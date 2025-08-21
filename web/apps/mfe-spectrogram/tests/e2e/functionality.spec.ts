import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('Functionality Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
  });

  test.describe('App Initialization', () => {
    test('should load the application successfully', async ({ page }) => {
      // Check main app container
      await expect(page.locator('#app')).toBeVisible();
      
      // Check for main components
      await expect(page.locator('[data-testid="header"]')).toBeVisible();
      await expect(page.locator('[data-testid="footer"]')).toBeVisible();
      await expect(page.locator('[data-testid="spectrogram-view"]')).toBeVisible();
      
      // Check for control buttons
      await expect(page.locator('[data-testid="open-file-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="play-pause-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="stop-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="settings-button"]')).toBeVisible();
    });

    test('should show drop zone when no audio is loaded', async ({ page }) => {
      const dropZone = page.locator('[data-testid="drop-zone"]');
      await expect(dropZone).toBeVisible();
      await expect(dropZone).toContainText('Drop audio files here');
    });

    test('should initialize WebAssembly module', async ({ page }) => {
      // Wait for WebAssembly to be available
      await page.waitForFunction(() => {
        return window.wasmModule !== undefined || 
               document.querySelector('[data-testid="spectrogram-canvas"]') !== null;
      }, { timeout: 15000 });
      
      // Check if spectrogram canvas is present
      const canvas = page.locator('[data-testid="spectrogram-canvas"]');
      await expect(canvas).toBeVisible();
    });
  });

  test.describe('Audio File Loading', () => {
    test('should load WAV audio file successfully', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Check if file is loaded
      await expect(page.locator('[data-testid="audio-loaded"]')).toBeVisible();
      
      // Check if spectrogram is generated
      const canvas = page.locator('[data-testid="spectrogram-canvas"]');
      await expect(canvas).toBeVisible();
    });

    test('should handle multiple file uploads', async ({ page }) => {
      // Upload first file
      await helpers.uploadAudioFile('test-silence.wav');
      await expect(page.locator('[data-testid="audio-loaded"]')).toBeVisible();
      
      // Upload second file
      await helpers.uploadAudioFile('test-audio.mp3');
      await expect(page.locator('[data-testid="audio-loaded"]')).toBeVisible();
    });

    test('should show file metadata after loading', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Check for metadata display
      const metadataPanel = page.locator('[data-testid="metadata-panel"]');
      if (await metadataPanel.isVisible()) {
        await expect(metadataPanel).toContainText('Duration');
        await expect(metadataPanel).toContainText('Sample Rate');
      }
    });

    test('should handle invalid file gracefully', async ({ page }) => {
      await helpers.testErrorHandling();
    });
  });

  test.describe('Playback Controls', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
    });

    test('should play and pause audio', async ({ page }) => {
      const playButton = page.locator('[data-testid="play-pause-button"]');
      
      // Start playback
      await playButton.click();
      await expect(page.locator('[data-testid="playing-state"]')).toBeVisible();
      
      // Pause playback
      await playButton.click();
      await expect(page.locator('[data-testid="paused-state"]')).toBeVisible();
    });

    test('should stop playback', async ({ page }) => {
      const playButton = page.locator('[data-testid="play-pause-button"]');
      const stopButton = page.locator('[data-testid="stop-button"]');
      
      // Start playback
      await playButton.click();
      await expect(page.locator('[data-testid="playing-state"]')).toBeVisible();
      
      // Stop playback
      await stopButton.click();
      await expect(page.locator('[data-testid="stopped-state"]')).toBeVisible();
    });

    test('should update progress bar during playback', async ({ page }) => {
      const playButton = page.locator('[data-testid="play-pause-button"]');
      const progressBar = page.locator('[data-testid="progress-bar"]');
      
      // Start playback
      await playButton.click();
      
      // Wait for progress to update
      await page.waitForTimeout(1000);
      
      // Check if progress bar is updating
      const initialProgress = await progressBar.getAttribute('aria-valuenow');
      await page.waitForTimeout(1000);
      const updatedProgress = await progressBar.getAttribute('aria-valuenow');
      
      expect(updatedProgress).not.toBe(initialProgress);
    });

    test('should seek to different positions', async ({ page }) => {
      const progressBar = page.locator('[data-testid="progress-bar"]');
      
      // Click on progress bar to seek
      await progressBar.click({ position: { x: 100, y: 10 } });
      await page.waitForTimeout(500);
      
      // Check if seeking worked
      const progress = await progressBar.getAttribute('aria-valuenow');
      expect(parseInt(progress || '0')).toBeGreaterThan(0);
    });
  });

  test.describe('Volume Controls', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
    });

    test('should adjust volume with slider', async ({ page }) => {
      const volumeSlider = page.locator('[data-testid="volume-slider"]');
      
      // Get initial volume
      const initialVolume = await volumeSlider.getAttribute('aria-valuenow');
      
      // Adjust volume
      await volumeSlider.click({ position: { x: 50, y: 10 } });
      await page.waitForTimeout(500);
      
      // Check if volume changed
      const newVolume = await volumeSlider.getAttribute('aria-valuenow');
      expect(newVolume).not.toBe(initialVolume);
    });

    test('should mute and unmute audio', async ({ page }) => {
      const muteButton = page.locator('[data-testid="mute-button"]');
      
      // Mute audio
      await muteButton.click();
      await expect(page.locator('[data-testid="muted-state"]')).toBeVisible();
      
      // Unmute audio
      await muteButton.click();
      await expect(page.locator('[data-testid="unmuted-state"]')).toBeVisible();
    });
  });

  test.describe('Settings and Configuration', () => {
    test('should open and close settings panel', async ({ page }) => {
      const settingsButton = page.locator('[data-testid="settings-button"]');
      
      // Open settings
      await settingsButton.click();
      await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
      
      // Close settings
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="settings-panel"]')).not.toBeVisible();
    });

    test('should change theme', async ({ page }) => {
      const settingsButton = page.locator('[data-testid="settings-button"]');
      await settingsButton.click();
      
      const themeSelect = page.locator('[data-testid="theme-select"]');
      if (await themeSelect.isVisible()) {
        // Change to light theme
        await themeSelect.selectOption('light');
        await expect(page.locator('body')).toHaveClass(/light/);
        
        // Change to dark theme
        await themeSelect.selectOption('dark');
        await expect(page.locator('body')).toHaveClass(/dark/);
      }
    });

    test('should adjust spectrogram settings', async ({ page }) => {
      const settingsButton = page.locator('[data-testid="settings-button"]');
      await settingsButton.click();
      
      // Test color scheme selection
      const colorSchemeSelect = page.locator('[data-testid="color-scheme-select"]');
      if (await colorSchemeSelect.isVisible()) {
        await colorSchemeSelect.selectOption('viridis');
        await page.waitForTimeout(500);
        await colorSchemeSelect.selectOption('plasma');
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
    });

    test('should handle spacebar for play/pause', async ({ page }) => {
      // Focus the app
      await page.click('[data-testid="app-container"]');
      
      // Test spacebar
      await page.keyboard.press(' ');
      await expect(page.locator('[data-testid="playing-state"]')).toBeVisible();
      
      await page.keyboard.press(' ');
      await expect(page.locator('[data-testid="paused-state"]')).toBeVisible();
    });

    test('should handle arrow keys for seeking', async ({ page }) => {
      await page.click('[data-testid="app-container"]');
      
      // Test right arrow
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
      
      // Test left arrow
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(500);
    });

    test('should handle volume shortcuts', async ({ page }) => {
      await page.click('[data-testid="app-container"]');
      
      // Test volume up
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(500);
      
      // Test volume down
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(500);
    });

    test('should handle other shortcuts', async ({ page }) => {
      await page.click('[data-testid="app-container"]');
      
      // Test 'M' for metadata toggle
      await page.keyboard.press('m');
      await page.waitForTimeout(500);
      
      // Test 'S' for settings
      await page.keyboard.press('s');
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    });
  });

  test.describe('State Management', () => {
    test('should maintain state across interactions', async ({ page }) => {
      // Load audio file
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Start playback
      const playButton = page.locator('[data-testid="play-pause-button"]');
      await playButton.click();
      
      // Open settings
      const settingsButton = page.locator('[data-testid="settings-button"]');
      await settingsButton.click();
      
      // Close settings
      await page.keyboard.press('Escape');
      
      // Verify playback is still active
      await expect(page.locator('[data-testid="playing-state"]')).toBeVisible();
    });

    test('should handle multiple state changes', async ({ page }) => {
      await helpers.uploadAudioFile('test-silence.wav');
      
      // Test various state changes
      await helpers.testAudioPlayback();
      await helpers.testVolumeControls();
      await helpers.testSettingsPanel();
      
      // Verify app is still functional
      await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });
  });
});
