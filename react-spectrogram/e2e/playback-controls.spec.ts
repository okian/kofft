import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Playback Controls E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Load a test file for playback tests
    const testFilePath = path.join(__dirname, '../test-fixtures/test-audio.mp3')
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles(testFilePath)
    
    // Wait for file to be loaded
    await expect(page.locator('text=Drop audio files here')).not.toBeVisible()
  })

  test('should start playback when play button is clicked', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    await playButton.click()

    // Button should toggle to pause icon
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'playing')

    // Progress should start moving
    await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('data-playing', 'true')

    // Time display should start incrementing
    await expect(page.locator('[data-testid="current-time"]')).not.toHaveText('0:00')
  })

  test('should pause playback when pause button is clicked', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    
    // Start playback
    await playButton.click()
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'playing')

    // Pause playback
    await playButton.click()
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'paused')

    // Progress should stop moving
    await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('data-playing', 'false')
  })

  test('should toggle play/pause with spacebar', async ({ page }) => {
    // Focus the app to receive keyboard events
    await page.locator('[data-testid="app-container"]').click()

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

  test('should stop playback and reset to beginning', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    const stopButton = page.getByTitle('Stop')

    // Start playback
    await playButton.click()
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'playing')

    // Let it play for a moment
    await page.waitForTimeout(1000)

    // Stop playback
    await stopButton.click()
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'stopped')

    // Should reset to beginning
    await expect(page.locator('[data-testid="current-time"]')).toHaveText('0:00')
  })

  test('should update spectrogram in real-time during playback', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    await playButton.click()

    // Get initial canvas state
    const spectrogramCanvas = page.locator('[data-testid="spectrogram-canvas"]')
    const initialImageData = await spectrogramCanvas.screenshot()

    // Wait for spectrogram to update
    await page.waitForTimeout(2000)

    // Take another screenshot
    const newImageData = await spectrogramCanvas.screenshot()

    // Images should be different (spectrogram should be updating)
    expect(Buffer.compare(initialImageData, newImageData)).not.toBe(0)

    // Check that spectrogram is actively updating
    await expect(spectrogramCanvas).toHaveAttribute('data-updating', 'true')
  })

  test('should pause spectrogram updates when paused', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    
    // Start playback
    await playButton.click()
    await expect(page.locator('[data-testid="spectrogram-canvas"]')).toHaveAttribute('data-updating', 'true')

    // Pause
    await playButton.click()
    await expect(page.locator('[data-testid="spectrogram-canvas"]')).toHaveAttribute('data-updating', 'false')
  })

  test('should show correct frequency representation', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    await playButton.click()

    // Check that frequency axis is correctly labeled
    await expect(page.locator('text=0 Hz')).toBeVisible()
    await expect(page.locator('text=22 kHz')).toBeVisible()

    // Check that time axis shows progression
    await page.waitForTimeout(2000)
    await expect(page.locator('[data-testid="current-time"]')).not.toHaveText('0:00')
  })

  test('should handle track completion gracefully', async ({ page }) => {
    // Load a very short test file
    const shortFilePath = path.join(__dirname, '../test-fixtures/short-audio.mp3')
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles(shortFilePath)
    
    await expect(page.locator('text=Drop audio files here')).not.toBeVisible()

    const playButton = page.getByTitle('Play/Pause (Space)')
    await playButton.click()

    // Wait for track to complete
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'stopped')

    // Should be ready to play again
    await expect(playButton).toBeEnabled()
  })

  test('should start playback with minimal delay', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    const startTime = Date.now()
    
    await playButton.click()
    
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'playing')

    const endTime = Date.now()
    
    // Should start within 500ms
    expect(endTime - startTime).toBeLessThan(500)
  })

  test('should remain responsive during playback', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    await playButton.click()

    // UI should remain interactive during playback
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'playing')

    // Try to interact with other controls
    const settingsButton = page.getByTitle('Settings (S)')
    await expect(settingsButton).toBeEnabled()
    
    // Should be able to pause immediately
    await playButton.click()
    await expect(page.locator('[data-testid="play-pause-icon"]')).toHaveAttribute('data-state', 'paused')
  })

  test('should handle rapid play/pause clicks gracefully', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    
    // Rapidly click play/pause multiple times
    await playButton.click()
    await playButton.click()
    await playButton.click()
    await playButton.click()

    // Should end up in a consistent state
    const state = await page.locator('[data-testid="play-pause-icon"]').getAttribute('data-state')
    expect(['playing', 'paused', 'stopped']).toContain(state)

    // Should not crash or become unresponsive
    await expect(playButton).toBeEnabled()
  })

  test('should display current time and total duration correctly', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    await playButton.click()

    // Check that time display is in correct format
    const timeDisplay = page.locator('[data-testid="current-time"]')
    await expect(timeDisplay).toBeVisible()
    
    const timeText = await timeDisplay.textContent()
    expect(timeText).toMatch(/\d+:\d{2}/)

    // Check that total duration is displayed
    const totalDuration = page.locator('[data-testid="total-duration"]')
    await expect(totalDuration).toBeVisible()
    
    const durationText = await totalDuration.textContent()
    expect(durationText).toMatch(/\d+:\d{2}/)
  })

  test('should update progress bar during playback', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    await playButton.click()

    // Get initial progress
    const progressFill = page.locator('[data-testid="progress-fill"]')
    const initialWidth = await progressFill.getAttribute('style')

    // Wait for some progress
    await page.waitForTimeout(2000)

    // Progress should have increased
    const newWidth = await progressFill.getAttribute('style')
    expect(newWidth).not.toBe(initialWidth)
  })

  test('should handle volume control during playback', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    await playButton.click()

    // Test volume slider
    const volumeSlider = page.locator('[data-testid="volume-slider"]')
    await expect(volumeSlider).toBeVisible()

    // Change volume
    await volumeSlider.fill('50')
    
    // Volume should be updated
    await expect(volumeSlider).toHaveValue('50')
  })

  test('should handle mute functionality', async ({ page }) => {
    const playButton = page.getByTitle('Play/Pause (Space)')
    await playButton.click()

    // Test mute button
    const muteButton = page.getByTitle('Mute (M)')
    await expect(muteButton).toBeVisible()

    // Click mute
    await muteButton.click()
    
    // Should show muted state
    await expect(page.locator('[data-testid="volume-icon"]')).toHaveAttribute('data-muted', 'true')

    // Click unmute
    await muteButton.click()
    
    // Should show unmuted state
    await expect(page.locator('[data-testid="volume-icon"]')).toHaveAttribute('data-muted', 'false')
  })
})
