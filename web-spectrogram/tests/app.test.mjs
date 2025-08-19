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

test("drawSpectrogram writes pixels via canvas fallback", () => {
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img) {
      this.last = img;
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext(type) {
      if (type === "2d") return ctx;
      return null;
    },
  };
  const res = { mags: [1, 1], width: 1, height: 2, max_mag: 1 };
  const colorFn = () => [1, 2, 3];
  drawSpectrogram(canvas, res, colorFn, 0);
  assert.equal(ctx.last.data[0], 1);
  assert.equal(ctx.last.data[1], 2);
  assert.equal(ctx.last.data[2], 3);
});

test("drawSpectrogram uses WebGL when available", () => {
  const calls = [];
  const gl = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    TRIANGLE_STRIP: 0x0005,
    TEXTURE_2D: 0x0de1,
    TEXTURE0: 0x84c0,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    NEAREST: 0x2600,
    RED: 0x1903,
    createShader() {
      return {};
    },
    shaderSource() {},
    compileShader() {},
    createProgram() {
      return {};
    },
    attachShader() {},
    linkProgram() {},
    useProgram() {},
    createBuffer() {
      return {};
    },
    bindBuffer() {},
    bufferData() {},
    getAttribLocation() {
      return 0;
    },
    enableVertexAttribArray() {},
    vertexAttribPointer() {},
    createTexture() {
      return {};
    },
    activeTexture() {},
    bindTexture() {},
    texParameteri() {},
    texImage2D() {},
    getUniformLocation() {
      return {};
    },
    uniform1f() {},
    uniform1i() {},
    viewport() {},
    drawArrays() {
      calls.push("draw");
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext(type) {
      if (type === "webgl2" || type === "webgl") return gl;
      return null;
    },
  };
  const res = { mags: [1], width: 1, height: 1, max_mag: 1 };
  drawSpectrogram(canvas, res, () => [0, 0, 0], 0);
  assert.deepEqual(calls, ["draw"]);
});

test("initApp loads and processes file", async () => {
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img) {
      this.last = img;
    },
  };
  const canvas = {
    getContext(type) {
      if (type === "2d") return ctx;
      return null;
    },
  };
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
