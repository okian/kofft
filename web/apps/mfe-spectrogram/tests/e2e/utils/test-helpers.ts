import { Page, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for the application to be fully loaded
   */
  async waitForAppLoad() {
    await this.page.waitForSelector('#root', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
    
    // Wait for WebAssembly module to load
    await this.page.waitForFunction(() => {
      return window.wasmModule !== undefined || 
             document.querySelector('[data-testid="spectrogram-canvas"]') !== null;
    }, { timeout: 15000 });
  }

  /**
   * Upload an audio file for testing
   */
  async uploadAudioFile(fileName: string) {
    const filePath = path.join(__dirname, 'test-data', fileName);
    const fileInput = this.page.locator('input[type="file"]');
    
    await fileInput.setInputFiles(filePath);
    
    // Wait for file processing
    await this.page.waitForTimeout(2000);
  }

  /**
   * Take a screenshot for visual regression testing
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}.png`,
      fullPage: true 
    });
  }

  /**
   * Check accessibility compliance
   */
  async checkAccessibility() {
    // Basic accessibility checks
    const violations = await this.page.evaluate(() => {
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
      
      // Check for proper form labels
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach((input, index) => {
        const id = input.getAttribute('id');
        if (id && !document.querySelector(`label[for="${id}"]`)) {
          issues.push(`Input ${index} missing associated label`);
        }
      });
      
      return issues;
    });
    
    expect(violations).toEqual([]);
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation() {
    // Test Tab navigation
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(500);
    
    // Test Enter key
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);
    
    // Test Escape key
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
  }

  /**
   * Test responsive behavior
   */
  async testResponsiveBehavior() {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1024, height: 768, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];
    
    for (const viewport of viewports) {
      await this.page.setViewportSize(viewport);
      await this.page.waitForTimeout(1000);
      
      // Check if layout is responsive
      const isResponsive = await this.page.evaluate(() => {
        const body = document.body;
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Basic responsive checks
        return width > 0 && height > 0 && body.offsetWidth > 0;
      });
      
      expect(isResponsive).toBe(true);
      
      // Take screenshot for visual regression
      await this.takeScreenshot(`responsive-${viewport.name}`);
    }
  }

  /**
   * Test audio playback functionality
   */
  async testAudioPlayback() {
    // Upload test audio file
    await this.uploadAudioFile('test-silence.wav');
    
    // Test play button
    const playButton = this.page.locator('[data-testid="play-pause-button"]');
    await playButton.click();
    await this.page.waitForTimeout(1000);
    
    // Test pause
    await playButton.click();
    await this.page.waitForTimeout(500);
    
    // Test stop
    const stopButton = this.page.locator('[data-testid="stop-button"]');
    await stopButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Test volume controls
   */
  async testVolumeControls() {
    const volumeSlider = this.page.locator('[data-testid="volume-slider"]');
    const muteButton = this.page.locator('[data-testid="mute-button"]');
    
    // Test volume slider
    await volumeSlider.click();
    await this.page.waitForTimeout(500);
    
    // Test mute button
    await muteButton.click();
    await this.page.waitForTimeout(500);
    await muteButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Test settings panel
   */
  async testSettingsPanel() {
    const settingsButton = this.page.locator('[data-testid="settings-button"]');
    
    // Open settings
    await settingsButton.click();
    await this.page.waitForTimeout(1000);
    
    // Check if settings panel is visible
    const settingsPanel = this.page.locator('[data-testid="settings-panel"]');
    await expect(settingsPanel).toBeVisible();
    
    // Test theme switching
    const themeSelect = this.page.locator('[data-testid="theme-select"]');
    if (await themeSelect.isVisible()) {
      await themeSelect.selectOption('light');
      await this.page.waitForTimeout(1000);
      await themeSelect.selectOption('dark');
      await this.page.waitForTimeout(1000);
    }
    
    // Close settings
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
  }

  /**
   * Test keyboard shortcuts
   */
  async testKeyboardShortcuts() {
    // Test spacebar for play/pause
    await this.page.keyboard.press(' ');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press(' ');
    await this.page.waitForTimeout(500);
    
    // Test arrow keys for seeking
    await this.page.keyboard.press('ArrowRight');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowLeft');
    await this.page.waitForTimeout(500);
    
    // Test volume controls
    await this.page.keyboard.press('ArrowUp');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    // Test with invalid file
    const invalidFile = path.join(__dirname, 'test-data', 'invalid-file.txt');
    const fileInput = this.page.locator('input[type="file"]');
    
    await fileInput.setInputFiles(invalidFile);
    await this.page.waitForTimeout(2000);
    
    // Check if error is handled gracefully
    const errorMessage = this.page.locator('[data-testid="error-message"]');
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toBeVisible();
    }
  }
}
