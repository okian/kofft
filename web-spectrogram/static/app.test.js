import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  decodeAndProcess,
  setupPlayback,
  startRenderLoop,
  init,
  palettes,
  parseID3v1,
  renderLegend,
} from "./app.js";
import { SeekBar } from "./seekbar.js";

test("decodeAndProcess decodes audio and invokes wasm", async () => {
  globalThis.window = {
    AudioContext: class {
      async decodeAudioData() {
        return {
          getChannelData: () => new Float32Array([0, 1, 0, -1]),
        };
      }
    },
    devicePixelRatio: 1,
  };
  const file = { arrayBuffer: async () => new ArrayBuffer(8) };
  let called = false;
  const wasm = {
    process_pcm: (pcm) => {
      called = pcm.length === 4;
      return new Float32Array([0.5, 0.25]);
    },
  };
  globalThis.URL = { createObjectURL: () => "blob:url" };
  const audio = { src: "" };
  const res = await decodeAndProcess(file, audio, wasm);
  assert.equal(audio.src, "blob:url");
  assert.ok(called);
  assert.deepEqual(res.amplitudes, [0.5, 0.25]);
});

test("SeekBar renders amplitudes", () => {
  const dom = new JSDOM(`<canvas width="4" height="2"></canvas>`);
  const canvas = dom.window.document.querySelector("canvas");
  const ops = [];
  canvas.getContext = () => ({
    clearRect: () => {},
    beginPath: () => {},
    moveTo: (...a) => ops.push(a),
    lineTo: (...a) => ops.push(a),
    stroke: () => {},
    strokeStyle: "",
    setTransform: () => {},
  });
  const seek = new SeekBar(canvas);
  seek.setAmplitudes([0, 1, 0, 1]);
  seek.setProgress(0, 10);
  assert.ok(ops.some((v) => v[0] === 1 && v[1] === 0));
});

test("setupPlayback syncs seek with audio", () => {
  const dom = new JSDOM(
    `<audio></audio><canvas id="seekbar" width="4" height="2"></canvas>`,
  );
  const audio = dom.window.document.querySelector("audio");
  const canvas = dom.window.document.getElementById("seekbar");
  const ops = [];
  canvas.getContext = () => ({
    clearRect: () => {},
    beginPath: () => ops.push("b"),
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => ops.push("s"),
    setTransform: () => {},
  });
  const seek = new SeekBar(canvas);
  seek.setAmplitudes([0, 1, 0, 1]);
  setupPlayback(audio, seek);
  Object.defineProperty(audio, "duration", { value: 10 });
  audio.currentTime = 5;
  audio.dispatchEvent(new dom.window.Event("timeupdate"));
  assert.ok(ops.length > 0); // draw called
  canvas.getBoundingClientRect = () => ({ left: 0, width: 4 });
  canvas.dispatchEvent(new dom.window.MouseEvent("click", { clientX: 1 }));
  assert.equal(audio.currentTime, 2.5);
});

test("startRenderLoop shifts left and draws vertical column", () => {
  const calls = { get: null, put: null, fills: [] };
  const ctx = {
    getImageData: (...args) => {
      calls.get = args;
      return { data: new Uint8ClampedArray(4) };
    },
    putImageData: (...args) => {
      calls.put = args;
    },
    fillStyle: "#000",
    fillRect: (...args) => calls.fills.push(args),
  };
  const canvas = { width: 2, height: 2, getContext: () => ctx };
  const analyser = {
    frequencyBinCount: 2,
    getByteFrequencyData: (arr) => arr.fill(1),
  };
  let rafCalled = false;
  globalThis.requestAnimationFrame = (cb) => {
    if (rafCalled) return;
    rafCalled = true;
    cb();
  };
  startRenderLoop(canvas, analyser);
  assert.deepEqual(calls.get, [1, 0, 1, 2]);
  assert.equal(calls.put[1], 0);
  assert.equal(calls.put[2], 0);
  assert.deepEqual(calls.fills, [
    [1, 0, 1, 1],
    [1, 1, 1, 1],
  ]);
});

