#!/usr/bin/env node
"use strict";

// Directory where the WebAssembly crate resides.
const WASM_CRATE_DIR = require("path").join(
  __dirname,
  "..",
  "web",
  "apps",
  "mfe-spectrogram",
  "src",
  "wasm",
);
// Directory containing the React workspace.
const WEB_DIR = require("path").join(__dirname, "..", "web");
// Shared constants for development tooling.
const { DEV_SERVER_PORT } = require("./e2e-helper");
// Synchronous process execution to invoke shell commands deterministically.
const { execSync } = require("child_process");

/**
 * Ensure a required CLI tool exists in the PATH.
 * Exits early with a clear error message if the tool is missing.
 * @param {string} tool - Executable name to check for.
 */
function ensureTool(tool) {
  try {
    execSync(`command -v ${tool}`, { stdio: "ignore" });
  } catch {
    console.error(`Missing required tool: ${tool}`);
    process.exit(1);
  }
}

/**
 * Run a shell command, streaming output and failing fast on errors.
 * @param {string} cmd - Command line to execute.
 */
function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

/**
 * Remove build artifacts and caches to ensure reproducible builds.
 */
function clean() {
  run("npm cache clean --force");
  run("cargo clean");
  const pkgDir = require("path").join(WASM_CRATE_DIR, "pkg");
  require("fs").rmSync(pkgDir, { recursive: true, force: true });
}

/**
 * Compile the Rust WebAssembly crate using wasm-pack.
 */
function buildWasm() {
  run(`wasm-pack build ${WASM_CRATE_DIR} --release --target web`);
}

/**
 * Build the React workspace that consumes the generated WebAssembly package.
 */
function buildWeb() {
  run(`npm --prefix ${WEB_DIR} install`);
  run(`npm --prefix ${WEB_DIR} run build`);
}

/**
 * Serve the compiled web assets for local development.
 */
function serve() {
  // Explicitly bind to the development port so automated tests know where to connect.
  run(
    `npx --yes serve -l ${DEV_SERVER_PORT} ${require("path").join(
      WEB_DIR,
      "dist",
    )}`,
  );
}

/**
 * Orchestrate the clean build and serve workflow.
 */
function main() {
  ensureTool("cargo");
  ensureTool("wasm-pack");
  ensureTool("npm");
  ensureTool("npx");
  clean();
  buildWasm();
  buildWeb();
  serve();
}

main();
