import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { playbackEngine } from '../PlaybackEngine'

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext
  }
}

class MockSource {
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
  disconnect = vi.fn()
  onended: (() => void) | null = null
  buffer: AudioBuffer | null = null
}

class MockGain {
  gain = { value: 1 }
  connect = vi.fn()
}

class MockAudioContext {
  currentTime = 0
  destination = {}
  createGain() { return new MockGain() as any }
  createBufferSource() { return new MockSource() as any }
  resume = vi.fn().mockResolvedValue(undefined)
  close = vi.fn().mockResolvedValue(undefined)
  decodeAudioData(_arrayBuffer: ArrayBuffer) {
    return new Promise<AudioBuffer>(resolve => {
      setTimeout(() => resolve({ duration: 2 } as any), 0)
    })
  }
}

beforeEach(() => {
  ;(global as any).AudioContext = MockAudioContext as any
  ;(global as any).webkitAudioContext = MockAudioContext as any
  ;(window as any).AudioContext = MockAudioContext as any
  ;(window as any).webkitAudioContext = MockAudioContext as any
})

afterEach(() => {
  playbackEngine.cleanup()
  vi.clearAllMocks()
})

describe('PlaybackEngine', () => {
  it('stops previous playback when a new track starts', async () => {
    const track1 = { file: { arrayBuffer: async () => new ArrayBuffer(8) } } as any
    const track2 = { file: { arrayBuffer: async () => new ArrayBuffer(8) } } as any

    await playbackEngine.load(track1)
    playbackEngine.play()
    const stopSpy = vi.spyOn((playbackEngine as any).source!, 'stop')

    await playbackEngine.load(track2)
    expect(stopSpy).toHaveBeenCalled()
  })

  it('cancels pending decode when loading a new track', async () => {
    const slowTrack = { file: { arrayBuffer: () => new Promise<ArrayBuffer>(resolve => setTimeout(() => resolve(new ArrayBuffer(8)), 50)) } } as any
    const fastTrack = { file: { arrayBuffer: async () => new ArrayBuffer(8) } } as any

    const p1 = playbackEngine.load(slowTrack).catch(e => e)
    await playbackEngine.load(fastTrack)
    const result = await p1
    expect(result).toBeInstanceOf(DOMException)
    expect(result.name).toBe('AbortError')
  })
})