test("log scale compresses high-frequency bins", () => {
  function makeCtx() {
    let style = "";
    const fills = [];
    return {
      ctx: {
        getImageData: () => ({ data: new Uint8ClampedArray(16) }),
        putImageData: () => {},
        set fillStyle(v) {
          style = v;
        },
        get fillStyle() {
          return style;
        },
        fillRect: (x, y) => fills.push({ y, style }),
      },
      fills,
    };
  }
  const analyser = {
    frequencyBinCount: 4,
    getByteFrequencyData: (arr) => {
      for (let i = 0; i < arr.length; i++) arr[i] = i;
    },
  };
  let rafCalled = false;
  globalThis.requestAnimationFrame = (cb) => {
    if (rafCalled) return;
    rafCalled = true;
    cb();
  };
  const { ctx: ctxLinear, fills: fillsLinear } = makeCtx();
  startRenderLoop(
    { width: 4, height: 4, getContext: () => ctxLinear },
    analyser,
    "linear",
  );
  rafCalled = false;
  const { ctx: ctxLog, fills: fillsLog } = makeCtx();
  startRenderLoop(
    { width: 4, height: 4, getContext: () => ctxLog },
    analyser,
    "logarithmic",
  );
  const extract = (fills) =>
    Number(fills.find((f) => f.y === 2).style.match(/rgb\((\d+)/)[1]);
  assert.ok(extract(fillsLog) < extract(fillsLinear));
});

test("different palettes yield different colors", () => {
  function run(palette) {
    const ctx = {
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: () => {},
      fillStyle: "",
      fillRect: () => {},
    };
    const canvas = { width: 1, height: 1, getContext: () => ctx };
    const analyser = {
      frequencyBinCount: 1,
      getByteFrequencyData: (arr) => arr.fill(128),
    };
    let rafCalled = false;
    globalThis.requestAnimationFrame = (cb) => {
      if (rafCalled) return;
      rafCalled = true;
      cb();
    };
    startRenderLoop(canvas, analyser, undefined, { current: palette });
    return ctx.fillStyle;
  }
  const colorA = run(() => "rgb(255,0,0)");
  const colorB = run(() => "rgb(0,255,0)");
  assert.notEqual(colorA, colorB);
});

test("init wires up file input change", async () => {
  const dom = new JSDOM(
    `<footer id="controls"><input type="file"><audio></audio><canvas id="seekbar" width="4" height="2"></canvas></footer><canvas id="spectrogram" width="10" height="10"></canvas>`,
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  dom.window.URL.createObjectURL = () => "blob:url";
  const file = { arrayBuffer: async () => new ArrayBuffer(8) };
  let setupCalled = 0;
  let renderCalled = 0;
  const deps = {
    decodeAndProcess: async () => ({
      ctx: {
        createMediaElementSource: () => ({ connect: () => {} }),
        createAnalyser: () => ({
          connect: () => {},
          frequencyBinCount: 2,
          getByteFrequencyData: () => {},
        }),
        destination: {},
        close: () => {},
      },
      amplitudes: [0],
    }),
    setupPlayback: () => {
      setupCalled++;
    },
    startRenderLoop: () => {
      renderCalled++;
    },
  };
  const seekCanvas = dom.window.document.getElementById("seekbar");
  seekCanvas.getContext = () => ({
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    setTransform: () => {},
  });
  init(dom.window.document, deps);
  assert.equal(setupCalled, 1);
  const input = dom.window.document.querySelector("input[type=file]");
  Object.defineProperty(input, "files", { value: [file] });
  input.dispatchEvent(new dom.window.Event("change"));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(renderCalled, 1);
});

test("init closes previous context and keeps seek in sync", async () => {
  const dom = new JSDOM(
    `<footer id="controls"><input type="file"><audio></audio><canvas id="seekbar" width="4" height="2"></canvas></footer><canvas id="spectrogram" width="10" height="10"></canvas>`,
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  dom.window.URL.createObjectURL = () => "blob:url";
  const files = [
    { arrayBuffer: async () => new ArrayBuffer(8) },
    { arrayBuffer: async () => new ArrayBuffer(8) },
  ];
  const closed = [];
  const mediaSources = [];
  const deps = {
    decodeAndProcess: async () => ({
      ctx: {
        createMediaElementSource: () => {
          mediaSources.push(true);
          return { connect: () => {} };
        },
        createAnalyser: () => ({
          connect: () => {},
          frequencyBinCount: 2,
          getByteFrequencyData: () => {},
        }),
        destination: {},
        close: () => {
          closed.push(true);
        },
      },
      amplitudes: [0],
    }),
    setupPlayback,
    startRenderLoop: () => {},
  };
  const seekCanvas = dom.window.document.getElementById("seekbar");
  seekCanvas.getContext = () => ({
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    setTransform: () => {},
  });
  init(dom.window.document, deps);
  const input = dom.window.document.querySelector("input[type=file]");
  Object.defineProperty(input, "files", {
    value: [files[0]],
    configurable: true,
  });
  input.dispatchEvent(new dom.window.Event("change"));
  await new Promise((r) => setTimeout(r, 0));
  Object.defineProperty(input, "files", {
    value: [files[1]],
    configurable: true,
  });
  input.dispatchEvent(new dom.window.Event("change"));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(mediaSources.length, 2);
  assert.equal(closed.length, 1);
  const audio = dom.window.document.querySelector("audio");
  const canvas = dom.window.document.getElementById("seekbar");
  Object.defineProperty(audio, "duration", { value: 10 });
  audio.currentTime = 4;
  audio.dispatchEvent(new dom.window.Event("timeupdate"));
  canvas.getBoundingClientRect = () => ({ left: 0, width: 4 });
  canvas.dispatchEvent(new dom.window.MouseEvent("click", { clientX: 1 }));
  assert.equal(audio.currentTime, 2.5);
});

test("theme buttons change spectrogram palette", async () => {
  const dom = new JSDOM(
    `<footer id="controls"><input type="file"><audio></audio><canvas id="seekbar" width="4" height="2"></canvas><div id="themes"><button data-theme="rainbow"></button><button data-theme="fire"></button></div></footer><canvas id="spectrogram"></canvas>`,
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  let usedPalette;
  const deps = {
    decodeAndProcess: async () => ({
      ctx: {
        createMediaElementSource: () => ({ connect: () => {} }),
        createAnalyser: () => ({
          connect: () => {},
          frequencyBinCount: 1,
          getByteFrequencyData: () => {},
        }),
        destination: {},
      },
      amplitudes: [0],
    }),
    setupPlayback: () => {},
    startRenderLoop: (_c, _a, _s, palette) => {
      usedPalette = palette;
    },
  };
  const seekCanvas = dom.window.document.getElementById("seekbar");
  seekCanvas.getContext = () => ({
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    setTransform: () => {},
  });
  init(dom.window.document, deps);
  const fireBtn = dom.window.document.querySelector(
    '#themes button[data-theme="fire"]',
  );
  fireBtn.dispatchEvent(new dom.window.Event("click"));
  const input = dom.window.document.querySelector("input[type=file]");
  Object.defineProperty(input, "files", { value: [{}], configurable: true });
  input.dispatchEvent(new dom.window.Event("change"));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(usedPalette.current(128), palettes.fire(128));
});

test("canvas resizes with window", () => {
  const dom = new JSDOM(
    `<footer id="controls"><input type="file"><audio></audio></footer><canvas id="spectrogram"></canvas>`,
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  dom.window.devicePixelRatio = 1;
  const canvas = dom.window.document.getElementById("spectrogram");
  Object.defineProperty(canvas, "clientWidth", {
    value: 100,
    configurable: true,
  });
  Object.defineProperty(canvas, "clientHeight", {
    value: 50,
    configurable: true,
  });
  init(dom.window.document, {
    decodeAndProcess: async () => ({}),
    setupPlayback: () => {},
    startRenderLoop: () => {},
  });
  assert.equal(canvas.width, 100);
  assert.equal(canvas.height, 50);
  Object.defineProperty(canvas, "clientWidth", {
    value: 200,
    configurable: true,
  });
  Object.defineProperty(canvas, "clientHeight", {
    value: 75,
    configurable: true,
  });
  dom.window.dispatchEvent(new dom.window.Event("resize"));
  assert.equal(canvas.width, 200);
  assert.equal(canvas.height, 75);
});

test("init handles missing seekbar on file selection", async () => {
  const dom = new JSDOM(
    `<footer id="controls"><input type="file"><audio></audio></footer><canvas id="spectrogram"></canvas>`,
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const events = [];
  const deps = {
    decodeAndProcess: async () => ({
      ctx: {
        createAnalyser: () => ({
          connect: () => {},
          frequencyBinCount: 1,
          getByteFrequencyData: () => {},
        }),
        createMediaElementSource: () => ({ connect: () => {} }),
        destination: {},
      },
      amplitudes: [0],
    }),
    setupPlayback: () => events.push("setup"),
    startRenderLoop: () => events.push("render"),
  };
  const input = dom.window.document.querySelector("input[type=file]");
  init(dom.window.document, deps);
  Object.defineProperty(input, "files", { value: [{}], configurable: true });
  input.dispatchEvent(new dom.window.Event("change"));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(events, ["render"]);
});

test("parseID3v1 extracts metadata", () => {
  const buf = new ArrayBuffer(128);
  const view = new Uint8Array(buf);
  const enc = new TextEncoder();
  view.set(enc.encode("TAG"), 0);
  view.set(enc.encode("Title"), 3);
  view.set(enc.encode("Artist"), 33);
  view.set(enc.encode("Album"), 63);
  view.set(enc.encode("1999"), 93);
  const meta = parseID3v1(buf);
  assert.equal(meta.title, "Title");
  assert.equal(meta.artist, "Artist");
  assert.equal(meta.album, "Album");
  assert.equal(meta.year, "1999");
});

test("renderLegend uses palette values", () => {
  const calls = [];
  const canvas = {
    width: 1,
    height: 2,
    getContext: () => ({ fillStyle: "", fillRect: () => {} }),
  };
  renderLegend(canvas, (v) => {
    calls.push(v);
    return "#000";
  });
  assert.deepEqual(calls, [255, 0]);
});

test("SeekBar resize adjusts canvas", () => {
  const dom = new JSDOM(`<canvas width="1" height="1"></canvas>`);
  dom.window.devicePixelRatio = 2;
  const canvas = dom.window.document.querySelector("canvas");
  Object.defineProperty(canvas, "clientWidth", {
    value: 10,
    configurable: true,
  });
  Object.defineProperty(canvas, "clientHeight", {
    value: 5,
    configurable: true,
  });
  canvas.getContext = () => ({
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    setTransform: () => {},
  });
  const seek = new SeekBar(canvas);
  seek.resize();
  assert.equal(canvas.width, 20);
  assert.equal(canvas.height, 10);
});

test("keyboard shortcuts control audio", () => {
  const dom = new JSDOM(
    `<footer id="controls"><input type="file"><audio></audio><button id="play"></button><button id="mute"></button><input id="volume" type="range"><canvas id="seekbar" width="4" height="2"></canvas><select id="scale"></select><div id="themes"><button data-theme="rainbow"></button></div></footer><div id="spectro-wrapper"><canvas id="spectrogram"></canvas><canvas id="legend" width="1" height="2"></canvas></div><section id="metadata"></section>`,
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  dom.window.devicePixelRatio = 1;
  const spectro = dom.window.document.getElementById("spectrogram");
  Object.defineProperty(spectro, "clientWidth", {
    value: 10,
    configurable: true,
  });
  Object.defineProperty(spectro, "clientHeight", {
    value: 10,
    configurable: true,
  });
  const legend = dom.window.document.getElementById("legend");
  legend.getContext = () => ({ fillStyle: "", fillRect: () => {} });
  const seekCanvas = dom.window.document.getElementById("seekbar");
  seekCanvas.getContext = () => ({
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    setTransform: () => {},
  });
  const audio = dom.window.document.querySelector("audio");
  Object.defineProperty(audio, "paused", { value: true, writable: true });
  audio.play = () => {
    audio.paused = false;
    audio.dispatchEvent(new dom.window.Event("play"));
  };
  audio.pause = () => {
    audio.paused = true;
    audio.dispatchEvent(new dom.window.Event("pause"));
  };
  audio.currentTime = 0;
  Object.defineProperty(audio, "duration", { value: 100 });
  init(dom.window.document, {
    decodeAndProcess: async () => ({
      ctx: {
        createMediaElementSource: () => ({ connect: () => {} }),
        createAnalyser: () => ({
          connect: () => {},
          frequencyBinCount: 1,
          getByteFrequencyData: () => {},
        }),
        destination: {},
      },
      amplitudes: [0],
      metadata: {},
    }),
    setupPlayback: () => {},
    startRenderLoop: () => {},
  });
  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: " " }));
  assert.equal(audio.paused, false);
  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: " " }));
  assert.equal(audio.paused, true);
  audio.volume = 0.5;
  document.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "ArrowUp" }),
  );
  assert.ok(audio.volume > 0.5);
  audio.currentTime = 50;
  document.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "ArrowLeft" }),
  );
  assert.equal(audio.currentTime, 40);
  audio.muted = false;
  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "m" }));
  assert.equal(audio.muted, true);
});
