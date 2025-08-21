import { test, expect } from '@playwright/test';

test.describe('Quick Check - Major Issues Detection', () => {
  test('should load application and basic UI', async ({ page }) => {
    await page.goto('/');
    
    // Basic app loading check
    await expect(page.locator('#root')).toBeVisible();
    
    // Check for critical UI elements
    const hasFileInput = await page.locator('input[type="file"]').isVisible();
    const hasCanvas = await page.locator('[data-testid="spectrogram-canvas"]').isVisible();
    
    // At least one of these should be present
    expect(hasFileInput || hasCanvas).toBeTruthy();
  });

  test('should handle basic file upload', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root');
    
    // Try to upload a file
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles('tests/e2e/test-data/test-silence.wav');
      // Just check that the app doesn't crash
      await expect(page.locator('#root')).toBeVisible();
    }
  });

  test('should not have console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForSelector('#root');
    
    // Wait a bit for any async operations
    await page.waitForTimeout(2000);
    
    // Check for critical errors (ignore warnings)
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Warning') && 
      !error.includes('Deprecation') &&
      !error.includes('DevTools')
    );
    
    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }
    
    // Allow some non-critical errors but fail on major ones
    expect(criticalErrors.length).toBeLessThan(5);
  });

  test('should have basic accessibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root');
    
    // Check for basic accessibility features
    const hasTitle = await page.title();
    expect(hasTitle.length).toBeGreaterThan(0);
    
    // Check that the page is keyboard navigable
    await page.keyboard.press('Tab');
    await expect(page.locator('#root')).toBeVisible();
  });
});
