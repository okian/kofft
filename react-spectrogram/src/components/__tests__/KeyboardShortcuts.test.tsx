import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../../App'

// Mock file input
const createMockFile = (name: string, type: string, content: string = 'mock audio data') => {
  return new File([content], name, { type })
}

describe('Keyboard Shortcut Functionality', () => {
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

  describe('Play/Pause Shortcut (Spacebar)', () => {
    it('should toggle playback with spacebar', async () => {
      render(<App />)
      await loadTestFile()

      // Focus the app to receive keyboard events
      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Start playback with spacebar
      await user.keyboard(' ')
      await waitFor(() => {
        expect(screen.getByTestId('play-pause-icon')).toHaveAttribute('data-state', 'playing')
      })

      // Pause with spacebar
      await user.keyboard(' ')
      await waitFor(() => {
        expect(screen.getByTestId('play-pause-icon')).toHaveAttribute('data-state', 'paused')
      })

      // Resume with spacebar
      await user.keyboard(' ')
      await waitFor(() => {
        expect(screen.getByTestId('play-pause-icon')).toHaveAttribute('data-state', 'playing')
      })
    })

    it('should prevent page scroll when using spacebar', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Mock preventDefault
      const preventDefaultSpy = vi.fn()
      
      // Simulate keydown event
      fireEvent.keyDown(appContainer, {
        key: ' ',
        preventDefault: preventDefaultSpy
      })

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should work even if play button is not clicked', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Use spacebar without clicking play button
      await user.keyboard(' ')
      await waitFor(() => {
        expect(screen.getByTestId('play-pause-icon')).toHaveAttribute('data-state', 'playing')
      })
    })
  })

  describe('Seek Shortcuts (Arrow Keys)', () => {
    it('should seek backward 10 seconds with left arrow', async () => {
      render(<App />)
      await loadTestFile()

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
        const newTime = screen.getByTestId('current-time').textContent
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

    it('should prevent default browser behavior for arrow keys', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Mock preventDefault
      const preventDefaultSpy = vi.fn()
      
      // Simulate keydown events
      fireEvent.keyDown(appContainer, {
        key: 'ArrowLeft',
        preventDefault: preventDefaultSpy
      })

      fireEvent.keyDown(appContainer, {
        key: 'ArrowRight',
        preventDefault: preventDefaultSpy
      })

      expect(preventDefaultSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Volume Control Shortcuts', () => {
    it('should increase volume with up arrow', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      const volumeSlider = screen.getByTestId('volume-slider')
      const initialVolume = volumeSlider.getAttribute('value') || '100'
      
      // Press up arrow to increase volume
      await user.keyboard('{ArrowUp}')
      
      await waitFor(() => {
        const newVolume = volumeSlider.getAttribute('value')
        expect(parseInt(newVolume || '0')).toBeGreaterThan(parseInt(initialVolume))
      })
    })

    it('should decrease volume with down arrow', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      const volumeSlider = screen.getByTestId('volume-slider')
      const initialVolume = volumeSlider.getAttribute('value') || '100'
      
      // Press down arrow to decrease volume
      await user.keyboard('{ArrowDown}')
      
      await waitFor(() => {
        const newVolume = volumeSlider.getAttribute('value')
        expect(parseInt(newVolume || '0')).toBeLessThan(parseInt(initialVolume))
      })
    })

    it('should not go below 0% volume', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Press down arrow many times to try to go below 0
      for (let i = 0; i < 20; i++) {
        await user.keyboard('{ArrowDown}')
      }
      
      await waitFor(() => {
        const volumeSlider = screen.getByTestId('volume-slider')
        const volume = volumeSlider.getAttribute('value')
        expect(parseInt(volume || '0')).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Mute Shortcut', () => {
    it('should toggle mute with M key', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Press M to mute
      await user.keyboard('m')
      await waitFor(() => {
        const volumeSlider = screen.getByTestId('volume-slider')
        expect(volumeSlider.getAttribute('value')).toBe('0')
      })

      // Press M again to unmute
      await user.keyboard('m')
      await waitFor(() => {
        const volumeSlider = screen.getByTestId('volume-slider')
        expect(volumeSlider.getAttribute('value')).toBe('100')
      })
    })

    it('should show muted icon when muted', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Press M to mute
      await user.keyboard('m')
      await waitFor(() => {
        const volumeIcon = screen.getByTestId('volume-icon')
        expect(volumeIcon).toHaveAttribute('data-muted', 'true')
      })
    })
  })

  describe('File Open Shortcut', () => {
    it('should open file dialog with Ctrl+O', async () => {
      render(<App />)

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Mock file input click
      const fileInput = screen.getByTestId('file-input')
      const clickSpy = vi.spyOn(fileInput, 'click')

      // Press Ctrl+O
      await user.keyboard('{Control>}o{/Control}')
      
      expect(clickSpy).toHaveBeenCalled()
    })

    it('should open file dialog with O key', async () => {
      render(<App />)

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Mock file input click
      const fileInput = screen.getByTestId('file-input')
      const clickSpy = vi.spyOn(fileInput, 'click')

      // Press O
      await user.keyboard('o')
      
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('Playlist Navigation Shortcuts', () => {
    it('should go to next track with Ctrl+Right', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Mock next track functionality
      const nextButton = screen.getByTitle('Next track (Ctrl+→)')
      const clickSpy = vi.spyOn(nextButton, 'click')

      // Press Ctrl+Right
      await user.keyboard('{Control>}{ArrowRight}{/Control}')
      
      expect(clickSpy).toHaveBeenCalled()
    })

    it('should go to previous track with Ctrl+Left', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Mock previous track functionality
      const prevButton = screen.getByTitle('Previous track (Ctrl+←)')
      const clickSpy = vi.spyOn(prevButton, 'click')

      // Press Ctrl+Left
      await user.keyboard('{Control>}{ArrowLeft}{/Control}')
      
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('Other Shortcuts', () => {
    it('should open settings with S key', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Press S to open settings
      await user.keyboard('s')
      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument()
      })
    })

    it('should open shortcut help with ? key', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      await user.keyboard('?')
      await waitFor(() => {
        expect(screen.getByTestId('shortcuts-modal')).toBeInTheDocument()
      })

      await user.keyboard('{Escape}')
      await waitFor(() => {
        expect(screen.queryByTestId('shortcuts-modal')).not.toBeInTheDocument()
      })
    })

    it('should close modals with Escape key', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Open settings first
      await user.keyboard('s')
      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument()
      })

      // Press Escape to close
      await user.keyboard('{Escape}')
      await waitFor(() => {
        expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument()
      })
    })
  })

  describe('Keyboard Focus Management', () => {
    it('should work when app has focus', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Test that shortcuts work
      await user.keyboard(' ')
      await waitFor(() => {
        expect(screen.getByTestId('play-pause-icon')).toHaveAttribute('data-state', 'playing')
      })
    })

    it('should not work when app loses focus', async () => {
      render(<App />)
      await loadTestFile()

      // Click outside the app to lose focus
      const body = document.body
      fireEvent.click(body)

      // Try to use spacebar - should not affect playback
      await user.keyboard(' ')
      
      // Should still be in initial state
      expect(screen.getByTestId('play-pause-icon')).toHaveAttribute('data-state', 'paused')
    })
  })

  describe('Conflict with Browser Shortcuts', () => {
    it('should prevent spacebar from scrolling page', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Mock preventDefault
      const preventDefaultSpy = vi.fn()
      
      // Simulate keydown event
      fireEvent.keyDown(appContainer, {
        key: ' ',
        preventDefault: preventDefaultSpy
      })

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should prevent arrow keys from scrolling page', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Mock preventDefault
      const preventDefaultSpy = vi.fn()
      
      // Simulate keydown events
      const arrowKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
      arrowKeys.forEach(key => {
        fireEvent.keyDown(appContainer, {
          key,
          preventDefault: preventDefaultSpy
        })
      })

      expect(preventDefaultSpy).toHaveBeenCalledTimes(4)
    })
  })

  describe('Accessibility and Error Handling', () => {
    it('should handle rapid key presses gracefully', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Rapidly press spacebar multiple times
      await user.keyboard(' ')
      await user.keyboard(' ')
      await user.keyboard(' ')
      await user.keyboard(' ')

      // Should end up in a consistent state
      await waitFor(() => {
        const state = screen.getByTestId('play-pause-icon').getAttribute('data-state')
        expect(['playing', 'paused', 'stopped']).toContain(state)
      })
    })

    it('should not crash on unsupported key combinations', async () => {
      render(<App />)
      await loadTestFile()

      const appContainer = screen.getByTestId('app-container')
      appContainer.focus()

      // Try various unsupported key combinations
      const unsupportedKeys = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']
      
      for (const key of unsupportedKeys) {
        await user.keyboard(key)
      }

      // App should still be functional
      expect(screen.getByTestId('play-pause-icon')).toBeInTheDocument()
    })
  })
})
