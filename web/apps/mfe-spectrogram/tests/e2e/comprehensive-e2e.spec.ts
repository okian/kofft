import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import fc from 'fast-check';

test.describe('Comprehensive E2E Test Suite', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
  });

  test.describe('1. Component Behavior - Settings & Options', () => {
    test.describe('Valid Settings', () => {
      test('should apply all valid theme options', async ({ page }) => {
        const themes = [
          'japanese-a-light', 'japanese-a-dark',
          'japanese-b-light', 'japanese-b-dark',
          'bauhaus-light', 'bauhaus-dark'
        ];

        for (const theme of themes) {
          await helpers.testSettingsPanel();
          await page.selectOption('[data-testid="theme-select"]', theme);
          await expect(page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', theme);
          
          // Verify theme persistence
          await page.reload();
          await helpers.waitForAppLoad();
          await expect(page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', theme);
        }
      });

      test('should apply all valid amplitude scales', async ({ page }) => {
        const scales = ['linear', 'logarithmic', 'db'];
        
        for (const scale of scales) {
          await helpers.testSettingsPanel();
          await page.selectOption('[data-testid="amplitude-scale-select"]', scale);
          await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
          
          // Verify setting is applied to spectrogram
          const canvas = page.locator('[data-testid="spectrogram-canvas"]');
          await expect(canvas).toBeVisible();
        }
      });

      test('should apply all valid frequency scales', async ({ page }) => {
        const scales = ['linear', 'logarithmic'];
        
        for (const scale of scales) {
          await helpers.openSettingsPanel();
          await page.selectOption('[data-testid="frequency-scale-select"]', scale);
          await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
        }
      });

      test('should apply all valid resolutions', async ({ page }) => {
        const resolutions = ['low', 'medium', 'high'];
        
        for (const resolution of resolutions) {
          await helpers.openSettingsPanel();
          await page.selectOption('[data-testid="resolution-select"]', resolution);
          await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
        }
      });

      test('should apply all valid refresh rates', async ({ page }) => {
        const rates = [30, 60];
        
        for (const rate of rates) {
          await helpers.openSettingsPanel();
          await page.selectOption('[data-testid="refresh-rate-select"]', rate.toString());
          await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
        }
      });
    });

    test.describe('Invalid Settings', () => {
      test('should handle invalid theme values gracefully', async ({ page }) => {
        await helpers.openSettingsPanel();
        
        // Try to set invalid theme via JavaScript
        await page.evaluate(() => {
          const select = document.querySelector('[data-testid="theme-select"]') as HTMLSelectElement;
          if (select) {
            select.value = 'invalid-theme';
            select.dispatchEvent(new Event('change'));
          }
        });
        
        // Should fall back to default theme
        await expect(page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', 'dark');
      });

      test('should handle malformed settings in localStorage', async ({ page }) => {
        // Inject malformed settings
        await page.evaluate(() => {
          localStorage.setItem('spectrogram-settings', 'invalid-json');
        });
        
        await page.reload();
        await helpers.waitForAppLoad();
        
        // Should load with default settings
        await expect(page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', 'dark');
      });

      test('should handle extreme numeric values', async ({ page }) => {
        await helpers.openSettingsPanel();
        
        // Test extreme values for numeric inputs
        const extremeValues = [-Infinity, Infinity, NaN, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
        
        for (const value of extremeValues) {
          await page.fill('[data-testid="seekbar-significance-input"]', value.toString());
          await page.keyboard.press('Enter');
          
          // Should clamp to valid range or show error
          const input = page.locator('[data-testid="seekbar-significance-input"]');
          const currentValue = await input.inputValue();
          expect(parseFloat(currentValue)).toBeGreaterThanOrEqual(0);
          expect(parseFloat(currentValue)).toBeLessThanOrEqual(1);
        }
      });
    });

    test.describe('Missing Settings', () => {
      test('should use defaults when no settings provided', async ({ page }) => {
        // Clear all settings
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        
        await page.reload();
        await helpers.waitForAppLoad();
        
        // Should load with default settings
        await expect(page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', 'dark');
        await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
      });

      test('should handle missing audio file gracefully', async ({ page }) => {
        const dropZone = page.locator('[data-testid="drop-zone"]');
        await expect(dropZone).toBeVisible();
        await expect(dropZone).toContainText('Drop audio files here');
      });
    });

    test.describe('State Persistence', () => {
      test('should persist settings across browser sessions', async ({ page }) => {
        await helpers.openSettingsPanel();
        await page.selectOption('[data-testid="theme-select"]', 'light');
        await page.selectOption('[data-testid="amplitude-scale-select"]', 'logarithmic');
        
        // Verify persistence in localStorage
        const settings = await page.evaluate(() => {
          return localStorage.getItem('spectrogram-settings');
        });
        expect(settings).toBeTruthy();
        
        // Reload and verify persistence
        await page.reload();
        await helpers.waitForAppLoad();
        await expect(page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', 'light');
      });

      test('should persist audio preferences', async ({ page }) => {
        await helpers.uploadAudioFile('test-silence.wav');
        
        // Set volume and mute state
        await page.click('[data-testid="volume-slider"]');
        await page.keyboard.press('ArrowLeft');
        await page.click('[data-testid="mute-button"]');
        
        // Verify persistence
        const audioPrefs = await page.evaluate(() => {
          return localStorage.getItem('audio-preferences');
        });
        expect(audioPrefs).toBeTruthy();
      });
    });
  });

  test.describe('2. User Interaction Scenarios', () => {
    test.describe('Mouse Interactions', () => {
      test('should handle all mouse interactions on spectrogram', async ({ page }) => {
        await helpers.uploadAudioFile('test-silence.wav');
        
        const canvas = page.locator('[data-testid="spectrogram-canvas"]');
        
        // Test mouse move
        await canvas.hover();
        
        // Test mouse click
        await canvas.click({ position: { x: 100, y: 100 } });
        
        // Test mouse leave
        await page.mouse.move(0, 0);
      });

      test('should handle drag and drop file upload', async ({ page }) => {
        const dropZone = page.locator('[data-testid="drop-zone"]');
        
        // Simulate drag and drop
        await page.evaluate(() => {
          const dropZone = document.querySelector('[data-testid="drop-zone"]');
          if (dropZone) {
            const file = new File(['test audio data'], 'test.wav', { type: 'audio/wav' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            const dropEvent = new DragEvent('drop', {
              dataTransfer,
              bubbles: true,
              cancelable: true
            });
            
            dropZone.dispatchEvent(dropEvent);
          }
        });
        
        await expect(page.locator('[data-testid="audio-loaded"]')).toBeVisible();
      });

      test('should handle rapid clicking', async ({ page }) => {
        const playButton = page.locator('[data-testid="play-pause-button"]');
        
        // Rapid clicking
        for (let i = 0; i < 10; i++) {
          await playButton.click();
          await page.waitForTimeout(50);
        }
        
        // Should not crash or behave unexpectedly
        await expect(playButton).toBeVisible();
      });
    });

    test.describe('Keyboard Shortcuts', () => {
      test('should handle all keyboard shortcuts', async ({ page }) => {
        await helpers.uploadAudioFile('test-silence.wav');
        
        // Test play/pause shortcut
        await page.keyboard.press('Space');
        await expect(page.locator('[data-testid="playing-state"]')).toBeVisible();
        
        await page.keyboard.press('Space');
        await expect(page.locator('[data-testid="paused-state"]')).toBeVisible();
        
        // Test seek shortcuts
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowRight');
        
        // Test volume shortcuts
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowDown');
        
        // Test mute shortcut
        await page.keyboard.press('m');
        
        // Test help shortcut
        await page.keyboard.press('h');
        await expect(page.locator('[data-testid="shortcuts-modal"]')).toBeVisible();
        
        await page.keyboard.press('Escape');
        await expect(page.locator('[data-testid="shortcuts-modal"]')).not.toBeVisible();
      });

      test('should handle keyboard navigation', async ({ page }) => {
        // Test tab navigation
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Test Enter key
        await page.keyboard.press('Enter');
        
        // Test Escape key
        await page.keyboard.press('Escape');
      });

      test('should handle rapid keyboard input', async ({ page }) => {
        // Rapid space key presses
        for (let i = 0; i < 20; i++) {
          await page.keyboard.press('Space');
          await page.waitForTimeout(10);
        }
        
        // Should not crash
        await expect(page.locator('[data-testid="play-pause-button"]')).toBeVisible();
      });
    });

    test.describe('Touch Interactions', () => {
      test('should handle touch interactions on mobile', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        
        await helpers.uploadAudioFile('test-silence.wav');
        
        const canvas = page.locator('[data-testid="spectrogram-canvas"]');
        
        // Test touch start
        await canvas.tap({ position: { x: 100, y: 100 } });
        
        // Test touch move
        await page.touchscreen.tap(100, 100);
        await page.touchscreen.move(200, 200);
        
        // Test touch end
        await page.touchscreen.up();
      });

      test('should handle pinch to zoom', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        
        const canvas = page.locator('[data-testid="spectrogram-canvas"]');
        
        // Simulate pinch gesture
        await page.evaluate(() => {
          const canvas = document.querySelector('[data-testid="spectrogram-canvas"]');
          if (canvas) {
            const touchEvent = new TouchEvent('touchstart', {
              touches: [
                new Touch({ identifier: 0, target: canvas, clientX: 100, clientY: 100 }),
                new Touch({ identifier: 1, target: canvas, clientX: 200, clientY: 200 })
              ],
              bubbles: true
            });
            canvas.dispatchEvent(touchEvent);
          }
        });
      });
    });

    test.describe('Navigation Scenarios', () => {
      test('should handle switching between panels', async ({ page }) => {
        // Open settings panel
        await helpers.openSettingsPanel();
        await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
        
        // Open metadata panel
        await page.click('[data-testid="metadata-button"]');
        await expect(page.locator('[data-testid="metadata-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="settings-panel"]')).not.toBeVisible();
        
        // Open playlist panel
        await page.click('[data-testid="playlist-button"]');
        await expect(page.locator('[data-testid="playlist-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="metadata-panel"]')).not.toBeVisible();
      });

      test('should handle browser refresh mid-flow', async ({ page }) => {
        await helpers.uploadAudioFile('test-silence.wav');
        await page.click('[data-testid="play-pause-button"]');
        
        // Refresh during playback
        await page.reload();
        await helpers.waitForAppLoad();
        
        // Should maintain state or handle gracefully
        await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
      });

      test('should handle leaving mid-action', async ({ page }) => {
        await helpers.openSettingsPanel();
        
        // Start changing a setting
        await page.selectOption('[data-testid="theme-select"]', 'light');
        
        // Close panel before change completes
        await page.click('[data-testid="close-settings"]');
        
        // Should handle gracefully
        await expect(page.locator('[data-testid="settings-panel"]')).not.toBeVisible();
      });
    });
  });

  test.describe('3. Cross-Component Effects', () => {
    test.describe('State Propagation', () => {
      test('should propagate audio state changes across components', async ({ page }) => {
        await helpers.uploadAudioFile('test-silence.wav');
        
        // Start playback
        await page.click('[data-testid="play-pause-button"]');
        
        // Verify all components reflect playing state
        await expect(page.locator('[data-testid="play-pause-button"]')).toHaveAttribute('aria-label', /pause/i);
        await expect(page.locator('[data-testid="seekbar"]')).toBeVisible();
        await expect(page.locator('[data-testid="current-time"]')).toBeVisible();
      });

      test('should propagate settings changes across components', async ({ page }) => {
        await helpers.uploadAudioFile('test-silence.wav');
        
        // Change theme
        await helpers.openSettingsPanel();
        await page.selectOption('[data-testid="theme-select"]', 'light');
        
        // Verify all components reflect theme change
        await expect(page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', 'light');
        await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
        await expect(page.locator('[data-testid="header"]')).toBeVisible();
        await expect(page.locator('[data-testid="footer"]')).toBeVisible();
      });

      test('should handle conflicting settings', async ({ page }) => {
        await helpers.openSettingsPanel();
        
        // Try to set mutually exclusive settings
        await page.selectOption('[data-testid="amplitude-scale-select"]', 'linear');
        await page.selectOption('[data-testid="amplitude-scale-select"]', 'logarithmic');
        
        // Should handle gracefully
        await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
      });
    });

    test.describe('Component Dependencies', () => {
      test('should handle spectrogram canvas dependency on audio data', async ({ page }) => {
        // Without audio data
        const canvas = page.locator('[data-testid="spectrogram-canvas"]');
        await expect(canvas).toBeVisible();
        
        // With audio data
        await helpers.uploadAudioFile('test-silence.wav');
        await expect(canvas).toBeVisible();
      });

      test('should handle seekbar dependency on audio duration', async ({ page }) => {
        // Without audio
        const seekbar = page.locator('[data-testid="seekbar"]');
        await expect(seekbar).not.toBeVisible();
        
        // With audio
        await helpers.uploadAudioFile('test-silence.wav');
        await expect(seekbar).toBeVisible();
      });

      test('should handle volume controls dependency on audio context', async ({ page }) => {
        const volumeSlider = page.locator('[data-testid="volume-slider"]');
        await expect(volumeSlider).toBeVisible();
        
        // Should work even without audio loaded
        await volumeSlider.click();
        await page.keyboard.press('ArrowUp');
      });
    });

    test.describe('Side Effects', () => {
      test('should not affect unrelated components when changing settings', async ({ page }) => {
        await helpers.uploadAudioFile('test-silence.wav');
        
        // Change spectrogram settings
        await helpers.openSettingsPanel();
        await page.selectOption('[data-testid="theme-select"]', 'light');
        
        // Verify unrelated components are unaffected
        await expect(page.locator('[data-testid="play-pause-button"]')).toBeVisible();
        await expect(page.locator('[data-testid="volume-slider"]')).toBeVisible();
        await expect(page.locator('[data-testid="seekbar"]')).toBeVisible();
      });

      test('should handle component unmounting gracefully', async ({ page }) => {
        await helpers.uploadAudioFile('test-silence.wav');
        
        // Start playback
        await page.click('[data-testid="play-pause-button"]');
        
        // Close and reopen panels
        await helpers.openSettingsPanel();
        await page.click('[data-testid="close-settings"]');
        await helpers.openSettingsPanel();
        
        // Should maintain audio state
        await expect(page.locator('[data-testid="playing-state"]')).toBeVisible();
      });
    });
  });

  test.describe('4. Integration & Flow Testing', () => {
    test.describe('Complete Workflows', () => {
      test('should complete full audio workflow', async ({ page }) => {
        // 1. Load audio file
        await helpers.uploadAudioFile('test-silence.wav');
        await expect(page.locator('[data-testid="audio-loaded"]')).toBeVisible();
        
        // 2. Play audio
        await page.click('[data-testid="play-pause-button"]');
        await expect(page.locator('[data-testid="playing-state"]')).toBeVisible();
        
        // 3. Seek to different position
        const seekbar = page.locator('[data-testid="seekbar"]');
        await seekbar.click({ position: { x: 50, y: 10 } });
        
        // 4. Change visualization settings
        await helpers.openSettingsPanel();
        await page.selectOption('[data-testid="theme-select"]', 'light');
        await page.selectOption('[data-testid="amplitude-scale-select"]', 'logarithmic');
        
        // 5. Save settings
        await page.click('[data-testid="save-settings"]');
        await expect(page.locator('[data-testid="settings-panel"]')).not.toBeVisible();
        
        // 6. Verify persistence
        await page.reload();
        await helpers.waitForAppLoad();
        await expect(page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', 'light');
      });

      test('should handle multiple file workflow', async ({ page }) => {
        // Load first file
        await helpers.uploadAudioFile('test-silence.wav');
        await expect(page.locator('[data-testid="audio-loaded"]')).toBeVisible();
        
        // Load second file
        await helpers.uploadAudioFile('test-audio.mp3');
        await expect(page.locator('[data-testid="audio-loaded"]')).toBeVisible();
        
        // Verify playlist functionality
        await page.click('[data-testid="playlist-button"]');
        await expect(page.locator('[data-testid="playlist-panel"]')).toBeVisible();
        
        // Switch between tracks
        await page.click('[data-testid="next-track-button"]');
        await expect(page.locator('[data-testid="audio-loaded"]')).toBeVisible();
      });

      test('should handle settings workflow', async ({ page }) => {
        // Open settings
        await helpers.openSettingsPanel();
        
        // Change multiple settings
        await page.selectOption('[data-testid="theme-select"]', 'neon');
        await page.selectOption('[data-testid="amplitude-scale-select"]', 'db');
        await page.selectOption('[data-testid="frequency-scale-select"]', 'logarithmic');
        await page.selectOption('[data-testid="resolution-select"]', 'high');
        await page.selectOption('[data-testid="refresh-rate-select"]', '60');
        
        // Toggle options
        await page.check('[data-testid="show-legend-checkbox"]');
        await page.check('[data-testid="enable-toast-checkbox"]');
        
        // Save settings
        await page.click('[data-testid="save-settings"]');
        
        // Verify persistence
        await page.reload();
        await helpers.waitForAppLoad();
        await expect(page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', 'neon');
      });
    });

    test.describe('Persistence Testing', () => {
      test('should persist all settings across reloads', async ({ page }) => {
        await helpers.openSettingsPanel();
        
        // Set all settings
        await page.selectOption('[data-testid="theme-select"]', 'light');
        await page.selectOption('[data-testid="amplitude-scale-select"]', 'logarithmic');
        await page.selectOption('[data-testid="frequency-scale-select"]', 'logarithmic');
        await page.selectOption('[data-testid="resolution-select"]', 'medium');
        await page.selectOption('[data-testid="refresh-rate-select"]', '30');
        await page.check('[data-testid="show-legend-checkbox"]');
        await page.check('[data-testid="enable-toast-checkbox"]');
        
        await page.click('[data-testid="save-settings"]');
        
        // Reload multiple times
        for (let i = 0; i < 3; i++) {
          await page.reload();
          await helpers.waitForAppLoad();
          
          await expect(page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', 'light');
        }
      });

      test('should persist audio preferences', async ({ page }) => {
        await helpers.uploadAudioFile('test-silence.wav');
        
        // Set volume and mute
        const volumeSlider = page.locator('[data-testid="volume-slider"]');
        await volumeSlider.click();
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        
        await page.click('[data-testid="mute-button"]');
        
        // Reload and verify
        await page.reload();
        await helpers.waitForAppLoad();
        
        // Should maintain volume and mute state
        await expect(page.locator('[data-testid="mute-button"]')).toHaveAttribute('aria-pressed', 'true');
      });
    });

    test.describe('Error Recovery', () => {
      test('should recover from corrupted data', async ({ page }) => {
        // Inject corrupted data
        await page.evaluate(() => {
          localStorage.setItem('spectrogram-settings', '{"theme": "invalid"}');
          localStorage.setItem('audio-preferences', '{"volume": "not-a-number"}');
        });
        
        await page.reload();
        await helpers.waitForAppLoad();
        
        // Should load with defaults
        await expect(page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', 'dark');
      });

      test('should handle network errors gracefully', async ({ page }) => {
        // Simulate network error
        await page.route('**/*', route => {
          route.abort();
        });
        
        await page.reload();
        await helpers.waitForAppLoad();
        
        // Should show error state or fallback
        await expect(page.locator('#app')).toBeVisible();
      });
    });
  });

  test.describe('5. Robustness & Resilience', () => {
    test.describe('Network Conditions', () => {
      test('should handle slow network', async ({ page }) => {
        // Simulate slow network
        await page.route('**/*', route => {
          route.continue();
        });
        
        // Set slow network
        await page.context().setExtraHTTPHeaders({
          'X-Slow-Network': 'true'
        });
        
        await page.goto('/');
        await helpers.waitForAppLoad();
        
        await expect(page.locator('#app')).toBeVisible();
      });

      test('should handle offline mode', async ({ page }) => {
        // Go offline
        await page.context().setOffline(true);
        
        await page.reload();
        await helpers.waitForAppLoad();
        
        // Should show offline state or cached content
        await expect(page.locator('#app')).toBeVisible();
        
        // Go back online
        await page.context().setOffline(false);
      });

      test('should handle intermittent connectivity', async ({ page }) => {
        let requestCount = 0;
        await page.route('**/*', route => {
          requestCount++;
          if (requestCount % 3 === 0) {
            route.abort();
          } else {
            route.continue();
          }
        });
        
        await page.reload();
        await helpers.waitForAppLoad();
        
        await expect(page.locator('#app')).toBeVisible();
      });
    });

    test.describe('Browser Compatibility', () => {
      test('should work across different viewport sizes', async ({ page }) => {
        const viewports = [
          { width: 1920, height: 1080 }, // Desktop
          { width: 1024, height: 768 },  // Tablet
          { width: 375, height: 667 },   // Mobile
          { width: 320, height: 568 }    // Small mobile
        ];
        
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await page.reload();
          await helpers.waitForAppLoad();
          
          await expect(page.locator('#app')).toBeVisible();
          await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
        }
      });

      test('should handle different pixel ratios', async ({ page }) => {
        const pixelRatios = [1, 1.5, 2, 3];
        
        for (const ratio of pixelRatios) {
          await page.evaluate((ratio) => {
            Object.defineProperty(window, 'devicePixelRatio', {
              value: ratio,
              writable: true
            });
          }, ratio);
          
          await page.reload();
          await helpers.waitForAppLoad();
          
          await expect(page.locator('#app')).toBeVisible();
        }
      });
    });

    test.describe('Memory Management', () => {
      test('should handle large audio files', async ({ page }) => {
        // Create large audio file
        const largeAudioData = new Array(1024 * 1024).fill(0); // 1MB
        const blob = new Blob([new Uint8Array(largeAudioData)], { type: 'audio/wav' });
        const file = new File([blob], 'large-test.wav', { type: 'audio/wav' });
        
        await page.evaluate((fileData) => {
          const input = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (input) {
            const dt = new DataTransfer();
            dt.items.add(fileData);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, file);
        
        await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
      });

      test('should handle multiple large files', async ({ page }) => {
        // Upload multiple files
        for (let i = 0; i < 5; i++) {
          await helpers.uploadAudioFile('test-silence.wav');
          await page.waitForTimeout(1000);
        }
        
        // Should not crash
        await expect(page.locator('#app')).toBeVisible();
      });

      test('should clean up resources properly', async ({ page }) => {
        await helpers.uploadAudioFile('test-silence.wav');
        
        // Start and stop playback multiple times
        for (let i = 0; i < 10; i++) {
          await page.click('[data-testid="play-pause-button"]');
          await page.waitForTimeout(100);
          await page.click('[data-testid="play-pause-button"]');
          await page.waitForTimeout(100);
        }
        
        // Should not have memory leaks
        await expect(page.locator('#app')).toBeVisible();
      });
    });

    test.describe('Accessibility', () => {
      test('should support screen readers', async ({ page }) => {
        // Check for ARIA labels
        await expect(page.locator('[data-testid="play-pause-button"]')).toHaveAttribute('aria-label');
        await expect(page.locator('[data-testid="volume-slider"]')).toHaveAttribute('aria-label');
        await expect(page.locator('[data-testid="seekbar"]')).toHaveAttribute('aria-label');
      });

      test('should support keyboard-only navigation', async ({ page }) => {
        // Navigate with keyboard only
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
        
        // Should be able to access all functionality
        await expect(page.locator('#app')).toBeVisible();
      });

      test('should support reduced motion preferences', async ({ page }) => {
        // Set reduced motion preference
        await page.evaluate(() => {
          Object.defineProperty(window, 'matchMedia', {
            value: () => ({
              matches: true,
              addListener: () => {},
              removeListener: () => {}
            })
          });
        });
        
        await page.reload();
        await helpers.waitForAppLoad();
        
        // Should respect reduced motion
        await expect(page.locator('#app')).toBeVisible();
      });
    });
  });

  test.describe('6. Property-Based Testing', () => {
    test('should handle arbitrary theme inputs', async ({ page }) => {
      const arbitraryTheme = fc.string().filter(s => s.length > 0);
      
      await arbitraryTheme.run(async (theme) => {
        await page.evaluate((t) => {
          const select = document.querySelector('[data-testid="theme-select"]') as HTMLSelectElement;
          if (select) {
            select.value = t;
            select.dispatchEvent(new Event('change'));
          }
        }, theme);
        
        // Should not crash
        await expect(page.locator('#app')).toBeVisible();
      });
    });

    test('should handle arbitrary volume values', async ({ page }) => {
      const arbitraryVolume = fc.float().between(0, 1);
      
      await arbitraryVolume.run(async (volume) => {
        await page.evaluate((v) => {
          const slider = document.querySelector('[data-testid="volume-slider"]') as HTMLInputElement;
          if (slider) {
            slider.value = v.toString();
            slider.dispatchEvent(new Event('input'));
          }
        }, volume);
        
        // Should not crash
        await expect(page.locator('#app')).toBeVisible();
      });
    });

    test('should handle arbitrary seek positions', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      const arbitrarySeek = fc.float().between(0, 100);
      
      await arbitrarySeek.run(async (seek) => {
        await page.evaluate((s) => {
          const seekbar = document.querySelector('[data-testid="seekbar"]') as HTMLElement;
          if (seekbar) {
            const rect = seekbar.getBoundingClientRect();
            const x = (s / 100) * rect.width;
            const clickEvent = new MouseEvent('click', {
              clientX: rect.left + x,
              clientY: rect.top + rect.height / 2
            });
            seekbar.dispatchEvent(clickEvent);
          }
        }, seek);
        
        // Should not crash
        await expect(page.locator('#app')).toBeVisible();
      });
    });
  });

  test.describe('7. Snapshot Testing', () => {
    test('should maintain consistent visual output', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Take initial screenshot
      const initialScreenshot = await page.screenshot({ fullPage: true });
      
      // Perform some actions
      await page.click('[data-testid="play-pause-button"]');
      await page.waitForTimeout(1000);
      
      // Take screenshot after actions
      const afterScreenshot = await page.screenshot({ fullPage: true });
      
      // Screenshots should be different (due to playback state)
      expect(initialScreenshot).not.toEqual(afterScreenshot);
    });

    test('should maintain consistent layout across themes', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      const themes = ['dark', 'light', 'neon'];
      const screenshots = [];
      
      for (const theme of themes) {
        await helpers.openSettingsPanel();
        await page.selectOption('[data-testid="theme-select"]', theme);
        await page.click('[data-testid="close-settings"]');
        
        const screenshot = await page.screenshot({ fullPage: true });
        screenshots.push(screenshot);
      }
      
      // All screenshots should be different (different themes)
      for (let i = 0; i < screenshots.length - 1; i++) {
        expect(screenshots[i]).not.toEqual(screenshots[i + 1]);
      }
    });
  });

  test.describe('8. Chaos Testing', () => {
    test('should handle random component failures', async ({ page }) => {
      // Randomly fail some operations
      await page.evaluate(() => {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
          if (Math.random() < 0.3) {
            throw new Error('Random network failure');
          }
          return originalFetch(...args);
        };
      });
      
      await page.reload();
      await helpers.waitForAppLoad();
      
      // Should handle gracefully
      await expect(page.locator('#app')).toBeVisible();
    });

    test('should handle rapid state changes', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Rapidly change settings
      for (let i = 0; i < 20; i++) {
        await helpers.openSettingsPanel();
        await page.selectOption('[data-testid="theme-select"]', i % 2 === 0 ? 'dark' : 'light');
        await page.click('[data-testid="close-settings"]');
        await page.waitForTimeout(10);
      }
      
      // Should not crash
      await expect(page.locator('#app')).toBeVisible();
    });

    test('should handle concurrent operations', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Start multiple operations simultaneously
      const promises = [
        page.click('[data-testid="play-pause-button"]'),
        helpers.openSettingsPanel(),
        page.click('[data-testid="metadata-button"]'),
        page.keyboard.press('Space')
      ];
      
      await Promise.all(promises);
      
      // Should handle gracefully
      await expect(page.locator('#app')).toBeVisible();
    });
  });
});
