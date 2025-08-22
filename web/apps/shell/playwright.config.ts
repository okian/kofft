import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the shell application.
 * Mirrors the spectrogram setup while adjusting the base URL
 * and test directory for this app.
 */
export default defineConfig({
  /** Directory containing end-to-end tests. */
  testDir: './e2e',
  /** Execute tests in parallel to reduce runtime. */
  fullyParallel: true,
  /** Prevent accidental commit of focused tests. */
  forbidOnly: !!process.env.CI,
  /** Retry failing tests on CI for increased stability. */
  retries: process.env.CI ? 2 : 0,
  /** Disable parallel workers on CI to limit resource usage. */
  workers: process.env.CI ? 1 : undefined,
  /** Reporters used to generate various test artifacts. */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['allure-playwright', { outputFolder: 'test-results/allure-results' }]
  ],
  /** Shared context configuration for all tests. */
  use: {
    /** Base URL used by `page.goto('/')`. */
    baseURL: 'http://localhost:5173',
    /** Enable tracing on first retry to aid debugging. */
    trace: 'on-first-retry',
    /** Capture screenshots only on failure. */
    screenshot: 'only-on-failure',
    /** Record video artifacts when tests fail. */
    video: 'retain-on-failure',
    /** Timeout for individual user actions. */
    actionTimeout: 10000,
    /** Timeout for page navigation events. */
    navigationTimeout: 30000,
  },
  /** Browsers and devices under test. */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    // System-installed browsers such as Edge and Chrome are omitted to
    // avoid dependence on external installations in test environments.
  ],
  /** Start the development server before running tests. */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  /** Global lifecycle hooks for setup and teardown. */
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  /** Directory for artifacts produced during test runs. */
  outputDir: 'test-results/',
  /** Maximum allowed time for the entire test run. */
  timeout: 300000,
  /** Expectation timeout for each assertion. */
  expect: {
    timeout: 10000,
  },
  /** Metadata included in generated reports. */
  metadata: {
    name: 'Kofft Shell E2E Tests',
    description: 'End-to-end tests for the Kofft Shell application',
    version: '1.0.0',
  },
});
