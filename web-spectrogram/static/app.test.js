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
    `<input type="file"><audio></audio><input type="range"><canvas id="spectrogram" width="10" height="10"></canvas>`,
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  dom.window.URL.createObjectURL = () => "blob:url";
  const file = { arrayBuffer: async () => new ArrayBuffer(8) };
  let setupCalled = false;
  let renderCalled = false;
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
    setupPlayback: () => {
      setupCalled = true;
    },
    startRenderLoop: () => {
      renderCalled = true;
    },
  };
  init(dom.window.document, deps);
  const input = dom.window.document.querySelector("input[type=file]");
  Object.defineProperty(input, "files", { value: [file] });
  input.dispatchEvent(new dom.window.Event("change"));
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(setupCalled && renderCalled);
});
