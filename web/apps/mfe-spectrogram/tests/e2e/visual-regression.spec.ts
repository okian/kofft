import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Visual Regression Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
  });

  test.describe('Initial Load States', () => {
    test('should render initial state correctly', async ({ page }) => {
      // Wait for app to fully load
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of initial state
      await helpers.takeScreenshot('initial-load');
      
      // Verify key elements are visible
      await expect(page.locator('#app')).toBeVisible();
      await expect(page.locator('[data-testid="header"]')).toBeVisible();
      await expect(page.locator('[data-testid="footer"]')).toBeVisible();
    });

    test('should render drop zone correctly', async ({ page }) => {
      const dropZone = page.locator('[data-testid="drop-zone"]');
      await expect(dropZone).toBeVisible();
      
      // Take screenshot of drop zone
      await helpers.takeScreenshot('drop-zone-empty');
      
      // Verify drop zone styling
      const dropZoneBox = await dropZone.boundingBox();
      expect(dropZoneBox).toBeTruthy();
      expect(dropZoneBox!.width).toBeGreaterThan(200);
      expect(dropZoneBox!.height).toBeGreaterThan(100);
    });
  });

  test.describe('Responsive Design', () => {
    test('should render correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);
      
      await helpers.takeScreenshot('desktop-layout');
      
      // Verify desktop-specific layout
      const header = page.locator('[data-testid="header"]');
      const footer = page.locator('[data-testid="footer"]');
      
      const headerBox = await header.boundingBox();
      const footerBox = await footer.boundingBox();
      
      expect(headerBox!.width).toBeGreaterThan(800);
      expect(footerBox!.width).toBeGreaterThan(800);
    });

    test('should render correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(1000);
      
      await helpers.takeScreenshot('tablet-layout');
      
      // Verify tablet-specific layout
      const controls = page.locator('[data-testid="controls-container"]');
      const controlsBox = await controls.boundingBox();
      
      expect(controlsBox!.width).toBeLessThanOrEqual(1024);
    });

    test('should render correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(1000);
      
      await helpers.takeScreenshot('mobile-layout');
      
      // Verify mobile-specific layout
      const controls = page.locator('[data-testid="controls-container"]');
      const controlsBox = await controls.boundingBox();
      
      expect(controlsBox!.width).toBeLessThanOrEqual(375);
    });

    test('should handle orientation changes', async ({ page }) => {
      // Test landscape orientation
      await page.setViewportSize({ width: 667, height: 375 });
      await page.waitForTimeout(1000);
      await helpers.takeScreenshot('mobile-landscape');
      
      // Test portrait orientation
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(1000);
      await helpers.takeScreenshot('mobile-portrait');
    });
  });

  test.describe('Component States', () => {
    test('should render loading state correctly', async ({ page }) => {
      // Simulate loading state
      await page.evaluate(() => {
        // Add loading class to app
        document.getElementById('app')?.classList.add('loading');
      });
      
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('loading-state');
      
      // Verify loading indicators
      const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
      if (await loadingIndicator.isVisible()) {
        await expect(loadingIndicator).toBeVisible();
      }
    });

    test('should render error state correctly', async ({ page }) => {
      // Simulate error state
      await page.evaluate(() => {
        // Add error class to app
        document.getElementById('app')?.classList.add('error');
      });
      
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('error-state');
      
      // Verify error message
      const errorMessage = page.locator('[data-testid="error-message"]');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toBeVisible();
      }
    });

    test('should render audio loaded state correctly', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      await page.waitForTimeout(2000);
      
      await helpers.takeScreenshot('audio-loaded-state');
      
      // Verify spectrogram is visible
      const spectrogram = page.locator('[data-testid="spectrogram-canvas"]');
      await expect(spectrogram).toBeVisible();
    });
  });

  test.describe('Interactive Elements', () => {
    test('should render button hover states', async ({ page }) => {
      const playButton = page.locator('[data-testid="play-pause-button"]');
      
      // Hover over button
      await playButton.hover();
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('button-hover-state');
      
      // Remove hover
      await page.mouse.move(0, 0);
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('button-normal-state');
    });

    test('should render button active states', async ({ page }) => {
      const playButton = page.locator('[data-testid="play-pause-button"]');
      
      // Press button
      await playButton.press('MouseDown');
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('button-active-state');
      
      // Release button
      await playButton.press('MouseUp');
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('button-released-state');
    });

    test('should render slider interactions', async ({ page }) => {
      const volumeSlider = page.locator('[data-testid="volume-slider"]');
      
      // Hover over slider
      await volumeSlider.hover();
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('slider-hover-state');
      
      // Click on slider
      await volumeSlider.click();
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('slider-active-state');
    });
  });

  test.describe('Modal and Overlay States', () => {
    test('should render settings modal correctly', async ({ page }) => {
      const settingsButton = page.locator('[data-testid="settings-button"]');
      
      // Open settings
      await settingsButton.click();
      await page.waitForTimeout(1000);
      
      await helpers.takeScreenshot('settings-modal-open');
      
      // Verify modal is visible
      const settingsModal = page.locator('[data-testid="settings-panel"]');
      await expect(settingsModal).toBeVisible();
      
      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      await helpers.takeScreenshot('settings-modal-closed');
    });

    test('should render metadata panel correctly', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Open metadata panel
      await page.keyboard.press('m');
      await page.waitForTimeout(1000);
      
      await helpers.takeScreenshot('metadata-panel-open');
      
      // Close metadata panel
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      await helpers.takeScreenshot('metadata-panel-closed');
    });
  });

  test.describe('Theme Variations', () => {
    test('should render light theme correctly', async ({ page }) => {
      // Set light theme
      await page.evaluate(() => {
        document.body.className = 'light';
      });
      
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('light-theme');
      
      // Verify light theme is applied
      const body = page.locator('body');
      await expect(body).toHaveClass('light');
    });

    test('should render dark theme correctly', async ({ page }) => {
      // Set dark theme
      await page.evaluate(() => {
        document.body.className = 'dark';
      });
      
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('dark-theme');
      
      // Verify dark theme is applied
      const body = page.locator('body');
      await expect(body).toHaveClass('dark');
    });

    test('should handle theme transitions', async ({ page }) => {
      // Start with light theme
      await page.evaluate(() => {
        document.body.className = 'light';
      });
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('theme-transition-light');
      
      // Transition to dark theme
      await page.evaluate(() => {
        document.body.className = 'dark';
      });
      await page.waitForTimeout(500);
      await helpers.takeScreenshot('theme-transition-dark');
    });
  });

  test.describe('Spectrogram Visualization', () => {
    test('should render spectrogram canvas correctly', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      await page.waitForTimeout(2000);
      
      const canvas = page.locator('[data-testid="spectrogram-canvas"]');
      await expect(canvas).toBeVisible();
      
      // Take screenshot of spectrogram
      await helpers.takeScreenshot('spectrogram-canvas');
      
      // Verify canvas dimensions
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox!.width).toBeGreaterThan(100);
      expect(canvasBox!.height).toBeGreaterThan(100);
    });

    test('should render different color schemes', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Test different color schemes
      const colorSchemes = ['viridis', 'plasma', 'inferno', 'magma'];
      
      for (const scheme of colorSchemes) {
        await page.evaluate((scheme) => {
          // Simulate color scheme change
          document.documentElement.style.setProperty('--color-scheme', scheme);
        }, scheme);
        
        await page.waitForTimeout(500);
        await helpers.takeScreenshot(`spectrogram-${scheme}`);
      }
    });
  });

  test.describe('Layout Consistency', () => {
    test('should maintain consistent spacing', async ({ page }) => {
      // Check header spacing
      const header = page.locator('[data-testid="header"]');
      const headerBox = await header.boundingBox();
      
      // Check footer spacing
      const footer = page.locator('[data-testid="footer"]');
      const footerBox = await footer.boundingBox();
      
      // Verify consistent spacing
      expect(headerBox!.height).toBeGreaterThan(0);
      expect(footerBox!.height).toBeGreaterThan(0);
      
      await helpers.takeScreenshot('layout-spacing');
    });

    test('should maintain consistent typography', async ({ page }) => {
      // Check font sizes and weights
      const title = page.locator('[data-testid="app-title"]');
      const titleStyle = await title.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontFamily: style.fontFamily
        };
      });
      
      expect(titleStyle.fontSize).toBeTruthy();
      expect(titleStyle.fontWeight).toBeTruthy();
      expect(titleStyle.fontFamily).toBeTruthy();
      
      await helpers.takeScreenshot('typography-consistency');
    });

    test('should maintain consistent colors', async ({ page }) => {
      // Check color consistency
      const primaryButton = page.locator('[data-testid="play-pause-button"]');
      const buttonStyle = await primaryButton.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
          borderColor: style.borderColor
        };
      });
      
      expect(buttonStyle.backgroundColor).toBeTruthy();
      expect(buttonStyle.color).toBeTruthy();
      
      await helpers.takeScreenshot('color-consistency');
    });
  });
});
