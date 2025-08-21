"use strict";

/**
 * Port where the development server listens. Keeping it centralised avoids
 * scattershot magic numbers and ensures tests and the server agree on the
 * communication endpoint.
 */
const DEV_SERVER_PORT = 8000;

/** Host used for local networking checks. */
const DEV_SERVER_HOST = "127.0.0.1";

/** Maximum time to wait for the development server to become reachable in ms. */
const SERVER_READY_TIMEOUT_MS = 60_000;

/** Interval between readiness probes in ms to avoid hammering the system. */
const SERVER_READY_INTERVAL_MS = 250;

const { spawn } = require("child_process");
const net = require("net");

/**
 * Poll for a TCP port to accept connections, failing if the timeout elapses.
 *
 * @param {object} opts - Configuration options.
 * @param {number} [opts.port=DEV_SERVER_PORT] - Port to probe.
 * @param {string} [opts.host=DEV_SERVER_HOST] - Hostname for the port.
 * @param {number} [opts.timeoutMs=SERVER_READY_TIMEOUT_MS] - How long to wait.
 * @param {number} [opts.intervalMs=SERVER_READY_INTERVAL_MS] - Delay between probes.
 * @returns {Promise<void>} Resolves when the port responds, rejects on timeout.
 */
function waitForPort({
  port = DEV_SERVER_PORT,
  host = DEV_SERVER_HOST,
  timeoutMs = SERVER_READY_TIMEOUT_MS,
  intervalMs = SERVER_READY_INTERVAL_MS,
} = {}) {
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("Invalid port number");
  }
  if (typeof host !== "string" || host.length === 0) {
    throw new Error("Host must be a non-empty string");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive integer");
  }
  if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
    throw new Error("intervalMs must be a positive integer");
  }

  return new Promise((resolve, reject) => {
    const start = Date.now();
    /** Attempt to open a socket to the target. */
    const attempt = () => {
      const socket = net.connect({ port, host });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - start >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, intervalMs);
      });
    };
    attempt();
  });
}

/**
 * Start the development server, wait for it to respond, then run a test command.
 * The development server process is terminated when the test command exits.
 *
 * @param {object} opts - Configuration options.
 * @param {string} opts.command - Shell command to execute for tests.
 * @param {number} [opts.port] - Port to await.
 * @param {string} [opts.host]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.intervalMs]
 * @returns {Promise<void>} Resolves when tests succeed, rejects on failure.
 */
async function runWithDevServer({
  command,
  port = DEV_SERVER_PORT,
  host = DEV_SERVER_HOST,
  timeoutMs = SERVER_READY_TIMEOUT_MS,
  intervalMs = SERVER_READY_INTERVAL_MS,
}) {
  if (typeof command !== "string" || command.trim().length === 0) {
    throw new Error("command must be a non-empty string");
  }

  const devProc = spawn("npm", ["run", "dev"], { stdio: "inherit" });
  const terminate = () => devProc.kill();
  process.on("SIGINT", terminate);
  process.on("SIGTERM", terminate);

  try {
    await waitForPort({ port, host, timeoutMs, intervalMs });
    await new Promise((resolve, reject) => {
      const testProc = spawn(command, { stdio: "inherit", shell: true });
      testProc.on("exit", (code) => {
        code === 0
          ? resolve()
          : reject(new Error(`Test command failed with exit code ${code}`));
      });
    });
  } finally {
    terminate();
    process.off("SIGINT", terminate);
    process.off("SIGTERM", terminate);
  }
}

module.exports = {
  DEV_SERVER_PORT,
  DEV_SERVER_HOST,
  SERVER_READY_TIMEOUT_MS,
  SERVER_READY_INTERVAL_MS,
  waitForPort,
  runWithDevServer,
};
