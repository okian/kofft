"use strict";

const puppeteer = require("puppeteer");
const { DEV_SERVER_PORT, DEV_SERVER_HOST } = require("./e2e-helper");

/** Base URL for the local development server. */
const BASE_URL = `http://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}`;

/** Selector that indicates the PWA has bootstrapped. */
const APP_ROOT_SELECTOR = "#app";

/** Timeout in ms to wait for the PWA root element to appear. */
const APP_ROOT_TIMEOUT_MS = 10_000;

/** Launch options for Puppeteer to ensure compatibility with CI environments. */
const LAUNCH_OPTIONS = {
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
};

/**
 * Minimal smoke test to verify the PWA loads.
 */
async function run() {
  const browser = await puppeteer.launch(LAUNCH_OPTIONS);
  try {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(APP_ROOT_SELECTOR, {
      timeout: APP_ROOT_TIMEOUT_MS,
    });
    console.log("PWA loaded successfully");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
