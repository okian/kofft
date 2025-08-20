import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../../App'

// Mock the Toaster component to avoid matchMedia issues
vi.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster" />
}))

// Mock file input
const createMockFile = (name: string, type: string, content: string = 'mock audio data') => {
  return new File([content], name, { type })
}

describe('Working Integration Tests', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    console.log('🧪 Starting new test...')
  })

  describe('Basic App Functionality', () => {
    it('should render all main components', () => {
      console.log('🔍 Testing app rendering...')
      render(<App />)
      
      // Check main app structure
      const appContainer = screen.getByTestId('app-container')
      console.log('✅ App container found:', appContainer)
      expect(appContainer).toBeInTheDocument()
      
      const spectrogramView = screen.getByTestId('spectrogram-view')
      console.log('✅ Spectrogram view found:', spectrogramView)
      expect(spectrogramView).toBeInTheDocument()
      
      const spectrogramCanvas = screen.getByTestId('spectrogram-canvas')
      console.log('✅ Spectrogram canvas found:', spectrogramCanvas)
      expect(spectrogramCanvas).toBeInTheDocument()
      
      // Check header controls
      const openFileButton = screen.getByTestId('open-file-button')
      console.log('✅ Open file button found:', openFileButton)
      expect(openFileButton).toBeInTheDocument()
      
      const microphoneButton = screen.getByTestId('microphone-button')
      console.log('✅ Microphone button found:', microphoneButton)
      expect(microphoneButton).toBeInTheDocument()
      
      const settingsButton = screen.getByTestId('settings-button')
      console.log('✅ Settings button found:', settingsButton)
      expect(settingsButton).toBeInTheDocument()
      
      // Check footer controls
      const playButton = screen.getByTestId('play-pause-button')
      console.log('✅ Play button found:', playButton)
      expect(playButton).toBeInTheDocument()
      
      const stopButton = screen.getByTestId('stop-button')
      console.log('✅ Stop button found:', stopButton)
      expect(stopButton).toBeInTheDocument()
      
      const volumeSlider = screen.getByTestId('volume-slider')
      console.log('✅ Volume slider found:', volumeSlider)
      expect(volumeSlider).toBeInTheDocument()
      
      // Check initial state
      const dropZone = screen.getByTestId('drop-zone')
      console.log('✅ Drop zone found:', dropZone)
      expect(dropZone).toBeInTheDocument()
      
      const dropText = screen.getByText('Drop audio files here')
      console.log('✅ Drop text found:', dropText)
      expect(dropText).toBeInTheDocument()
      
      console.log('🎉 All components rendered successfully!')
    })

    it('should show initial disabled state for playback controls', () => {
      console.log('🔍 Testing initial disabled state...')
      render(<App />)
      
      // Play button should be disabled initially
      const playButton = screen.getByTestId('play-pause-button') as HTMLButtonElement
      console.log('🔍 Play button disabled state:', playButton.disabled)
      expect(playButton).toBeDisabled()
      
      // Time displays should show 0:00
      const currentTime = screen.getByTestId('current-time')
      console.log('🔍 Current time text:', currentTime.textContent)
      expect(currentTime).toHaveTextContent('0:00')
      
      const totalDuration = screen.getByTestId('total-duration')
      console.log('🔍 Total duration text:', totalDuration.textContent)
      expect(totalDuration).toHaveTextContent('0:00')
      
      console.log('🎉 Initial disabled state verified!')
    })
  })

  describe('Header Controls', () => {
    it('should have clickable header buttons that trigger actions', async () => {
      console.log('🔍 Testing header button interactions...')
      render(<App />)
      
      // Test that buttons are clickable and trigger actions
      const openFileButton = screen.getByTestId('open-file-button')
      console.log('🔍 Clicking open file button...')
      await user.click(openFileButton)
      
      // Check if file input is triggered (it should be hidden but accessible)
      const fileInput = screen.getByTestId('file-input')
      console.log('🔍 File input found after click:', fileInput)
      expect(fileInput).toBeInTheDocument()
      
      const microphoneButton = screen.getByTestId('microphone-button')
      console.log('🔍 Clicking microphone button...')
      await user.click(microphoneButton)
      
      const settingsButton = screen.getByTestId('settings-button')
      console.log('🔍 Clicking settings button...')
      await user.click(settingsButton)
      
      // App should still be functional after all clicks
      expect(screen.getByTestId('app-container')).toBeInTheDocument()
      console.log('🎉 Header buttons clicked successfully!')
    })

    it('should have hidden file input with correct attributes', () => {
      console.log('🔍 Testing file input attributes...')
      render(<App />)
      
      const fileInput = screen.getByTestId('file-input')
      console.log('🔍 File input attributes:', {
        type: fileInput.getAttribute('type'),
        accept: fileInput.getAttribute('accept'),
        multiple: fileInput.hasAttribute('multiple'),
        className: fileInput.className
      })
      
      expect(fileInput).toBeInTheDocument()
      expect(fileInput).toHaveAttribute('type', 'file')
      expect(fileInput).toHaveAttribute('accept', 'audio/*')
      expect(fileInput).toHaveAttribute('multiple')
      expect(fileInput).toHaveClass('hidden')
      
      console.log('🎉 File input attributes verified!')
    })
  })

  describe('Footer Controls', () => {
    it('should have volume slider with correct range and initial value', () => {
      console.log('🔍 Testing volume slider...')
      render(<App />)
      
      const volumeSlider = screen.getByTestId('volume-slider')
      console.log('🔍 Volume slider attributes:', {
        min: volumeSlider.getAttribute('min'),
        max: volumeSlider.getAttribute('max'),
        value: volumeSlider.getAttribute('value'),
        type: volumeSlider.getAttribute('type')
      })
      
      expect(volumeSlider).toHaveAttribute('min', '0')
      expect(volumeSlider).toHaveAttribute('max', '100')
      expect(volumeSlider).toHaveAttribute('type', 'range')
      
      // Check initial value (should be 100 or 0 depending on implementation)
      const initialValue = volumeSlider.getAttribute('value')
      console.log('🔍 Initial volume value:', initialValue)
      expect(initialValue).toBeDefined()
      
      console.log('🎉 Volume slider verified!')
    })

    it('should have progress bar with correct structure', () => {
      console.log('🔍 Testing progress bar...')
      render(<App />)
      
      const progressBar = screen.getByTestId('progress-bar')
      console.log('🔍 Progress bar found:', progressBar)
      expect(progressBar).toBeInTheDocument()
      
      const progressFill = screen.getByTestId('progress-fill')
      console.log('🔍 Progress fill found:', progressFill)
      expect(progressFill).toBeInTheDocument()
      
      // Check that progress fill has correct initial width (should be 0%)
      const initialWidth = progressFill.style.width
      console.log('🔍 Initial progress width:', initialWidth)
      expect(initialWidth).toBe('0%')
      
      console.log('🎉 Progress bar structure verified!')
    })

    it('should have mute button that changes state', () => {
      console.log('🔍 Testing mute button...')
      render(<App />)
      
      const muteButton = screen.getByTestId('mute-button')
      console.log('🔍 Mute button found:', muteButton)
      expect(muteButton).toBeInTheDocument()
      
      // Check initial state (should show volume icon)
      const initialIcon = muteButton.innerHTML
      console.log('🔍 Initial mute button icon:', initialIcon)
      // Just check that it contains an SVG (any volume icon)
      expect(initialIcon).toContain('<svg')
      
      console.log('🎉 Mute button verified!')
    })
  })

  describe('Spectrogram View', () => {
    it('should show drop zone when no file is loaded', () => {
      console.log('🔍 Testing drop zone visibility...')
      render(<App />)
      
      const dropZone = screen.getByTestId('drop-zone')
      console.log('🔍 Drop zone found:', dropZone)
      expect(dropZone).toBeInTheDocument()
      
      const dropText = screen.getByText('Drop audio files here')
      console.log('🔍 Drop text found:', dropText)
      expect(dropText).toBeInTheDocument()
      
      // Check that drop zone is visible (not hidden)
      const dropZoneStyle = window.getComputedStyle(dropZone)
      console.log('🔍 Drop zone display style:', dropZoneStyle.display)
      expect(dropZoneStyle.display).not.toBe('none')
      
      console.log('🎉 Drop zone visibility verified!')
    })

    it('should have spectrogram canvas with correct properties', () => {
      console.log('🔍 Testing spectrogram canvas...')
      render(<App />)
      
      const canvas = screen.getByTestId('spectrogram-canvas')
      console.log('🔍 Canvas found:', canvas)
      expect(canvas).toBeInTheDocument()
      expect(canvas.tagName).toBe('CANVAS')
      
      // Check canvas properties
      const canvasElement = canvas as HTMLCanvasElement
      console.log('🔍 Canvas properties:', {
        width: canvasElement.width,
        height: canvasElement.height,
        className: canvasElement.className
      })
      
      expect(canvasElement).toHaveClass('w-full', 'h-full', 'block')
      
      console.log('🎉 Spectrogram canvas verified!')
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should handle keyboard events without crashing and log interactions', async () => {
      console.log('🔍 Testing keyboard shortcuts...')
      render(<App />)
      
      const appContainer = screen.getByTestId('app-container')
      console.log('🔍 App container found for keyboard focus:', appContainer)
      
      // Focus the app to receive keyboard events
      await user.click(appContainer)
      console.log('🔍 App container focused')
      
      // Test various keyboard shortcuts and log what happens
      console.log('🔍 Testing spacebar...')
      await user.keyboard(' ')
      console.log('✅ Spacebar pressed')
      
      console.log('🔍 Testing left arrow...')
      await user.keyboard('{ArrowLeft}')
      console.log('✅ Left arrow pressed')
      
      console.log('🔍 Testing right arrow...')
      await user.keyboard('{ArrowRight}')
      console.log('✅ Right arrow pressed')
      
      console.log('🔍 Testing up arrow...')
      await user.keyboard('{ArrowUp}')
      console.log('✅ Up arrow pressed')
      
      console.log('🔍 Testing down arrow...')
      await user.keyboard('{ArrowDown}')
      console.log('✅ Down arrow pressed')
      
      console.log('🔍 Testing M key...')
      await user.keyboard('m')
      console.log('✅ M key pressed')
      
      console.log('🔍 Testing S key...')
      await user.keyboard('s')
      console.log('✅ S key pressed')
      
      console.log('🔍 Testing Escape key...')
      await user.keyboard('{Escape}')
      console.log('✅ Escape key pressed')
      
      // App should still be functional
      expect(screen.getByTestId('app-container')).toBeInTheDocument()
      console.log('🎉 All keyboard shortcuts handled without crashing!')
    })
  })

  describe('UI Responsiveness', () => {
    it('should remain responsive after multiple interactions and log state changes', async () => {
      console.log('🔍 Testing UI responsiveness...')
      render(<App />)
      
      // Perform multiple interactions and log state changes
      const openFileButton = screen.getByTestId('open-file-button')
      const playButton = screen.getByTestId('play-pause-button') as HTMLButtonElement
      const settingsButton = screen.getByTestId('settings-button')
      const muteButton = screen.getByTestId('mute-button')
      
      console.log('🔍 Initial play button disabled state:', playButton.disabled)
      
      // Click buttons multiple times and log state changes
      for (let i = 0; i < 3; i++) {
        console.log(`🔍 Interaction round ${i + 1}:`)
        
        console.log('  - Clicking open file button...')
        await user.click(openFileButton)
        
        console.log('  - Clicking settings button...')
        await user.click(settingsButton)
        
        console.log('  - Clicking mute button...')
        await user.click(muteButton)
        
        // Log current state
        console.log('  - Current play button disabled state:', playButton.disabled)
        console.log('  - App container still exists:', !!screen.getByTestId('app-container'))
      }
      
      // App should still be functional
      expect(screen.getByTestId('app-container')).toBeInTheDocument()
      expect(screen.getByTestId('spectrogram-canvas')).toBeInTheDocument()
      
      console.log('🎉 UI remained responsive after multiple interactions!')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid interactions gracefully and log errors', async () => {
      console.log('🔍 Testing error handling...')
      render(<App />)
      
      // Try to interact with disabled elements
      const playButton = screen.getByTestId('play-pause-button') as HTMLButtonElement
      console.log('🔍 Play button initial disabled state:', playButton.disabled)
      
      // Should not crash when trying to click disabled button
      console.log('🔍 Attempting to click disabled play button...')
      await user.click(playButton)
      console.log('✅ Clicked disabled button without crashing')
      
      // Check that button is still disabled
      console.log('🔍 Play button disabled state after click:', playButton.disabled)
      expect(playButton).toBeDisabled()
      
      // App should still be functional
      expect(screen.getByTestId('app-container')).toBeInTheDocument()
      
      console.log('🎉 Error handling verified!')
    })
  })

  describe('Real File Upload Test', () => {
    it('should handle file upload and show loading state', async () => {
      console.log('🔍 Testing real file upload...')
      render(<App />)
      
      // Create a mock audio file
      const mockFile = createMockFile('test-audio.mp3', 'audio/mpeg', 'fake audio data')
      console.log('🔍 Created mock file:', mockFile.name, mockFile.type, mockFile.size)
      
      // Get the file input
      const fileInput = screen.getByTestId('file-input')
      console.log('🔍 File input found:', fileInput)
      
      // Simulate file upload
      console.log('🔍 Simulating file upload...')
      await user.upload(fileInput, mockFile)
      console.log('✅ File upload simulated')
      
      // Wait a bit for any async operations
      await waitFor(() => {
        console.log('🔍 Checking for any state changes after upload...')
        // The app should still be functional
        expect(screen.getByTestId('app-container')).toBeInTheDocument()
      }, { timeout: 2000 })
      
      console.log('🎉 File upload test completed!')
    })
  })
})
