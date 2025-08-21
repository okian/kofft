import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Cross-Browser Compatibility Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
  });

  test.describe('Browser-Specific Features', () => {
    test('should handle WebAssembly loading across browsers', async ({ page }) => {
      // Wait for WebAssembly to be available
      await page.waitForFunction(() => {
        return window.wasmModule !== undefined || 
               document.querySelector('[data-testid="spectrogram-canvas"]') !== null;
      }, { timeout: 15000 });
      
      // Verify WebAssembly functionality
      const canvas = page.locator('[data-testid="spectrogram-canvas"]');
      await expect(canvas).toBeVisible();
      
      // Test basic WebAssembly operations
      const wasmAvailable = await page.evaluate(() => {
        return typeof WebAssembly !== 'undefined' && 
               window.wasmModule !== undefined;
      });
      
      expect(wasmAvailable).toBe(true);
    });

    test('should handle audio context across browsers', async ({ page }) => {
      // Test AudioContext creation
      const audioContextSupported = await page.evaluate(() => {
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          return typeof AudioContext !== 'undefined';
        } catch (e) {
          return false;
        }
      });
      
      expect(audioContextSupported).toBe(true);
    });

    test('should handle canvas API across browsers', async ({ page }) => {
      // Test Canvas API support
      const canvasSupported = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        return ctx !== null;
      });
      
      expect(canvasSupported).toBe(true);
    });

    test('should handle file API across browsers', async ({ page }) => {
      // Test File API support
      const fileAPISupported = await page.evaluate(() => {
        return typeof File !== 'undefined' && 
               typeof FileReader !== 'undefined' &&
               typeof FileList !== 'undefined';
      });
      
      expect(fileAPISupported).toBe(true);
    });
  });

  test.describe('CSS Compatibility', () => {
    test('should handle CSS Grid across browsers', async ({ page }) => {
      // Test CSS Grid support
      const gridSupported = await page.evaluate(() => {
        const element = document.createElement('div');
        element.style.display = 'grid';
        return element.style.display === 'grid';
      });
      
      expect(gridSupported).toBe(true);
    });

    test('should handle CSS Flexbox across browsers', async ({ page }) => {
      // Test CSS Flexbox support
      const flexboxSupported = await page.evaluate(() => {
        const element = document.createElement('div');
        element.style.display = 'flex';
        return element.style.display === 'flex';
      });
      
      expect(flexboxSupported).toBe(true);
    });

    test('should handle CSS Custom Properties across browsers', async ({ page }) => {
      // Test CSS Custom Properties support
      const customPropertiesSupported = await page.evaluate(() => {
        const element = document.createElement('div');
        element.style.setProperty('--test-property', 'test-value');
        return element.style.getPropertyValue('--test-property') === 'test-value';
      });
      
      expect(customPropertiesSupported).toBe(true);
    });

    test('should handle CSS transforms across browsers', async ({ page }) => {
      // Test CSS transforms support
      const transformsSupported = await page.evaluate(() => {
        const element = document.createElement('div');
        element.style.transform = 'translateX(10px)';
        return element.style.transform.includes('translateX');
      });
      
      expect(transformsSupported).toBe(true);
    });
  });

  test.describe('JavaScript Compatibility', () => {
    test('should handle ES6+ features across browsers', async ({ page }) => {
      // Test ES6+ features
      const es6Supported = await page.evaluate(() => {
        // Test arrow functions
        const arrowFunc = () => true;
        
        // Test destructuring
        const { a, b } = { a: 1, b: 2 };
        
        // Test template literals
        const template = `Value: ${a + b}`;
        
        // Test async/await
        const asyncFunc = async () => Promise.resolve(true);
        
        return arrowFunc() && a === 1 && b === 2 && template === 'Value: 3';
      });
      
      expect(es6Supported).toBe(true);
    });

    test('should handle Promise API across browsers', async ({ page }) => {
      // Test Promise support
      const promiseSupported = await page.evaluate(() => {
        return typeof Promise !== 'undefined' && 
               typeof Promise.resolve === 'function' &&
               typeof Promise.reject === 'function';
      });
      
      expect(promiseSupported).toBe(true);
    });

    test('should handle Fetch API across browsers', async ({ page }) => {
      // Test Fetch API support
      const fetchSupported = await page.evaluate(() => {
        return typeof fetch === 'function';
      });
      
      expect(fetchSupported).toBe(true);
    });

    test('should handle localStorage across browsers', async ({ page }) => {
      // Test localStorage support
      const localStorageSupported = await page.evaluate(() => {
        try {
          localStorage.setItem('test', 'value');
          const value = localStorage.getItem('test');
          localStorage.removeItem('test');
          return value === 'value';
        } catch (e) {
          return false;
        }
      });
      
      expect(localStorageSupported).toBe(true);
    });
  });

  test.describe('Event Handling', () => {
    test('should handle touch events across browsers', async ({ page }) => {
      // Test touch event support
      const touchSupported = await page.evaluate(() => {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      });
      
      // Touch support is optional, but should work if available
      if (touchSupported) {
        const playButton = page.locator('[data-testid="play-pause-button"]');
        await playButton.tap();
        await page.waitForTimeout(500);
        
        // Button should respond to touch
        const hasError = await page.locator('[data-testid="error-message"]').isVisible();
        expect(hasError).toBe(false);
      }
    });

    test('should handle keyboard events across browsers', async ({ page }) => {
      // Test keyboard event support
      const keyboardSupported = await page.evaluate(() => {
        return 'onkeydown' in window && 'onkeyup' in window && 'onkeypress' in window;
      });
      
      expect(keyboardSupported).toBe(true);
      
      // Test keyboard interactions
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName || null;
      });
      
      expect(focusedElement).toBeTruthy();
    });

    test('should handle mouse events across browsers', async ({ page }) => {
      // Test mouse event support
      const mouseSupported = await page.evaluate(() => {
        return 'onclick' in window && 'onmouseover' in window && 'onmouseout' in window;
      });
      
      expect(mouseSupported).toBe(true);
      
      // Test mouse interactions
      const playButton = page.locator('[data-testid="play-pause-button"]');
      await playButton.hover();
      await page.waitForTimeout(500);
      await playButton.click();
      await page.waitForTimeout(500);
      
      // Button should respond to mouse events
      const hasError = await page.locator('[data-testid="error-message"]').isVisible();
      expect(hasError).toBe(false);
    });
  });

  test.describe('Media Handling', () => {
    test('should handle audio elements across browsers', async ({ page }) => {
      // Test audio element support
      const audioSupported = await page.evaluate(() => {
        const audio = document.createElement('audio');
        return audio.canPlayType !== undefined;
      });
      
      expect(audioSupported).toBe(true);
    });

    test('should handle video elements across browsers', async ({ page }) => {
      // Test video element support
      const videoSupported = await page.evaluate(() => {
        const video = document.createElement('video');
        return video.canPlayType !== undefined;
      });
      
      expect(videoSupported).toBe(true);
    });

    test('should handle media queries across browsers', async ({ page }) => {
      // Test media query support
      const mediaQuerySupported = await page.evaluate(() => {
        return typeof window.matchMedia === 'function';
      });
      
      expect(mediaQuerySupported).toBe(true);
    });
  });

  test.describe('Performance and Memory', () => {
    test('should handle memory usage across browsers', async ({ page }) => {
      // Test memory usage monitoring
      const memorySupported = await page.evaluate(() => {
        return 'memory' in performance || 'memory' in (performance as any);
      });
      
      // Memory monitoring is optional but useful
      if (memorySupported) {
        const memoryInfo = await page.evaluate(() => {
          return (performance as any).memory;
        });
        
        expect(memoryInfo).toBeTruthy();
      }
    });

    test('should handle performance timing across browsers', async ({ page }) => {
      // Test performance timing
      const timingSupported = await page.evaluate(() => {
        return 'timing' in performance || 'getEntriesByType' in performance;
      });
      
      expect(timingSupported).toBe(true);
    });
  });

  test.describe('Security Features', () => {
    test('should handle Content Security Policy across browsers', async ({ page }) => {
      // Test CSP support
      const cspSupported = await page.evaluate(() => {
        return 'securityPolicyViolationEvent' in window;
      });
      
      // CSP support is expected in modern browsers
      expect(cspSupported).toBe(true);
    });

    test('should handle secure context across browsers', async ({ page }) => {
      // Test secure context
      const secureContextSupported = await page.evaluate(() => {
        return 'isSecureContext' in window;
      });
      
      expect(secureContextSupported).toBe(true);
    });
  });

  test.describe('Browser-Specific Workarounds', () => {
    test('should handle Safari-specific features', async ({ page, browserName }) => {
      if (browserName === 'webkit') {
        // Safari-specific tests
        const safariFeatures = await page.evaluate(() => {
          // Test Safari-specific audio context
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          return typeof AudioContext !== 'undefined';
        });
        
        expect(safariFeatures).toBe(true);
      }
    });

    test('should handle Firefox-specific features', async ({ page, browserName }) => {
      if (browserName === 'firefox') {
        // Firefox-specific tests
        const firefoxFeatures = await page.evaluate(() => {
          // Test Firefox-specific features
          return typeof window.URL !== 'undefined';
        });
        
        expect(firefoxFeatures).toBe(true);
      }
    });

    test('should handle Chrome-specific features', async ({ page, browserName }) => {
      if (browserName === 'chromium') {
        // Chrome-specific tests
        const chromeFeatures = await page.evaluate(() => {
          // Test Chrome-specific features
          return typeof window.chrome !== 'undefined' || 
                 typeof (window as any).webkitAudioContext !== 'undefined';
        });
        
        expect(chromeFeatures).toBe(true);
      }
    });
  });

  test.describe('Mobile Browser Compatibility', () => {
    test('should handle mobile Safari features', async ({ page, browserName }) => {
      if (browserName === 'webkit') {
        await page.setViewportSize({ width: 375, height: 667 });
        
        // Test mobile Safari-specific features
        const mobileSafariFeatures = await page.evaluate(() => {
          // Test touch events
          return 'ontouchstart' in window;
        });
        
        expect(mobileSafariFeatures).toBe(true);
      }
    });

    test('should handle mobile Chrome features', async ({ page, browserName }) => {
      if (browserName === 'chromium') {
        await page.setViewportSize({ width: 375, height: 667 });
        
        // Test mobile Chrome-specific features
        const mobileChromeFeatures = await page.evaluate(() => {
          // Test viewport meta tag support
          const viewport = document.querySelector('meta[name="viewport"]');
          return viewport !== null;
        });
        
        expect(mobileChromeFeatures).toBe(true);
      }
    });
  });
});
