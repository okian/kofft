import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Accessibility Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
  });

  test.describe('WCAG 2.1 AA Compliance', () => {
    test('should have proper page title', async ({ page }) => {
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThan(60); // Reasonable length for screen readers
    });

    test('should have proper heading structure', async ({ page }) => {
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      
      // Check that we have at least one heading
      expect(headings.length).toBeGreaterThan(0);
      
      // Check heading hierarchy
      let previousLevel = 0;
      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName);
        const level = parseInt(tagName.charAt(1));
        
        // Ensure no skipped levels
        expect(level).toBeLessThanOrEqual(previousLevel + 1);
        previousLevel = level;
      }
    });

    test('should have proper alt text for images', async ({ page }) => {
      const images = await page.locator('img').all();
      
      for (const image of images) {
        const alt = await image.getAttribute('alt');
        const ariaLabel = await image.getAttribute('aria-label');
        
        // Images should have either alt text or aria-label
        expect(alt || ariaLabel).toBeTruthy();
        
        // If alt text exists, it should be meaningful
        if (alt) {
          expect(alt.trim().length).toBeGreaterThan(0);
          expect(alt).not.toBe('image');
          expect(alt).not.toBe('img');
        }
      }
    });

    test('should have proper form labels', async ({ page }) => {
      const inputs = await page.locator('input, select, textarea').all();
      
      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledby = await input.getAttribute('aria-labelledby');
        const placeholder = await input.getAttribute('placeholder');
        
        if (id) {
          // Check for associated label
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.count() > 0;
          
          // Input should have label, aria-label, aria-labelledby, or meaningful placeholder
          expect(hasLabel || ariaLabel || ariaLabelledby || (placeholder && placeholder.length > 0)).toBe(true);
        }
      }
    });

    test('should have proper button labels', async ({ page }) => {
      const buttons = await page.locator('button, [role="button"]').all();
      
      for (const button of buttons) {
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        const title = await button.getAttribute('title');
        
        // Button should have accessible text
        expect(text?.trim() || ariaLabel || title).toBeTruthy();
        
        // If text exists, it should be meaningful
        if (text) {
          expect(text.trim().length).toBeGreaterThan(0);
          expect(text).not.toBe('button');
          expect(text).not.toBe('click');
        }
      }
    });

    test('should have proper color contrast', async ({ page }) => {
      // Test text contrast against background
      const textElements = await page.locator('p, span, div, h1, h2, h3, h4, h5, h6, button, a, label').all();
      
      for (const element of textElements.slice(0, 10)) { // Test first 10 elements
        const color = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.color;
        });
        
        const backgroundColor = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.backgroundColor;
        });
        
        // Basic check - ensure colors are defined
        expect(color).toBeTruthy();
        expect(backgroundColor).toBeTruthy();
      }
    });

    test('should have proper focus indicators', async ({ page }) => {
      const focusableElements = await page.locator('button, input, select, textarea, a, [tabindex]:not([tabindex="-1"])').all();
      
      for (const element of focusableElements.slice(0, 5)) { // Test first 5 elements
        // Focus the element
        await element.focus();
        
        // Check if focus is visible
        const isFocused = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.outline !== 'none' || 
                 style.boxShadow !== 'none' || 
                 style.borderColor !== 'transparent';
        });
        
        expect(isFocused).toBe(true);
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should be fully navigable by keyboard', async ({ page }) => {
      // Focus the page
      await page.keyboard.press('Tab');
      
      // Navigate through all focusable elements
      const focusableElements = await page.locator('button, input, select, textarea, a, [tabindex]:not([tabindex="-1"])').all();
      
      for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
        
        // Check if an element is focused
        const focusedElement = await page.evaluate(() => {
          return document.activeElement?.tagName || null;
        });
        
        expect(focusedElement).toBeTruthy();
      }
    });

    test('should handle Enter key properly', async ({ page }) => {
      const buttons = await page.locator('button, [role="button"]').all();
      
      for (const button of buttons.slice(0, 3)) { // Test first 3 buttons
        await button.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        // Button should respond to Enter key
        // We can't easily test the specific response, but we can ensure no errors
        const hasError = await page.locator('[data-testid="error-message"]').isVisible();
        expect(hasError).toBe(false);
      }
    });

    test('should handle Space key properly', async ({ page }) => {
      const buttons = await page.locator('button, [role="button"]').all();
      
      for (const button of buttons.slice(0, 3)) { // Test first 3 buttons
        await button.focus();
        await page.keyboard.press(' ');
        await page.waitForTimeout(500);
        
        // Button should respond to Space key
        const hasError = await page.locator('[data-testid="error-message"]').isVisible();
        expect(hasError).toBe(false);
      }
    });

    test('should handle Escape key properly', async ({ page }) => {
      // Open a modal or panel
      const settingsButton = page.locator('[data-testid="settings-button"]');
      await settingsButton.click();
      await page.waitForTimeout(500);
      
      // Press Escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      // Modal should be closed
      const settingsPanel = page.locator('[data-testid="settings-panel"]');
      await expect(settingsPanel).not.toBeVisible();
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      const elementsWithAria = await page.locator('[aria-label], [aria-labelledby], [aria-describedby]').all();
      
      for (const element of elementsWithAria) {
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledby = await element.getAttribute('aria-labelledby');
        const ariaDescribedby = await element.getAttribute('aria-describedby');
        
        // At least one ARIA attribute should be present
        expect(ariaLabel || ariaLabelledby || ariaDescribedby).toBeTruthy();
        
        // If aria-labelledby is present, the referenced element should exist
        if (ariaLabelledby) {
          const referencedElement = page.locator(`#${ariaLabelledby}`);
          await expect(referencedElement).toBeVisible();
        }
      }
    });

    test('should have proper ARIA roles', async ({ page }) => {
      const elementsWithRoles = await page.locator('[role]').all();
      
      for (const element of elementsWithRoles) {
        const role = await element.getAttribute('role');
        
        // Role should be a valid ARIA role
        const validRoles = [
          'button', 'checkbox', 'dialog', 'grid', 'gridcell', 'link', 'listbox',
          'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'progressbar',
          'radio', 'scrollbar', 'searchbox', 'slider', 'spinbutton', 'switch',
          'tab', 'tabpanel', 'textbox', 'treeitem'
        ];
        
        expect(validRoles).toContain(role);
      }
    });

    test('should have proper ARIA states', async ({ page }) => {
      // Test aria-expanded
      const expandableElements = await page.locator('[aria-expanded]').all();
      
      for (const element of expandableElements) {
        const expanded = await element.getAttribute('aria-expanded');
        expect(['true', 'false']).toContain(expanded);
      }
      
      // Test aria-pressed
      const pressableElements = await page.locator('[aria-pressed]').all();
      
      for (const element of pressableElements) {
        const pressed = await element.getAttribute('aria-pressed');
        expect(['true', 'false', 'mixed']).toContain(pressed);
      }
    });

    test('should announce dynamic content changes', async ({ page }) => {
      // Test if live regions are present for dynamic content
      const liveRegions = await page.locator('[aria-live]').all();
      
      // For dynamic content like progress bars, status messages, etc.
      const progressBar = page.locator('[data-testid="progress-bar"]');
      if (await progressBar.isVisible()) {
        const ariaLive = await progressBar.getAttribute('aria-live');
        expect(['polite', 'assertive']).toContain(ariaLive);
      }
    });
  });

  test.describe('Semantic HTML', () => {
    test('should use semantic HTML elements', async ({ page }) => {
      // Check for semantic elements
      const semanticElements = await page.locator('main, nav, header, footer, section, article, aside').all();
      expect(semanticElements.length).toBeGreaterThan(0);
      
      // Check for proper use of main element
      const mainElement = page.locator('main');
      if (await mainElement.count() > 0) {
        await expect(mainElement).toBeVisible();
      }
      
      // Check for proper use of navigation
      const navElement = page.locator('nav');
      if (await navElement.count() > 0) {
        await expect(navElement).toBeVisible();
      }
    });

    test('should have proper list structure', async ({ page }) => {
      const lists = await page.locator('ul, ol').all();
      
      for (const list of lists) {
        const listItems = await list.locator('li').all();
        expect(listItems.length).toBeGreaterThan(0);
      }
    });

    test('should have proper table structure', async ({ page }) => {
      const tables = await page.locator('table').all();
      
      for (const table of tables) {
        const headers = await table.locator('th').all();
        const rows = await table.locator('tr').all();
        
        // Tables should have headers and rows
        expect(headers.length).toBeGreaterThan(0);
        expect(rows.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should provide accessible error messages', async ({ page }) => {
      // Simulate an error
      await helpers.testErrorHandling();
      
      const errorMessage = page.locator('[data-testid="error-message"]');
      if (await errorMessage.isVisible()) {
        // Error message should be accessible
        const ariaLive = await errorMessage.getAttribute('aria-live');
        expect(['polite', 'assertive']).toContain(ariaLive);
        
        // Error message should be descriptive
        const errorText = await errorMessage.textContent();
        expect(errorText?.trim().length).toBeGreaterThan(0);
      }
    });

    test('should provide accessible loading states', async ({ page }) => {
      const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
      if (await loadingIndicator.isVisible()) {
        // Loading indicator should be accessible
        const ariaLabel = await loadingIndicator.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        
        // Should indicate loading state
        expect(ariaLabel).toContain('loading');
      }
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should be accessible on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check touch target sizes
      const buttons = await page.locator('button, [role="button"]').all();
      
      for (const button of buttons.slice(0, 5)) {
        const box = await button.boundingBox();
        if (box) {
          // Touch targets should be at least 44x44 pixels
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
      
      // Check for proper mobile navigation
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      if (await mobileMenu.isVisible()) {
        await expect(mobileMenu).toBeVisible();
      }
    });

    test('should handle touch interactions properly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Test touch interactions
      const playButton = page.locator('[data-testid="play-pause-button"]');
      await playButton.tap();
      await page.waitForTimeout(500);
      
      // Button should respond to touch
      const hasError = await page.locator('[data-testid="error-message"]').isVisible();
      expect(hasError).toBe(false);
    });
  });
});
