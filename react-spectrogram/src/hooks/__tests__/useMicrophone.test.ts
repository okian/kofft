import { describe, it, expect, vi, act } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMicrophone } from '../useMicrophone'

vi.mock('@/stores/audioStore', () => ({
  useAudioStore: () => ({
    setMicrophoneActive: vi.fn(),
    setLive: vi.fn(),
    setCurrentTrack: vi.fn()
  })
}))

const startMicrophoneMock = vi.fn().mockResolvedValue(true)
const stopMicrophoneMock = vi.fn().mockReturnValue(true)

vi.mock('@/utils/audioPlayer', () => ({
  audioPlayer: {
    initAudioContext: vi.fn().mockResolvedValue({}),
    startMicrophone: startMicrophoneMock,
    stopMicrophone: stopMicrophoneMock,
    getFrequencyData: vi.fn(),
    getTimeData: vi.fn(),
    onTrackEnd: vi.fn()
  }
}))

vi.mock('@/utils/toast', () => ({
  conditionalToast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('useMicrophone', () => {
  it('stops tracks when stopping microphone', async () => {
    const trackStop = vi.fn()
    const mockStream: any = { getTracks: () => [{ stop: trackStop }] }
    ;(global as any).navigator = {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
        enumerateDevices: vi.fn().mockResolvedValue([])
      }
    }

    const { result } = renderHook(() => useMicrophone())
    await act(async () => { await result.current.startMicrophone() })
    act(() => { result.current.stopMicrophone() })
    expect(trackStop).toHaveBeenCalled()
  })

  it('clears previous stream when starting again', async () => {
    const trackStop1 = vi.fn()
    const stream1: any = { getTracks: () => [{ stop: trackStop1 }] }
    const trackStop2 = vi.fn()
    const stream2: any = { getTracks: () => [{ stop: trackStop2 }] }
    ;(global as any).navigator = {
      mediaDevices: {
        getUserMedia: vi.fn()
          .mockResolvedValueOnce(stream1)
          .mockResolvedValueOnce(stream2),
        enumerateDevices: vi.fn().mockResolvedValue([])
      }
    }

    const { result } = renderHook(() => useMicrophone())
    await act(async () => { await result.current.startMicrophone() })
    await act(async () => { await result.current.startMicrophone() })
    expect(trackStop1).toHaveBeenCalled()
  })
})
