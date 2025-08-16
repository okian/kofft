import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  decodeAndProcess,
  setupPlayback,
  startRenderLoop,
  init,
} from "./app.js";

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
    },
  };
  globalThis.URL = { createObjectURL: () => "blob:url" };
  const audio = { src: "" };
  await decodeAndProcess(file, audio, wasm);
  assert.equal(audio.src, "blob:url");
  assert.ok(called);
});

test("setupPlayback syncs seek with audio", () => {
  const dom = new JSDOM(`<audio></audio><input type="range">`);
  const audio = dom.window.document.querySelector("audio");
  const seek = dom.window.document.querySelector("input");
  audio.currentTime = 0;
  setupPlayback(audio, seek);
  Object.defineProperty(audio, "duration", { value: 10 });
  audio.currentTime = 5;
  audio.dispatchEvent(new dom.window.Event("timeupdate"));
  assert.equal(seek.value, "5");
  seek.value = "2";
  seek.dispatchEvent(new dom.window.Event("input"));
  assert.equal(audio.currentTime, 2);
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

test("init wires up file input change", async () => {
  const dom = new JSDOM(
    `<input type="file"><audio></audio><input type="range"><canvas id="spectrogram" width="10" height="10"></canvas><select id="theme"><option value="dark">dark</option><option value="light">light</option></select>`,
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
    }),
    setupPlayback: () => {
      setupCalled++;
    },
    startRenderLoop: () => {
      renderCalled++;
    },
  };
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
    `<input type="file"><audio></audio><input type="range"><canvas id="spectrogram" width="10" height="10"></canvas>`,
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
    }),
    setupPlayback,
    startRenderLoop: () => {},
  };
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
  const seek = dom.window.document.querySelector("input[type=range]");
  Object.defineProperty(audio, "duration", { value: 10 });
  audio.currentTime = 4;
  audio.dispatchEvent(new dom.window.Event("timeupdate"));
  assert.equal(seek.value, "4");
  seek.value = "2";
  seek.dispatchEvent(new dom.window.Event("input"));
  assert.equal(audio.currentTime, 2);
});

test("theme selector updates body dataset", () => {
  const dom = new JSDOM(
    `<input type="file"><audio></audio><input type="range"><canvas id="spectrogram"></canvas><select id="theme"><option value="dark">dark</option><option value="light">light</option></select>`,
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const deps = {
    decodeAndProcess: async () => ({
      ctx: {
        createBufferSource: () => ({
          buffer: null,
          connect: () => {},
          start: () => {},
        }),
        createAnalyser: () => ({
          connect: () => {},
          frequencyBinCount: 2,
          getByteFrequencyData: () => {},
        }),
        destination: {},
      },
      audioBuffer: {},
    }),
    setupPlayback: () => {},
    startRenderLoop: () => {},
  };
  init(dom.window.document, deps);
  const select = dom.window.document.getElementById("theme");
  select.value = "light";
  select.dispatchEvent(new dom.window.Event("change"));
  assert.equal(dom.window.document.body.dataset.theme, "light");
});
