import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { WaveformSeekbar } from '../spectrogram/WaveformSeekbar'
import { audioPlayer } from '@/utils/audioPlayer'
import { useAudioStore } from '@/stores/audioStore'

// Reset store after each test
afterEach(() => {
  useAudioStore.setState({ currentTime: 0, duration: 0 })
  vi.restoreAllMocks()
})

describe('WaveformSeekbar integration', () => {
  it('updates position when store time changes', () => {
    render(<WaveformSeekbar audioData={null} />)
    const slider = screen.getByRole('slider')

    act(() => {
      useAudioStore.setState({ currentTime: 10, duration: 100 })
    })

    expect(slider).toHaveAttribute('aria-valuenow', '10')
  })

  it('seeks using the engine and reflects new time', () => {
    const seekSpy = vi.spyOn(audioPlayer, 'seek').mockImplementation((time: number) => {
      ;(audioPlayer as any).isPaused = true
      ;(audioPlayer as any).pausedTime = time
      ;(audioPlayer as any).currentBuffer = { duration: 100 }
      ;(audioPlayer as any).emit('timeupdate')
    })

    ;(audioPlayer as any).isPaused = true
    ;(audioPlayer as any).pausedTime = 0
    ;(audioPlayer as any).currentBuffer = { duration: 100 }
    ;(audioPlayer as any).emit('timeupdate')

    render(<WaveformSeekbar audioData={null} />)
    const slider = screen.getByRole('slider') as any
    slider.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 20, right: 100, bottom: 20, x: 0, y: 0, toJSON: () => {} })

    fireEvent.mouseDown(slider, { clientX: 50 })
    fireEvent.mouseUp(slider)

    expect(seekSpy).toHaveBeenCalledWith(50)
    expect(slider).toHaveAttribute('aria-valuenow', '50')
  })
})
