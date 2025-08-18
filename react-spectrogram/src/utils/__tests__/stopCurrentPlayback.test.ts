import { describe, it, expect, vi } from 'vitest'
import { audioPlayer } from '../audioPlayer'

describe('stopCurrentPlayback', () => {
  it('clears source and cancels animation frame without triggering onended', () => {
    const mockStop = vi.fn(() => {
      if (mockSource.onended) {
        mockSource.onended(new Event('ended'))
      }
    })
    const mockDisconnect = vi.fn()
    const mockSource: any = {
      stop: mockStop,
      disconnect: mockDisconnect,
      onended: vi.fn()
    }

    ;(audioPlayer as any).source = mockSource
    ;(audioPlayer as any).animationFrameId = 1

    const cancelSpy = vi.spyOn(global, 'cancelAnimationFrame')
    const endedSpy = vi.spyOn(audioPlayer as any, 'handleTrackEnded')

    ;(audioPlayer as any).stopCurrentPlayback()

    expect(mockStop).toHaveBeenCalled()
    expect(mockDisconnect).toHaveBeenCalled()
    expect(cancelSpy).toHaveBeenCalledWith(1)
    expect(mockSource.onended).toBeNull()
    expect(endedSpy).not.toHaveBeenCalled()

    cancelSpy.mockRestore()
    endedSpy.mockRestore()
  })
})

