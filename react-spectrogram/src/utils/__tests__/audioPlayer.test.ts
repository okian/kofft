import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { audioPlayer } from '../audioPlayer'

type Track = {
  id: string
  file: { arrayBuffer: () => Promise<ArrayBuffer> }
  metadata: any
  duration: number
  url: string
}

const createTrack = (id: string, arrayBufferPromise: Promise<ArrayBuffer>): Track => ({
  id,
  file: { arrayBuffer: () => arrayBufferPromise },
  metadata: {},
  duration: 0,
  url: ''
})

describe('audioPlayer', () => {
  let mockContext: any
  const mockBuffer = { duration: 1, getChannelData: () => new Float32Array(1) }

  beforeEach(() => {
    vi.useFakeTimers()
    mockContext = {
      createGain: vi.fn(() => ({ gain: { value: 0.5 }, connect: vi.fn() })),
      createAnalyser: vi.fn(() => ({
        fftSize: 0,
        connect: vi.fn(),
        frequencyBinCount: 1,
        getByteFrequencyData: vi.fn(),
        getByteTimeDomainData: vi.fn()
      })),
      createBufferSource: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null as any
      })),
      decodeAudioData: vi.fn(() => Promise.resolve(mockBuffer)),
      currentTime: 0,
      resume: vi.fn(() => Promise.resolve()),
      state: 'running',
      destination: {},
      close: vi.fn(() => Promise.resolve())
    }
    ;(global as any).AudioContext = vi.fn(() => mockContext)
    audioPlayer.cleanup()
  })

  afterEach(() => {
    audioPlayer.cleanup()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('cancels outdated play requests to prevent overlapping audio', async () => {
    const slowArrayBuffer = new Promise<ArrayBuffer>(resolve =>
      setTimeout(() => resolve(new ArrayBuffer(8)), 20)
    )
    const fastArrayBuffer = Promise.resolve(new ArrayBuffer(8))
    const trackA = createTrack('a', slowArrayBuffer)
    const trackB = createTrack('b', fastArrayBuffer)

    const p1 = audioPlayer.playTrack(trackA)
    const p2 = audioPlayer.playTrack(trackB)

    vi.advanceTimersByTime(20)
    await Promise.all([p1, p2])

    expect(mockContext.createBufferSource).toHaveBeenCalledTimes(1)
  })

  it('removes previous onended handler when switching tracks', async () => {
    const trackA = createTrack('a', Promise.resolve(new ArrayBuffer(8)))
    const trackB = createTrack('b', Promise.resolve(new ArrayBuffer(8)))

    const sources: any[] = []
    mockContext.createBufferSource.mockImplementation(() => {
      const src = {
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null as any
      }
      sources.push(src)
      return src
    })

    await audioPlayer.playTrack(trackA)
    const handleEndedSpy = vi.spyOn(audioPlayer as any, 'handleTrackEnded')
    await audioPlayer.playTrack(trackB)

    expect(sources[0].onended).toBeNull()
    expect(handleEndedSpy).not.toHaveBeenCalled()
  })
})
