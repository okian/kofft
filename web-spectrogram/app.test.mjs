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
});
