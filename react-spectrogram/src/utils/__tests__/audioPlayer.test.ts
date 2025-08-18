import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { audioPlayer } from '../audioPlayer'

class MockAudioBuffer { constructor(public duration: number) {} }

class MockAudioBufferSourceNode {
  buffer: any = null
  connect() {}
  start() {}
  stop() {}
  disconnect() {}
  onended: (() => void) | null = null
}

class MockGainNode { gain = { value: 0.5 }; connect() {} }
class MockAnalyserNode { fftSize = 0; connect() {} }

let decodeCall = 0

class MockAudioContext {
  currentTime = 0
  state: 'running' | 'suspended' = 'running'
  createGain() { return new MockGainNode() }
  createAnalyser() { return new MockAnalyserNode() }
  createBufferSource() { return new MockAudioBufferSourceNode() }
  decodeAudioData(_: ArrayBuffer) {
    decodeCall++
    const duration = decodeCall
    const delay = duration === 1 ? 20 : 0
    return new Promise<MockAudioBuffer>(resolve => setTimeout(() => resolve(new MockAudioBuffer(duration)), delay))
  }
  resume() { return Promise.resolve() }
  close() {}
}

beforeEach(() => {
  decodeCall = 0
  ;(globalThis as any).requestAnimationFrame = vi.fn()
  ;(globalThis as any).cancelAnimationFrame = vi.fn()
  ;(window as any).AudioContext = MockAudioContext as any
  ;(window as any).webkitAudioContext = MockAudioContext as any
  audioPlayer.cleanup()
})

afterEach(() => {
  audioPlayer.cleanup()
  vi.clearAllMocks()
})

describe('audioPlayer overlap handling', () => {
  it('prevents previous track from playing when a new track is started', async () => {
    const track1 = { file: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } }
    const track2 = { file: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } }

    const startSpy = vi.spyOn(MockAudioBufferSourceNode.prototype, 'start')

    const p1 = audioPlayer.playTrack(track1)
    const p2 = audioPlayer.playTrack(track2)

    await new Promise(resolve => setTimeout(resolve, 30))
    await Promise.all([p1, p2])

    expect(startSpy).toHaveBeenCalledTimes(1)
    expect(audioPlayer.getDuration()).toBe(2)
  })

  it('cancels pending playback when stop is called before decode completes', async () => {
    const track = { file: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } }
    const startSpy = vi.spyOn(MockAudioBufferSourceNode.prototype, 'start')

    const p = audioPlayer.playTrack(track)
    audioPlayer.stopPlayback()

    await new Promise(resolve => setTimeout(resolve, 30))
    await p

    expect(startSpy).not.toHaveBeenCalled()
    expect(audioPlayer.isPlaying()).toBe(false)
  })

  it('resumes from paused position', async () => {
    const track = { file: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } }
    const startSpy = vi.spyOn(MockAudioBufferSourceNode.prototype, 'start')

    await audioPlayer.playTrack(track)
    const ctx = audioPlayer.getAudioContext() as any
    ctx.currentTime = 5
    audioPlayer.pausePlayback()
    audioPlayer.resumePlayback()

    expect(startSpy).toHaveBeenCalledTimes(2)
    expect(startSpy.mock.calls[1][1]).toBeCloseTo(5)
  })
})
