import assert from "node:assert/strict";

async function run() {
  const originalSAB = globalThis.SharedArrayBuffer;
  const originalWindow = globalThis.window;
  globalThis.window = {};
  globalThis.SharedArrayBuffer = undefined;
  globalThis.crossOriginIsolated = false;

  const { initWasmWithThreadPool } = await import("./app.mjs");
  let result = await initWasmWithThreadPool(
    async () => {},
    async () => {},
  );
  assert.equal(result, false);

  globalThis.SharedArrayBuffer = class {};
  globalThis.crossOriginIsolated = true;
  let initCalled = 0;
  let poolCalled = 0;
  result = await initWasmWithThreadPool(
    async () => {
      initCalled++;
    },
    async () => {
      poolCalled++;
    },
  );
  assert.equal(result, true);
  assert.equal(initCalled, 1);
  assert.equal(poolCalled, 1);

  globalThis.SharedArrayBuffer = originalSAB;
  globalThis.window = originalWindow;
  console.log("app.mjs tests passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
import test from "node:test";
import assert from "node:assert/strict";
import { SpectrogramApp } from "./app.mjs";

globalThis.ImageData = class {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

test("start, process audio, and stop", async () => {
  let getUserMediaCalled = false;
  const fakeTrack = { stop: () => (fakeTrack.stopped = true) };
  const stream = { getTracks: () => [fakeTrack] };
  const navigator = {
    mediaDevices: {
      getUserMedia: async () => {
        getUserMediaCalled = true;
        return stream;
      },
    },
  };

  const source = {
    connect: (node) => {
      source.connected = node;
    },
    disconnect: () => {
      source.disconnected = true;
    },
  };

  const processor = {
    connect: () => {
      processor.connected = true;
    },
    disconnect: () => {
      processor.disconnected = true;
    },
    onaudioprocess: null,
  };

  const audioContext = {
    createMediaStreamSource: () => source,
    createScriptProcessor: () => processor,
    destination: {},
  };

  const calls = [];
  const canvas = {
    width: 2,
    height: 1,
    getContext: () => ({
      drawImage: () => calls.push("draw"),
      putImageData: () => calls.push("put"),
    }),
  };

  let callCount = 0;
  const computeFrame = (input) => {
    assert.equal(input.length, 4);
    callCount++;
    return callCount === 1 ? [] : [0, 0, 0, 255, 0, 0, 0, 255];
  };

  const app = new SpectrogramApp({
    canvas,
    computeFrame,
    audioContext,
    navigator,
  });
  await app.start();
  assert.ok(getUserMediaCalled);
  const floatData = new Float32Array([0, 0, 0, 0]);
  processor.onaudioprocess({
    inputBuffer: { getChannelData: () => floatData },
  });
  assert.deepEqual(calls, []);
  processor.onaudioprocess({
    inputBuffer: { getChannelData: () => floatData },
  });
  assert.deepEqual(calls, ["draw", "put"]);
  app.stop();
  assert.ok(processor.disconnected);
  assert.ok(source.disconnected);
  assert.ok(fakeTrack.stopped);
});

test("permission error triggers handler", async () => {
  const navigator = {
    mediaDevices: {
      getUserMedia: async () => {
        throw new Error("denied");
      },
    },
  };
  const canvas = { width: 1, height: 1, getContext: () => ({}) };
  let error;
  const app = new SpectrogramApp({ canvas, computeFrame: () => [], navigator });
  app.onError = (e) => {
    error = e;
  };
  await app.start();
  assert.ok(error instanceof Error);
});
