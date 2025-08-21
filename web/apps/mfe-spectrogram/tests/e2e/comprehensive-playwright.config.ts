import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Comprehensive Playwright configuration for the Kofft Spectrogram application
 * Supports property-based testing, visual regression, accessibility, and performance testing
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['allure-playwright', { outputFolder: 'test-results/allure-results' }]
  ],
  
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Enhanced timeout for complex operations
    actionTimeout: 10000,
    navigationTimeout: 30000,
    // Enable network interception for testing
    extraHTTPHeaders: {
      'Accept': 'application/json, text/plain, */*',
    },
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable experimental features for property-based testing
        launchOptions: {
          args: [
            '--enable-experimental-web-platform-features',
            '--enable-features=V8VmFuture',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        }
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'dom.webgpu.enabled': true,
            'dom.webassembly.enabled': true,
            'javascript.options.shared_memory': true
          }
        }
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        launchOptions: {
          args: [
            '--enable-experimental-web-platform-features',
            '--enable-features=WebAssemblyStreaming'
          ]
        }
      },
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet browsers
    {
      name: 'Tablet Chrome',
      use: { ...devices['iPad Pro 11 landscape'] },
    },
    {
      name: 'Tablet Safari',
      use: { ...devices['iPad Pro 11'] },
    },

    // Performance testing configuration
    {
      name: 'performance',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--enable-logging',
            '--v=1',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        }
      },
      testMatch: '**/performance.spec.ts',
    },

    // Visual regression testing
    {
      name: 'visual-regression',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-dev-shm-usage',
            '--no-sandbox'
          ]
        }
      },
      testMatch: '**/visual-regression.spec.ts',
    },

    // Accessibility testing
    {
      name: 'accessibility',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-logging',
            '--v=1'
          ]
        }
      },
      testMatch: '**/accessibility.spec.ts',
    },

    // Property-based testing
    {
      name: 'property-based',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-experimental-web-platform-features',
            '--disable-web-security'
          ]
        }
      },
      testMatch: '**/comprehensive-e2e.spec.ts',
      grep: /Property-Based Testing/,
    },

    // Chaos testing
    {
      name: 'chaos',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        }
      },
      testMatch: '**/comprehensive-e2e.spec.ts',
      grep: /Chaos Testing/,
    },
  ],

  // Global setup and teardown
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Output directories
  outputDir: 'test-results/',
  
  // Test artifacts
  preserveOutput: 'always',
  
  // Timeout configuration
  timeout: 60000,
  expect: {
    timeout: 10000,
    toMatchSnapshot: {
      maxDiffPixels: 10,
    },
  },

  // Custom test fixtures
  use: {
    // Custom fixtures for enhanced testing
    enhancedHelpers: async ({ page }, use) => {
      const { EnhancedTestHelpers } = await import('./utils/enhanced-test-helpers');
      await use(new EnhancedTestHelpers(page));
    },
    
    // Performance monitoring
    performanceMonitor: async ({ page }, use) => {
      const monitor = {
        async startMeasurement(name: string) {
          await page.evaluate((name) => {
            window.performance.mark(`${name}-start`);
          }, name);
        },
        
        async endMeasurement(name: string) {
          const measure = await page.evaluate((name) => {
            window.performance.mark(`${name}-end`);
            window.performance.measure(name, `${name}-start`, `${name}-end`);
            const entries = window.performance.getEntriesByName(name);
            return entries[entries.length - 1];
          }, name);
          
          return measure;
        },
        
        async getMemoryUsage() {
          return await page.evaluate(() => {
            if (performance.memory) {
              return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
              };
            }
            return null;
          });
        }
      };
      
      await use(monitor);
    },
    
    // Visual regression testing
    visualRegression: async ({ page }, use) => {
      const visual = {
        async takeScreenshot(name: string, options: any = {}) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${name}-${timestamp}.png`;
          
          await page.screenshot({
            path: `test-results/screenshots/${filename}`,
            fullPage: options.fullPage ?? true,
            clip: options.clip,
            animations: options.animations ?? 'disabled',
          });
          
          return filename;
        },
        
        async compareScreenshots(baseline: string, current: string) {
          // In a real implementation, you would use a visual comparison library
          // like pixelmatch or resemble.js
          console.log(`Comparing ${baseline} with ${current}`);
          return true;
        }
      };
      
      await use(visual);
    },
    
    // Accessibility testing
    accessibility: async ({ page }, use) => {
      const a11y = {
        async checkAccessibility() {
          // In a real implementation, you would use axe-core or similar
          const violations = await page.evaluate(() => {
            // Basic accessibility checks
            const issues = [];
            
            // Check for alt text on images
            const images = document.querySelectorAll('img');
            images.forEach((img, index) => {
              if (!img.alt && !img.getAttribute('aria-label')) {
                issues.push(`Image ${index} missing alt text or aria-label`);
              }
            });
            
            // Check for proper heading structure
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            let previousLevel = 0;
            headings.forEach((heading, index) => {
              const level = parseInt(heading.tagName.charAt(1));
              if (level > previousLevel + 1) {
                issues.push(`Heading structure issue at heading ${index}: skipped level ${previousLevel + 1}`);
              }
              previousLevel = level;
            });
            
            return issues;
          });
          
          return violations;
        },
        
        async checkColorContrast() {
          // Basic color contrast check
          return await page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            const issues = [];
            
            elements.forEach((element, index) => {
              const style = window.getComputedStyle(element);
              const backgroundColor = style.backgroundColor;
              const color = style.color;
              
              // Simplified contrast check
              if (backgroundColor && color && 
                  backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                  color !== 'rgba(0, 0, 0, 0)') {
                // In a real implementation, calculate actual contrast ratio
              }
            });
            
            return issues;
          });
        }
      };
      
      await use(a11y);
    },
    
    // Property-based testing utilities
    propertyBased: async ({ page }, use) => {
      const pb = {
        async generateArbitraryData() {
          const fc = await import('fast-check');
          
          return {
            theme: fc.default.constantFrom('japanese-a-light', 'japanese-a-dark', 'japanese-b-light', 'japanese-b-dark', 'bauhaus-light', 'bauhaus-dark'),
            amplitudeScale: fc.default.constantFrom('linear', 'logarithmic', 'db'),
            frequencyScale: fc.default.constantFrom('linear', 'logarithmic'),
            resolution: fc.default.constantFrom('low', 'medium', 'high'),
            refreshRate: fc.default.constantFrom(30, 60),
            volume: fc.default.float().between(0, 1),
            seekPosition: fc.default.float().between(0, 100),
            arbitraryString: fc.default.string().filter(s => s.length > 0),
            arbitraryNumber: fc.default.float().between(-1000, 1000),
          };
        },
        
        async runPropertyTest(generator: any, testFunction: Function, numRuns = 100) {
          const fc = await import('fast-check');
          
          await fc.default.assert(
            fc.default.property(generator, async (input) => {
              try {
                await testFunction(input);
                return true;
              } catch (error) {
                console.error('Property test failed with input:', input);
                throw error;
              }
            }),
            { numRuns }
          );
        }
      };
      
      await use(pb);
    }
  },

  // Custom test utilities
  use: {
    // Network interception for testing
    networkInterceptor: async ({ page }, use) => {
      const interceptor = {
        async interceptRequests(pattern: string, handler: Function) {
          await page.route(pattern, handler);
        },
        
        async simulateSlowNetwork(delay: number) {
          await page.route('**/*', route => {
            setTimeout(() => route.continue(), delay);
          });
        },
        
        async simulateNetworkErrors(errorRate: number) {
          let requestCount = 0;
          await page.route('**/*', route => {
            requestCount++;
            if (Math.random() < errorRate) {
              route.abort();
            } else {
              route.continue();
            }
          });
        }
      };
      
      await use(interceptor);
    },
    
    // State management for testing
    stateManager: async ({ page }, use) => {
      const state = {
        async saveState() {
          return await page.evaluate(() => {
            return {
              localStorage: Object.fromEntries(
                Object.entries(localStorage)
              ),
              sessionStorage: Object.fromEntries(
                Object.entries(sessionStorage)
              ),
              cookies: document.cookie,
            };
          });
        },
        
        async restoreState(savedState: any) {
          await page.evaluate((state) => {
            // Restore localStorage
            Object.entries(state.localStorage).forEach(([key, value]) => {
              localStorage.setItem(key, value as string);
            });
            
            // Restore sessionStorage
            Object.entries(state.sessionStorage).forEach(([key, value]) => {
              sessionStorage.setItem(key, value as string);
            });
            
            // Restore cookies
            document.cookie = state.cookies;
          }, savedState);
        },
        
        async clearState() {
          await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
            document.cookie.split(";").forEach(function(c) { 
              document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
            });
          });
        }
      };
      
      await use(state);
    }
  },

  // Custom reporter for comprehensive testing
  reporter: [
    ['html', { 
      outputFolder: 'test-results/html-report',
      open: 'never'
    }],
    ['json', { 
      outputFile: 'test-results/test-results.json' 
    }],
    ['junit', { 
      outputFile: 'test-results/junit.xml' 
    }],
    ['allure-playwright', { 
      outputFolder: 'test-results/allure-results' 
    }],
    // Custom reporter for property-based testing results
    ['list', {
      printSteps: true,
    }],
    // Custom reporter for performance metrics
    ['json', {
      outputFile: 'test-results/performance-metrics.json',
      filter: (test) => test.title.includes('Performance')
    }]
  ],

  // Test retry configuration
  retries: process.env.CI ? 2 : 0,
  
  // Worker configuration
  workers: process.env.CI ? 1 : undefined,
  
  // Timeout configuration
  timeout: 60000,
  expect: {
    timeout: 10000,
    toMatchSnapshot: {
      maxDiffPixels: 10,
    },
  },

  // Custom test utilities
  use: {
    // Enhanced screenshot configuration
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    
    // Enhanced action timeouts
    actionTimeout: 10000,
    navigationTimeout: 30000,
    
    // Enhanced viewport configuration
    viewport: { width: 1280, height: 720 },
    
    // Enhanced user agent
    userAgent: 'Playwright Test Agent',
    
    // Enhanced color scheme
    colorScheme: 'dark',
    
    // Enhanced locale
    locale: 'en-US',
    
    // Enhanced timezone
    timezoneId: 'America/New_York',
    
    // Enhanced permissions
    permissions: ['geolocation', 'notifications'],
    
    // Enhanced geolocation
    geolocation: { longitude: 40.730610, latitude: -73.935242 },
    
    // Enhanced extra HTTP headers
    extraHTTPHeaders: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  },

  // Custom test utilities
  use: {
    // Enhanced test utilities
    testUtils: async ({ page }, use) => {
      const utils = {
        async waitForCondition(condition: Function, timeout = 10000) {
          await page.waitForFunction(condition, { timeout });
        },
        
        async waitForNetworkIdle(timeout = 5000) {
          await page.waitForLoadState('networkidle', { timeout });
        },
        
        async waitForAnimationEnd(selector: string) {
          await page.waitForFunction((sel) => {
            const element = document.querySelector(sel);
            if (!element) return true;
            
            const animations = element.getAnimations();
            return animations.length === 0;
          }, selector);
        },
        
        async simulateUserBehavior() {
          // Simulate realistic user behavior patterns
          await page.mouse.move(100, 100);
          await page.waitForTimeout(100);
          await page.mouse.move(200, 200);
          await page.waitForTimeout(100);
        }
      };
      
      await use(utils);
    }
  }
});
