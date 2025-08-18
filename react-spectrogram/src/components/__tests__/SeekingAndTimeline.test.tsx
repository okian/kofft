import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../../App'

// Mock file input
const createMockFile = (name: string, type: string, content: string = 'mock audio data') => {
  return new File([content], name, { type })
}

describe('Seeking and Timeline Interaction', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
  })

  const loadTestFile = async () => {
    const file = createMockFile('test-song.mp3', 'audio/mpeg')
    
    // Mock audio context with test data
    const mockAudioContext = global.AudioContext as any
    mockAudioContext.mockImplementation(() => ({
      ...mockAudioContext(),
      decodeAudioData: vi.fn(() => Promise.resolve({
        duration: 180, // 3 minutes
        sampleRate: 44100,
        getChannelData: vi.fn(() => new Float32Array(44100 * 180))
      })),
      createBufferSource: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        buffer: null,
        onended: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: { value: 1 },
      })),
      createAnalyser: vi.fn(() => ({
        connect: vi.fn(),
        frequencyBinCount: 1024,
        getByteFrequencyData: vi.fn(),
        getByteTimeDomainData: vi.fn(),
      })),
    }))

    const fileInput = screen.getByTestId('file-input')
    await user.upload(fileInput, file)
    
    // Wait for file to be loaded
    await waitFor(() => {
      expect(screen.queryByText('Drop audio files here')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  }

  describe('Timeline Click Seeking', () => {
    it('should seek to position when clicking on timeline', async () => {
      render(<App />)
      await loadTestFile()

      const progressBar = screen.getByTestId('progress-bar')
      const initialTime = screen.getByTestId('current-time').textContent

      // Click at 50% position on the progress bar
      const rect = progressBar.getBoundingClientRect()
      const clickX = rect.left + (rect.width * 0.5)
      
      fireEvent.click(progressBar, {
        clientX: clickX,
        clientY: rect.top + rect.height / 2
      })

      // Should seek to approximately 50% of the track (1:30 for 3-minute track)
      await waitFor(() => {
        const newTime = screen.getByTestId('current-time').textContent
        expect(newTime).not.toBe(initialTime)
        // Should be around 1:30 (90 seconds)
        expect(newTime).toMatch(/1:\d{2}/)
      })
    })

    it('should continue playing from new position if already playing', async () => {
      render(<App />)
      await loadTestFile()

      const playButton = screen.getByTitle('Play/Pause (Space)')
      await user.click(playButton)

      await waitFor(() => {
        expect(screen.getByTestId('play-pause-icon')).toHaveAttribute('data-state', 'playing')
      })

      const progressBar = screen.getByTestId('progress-bar')
      const rect = progressBar.getBoundingClientRect()
      const clickX = rect.left + (rect.width * 0.75) // 75% position
      
      fireEvent.click(progressBar, {
        clientX: clickX,
        clientY: rect.top + rect.height / 2
      })

      // Should continue playing from new position
      await waitFor(() => {
        expect(screen.getByTestId('play-pause-icon')).toHaveAttribute('data-state', 'playing')
        const timeDisplay = screen.getByTestId('current-time')
        expect(timeDisplay.textContent).toMatch(/2:\d{2}/) // Around 2:15
      })
    })

    it('should seek to position when paused', async () => {
      render(<App />)
      await loadTestFile()

      const progressBar = screen.getByTestId('progress-bar')
      const rect = progressBar.getBoundingClientRect()
      const clickX = rect.left + (rect.width * 0.25) // 25% position
      
      fireEvent.click(progressBar, {
        clientX: clickX,
        clientY: rect.top + rect.height / 2
      })

      // Should seek to new position but remain paused
      await waitFor(() => {
        const timeDisplay = screen.getByTestId('current-time')
        expect(timeDisplay.textContent).toMatch(/0:\d{2}/) // Around 0:45
        expect(screen.getByTestId('play-pause-icon')).toHaveAttribute('data-state', 'paused')
      })
    })
  })

  describe('Progress Bar Dragging', () => {
    it('should update time display while dragging', async () => {
      render(<App />)
      await loadTestFile()

      const progressBar = screen.getByTestId('progress-bar')
      const rect = progressBar.getBoundingClientRect()
      
      // Start drag at 25%
      const startX = rect.left + (rect.width * 0.25)
      const endX = rect.left + (rect.width * 0.75)
      
      fireEvent.mouseDown(progressBar, { clientX: startX })
      fireEvent.mouseMove(progressBar, { clientX: endX })
      
      // Should show preview of time while dragging
      await waitFor(() => {
        const timeDisplay = screen.getByTestId('current-time')
        expect(timeDisplay.textContent).toMatch(/2:\d{2}/) // Around 2:15
      })

      fireEvent.mouseUp(progressBar, { clientX: endX })
      
      // Should finalize at the dragged position
      await waitFor(() => {
        const timeDisplay = screen.getByTestId('current-time')
        expect(timeDisplay.textContent).toMatch(/2:\d{2}/)
      })
    })

    it('should handle continuous scrubbing without crashing', async () => {
      render(<App />)
      await loadTestFile()

      const progressBar = screen.getByTestId('progress-bar')
      const rect = progressBar.getBoundingClientRect()
      
      // Rapid back and forth scrubbing
      fireEvent.mouseDown(progressBar, { clientX: rect.left + rect.width * 0.1 })
      
      for (let i = 0; i < 10; i++) {
        const x = rect.left + (rect.width * (0.1 + (i * 0.08)))
        fireEvent.mouseMove(progressBar, { clientX: x })
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      fireEvent.mouseUp(progressBar, { clientX: rect.left + rect.width * 0.9 })
      
      // Should handle it gracefully
      await waitFor(() => {
        const timeDisplay = screen.getByTestId('current-time')
        expect(timeDisplay.textContent).toMatch(/\d:\d{2}/)
      })
    })
  })

  describe('Keyboard Seeking', () => {
    it('should seek backward 10 seconds with left arrow', async () => {
      render(<App />)
      await loadTestFile()

      // Focus the app to receive keyboard events
      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Start playback to get some time elapsed
      const playButton = screen.getByTitle('Play/Pause (Space)')
      await user.click(playButton)
      
      await new Promise(resolve => setTimeout(resolve, 200)) // Let some time pass
      
      const initialTime = screen.getByTestId('current-time').textContent
      
      // Press left arrow to seek backward
      await user.keyboard('{ArrowLeft}')
      
      await waitFor(() => {
        const newTime = screen.getByText('current-time').textContent
        expect(newTime).not.toBe(initialTime)
      })
    })

    it('should seek forward 10 seconds with right arrow', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      const initialTime = screen.getByTestId('current-time').textContent
      
      // Press right arrow to seek forward
      await user.keyboard('{ArrowRight}')
      
      await waitFor(() => {
        const newTime = screen.getByTestId('current-time').textContent
        expect(newTime).not.toBe(initialTime)
      })
    })

    it('should handle multiple arrow key presses', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      const initialTime = screen.getByTestId('current-time').textContent
      
      // Press right arrow multiple times
      await user.keyboard('{ArrowRight}')
      await user.keyboard('{ArrowRight}')
      await user.keyboard('{ArrowRight}')
      
      await waitFor(() => {
        const newTime = screen.getByTestId('current-time').textContent
        expect(newTime).not.toBe(initialTime)
      })
    })

    it('should clamp at track boundaries', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Try to seek before start
      await user.keyboard('{ArrowLeft}')
      
      await waitFor(() => {
        const timeDisplay = screen.getByTestId('current-time')
        expect(timeDisplay.textContent).toBe('0:00')
      })

      // Seek to near end
      for (let i = 0; i < 20; i++) {
        await user.keyboard('{ArrowRight}')
      }
      
      await waitFor(() => {
        const timeDisplay = screen.getByTestId('current-time')
        expect(timeDisplay.textContent).toMatch(/3:\d{2}/) // Should be at or near end
      })
    })

    it('should prevent default browser behavior for arrow keys', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Mock preventDefault
      const preventDefaultSpy = vi.fn()
      
      // Simulate keydown event
      fireEvent.keyDown(appContainer, {
        key: 'ArrowRight',
        preventDefault: preventDefaultSpy
      })

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe('Spectrogram Interaction Seeking', () => {
    it('should seek when clicking on spectrogram', async () => {
      render(<App />)
      await loadTestFile()

      const spectrogramCanvas = screen.getByTestId('spectrogram-canvas')
      const initialTime = screen.getByTestId('current-time').textContent
      
      const rect = spectrogramCanvas.getBoundingClientRect()
      const clickX = rect.left + (rect.width * 0.6) // 60% position
      
      fireEvent.click(spectrogramCanvas, {
        clientX: clickX,
        clientY: rect.top + rect.height / 2
      })

      await waitFor(() => {
        const newTime = screen.getByTestId('current-time').textContent
        expect(newTime).not.toBe(initialTime)
        expect(newTime).toMatch(/1:\d{2}/) // Around 1:48
      })
    })

    it('should highlight clicked position on spectrogram', async () => {
      render(<App />)
      await loadTestFile()

      const spectrogramCanvas = screen.getByTestId('spectrogram-canvas')
      const rect = spectrogramCanvas.getBoundingClientRect()
      const clickX = rect.left + (rect.width * 0.5)
      
      fireEvent.click(spectrogramCanvas, {
        clientX: clickX,
        clientY: rect.top + rect.height / 2
      })

      await waitFor(() => {
        expect(spectrogramCanvas).toHaveAttribute('data-playhead-position', expect.any(String))
      })
    })
  })

  describe('Synchronization Verification', () => {
    it('should keep time display, progress bar, and audio in sync', async () => {
      render(<App />)
      await loadTestFile()

      const progressBar = screen.getByTestId('progress-bar')
      const timeDisplay = screen.getByTestId('current-time')
      const rect = progressBar.getBoundingClientRect()
      
      // Seek to 50%
      const clickX = rect.left + (rect.width * 0.5)
      fireEvent.click(progressBar, {
        clientX: clickX,
        clientY: rect.top + rect.height / 2
      })

      await waitFor(() => {
        // Time display should show around 1:30
        expect(timeDisplay.textContent).toMatch(/1:\d{2}/)
        
        // Progress bar should be at 50%
        const progressFill = screen.getByTestId('progress-fill')
        expect(progressFill).toHaveStyle({ width: '50%' })
      })
    })

    it('should maintain sync during playback', async () => {
      render(<App />)
      await loadTestFile()

      const playButton = screen.getByTitle('Play/Pause (Space)')
      await user.click(playButton)

      await waitFor(() => {
        expect(screen.getByTestId('play-pause-icon')).toHaveAttribute('data-state', 'playing')
      })

      // Let it play for a moment
      await new Promise(resolve => setTimeout(resolve, 500))

      // Check that time and progress are still in sync
      const timeDisplay = screen.getByTestId('current-time')
      const progressFill = screen.getByTestId('progress-fill')
      
      const timeText = timeDisplay.textContent
      const progressWidth = progressFill.style.width
      
      // Both should indicate progression
      expect(timeText).not.toBe('0:00')
      expect(progressWidth).not.toBe('0%')
    })
  })
})
