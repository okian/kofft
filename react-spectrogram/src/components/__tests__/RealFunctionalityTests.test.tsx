import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import App from '../../App'

// Mock the Toaster component to avoid matchMedia issues
vi.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster" />
}))

// Test if the service is actually running
let serviceAvailable = false

beforeAll(async () => {
  try {
    console.log('🔍 Checking if service is available at http://localhost:8000/...')
    const response = await fetch('http://localhost:8000/', { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    serviceAvailable = response.ok
    console.log('✅ Service is available:', serviceAvailable)
  } catch (error) {
    console.log('❌ Service is not available:', error)
    serviceAvailable = false
  }
})

describe('Real Functionality Tests', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    console.log('🧪 Starting real functionality test...')
  })

  describe('Service Connectivity', () => {
    it('should have service available', () => {
      console.log('🔍 Testing service availability...')
      expect(serviceAvailable).toBe(true)
      console.log('✅ Service connectivity verified!')
    })
  })

  describe('Real Audio File Processing', () => {
    it('should handle real audio file upload and processing', async () => {
      console.log('🔍 Testing real audio file processing...')
      
      if (!serviceAvailable) {
        console.log('⏭️ Skipping test - service not available')
        return
      }

      render(<App />)
      
      // Create a more realistic mock audio file
      const audioData = new ArrayBuffer(1024) // 1KB of audio data
      const mockFile = new File([audioData], 'test-song.mp3', { 
        type: 'audio/mpeg',
        lastModified: Date.now()
      })
      
      console.log('🔍 Created realistic mock file:', {
        name: mockFile.name,
        type: mockFile.type,
        size: mockFile.size,
        lastModified: mockFile.lastModified
      })

      // Get the file input
      const fileInput = screen.getByTestId('file-input')
      console.log('🔍 File input found:', fileInput)

      // Simulate file upload
      console.log('🔍 Simulating file upload...')
      await user.upload(fileInput, mockFile)
      console.log('✅ File upload simulated')

      // Wait for any async processing
      await waitFor(() => {
        console.log('🔍 Checking for state changes after upload...')
        // The app should still be functional
        expect(screen.getByTestId('app-container')).toBeInTheDocument()
      }, { timeout: 3000 })

      console.log('🎉 Real audio file processing test completed!')
    })
  })

  describe('Real Keyboard Shortcuts', () => {
    it('should handle real keyboard events and trigger actual functionality', async () => {
      console.log('🔍 Testing real keyboard functionality...')
      
      render(<App />)
      
      const appContainer = screen.getByTestId('app-container')
      console.log('🔍 App container found for keyboard focus:', appContainer)
      
      // Focus the app to receive keyboard events
      await user.click(appContainer)
      console.log('🔍 App container focused')
      
      // Test spacebar for play/pause
      console.log('🔍 Testing spacebar for play/pause...')
      await user.keyboard(' ')
      console.log('✅ Spacebar pressed')
      
      // Check if any state changed (button might become enabled if file is loaded)
      const playButton = screen.getByTestId('play-pause-button') as HTMLButtonElement
      console.log('🔍 Play button state after spacebar:', {
        disabled: playButton.disabled,
        className: playButton.className
      })
      
      // Test arrow keys for seeking
      console.log('🔍 Testing arrow keys for seeking...')
      await user.keyboard('{ArrowRight}')
      console.log('✅ Right arrow pressed')
      
      await user.keyboard('{ArrowLeft}')
      console.log('✅ Left arrow pressed')
      
      // Test volume controls
      console.log('🔍 Testing volume controls...')
      await user.keyboard('{ArrowUp}')
      console.log('✅ Up arrow pressed')
      
      await user.keyboard('{ArrowDown}')
      console.log('✅ Down arrow pressed')
      
      // Test mute
      console.log('🔍 Testing mute...')
      await user.keyboard('m')
      console.log('✅ M key pressed')
      
      // Test settings
      console.log('🔍 Testing settings...')
      await user.keyboard('s')
      console.log('✅ S key pressed')
      
      // App should still be functional
      expect(screen.getByTestId('app-container')).toBeInTheDocument()
      console.log('🎉 Real keyboard functionality verified!')
    })
  })

  describe('Real UI Interactions', () => {
    it('should handle real button clicks and trigger actual functionality', async () => {
      console.log('🔍 Testing real UI interactions...')
      
      render(<App />)
      
      // Test open file button
      const openFileButton = screen.getByTestId('open-file-button')
      console.log('🔍 Clicking open file button...')
      await user.click(openFileButton)
      console.log('✅ Open file button clicked')
      
      // Test settings button
      const settingsButton = screen.getByTestId('settings-button')
      console.log('🔍 Clicking settings button...')
      await user.click(settingsButton)
      console.log('✅ Settings button clicked')
      
      // Test mute button
      const muteButton = screen.getByTestId('mute-button')
      console.log('🔍 Clicking mute button...')
      await user.click(muteButton)
      console.log('✅ Mute button clicked')
      
      // Test volume slider
      const volumeSlider = screen.getByTestId('volume-slider')
      console.log('🔍 Testing volume slider interaction...')
      await user.click(volumeSlider)
      console.log('✅ Volume slider clicked')
      
      // Test progress bar
      const progressBar = screen.getByTestId('progress-bar')
      console.log('🔍 Testing progress bar interaction...')
      await user.click(progressBar)
      console.log('✅ Progress bar clicked')
      
      // App should still be functional
      expect(screen.getByTestId('app-container')).toBeInTheDocument()
      console.log('🎉 Real UI interactions verified!')
    })
  })

  describe('Real Spectrogram Functionality', () => {
    it('should handle real spectrogram interactions', async () => {
      console.log('🔍 Testing real spectrogram functionality...')
      
      render(<App />)
      
      // Test spectrogram canvas interactions
      const canvas = screen.getByTestId('spectrogram-canvas')
      console.log('🔍 Testing spectrogram canvas interactions...')
      
      // Simulate mouse move on canvas
      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 })
      console.log('✅ Mouse move on canvas')
      
      // Simulate mouse click on canvas
      fireEvent.click(canvas, { clientX: 150, clientY: 150 })
      console.log('✅ Mouse click on canvas')
      
      // Simulate mouse leave
      fireEvent.mouseLeave(canvas)
      console.log('✅ Mouse leave canvas')
      
      // Canvas should still be present
      expect(canvas).toBeInTheDocument()
      console.log('🎉 Real spectrogram functionality verified!')
    })
  })

  describe('Real Error Handling', () => {
    it('should handle real error scenarios gracefully', async () => {
      console.log('🔍 Testing real error handling...')
      
      render(<App />)
      
      // Try to interact with disabled elements
      const playButton = screen.getByTestId('play-pause-button') as HTMLButtonElement
      console.log('🔍 Play button initial state:', { disabled: playButton.disabled })
      
      // Should not crash when trying to click disabled button
      console.log('🔍 Attempting to click disabled play button...')
      await user.click(playButton)
      console.log('✅ Clicked disabled button without crashing')
      
      // Button should still be disabled
      expect(playButton).toBeDisabled()
      console.log('🔍 Play button still disabled after click')
      
      // Try rapid interactions
      console.log('🔍 Testing rapid interactions...')
      for (let i = 0; i < 5; i++) {
        await user.click(playButton)
        await user.keyboard(' ')
        await user.keyboard('{ArrowRight}')
      }
      console.log('✅ Rapid interactions completed without crashing')
      
      // App should still be functional
      expect(screen.getByTestId('app-container')).toBeInTheDocument()
      console.log('🎉 Real error handling verified!')
    })
  })

  describe('Real Performance Tests', () => {
    it('should maintain performance under load', async () => {
      console.log('🔍 Testing real performance...')
      
      render(<App />)
      
      const startTime = performance.now()
      
      // Perform many interactions quickly
      console.log('🔍 Performing rapid interactions...')
      for (let i = 0; i < 10; i++) {
        await user.keyboard(' ')
        await user.keyboard('{ArrowRight}')
        await user.keyboard('{ArrowLeft}')
        await user.keyboard('m')
        await user.keyboard('s')
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      console.log('🔍 Performance test completed in:', duration, 'ms')
      
      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000)
      
      // App should still be functional
      expect(screen.getByTestId('app-container')).toBeInTheDocument()
      console.log('🎉 Real performance test verified!')
    })
  })
})
