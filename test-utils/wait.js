/**
 * @fileoverview Deterministic wait helpers for Puppeteer tests.
 * Replaces arbitrary timeouts with explicit conditions to reduce flakiness
 * and improve test performance.
 */

/**
 * Default timeout in milliseconds for waiting on conditions.
 * Using a named constant avoids magic numbers and provides a
 * single tuning point for slower environments.
 */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Default network idle threshold in milliseconds. Puppeteer considers the
 * network idle when there are no in-flight requests for at least this time.
 */
const DEFAULT_IDLE_MS = 500;

/**
 * Waits for a DOM element matching the provided selector to appear.
 * This ensures that the element is present before interacting with it.
 *
 * @param {import('puppeteer').Page} page - Active Puppeteer page instance.
 * @param {string} selector - CSS selector of the element to wait for.
 * @param {number} [timeoutMs=DEFAULT_TIMEOUT_MS] - Maximum time to wait.
 * @returns {Promise<void>} Resolves when the element appears or rejects on timeout.
 */
async function waitForElement(page, selector, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!page) throw new Error("waitForElement requires a valid Puppeteer page.");
  if (typeof selector !== "string" || selector.length === 0) {
    throw new Error("waitForElement requires a non-empty selector string.");
  }
  await page.waitForSelector(selector, { timeout: timeoutMs });
}

/**
 * Waits for a JavaScript condition within the page context to evaluate to true.
 * Useful for waiting on dynamic state changes such as class toggles or
 * computed style updates.
 *
 * @param {import('puppeteer').Page} page - Active Puppeteer page instance.
 * @param {Function} condition - Function executed in the browser; should return a boolean.
 * @param {number} [timeoutMs=DEFAULT_TIMEOUT_MS] - Maximum time to wait.
 * @returns {Promise<void>} Resolves when condition is met or rejects on timeout.
 */
async function waitForCondition(
  page,
  condition,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  if (!page)
    throw new Error("waitForCondition requires a valid Puppeteer page.");
  if (typeof condition !== "function") {
    throw new Error("waitForCondition requires a condition function.");
  }
  await page.waitForFunction(condition, { timeout: timeoutMs });
}

/**
 * Waits for the browser network to become idle, indicating that all
 * outstanding requests have completed. This is safer than fixed delays
 * when actions trigger asynchronous network activity.
 *
 * @param {import('puppeteer').Page} page - Active Puppeteer page instance.
 * @param {number} [timeoutMs=DEFAULT_TIMEOUT_MS] - Maximum time to wait.
 * @param {number} [idleMs=DEFAULT_IDLE_MS] - Required idle period in milliseconds.
 * @returns {Promise<void>} Resolves when network is idle or rejects on timeout.
 */
async function waitForNetworkIdle(
  page,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  idleMs = DEFAULT_IDLE_MS,
) {
  if (!page)
    throw new Error("waitForNetworkIdle requires a valid Puppeteer page.");
  await page.waitForNetworkIdle({ timeout: timeoutMs, idleTime: idleMs });
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_IDLE_MS,
  waitForElement,
  waitForCondition,
  waitForNetworkIdle,
};
