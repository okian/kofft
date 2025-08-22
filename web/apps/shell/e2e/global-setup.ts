import { chromium, FullConfig } from '@playwright/test';

/**
 * Ensure the development server is reachable before tests execute.
 * The check fails fast so misconfigured environments surface quickly.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#root', { timeout: 10000 });
  } finally {
    await browser.close();
  }
}
