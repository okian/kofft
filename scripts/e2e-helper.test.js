"use strict";

const assert = require("assert");
const http = require("http");
const { waitForPort } = require("./e2e-helper");

/**
 * Exercise waitForPort success path by starting a disposable HTTP server.
 */
async function testWaitForPortSuccess() {
  const server = http.createServer((_, res) => res.end("ok"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await waitForPort({
    port,
    host: "127.0.0.1",
    timeoutMs: 500,
    intervalMs: 50,
  });
  server.close();
}

/**
 * Ensure waitForPort rejects when the port stays closed.
 */
async function testWaitForPortTimeout() {
  let caught = false;
  try {
    await waitForPort({
      port: 9_999,
      host: "127.0.0.1",
      timeoutMs: 200,
      intervalMs: 50,
    });
  } catch {
    caught = true;
  }
  assert.ok(caught, "expected timeout to throw");
}

/**
 * Verify input validation guards.
 */
function testInputValidation() {
  assert.throws(() => waitForPort({ port: -1 }), /Invalid port/);
  assert.throws(() => waitForPort({ host: "" }), /non-empty string/);
  assert.throws(() => waitForPort({ timeoutMs: 0 }), /positive integer/);
  assert.throws(() => waitForPort({ intervalMs: 0 }), /positive integer/);
}

(async () => {
  await testWaitForPortSuccess();
  await testWaitForPortTimeout();
  testInputValidation();
})();
