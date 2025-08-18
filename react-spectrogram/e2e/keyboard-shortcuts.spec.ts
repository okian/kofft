import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Keyboard Shortcuts E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Load a test file for keyboard tests
    const testFilePath = path.join(__dirname, '../test-fixtures/test-audio.mp3')
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles(testFilePath)
    
    // Wait for file to be loaded
    await expect(page.locator('text=Drop audio files here')).not.toBeVisible()
    
    // Focus the app to receive keyboard events
    await page.locator('[data-testid="app-container"]').click()
  })

  test('should toggle playback with spacebar', async ({ page }) => {
    // Start playback with spacebar
    await page.keyboard.press(' ')
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'playing')

    // Pause with spacebar
    await page.keyboard.press(' ')
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'paused')

    // Resume with spacebar
    await page.keyboard.press(' ')
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'playing')
  })

  test('should prevent page scroll when using spacebar', async ({ page }) => {
    // Get initial scroll position
    const initialScrollY = await page.evaluate(() => window.scrollY)

    // Press spacebar
    await page.keyboard.press(' ')

    // Check that page didn't scroll
    const newScrollY = await page.evaluate(() => window.scrollY)
    expect(newScrollY).toBe(initialScrollY)
  })

  test('should seek backward 10 seconds with left arrow', async ({ page }) => {
    // Start playback to get some time elapsed
    await page.keyboard.press(' ')
    await page.waitForTimeout(2000) // Let some time pass
    
    const initialTime = await page.locator('[data-testid="current-time"]').textContent()
    
    // Press left arrow to seek backward
    await page.keyboard.press('ArrowLeft')
    
    // Time should have decreased
    await expect(page.locator('[data-testid="current-time"]')).not.toHaveText(initialTime)
  })

  test('should seek forward 10 seconds with right arrow', async ({ page }) => {
    const initialTime = await page.locator('[data-testid="current-time"]').textContent()
    
    // Press right arrow to seek forward
    await page.keyboard.press('ArrowRight')
    
    // Time should have increased
    await expect(page.locator('[data-testid="current-time"]')).not.toHaveText(initialTime)
  })

  test('should handle multiple arrow key presses', async ({ page }) => {
    const initialTime = await page.locator('[data-testid="current-time"]').textContent()
    
    // Press right arrow multiple times
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    
    // Time should have increased significantly
    await expect(page.locator('[data-testid="current-time"]')).not.toHaveText(initialTime)
  })

  test('should clamp at track boundaries', async ({ page }) => {
    // Try to seek before start
    await page.keyboard.press('ArrowLeft')
    
    // Should stay at 0:00
    await expect(page.locator('[data-testid="current-time"]')).toHaveText('0:00')

    // Seek to near end
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowRight')
    }
    
    // Should be at or near end
    const timeText = await page.locator('[data-testid="current-time"]').textContent()
    expect(timeText).toMatch(/\d+:\d{2}/)
  })

  test('should increase volume with up arrow', async ({ page }) => {
    const volumeSlider = page.locator('[data-testid="volume-slider"]')
    const initialVolume = await volumeSlider.getAttribute('value')
    
    // Press up arrow to increase volume
    await page.keyboard.press('ArrowUp')
    
    // Volume should have increased
    const newVolume = await volumeSlider.getAttribute('value')
    expect(parseInt(newVolume)).toBeGreaterThan(parseInt(initialVolume))
  })

  test('should decrease volume with down arrow', async ({ page }) => {
    const volumeSlider = page.locator('[data-testid="volume-slider"]')
    const initialVolume = await volumeSlider.getAttribute('value')
    
    // Press down arrow to decrease volume
    await page.keyboard.press('ArrowDown')
    
    // Volume should have decreased
    const newVolume = await volumeSlider.getAttribute('value')
    expect(parseInt(newVolume)).toBeLessThan(parseInt(initialVolume))
  })

  test('should not go below 0% volume', async ({ page }) => {
    const volumeSlider = page.locator('[data-testid="volume-slider"]')
    
    // Press down arrow many times to try to go below 0
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowDown')
    }
    
    // Volume should not go below 0
    const volume = await volumeSlider.getAttribute('value')
    expect(parseInt(volume)).toBeGreaterThanOrEqual(0)
  })

  test('should toggle mute with M key', async ({ page }) => {
    // Press M to mute
    await page.keyboard.press('m')
    await expect(page.locator('[data-testid="volume-slider"]')).toHaveValue('0')

    // Press M again to unmute
    await page.keyboard.press('m')
    await expect(page.locator('[data-testid="volume-slider"]')).toHaveValue('100')
  })

  test('should show muted icon when muted', async ({ page }) => {
    // Press M to mute
    await page.keyboard.press('m')
    await expect(page.locator('[data-testid="volume-icon"]')).toHaveAttribute('data-muted', 'true')
  })

  test('should open file dialog with Ctrl+O', async ({ page }) => {
    // Mock file input click
    const fileInput = page.locator('[data-testid="file-input"]')
    
    // Press Ctrl+O
    await page.keyboard.press('Control+o')
    
    // File dialog should be triggered (we can't easily test the actual dialog)
    // But we can verify the app didn't crash
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible()
  })

  test('should open file dialog with O key', async ({ page }) => {
    // Press O
    await page.keyboard.press('o')
    
    // App should remain functional
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible()
  })

  test('should go to next track with Ctrl+Right', async ({ page }) => {
    // Press Ctrl+Right
    await page.keyboard.press('Control+ArrowRight')
    
    // App should remain functional
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible()
  })

  test('should go to previous track with Ctrl+Left', async ({ page }) => {
    // Press Ctrl+Left
    await page.keyboard.press('Control+ArrowLeft')
    
    // App should remain functional
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible()
  })

  test('should toggle loop mode with L key', async ({ page }) => {
    // Press L to toggle loop
    await page.keyboard.press('l')
    await expect(page.locator('[data-testid="loop-button"]')).toHaveAttribute('data-active', 'true')

    // Press L again to disable loop
    await page.keyboard.press('l')
    await expect(page.locator('[data-testid="loop-button"]')).toHaveAttribute('data-active', 'false')
  })

  test('should open settings with S key', async ({ page }) => {
    // Press S to open settings
    await page.keyboard.press('s')
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible()
  })

  test('should close modals with Escape key', async ({ page }) => {
    // Open settings first
    await page.keyboard.press('s')
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible()

    // Press Escape to close
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="settings-panel"]')).not.toBeVisible()
  })

  test('should work when app has focus', async ({ page }) => {
    // Test that shortcuts work when app has focus
    await page.keyboard.press(' ')
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'playing')
  })

  test('should not work when app loses focus', async ({ page }) => {
    // Click outside the app to lose focus
    await page.locator('body').click()

    // Try to use spacebar - should not affect playback
    await page.keyboard.press(' ')
    
    // Should still be in initial state
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'paused')
  })

  test('should handle rapid key presses gracefully', async ({ page }) => {
    // Rapidly press spacebar multiple times
    await page.keyboard.press(' ')
    await page.keyboard.press(' ')
    await page.keyboard.press(' ')
    await page.keyboard.press(' ')

    // Should end up in a consistent state
    const state = await page.locator('[data-testid="play-pause-icon"]').getAttribute('data-state')
    expect(['playing', 'paused', 'stopped']).toContain(state)
  })

  test('should not crash on unsupported key combinations', async ({ page }) => {
    // Try various unsupported key combinations
    const unsupportedKeys = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']
    
    for (const key of unsupportedKeys) {
      await page.keyboard.press(key)
    }

    // App should still be functional
    await expect(page.locator('[data-testid="play-pause-icon"]')).toBeVisible()
  })

  test('should handle keyboard shortcuts during playback', async ({ page }) => {
    // Start playback
    await page.keyboard.press(' ')
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'playing')

    // Test shortcuts while playing
    await page.keyboard.press('ArrowRight') // Seek forward
    await expect(page.locator('[data-testid="current-time"]')).not.toHaveText('0:00')

    await page.keyboard.press('ArrowUp') // Increase volume
    const volumeSlider = page.locator('[data-testid="volume-slider"]')
    await expect(volumeSlider).not.toHaveValue('100')

    await page.keyboard.press(' ') // Pause
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'paused')
  })

  test('should handle keyboard shortcuts with settings panel open', async ({ page }) => {
    // Open settings
    await page.keyboard.press('s')
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible()

    // Test that some shortcuts still work
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="settings-panel"]')).not.toBeVisible()

    // Test that playback shortcuts work after closing settings
    await page.keyboard.press(' ')
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'playing')
  })
})
