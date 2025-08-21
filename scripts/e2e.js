"use strict";

const { runWithDevServer } = require("./e2e-helper");

/**
 * Start the development server and execute the Puppeteer smoke test.
 */
async function main() {
  await runWithDevServer({ command: "node scripts/e2e-test.js" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
