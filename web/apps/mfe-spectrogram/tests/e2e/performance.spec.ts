import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Performance Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
  });

  test.describe('Load Time Performance', () => {
    test('should load initial page within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      await helpers.waitForAppLoad();
      
      const loadTime = Date.now() - startTime;
      
      // Initial page load should be under 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      console.log(`Initial page load time: ${loadTime}ms`);
    });

    test('should load WebAssembly module within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      // Wait for WebAssembly to be available
      await page.waitForFunction(() => {
        return window.wasmModule !== undefined || 
               document.querySelector('[data-testid="spectrogram-canvas"]') !== null;
      }, { timeout: 15000 });
      
      const wasmLoadTime = Date.now() - startTime;
      
      // WebAssembly should load within 5 seconds
      expect(wasmLoadTime).toBeLessThan(5000);
      
      console.log(`WebAssembly load time: ${wasmLoadTime}ms`);
    });

    test('should render spectrogram within acceptable time', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      const startTime = Date.now();
      
      // Wait for spectrogram to be rendered
      await page.waitForSelector('[data-testid="spectrogram-canvas"]', { timeout: 10000 });
      
      const renderTime = Date.now() - startTime;
      
      // Spectrogram should render within 2 seconds
      expect(renderTime).toBeLessThan(2000);
      
      console.log(`Spectrogram render time: ${renderTime}ms`);
    });
  });

  test.describe('Memory Usage', () => {
    test('should maintain reasonable memory usage', async ({ page }) => {
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return null;
      });
      
      if (initialMemory !== null) {
        console.log(`Initial memory usage: ${initialMemory} bytes`);
        
        // Perform some operations
        await helpers.uploadAudioFile('test-silence.wav');
        await page.waitForTimeout(2000);
        
        // Get memory usage after operations
        const finalMemory = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize;
          }
          return null;
        });
        
        if (finalMemory !== null) {
          console.log(`Final memory usage: ${finalMemory} bytes`);
          
          const memoryIncrease = finalMemory - initialMemory;
          console.log(`Memory increase: ${memoryIncrease} bytes`);
          
          // Memory increase should be reasonable (less than 50MB)
          expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        }
      }
    });

    test('should not have memory leaks during repeated operations', async ({ page }) => {
      const memoryReadings = [];
      
      for (let i = 0; i < 5; i++) {
        // Upload file
        await helpers.uploadAudioFile('test-silence.wav');
        await page.waitForTimeout(1000);
        
        // Get memory usage
        const memory = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize;
          }
          return null;
        });
        
        if (memory !== null) {
          memoryReadings.push(memory);
        }
        
        // Clear file
        await page.reload();
        await helpers.waitForAppLoad();
      }
      
      if (memoryReadings.length > 1) {
        // Check for consistent memory usage
        const firstReading = memoryReadings[0];
        const lastReading = memoryReadings[memoryReadings.length - 1];
        const memoryGrowth = lastReading - firstReading;
        
        console.log(`Memory growth over ${memoryReadings.length} operations: ${memoryGrowth} bytes`);
        
        // Memory growth should be minimal (less than 10MB)
        expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
      }
    });
  });

  test.describe('CPU Performance', () => {
    test('should handle audio processing efficiently', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Start performance monitoring
      const startTime = performance.now();
      
      // Perform audio processing operations
      const playButton = page.locator('[data-testid="play-pause-button"]');
      await playButton.click();
      await page.waitForTimeout(2000);
      await playButton.click();
      
      const processingTime = performance.now() - startTime;
      
      // Audio processing should be efficient
      expect(processingTime).toBeLessThan(3000);
      
      console.log(`Audio processing time: ${processingTime}ms`);
    });

    test('should handle spectrogram generation efficiently', async ({ page }) => {
      const startTime = performance.now();
      
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Wait for spectrogram generation
      await page.waitForSelector('[data-testid="spectrogram-canvas"]', { timeout: 10000 });
      
      const generationTime = performance.now() - startTime;
      
      // Spectrogram generation should be efficient
      expect(generationTime).toBeLessThan(2000);
      
      console.log(`Spectrogram generation time: ${generationTime}ms`);
    });
  });

  test.describe('Network Performance', () => {
    test('should handle file uploads efficiently', async ({ page }) => {
      const startTime = performance.now();
      
      await helpers.uploadAudioFile('test-silence.wav');
      
      const uploadTime = performance.now() - startTime;
      
      // File upload should be efficient
      expect(uploadTime).toBeLessThan(1000);
      
      console.log(`File upload time: ${uploadTime}ms`);
    });

    test('should handle multiple file uploads efficiently', async ({ page }) => {
      const startTime = performance.now();
      
      // Upload multiple files
      for (let i = 0; i < 3; i++) {
        await helpers.uploadAudioFile('test-silence.wav');
        await page.waitForTimeout(500);
      }
      
      const totalTime = performance.now() - startTime;
      
      // Multiple uploads should be efficient
      expect(totalTime).toBeLessThan(3000);
      
      console.log(`Multiple file uploads time: ${totalTime}ms`);
    });
  });

  test.describe('UI Responsiveness', () => {
    test('should maintain responsive UI during heavy operations', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Start heavy operation
      const playButton = page.locator('[data-testid="play-pause-button"]');
      await playButton.click();
      
      // Test UI responsiveness during playback
      const startTime = performance.now();
      
      // Try to interact with UI elements
      const settingsButton = page.locator('[data-testid="settings-button"]');
      await settingsButton.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      
      const interactionTime = performance.now() - startTime;
      
      // UI should remain responsive
      expect(interactionTime).toBeLessThan(1000);
      
      console.log(`UI interaction time during heavy operation: ${interactionTime}ms`);
    });

    test('should handle rapid user interactions efficiently', async ({ page }) => {
      const startTime = performance.now();
      
      // Perform rapid interactions
      const playButton = page.locator('[data-testid="play-pause-button"]');
      const settingsButton = page.locator('[data-testid="settings-button"]');
      
      for (let i = 0; i < 5; i++) {
        await playButton.click();
        await page.waitForTimeout(100);
        await settingsButton.click();
        await page.waitForTimeout(100);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
      }
      
      const interactionTime = performance.now() - startTime;
      
      // Rapid interactions should be handled efficiently
      expect(interactionTime).toBeLessThan(2000);
      
      console.log(`Rapid interactions time: ${interactionTime}ms`);
    });
  });

  test.describe('Large File Handling', () => {
    test('should handle large audio files efficiently', async ({ page }) => {
      // Create a larger test file
      const largeFileData = new ArrayBuffer(1024 * 1024); // 1MB
      const largeFile = new File([largeFileData], 'large-test.wav', { type: 'audio/wav' });
      
      const startTime = performance.now();
      
      // Upload large file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'large-test.wav',
        mimeType: 'audio/wav',
        buffer: Buffer.from(largeFileData)
      });
      
      await page.waitForTimeout(2000);
      
      const uploadTime = performance.now() - startTime;
      
      // Large file upload should be handled efficiently
      expect(uploadTime).toBeLessThan(5000);
      
      console.log(`Large file upload time: ${uploadTime}ms`);
    });

    test('should handle multiple large files efficiently', async ({ page }) => {
      const startTime = performance.now();
      
      // Upload multiple large files
      for (let i = 0; i < 3; i++) {
        const largeFileData = new ArrayBuffer(512 * 1024); // 512KB
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: `large-test-${i}.wav`,
          mimeType: 'audio/wav',
          buffer: Buffer.from(largeFileData)
        });
        await page.waitForTimeout(1000);
      }
      
      const totalTime = performance.now() - startTime;
      
      // Multiple large files should be handled efficiently
      expect(totalTime).toBeLessThan(10000);
      
      console.log(`Multiple large files upload time: ${totalTime}ms`);
    });
  });

  test.describe('Concurrent Operations', () => {
    test('should handle concurrent audio operations efficiently', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      const startTime = performance.now();
      
      // Start multiple concurrent operations
      const playButton = page.locator('[data-testid="play-pause-button"]');
      const volumeSlider = page.locator('[data-testid="volume-slider"]');
      const settingsButton = page.locator('[data-testid="settings-button"]');
      
      // Start playback
      await playButton.click();
      
      // Adjust volume
      await volumeSlider.click({ position: { x: 50, y: 10 } });
      
      // Open settings
      await settingsButton.click();
      
      // Close settings
      await page.keyboard.press('Escape');
      
      const concurrentTime = performance.now() - startTime;
      
      // Concurrent operations should be handled efficiently
      expect(concurrentTime).toBeLessThan(2000);
      
      console.log(`Concurrent operations time: ${concurrentTime}ms`);
    });

    test('should handle rapid state changes efficiently', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      const startTime = performance.now();
      
      // Perform rapid state changes
      const playButton = page.locator('[data-testid="play-pause-button"]');
      
      for (let i = 0; i < 10; i++) {
        await playButton.click();
        await page.waitForTimeout(50);
      }
      
      const stateChangeTime = performance.now() - startTime;
      
      // Rapid state changes should be handled efficiently
      expect(stateChangeTime).toBeLessThan(2000);
      
      console.log(`Rapid state changes time: ${stateChangeTime}ms`);
    });
  });

  test.describe('Performance Monitoring', () => {
    test('should provide performance metrics', async ({ page }) => {
      const metrics = await page.evaluate(() => {
        const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paintTiming = performance.getEntriesByType('paint');
        
        return {
          domContentLoaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.domContentLoadedEventStart,
          loadComplete: navigationTiming.loadEventEnd - navigationTiming.loadEventStart,
          firstPaint: paintTiming.find(entry => entry.name === 'first-paint')?.startTime,
          firstContentfulPaint: paintTiming.find(entry => entry.name === 'first-contentful-paint')?.startTime
        };
      });
      
      console.log('Performance metrics:', metrics);
      
      // Verify metrics are available
      expect(metrics.domContentLoaded).toBeGreaterThan(0);
      expect(metrics.loadComplete).toBeGreaterThan(0);
    });

    test('should track WebAssembly performance', async ({ page }) => {
      // Wait for WebAssembly to load
      await page.waitForFunction(() => {
        return window.wasmModule !== undefined;
      }, { timeout: 15000 });
      
      const wasmMetrics = await page.evaluate(() => {
        if (window.wasmModule) {
          return {
            moduleSize: window.wasmModule.instance.exports.memory?.buffer?.byteLength || 0,
            functionsAvailable: Object.keys(window.wasmModule.instance.exports).length
          };
        }
        return null;
      });
      
      if (wasmMetrics) {
        console.log('WebAssembly metrics:', wasmMetrics);
        expect(wasmMetrics.functionsAvailable).toBeGreaterThan(0);
      }
    });
  });
});
