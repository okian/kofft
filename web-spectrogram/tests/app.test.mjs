import { test } from "node:test";
import assert from "node:assert";
import {
  magnitudeToDb,
  drawSpectrogram,
  initApp,
  ensureBuffer,
} from "../app.mjs";

test("magnitudeToDb converts correctly", () => {
  const db = magnitudeToDb(1, 1);
  assert(Math.abs(db) < 1e-6);
});

test("drawSpectrogram writes pixels", () => {
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img) {
      this.last = img;
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return ctx;
    },
  };
  const res = { mags: [1, 1], width: 1, height: 2, max_mag: 1 };
  const colorFn = () => [1, 2, 3];
  drawSpectrogram(canvas, res, colorFn, 0);
  assert.equal(ctx.last.data[0], 1);
  assert.equal(ctx.last.data[1], 2);
  assert.equal(ctx.last.data[2], 3);
});

test("initApp loads and processes file", async () => {
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img) {
      this.last = img;
    },
  };
  const canvas = { getContext: () => ctx };
  const listeners = {};
  global.document = {
    getElementById(id) {
      if (id === "file") {
        return {
          addEventListener: (ev, cb) => {
            listeners[ev] = cb;
          },
        };
      }
      if (id === "spec") {
        return canvas;
      }
    },
  };
  global.AudioContext = class {
    decodeAudioData() {
      return Promise.resolve({
        getChannelData: () => new Float32Array([1, 1]),
      });
    }
  };
  await initApp();
  await listeners["change"]({
    target: {
      files: [{ name: "x", arrayBuffer: async () => new ArrayBuffer(0) }],
    },
  });
  assert.ok(ctx.last);
});

test("polyfills Buffer when missing", async () => {
  const original = global.Buffer;
  try {
    // Simulate browser environment without Buffer
    // eslint-disable-next-line no-global-assign
    global.Buffer = undefined;
    ensureBuffer();
    assert.ok(global.Buffer);
    const buf = Buffer.from([1, 2, 3]);
    assert.ok(buf instanceof Uint8Array);
  } finally {
    global.Buffer = original;
  }
});
