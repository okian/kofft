import { test } from "node:test";
import assert from "node:assert";
import {
  magnitudeToDb,
  drawSpectrogram,
  initApp,
  ensureBuffer,
  startMic,
  stopMic,
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
    const buf2 = Buffer.from(new ArrayBuffer(1));
    assert.ok(buf2 instanceof Uint8Array);
  } finally {
    global.Buffer = original;
  }
});

test("startMic processes audio and stopMic stops", async () => {
  global.ImageData = class {
    constructor(data) {
      this.data = data;
    }
  };
  const ctx = {
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData(img) {
      this.last = img;
    },
  };
  const canvas = { width: 2, height: 512, getContext: () => ctx };
  let stopped = false;
  Object.defineProperty(global, "navigator", {
    value: {
      mediaDevices: {
        getUserMedia: () =>
          Promise.resolve({
            getTracks: () => [{ stop: () => (stopped = true) }],
          }),
      },
    },
    configurable: true,
  });
  const procRef = {};
  global.AudioContext = class {
    constructor() {
      this.destination = {};
    }
    createMediaStreamSource() {
      return { connect() {} };
    }
    createScriptProcessor() {
      procRef.node = { connect() {}, disconnect() {}, onaudioprocess: null };
      return procRef.node;
    }
    close() {
      this.closed = true;
    }
  };
  const ok = await startMic(canvas);
  assert.ok(ok);
  const samples = new Float32Array(1024).fill(1);
  procRef.node.onaudioprocess({
    inputBuffer: { getChannelData: () => samples },
  });
  assert.ok(ctx.last);
  stopMic();
  assert.ok(stopped);
});

test("startMic handles permission errors", async () => {
  Object.defineProperty(global, "navigator", {
    value: {
      mediaDevices: {
        getUserMedia: () => Promise.reject(new Error("denied")),
      },
    },
    configurable: true,
  });
  const ok = await startMic({ getContext: () => ({}) });
  assert.equal(ok, false);
});
