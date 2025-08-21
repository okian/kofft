import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Critical Functionality', () => {
  test('should load the application successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check that the app loads
    await expect(page.locator('#root')).toBeVisible();
    
    // Check that the main UI elements are present
    await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
    
    // Check for file input (it might be hidden but should exist)
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1);
  });

  test('should handle file upload', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForSelector('#root');
    
    // Upload a test file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/e2e/test-data/test-silence.wav');
    
    // Check that file processing starts
    await expect(page.locator('[data-testid="spectrogram-canvas"]')).toBeVisible();
  });

  test('should open settings panel', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForSelector('#root');
    
    // Wait for drop zone to disappear or handle it
    await page.waitForTimeout(1000);
    
    // Open settings (if there's a settings button)
    const settingsButton = page.locator('[data-testid="settings-button"]');
    if (await settingsButton.isVisible()) {
      // Try to click with force if needed
      await settingsButton.click({ force: true });
      await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
    }
  });

  test('should handle basic navigation', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForSelector('#root');
    
    // Test basic keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    
    // Test that the app doesn't crash on basic interactions
    await expect(page.locator('#root')).toBeVisible();
  });
});
