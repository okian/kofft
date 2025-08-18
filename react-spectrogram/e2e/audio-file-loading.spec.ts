import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Audio File Loading E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load application with correct initial state', async ({ page }) => {
    // Check initial UI elements
    await expect(page.getByText('Spectrogram')).toBeVisible()
    await expect(page.getByText('Drop audio files here')).toBeVisible()
    
    // Check that playback controls are initially disabled
    const playButton = page.getByTitle('Play/Pause (Space)')
    await expect(playButton).toBeVisible()
    await expect(playButton).toBeDisabled()
    
    // Check that no metadata is displayed initially
    await expect(page.locator('text=Title:')).not.toBeVisible()
    await expect(page.locator('text=Artist:')).not.toBeVisible()
    
    // Check that spectrogram area is present
    const spectrogramCanvas = page.locator('[data-testid="spectrogram-canvas"]')
    await expect(spectrogramCanvas).toBeVisible()
  })

  test('should load valid audio file and display metadata', async ({ page }) => {
    // Create a test audio file
    const testFilePath = path.join(__dirname, '../test-fixtures/test-audio.mp3')
    
    // Upload the file
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles(testFilePath)
    
    // Wait for file to be processed
    await expect(page.locator('text=Drop audio files here')).not.toBeVisible()
    
    // Check that metadata is displayed
    await expect(page.locator('text=test-audio.mp3')).toBeVisible()
    
    // Check that play button is now enabled
    const playButton = page.getByTitle('Play/Pause (Space)')
    await expect(playButton).toBeEnabled()
    
    // Check that spectrogram is initialized
    const spectrogramCanvas = page.locator('[data-testid="spectrogram-canvas"]')
    await expect(spectrogramCanvas).toBeVisible()
  })

  test('should handle files with missing metadata gracefully', async ({ page }) => {
    // Create a test file without metadata
    const testFilePath = path.join(__dirname, '../test-fixtures/no-metadata.wav')
    
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles(testFilePath)
    
    // Should still load and display filename as fallback
    await expect(page.locator('text=no-metadata.wav')).toBeVisible()
    
    // Should not show any error messages
    await expect(page.locator('text=error')).not.toBeVisible()
    
    // App should remain functional
    await expect(page.getByTitle('Open audio file (O)')).toBeEnabled()
  })

  test('should reject invalid file types', async ({ page }) => {
    // Create an invalid file
    const invalidFilePath = path.join(__dirname, '../test-fixtures/invalid.txt')
    
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles(invalidFilePath)
    
    // Should show error message
    await expect(page.locator('text=unsupported file format')).toBeVisible()
    
    // Previous state should persist
    await expect(page.getByText('Drop audio files here')).toBeVisible()
    
    // App should remain functional
    await expect(page.getByTitle('Open audio file (O)')).toBeEnabled()
  })

  test('should load file within reasonable time', async ({ page }) => {
    const testFilePath = path.join(__dirname, '../test-fixtures/test-audio.mp3')
    
    const startTime = Date.now()
    
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles(testFilePath)
    
    // Wait for file to be loaded
    await expect(page.locator('text=Drop audio files here')).not.toBeVisible()
    
    const endTime = Date.now()
    const loadTime = endTime - startTime
    
    // Should load within 5 seconds (more generous for E2E)
    expect(loadTime).toBeLessThan(5000)
  })

  test('should handle drag and drop file loading', async ({ page }) => {
    const testFilePath = path.join(__dirname, '../test-fixtures/test-audio.mp3')
    
    // Drag and drop the file onto the drop zone
    const dropZone = page.locator('[data-testid="drop-zone"]')
    await dropZone.setInputFiles(testFilePath)
    
    // Wait for file to be processed
    await expect(page.locator('text=Drop audio files here')).not.toBeVisible()
    await expect(page.locator('text=test-audio.mp3')).toBeVisible()
  })

  test('should show loading indicator during file processing', async ({ page }) => {
    const testFilePath = path.join(__dirname, '../test-fixtures/large-audio.mp3')
    
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles(testFilePath)
    
    // Should show loading indicator
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible()
    
    // Wait for loading to complete
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible()
    
    // File should be loaded
    await expect(page.locator('text=large-audio.mp3')).toBeVisible()
  })

  test('should handle multiple file uploads', async ({ page }) => {
    const testFile1 = path.join(__dirname, '../test-fixtures/test-audio.mp3')
    const testFile2 = path.join(__dirname, '../test-fixtures/another-audio.wav')
    
    const fileInput = page.locator('[data-testid="file-input"]')
    
    // Load first file
    await fileInput.setInputFiles(testFile1)
    await expect(page.locator('text=test-audio.mp3')).toBeVisible()
    
    // Load second file (should replace first)
    await fileInput.setInputFiles(testFile2)
    await expect(page.locator('text=another-audio.wav')).toBeVisible()
    await expect(page.locator('text=test-audio.mp3')).not.toBeVisible()
  })

  test('should display file size and duration information', async ({ page }) => {
    const testFilePath = path.join(__dirname, '../test-fixtures/test-audio.mp3')
    
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles(testFilePath)
    
    // Wait for file to be processed
    await expect(page.locator('text=Drop audio files here')).not.toBeVisible()
    
    // Check that file information is displayed
    await expect(page.locator('[data-testid="file-duration"]')).toBeVisible()
    await expect(page.locator('[data-testid="file-size"]')).toBeVisible()
    
    // Duration should be in a reasonable format
    const durationText = await page.locator('[data-testid="file-duration"]').textContent()
    expect(durationText).toMatch(/\d+:\d{2}/)
  })

  test('should handle corrupted audio files gracefully', async ({ page }) => {
    const corruptedFilePath = path.join(__dirname, '../test-fixtures/corrupted.mp3')
    
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles(corruptedFilePath)
    
    // Should show error message
    await expect(page.locator('text=Failed to load audio file')).toBeVisible()
    
    // App should remain functional
    await expect(page.getByTitle('Open audio file (O)')).toBeEnabled()
    await expect(page.getByText('Drop audio files here')).toBeVisible()
  })

  test('should handle very large audio files', async ({ page }) => {
    const largeFilePath = path.join(__dirname, '../test-fixtures/very-large-audio.mp3')
    
    const startTime = Date.now()
    
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles(largeFilePath)
    
    // Should show loading indicator
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible()
    
    // Wait for loading to complete
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible()
    
    const endTime = Date.now()
    const loadTime = endTime - startTime
    
    // Should load within 30 seconds for very large files
    expect(loadTime).toBeLessThan(30000)
    
    // File should be loaded successfully
    await expect(page.locator('text=very-large-audio.mp3')).toBeVisible()
  })
})
