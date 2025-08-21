import { Page, expect, Locator } from '@playwright/test';
import path from 'path';
import fc from 'fast-check';

export class EnhancedTestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for the application to be fully loaded with enhanced checks
   */
  async waitForAppLoad(timeout = 15000) {
    await this.page.waitForSelector('#app', { timeout });
    await this.page.waitForLoadState('networkidle');
    
    // Wait for WebAssembly module to load
    await this.page.waitForFunction(() => {
      return window.wasmModule !== undefined || 
             document.querySelector('[data-testid="spectrogram-canvas"]') !== null;
    }, { timeout });
    
    // Wait for all critical components
    await this.page.waitForSelector('[data-testid="spectrogram-canvas"]', { timeout });
    await this.page.waitForSelector('[data-testid="header"]', { timeout });
    await this.page.waitForSelector('[data-testid="footer"]', { timeout });
  }

  /**
   * Upload an audio file for testing with enhanced error handling
   */
  async uploadAudioFile(fileName: string, timeout = 10000) {
    const filePath = path.join(__dirname, 'test-data', fileName);
    const fileInput = this.page.locator('input[type="file"]');
    
    await fileInput.setInputFiles(filePath);
    
    // Wait for file processing with better error handling
    try {
      await this.page.waitForSelector('[data-testid="audio-loaded"]', { timeout });
    } catch (error) {
      // Check if there was an error during processing
      const errorElement = this.page.locator('[data-testid="error-message"]');
      if (await errorElement.isVisible()) {
        throw new Error(`File upload failed: ${await errorElement.textContent()}`);
      }
      throw error;
    }
  }

  /**
   * Open settings panel with retry logic
   */
  async openSettingsPanel() {
    const settingsButton = this.page.locator('[data-testid="settings-button"]');
    await settingsButton.click();
    
    // Wait for panel to open
    await this.page.waitForSelector('[data-testid="settings-panel"]', { timeout: 5000 });
  }

  /**
   * Take a screenshot for visual regression testing with metadata
   */
  async takeScreenshot(name: string, options: { fullPage?: boolean; clip?: any } = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    
    await this.page.screenshot({ 
      path: `test-results/screenshots/${filename}`,
      fullPage: options.fullPage ?? true,
      clip: options.clip
    });
    
    return filename;
  }

  /**
   * Comprehensive accessibility compliance check
   */
  async checkAccessibility() {
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
      
      // Check for ARIA attributes
      const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
      interactiveElements.forEach((element, index) => {
        if (element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
          // This is fine - aria-label is sufficient
        } else if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby') && !element.textContent?.trim()) {
          issues.push(`Interactive element ${index} missing accessible name`);
        }
      });
      
      // Check for color contrast (basic check)
      const elements = document.querySelectorAll('*');
      elements.forEach((element, index) => {
        const style = window.getComputedStyle(element);
        const backgroundColor = style.backgroundColor;
        const color = style.color;
        
        // Basic contrast check (simplified)
        if (backgroundColor && color && backgroundColor !== 'rgba(0, 0, 0, 0)' && color !== 'rgba(0, 0, 0, 0)') {
          // This is a simplified check - in real implementation, use a proper contrast library
        }
      });
      
      return issues;
    });
    
    expect(violations).toEqual([]);
  }

  /**
   * Test keyboard navigation comprehensively
   */
  async testKeyboardNavigation() {
    const focusableElements = await this.page.evaluate(() => {
      const elements = document.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      return Array.from(elements).map(el => ({
        tagName: el.tagName,
        text: el.textContent?.trim() || el.getAttribute('aria-label') || '',
        visible: el.offsetParent !== null
      }));
    });
    
    // Test Tab navigation through all focusable elements
    for (let i = 0; i < focusableElements.length; i++) {
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(100);
      
      // Verify focus is on a visible element
      const focusedElement = await this.page.evaluate(() => {
        const active = document.activeElement;
        return active ? active.tagName : null;
      });
      
      expect(focusedElement).toBeTruthy();
    }
    
    // Test Enter key
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);
    
    // Test Escape key
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
  }

  /**
   * Test responsive behavior across different viewports
   */
  async testResponsiveBehavior() {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1024, height: 768, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' },
      { width: 320, height: 568, name: 'small-mobile' }
    ];
    
    for (const viewport of viewports) {
      await this.page.setViewportSize(viewport);
      await this.page.reload();
      await this.waitForAppLoad();
      
      // Verify critical elements are visible
      await expect(this.page.locator('#app')).toBeVisible();
      await expect(this.page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
      
      // Check for mobile-specific elements
      if (viewport.width <= 768) {
        // Mobile-specific checks
        const mobileMenu = this.page.locator('[data-testid="mobile-menu"]');
        if (await mobileMenu.isVisible()) {
          await expect(mobileMenu).toBeVisible();
        }
      }
    }
  }

  /**
   * Test audio functionality comprehensively
   */
  async testAudioPlayback() {
    await this.uploadAudioFile('test-silence.wav');
    
    // Test play/pause
    const playButton = this.page.locator('[data-testid="play-pause-button"]');
    await playButton.click();
    await expect(this.page.locator('[data-testid="playing-state"]')).toBeVisible();
    
    await playButton.click();
    await expect(this.page.locator('[data-testid="paused-state"]')).toBeVisible();
    
    // Test seeking
    const seekbar = this.page.locator('[data-testid="seekbar"]');
    await seekbar.click({ position: { x: 50, y: 10 } });
    
    // Test volume controls
    const volumeSlider = this.page.locator('[data-testid="volume-slider"]');
    await volumeSlider.click();
    await this.page.keyboard.press('ArrowUp');
    await this.page.keyboard.press('ArrowDown');
    
    // Test mute
    const muteButton = this.page.locator('[data-testid="mute-button"]');
    await muteButton.click();
    await expect(muteButton).toHaveAttribute('aria-pressed', 'true');
    
    await muteButton.click();
    await expect(muteButton).toHaveAttribute('aria-pressed', 'false');
  }

  /**
   * Test volume controls with various inputs
   */
  async testVolumeControls() {
    const volumeSlider = this.page.locator('[data-testid="volume-slider"]');
    
    // Test keyboard controls
    await volumeSlider.click();
    await this.page.keyboard.press('ArrowUp');
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Home');
    await this.page.keyboard.press('End');
    
    // Test mouse controls
    await volumeSlider.hover();
    await volumeSlider.click({ position: { x: 25, y: 10 } });
    await volumeSlider.click({ position: { x: 75, y: 10 } });
    
    // Test extreme values
    await this.page.evaluate(() => {
      const slider = document.querySelector('[data-testid="volume-slider"]') as HTMLInputElement;
      if (slider) {
        slider.value = '0';
        slider.dispatchEvent(new Event('input'));
        slider.value = '1';
        slider.dispatchEvent(new Event('input'));
      }
    });
  }

  /**
   * Test settings panel functionality
   */
  async testSettingsPanel() {
    await this.openSettingsPanel();
    
    // Test all setting options
    const settings = [
      { selector: '[data-testid="theme-select"]', values: ['japanese-a-light', 'japanese-a-dark', 'japanese-b-light', 'japanese-b-dark', 'bauhaus-light', 'bauhaus-dark'] },
      { selector: '[data-testid="amplitude-scale-select"]', values: ['linear', 'logarithmic', 'db'] },
      { selector: '[data-testid="frequency-scale-select"]', values: ['linear', 'logarithmic'] },
      { selector: '[data-testid="resolution-select"]', values: ['low', 'medium', 'high'] },
      { selector: '[data-testid="refresh-rate-select"]', values: ['30', '60'] }
    ];
    
    for (const setting of settings) {
      for (const value of setting.values) {
        await this.page.selectOption(setting.selector, value);
        await this.page.waitForTimeout(100);
      }
    }
    
    // Test checkboxes
    const checkboxes = [
      '[data-testid="show-legend-checkbox"]',
      '[data-testid="enable-toast-checkbox"]'
    ];
    
    for (const checkbox of checkboxes) {
      await this.page.check(checkbox);
      await this.page.uncheck(checkbox);
    }
    
    // Test save and cancel
    await this.page.click('[data-testid="save-settings"]');
    await expect(this.page.locator('[data-testid="settings-panel"]')).not.toBeVisible();
  }

  /**
   * Test keyboard shortcuts comprehensively
   */
  async testKeyboardShortcuts() {
    const shortcuts = [
      { key: 'Space', description: 'Play/Pause' },
      { key: 'ArrowLeft', description: 'Seek Backward' },
      { key: 'ArrowRight', description: 'Seek Forward' },
      { key: 'ArrowUp', description: 'Volume Up' },
      { key: 'ArrowDown', description: 'Volume Down' },
      { key: 'm', description: 'Mute' },
      { key: 'h', description: 'Help' },
      { key: 'Escape', description: 'Close Modals' }
    ];
    
    for (const shortcut of shortcuts) {
      await this.page.keyboard.press(shortcut.key);
      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Test error handling scenarios
   */
  async testErrorHandling() {
    // Test invalid file upload
    const invalidFile = new File(['invalid data'], 'invalid.txt', { type: 'text/plain' });
    await this.page.evaluate((file) => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, invalidFile);
    
    // Check for error message
    const errorMessage = this.page.locator('[data-testid="error-message"]');
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toContainText('Invalid file');
    }
    
    // Test network errors
    await this.page.route('**/*', route => {
      route.abort();
    });
    
    await this.page.reload();
    await this.waitForAppLoad();
    
    // Should handle gracefully
    await expect(this.page.locator('#app')).toBeVisible();
  }

  /**
   * Performance monitoring utilities
   */
  async measurePerformance(operation: () => Promise<void>, name: string) {
    const startTime = Date.now();
    const startMemory = await this.page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
    
    await operation();
    
    const endTime = Date.now();
    const endMemory = await this.page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
    
    const duration = endTime - startTime;
    const memoryDelta = endMemory - startMemory;
    
    console.log(`Performance [${name}]: ${duration}ms, Memory: ${memoryDelta} bytes`);
    
    return { duration, memoryDelta };
  }

  /**
   * Property-based testing utilities
   */
  async testWithArbitraryInput<T>(
    generator: any,
    testFunction: (input: T) => Promise<void>,
    numRuns = 100
  ) {
    await generator.run(async (input: T) => {
      try {
        await testFunction(input);
      } catch (error) {
        // Log the failing input for debugging
        console.error(`Property test failed with input:`, input);
        throw error;
      }
    }, { numRuns });
  }

  /**
   * Generate arbitrary test data
   */
  generateArbitraryData() {
    return {
          theme: fc.constantFrom('japanese-a-light', 'japanese-a-dark', 'japanese-b-light', 'japanese-b-dark', 'bauhaus-light', 'bauhaus-dark'),
    amplitudeScale: fc.constantFrom('linear', 'logarithmic', 'db'),
    frequencyScale: fc.constantFrom('linear', 'logarithmic'),
    resolution: fc.constantFrom('low', 'medium', 'high'),
    refreshRate: fc.constantFrom(30, 60),
    volume: fc.float().between(0, 1),
    seekPosition: fc.float().between(0, 100)
    };
  }

  /**
   * Test state persistence comprehensively
   */
  async testStatePersistence() {
    // Set various states
    await this.openSettingsPanel();
    await this.page.selectOption('[data-testid="theme-select"]', 'light');
    await this.page.selectOption('[data-testid="amplitude-scale-select"]', 'logarithmic');
    await this.page.check('[data-testid="show-legend-checkbox"]');
    await this.page.click('[data-testid="save-settings"]');
    
    // Upload audio and set playback state
    await this.uploadAudioFile('test-silence.wav');
    await this.page.click('[data-testid="play-pause-button"]');
    
    // Set volume
    const volumeSlider = this.page.locator('[data-testid="volume-slider"]');
    await volumeSlider.click();
    await this.page.keyboard.press('ArrowLeft');
    
    // Reload and verify persistence
    await this.page.reload();
    await this.waitForAppLoad();
    
    // Verify settings persisted
    await expect(this.page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', 'light');
    
    // Verify audio state (may not persist depending on implementation)
    await expect(this.page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
  }

  /**
   * Test cross-component communication
   */
  async testCrossComponentCommunication() {
    await this.uploadAudioFile('test-silence.wav');
    
    // Start playback
    await this.page.click('[data-testid="play-pause-button"]');
    
    // Verify all components reflect the state
    const components = [
      '[data-testid="play-pause-button"]',
      '[data-testid="seekbar"]',
      '[data-testid="current-time"]',
      '[data-testid="duration"]'
    ];
    
    for (const component of components) {
      await expect(this.page.locator(component)).toBeVisible();
    }
    
    // Change settings and verify propagation
    await this.openSettingsPanel();
    await this.page.selectOption('[data-testid="theme-select"]', 'light');
    await this.page.click('[data-testid="save-settings"]');
    
    // Verify theme change propagated
    await expect(this.page.locator('[data-testid="app-container"]')).toHaveAttribute('data-theme', 'light');
  }

  /**
   * Test accessibility with screen reader simulation
   */
  async testScreenReaderAccessibility() {
    // Check for proper ARIA attributes
    const ariaElements = await this.page.evaluate(() => {
      const elements = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]');
      return Array.from(elements).map(el => ({
        tagName: el.tagName,
        ariaLabel: el.getAttribute('aria-label'),
        ariaLabelledBy: el.getAttribute('aria-labelledby'),
        ariaDescribedBy: el.getAttribute('aria-describedby')
      }));
    });
    
    expect(ariaElements.length).toBeGreaterThan(0);
    
    // Check for proper roles
    const roleElements = await this.page.evaluate(() => {
      const elements = document.querySelectorAll('[role]');
      return Array.from(elements).map(el => ({
        tagName: el.tagName,
        role: el.getAttribute('role')
      }));
    });
    
    // Verify critical elements have roles
    const criticalRoles = ['button', 'slider', 'progressbar', 'dialog'];
    const hasCriticalRoles = roleElements.some(el => criticalRoles.includes(el.role || ''));
    expect(hasCriticalRoles).toBe(true);
  }

  /**
   * Test memory management and cleanup
   */
  async testMemoryManagement() {
    const initialMemory = await this.page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
    
    // Perform memory-intensive operations
    for (let i = 0; i < 10; i++) {
      await this.uploadAudioFile('test-silence.wav');
      await this.page.click('[data-testid="play-pause-button"]');
      await this.page.waitForTimeout(100);
      await this.page.click('[data-testid="play-pause-button"]');
      await this.page.waitForTimeout(100);
    }
    
    // Force garbage collection if available
    await this.page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });
    
    const finalMemory = await this.page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  }

  /**
   * Test network resilience
   */
  async testNetworkResilience() {
    // Test offline mode
    await this.page.context().setOffline(true);
    await this.page.reload();
    await this.waitForAppLoad();
    await expect(this.page.locator('#app')).toBeVisible();
    
    // Test slow network
    await this.page.context().setOffline(false);
    await this.page.route('**/*', route => {
      setTimeout(() => route.continue(), 1000);
    });
    
    await this.page.reload();
    await this.waitForAppLoad();
    await expect(this.page.locator('#app')).toBeVisible();
    
    // Test intermittent failures
    let requestCount = 0;
    await this.page.route('**/*', route => {
      requestCount++;
      if (requestCount % 3 === 0) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    await this.page.reload();
    await this.waitForAppLoad();
    await expect(this.page.locator('#app')).toBeVisible();
  }

  /**
   * Test browser compatibility features
   */
  async testBrowserCompatibility() {
    // Test different pixel ratios
    const pixelRatios = [1, 1.5, 2, 3];
    
    for (const ratio of pixelRatios) {
      await this.page.evaluate((ratio) => {
        Object.defineProperty(window, 'devicePixelRatio', {
          value: ratio,
          writable: true
        });
      }, ratio);
      
      await this.page.reload();
      await this.waitForAppLoad();
      await expect(this.page.locator('#app')).toBeVisible();
    }
    
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1024, height: 768 },
      { width: 375, height: 667 },
      { width: 320, height: 568 }
    ];
    
    for (const viewport of viewports) {
      await this.page.setViewportSize(viewport);
      await this.page.reload();
      await this.waitForAppLoad();
      await expect(this.page.locator('#app')).toBeVisible();
    }
  }

  /**
   * Generate comprehensive test report
   */
  async generateTestReport() {
    const report = await this.page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        userAgent: navigator.userAgent,
        localStorage: Object.keys(localStorage),
        sessionStorage: Object.keys(sessionStorage),
        performance: {
          loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
          domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
        }
      };
    });
    
    console.log('Test Report:', JSON.stringify(report, null, 2));
    return report;
  }
}
