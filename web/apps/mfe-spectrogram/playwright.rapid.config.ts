import { defineConfig, devices } from '@playwright/test';

/**
 * Rapid test configuration for quick feedback
 * Runs only on Chromium with minimal test coverage
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* No retries for rapid testing */
  retries: 0,
  /* Use multiple workers for speed */
  workers: 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/rapid-results.json' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5175',

    /* No trace for rapid testing */
    trace: 'off',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* No video for rapid testing */
    video: 'off',

    /* Shorter timeouts for rapid testing */
    actionTimeout: 5000,
    navigationTimeout: 15000,
  },

  /* Configure projects for rapid testing - only Chromium */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000, // Shorter timeout
  },

  /* Global setup and teardown */
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  /* Test output directory */
  outputDir: 'test-results/',

  /* Shorter timeout for rapid testing */
  timeout: 120000,

  /* Expect timeout for each test */
  expect: {
    timeout: 5000, // Shorter timeout
  },

  /* Metadata for test reports */
  metadata: {
    name: 'Kofft Spectrogram Rapid E2E Tests',
    description: 'Rapid end-to-end tests for quick feedback',
    version: '1.0.0',
  },
});
