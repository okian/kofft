import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'

vi.mock('music-metadata-browser', () => ({
  parseBlob: vi.fn()
}))

vi.mock('@/shared/utils/audioPlayer', () => ({
  audioPlayer: {
    initAudioContext: vi.fn().mockResolvedValue({
      decodeAudioData: vi.fn().mockResolvedValue({
        sampleRate: 48000,
        numberOfChannels: 2
      })
    })
  }
}))

describe('extractMetadata', () => {
  const mockFile = new File(['data'], 'test.mp3', { type: 'audio/mp3' })

  beforeEach(() => {
    vi.resetModules()
  })

  it('falls back when parsing fails', async () => {
    const { parseBlob } = await import('music-metadata-browser')
    ;(parseBlob as Mock).mockRejectedValue(new Error('fail'))

    class MockAudio {
      duration = 123
      src = ''
      addEventListener = vi.fn((event: string, handler: Function) => {
        if (event === 'loadedmetadata') {
          handler()
        }
      })
      removeEventListener = vi.fn()
    }
    const OriginalAudio = globalThis.Audio
    // @ts-expect-error: override for test
    globalThis.Audio = MockAudio

    const { extractMetadata } = await import('../wasm')
    const result = await extractMetadata(mockFile)

    expect(result.title).toBe('test')
    expect(result.duration).toBe(123)
    expect(result.artist).toBe('Unknown Artist')
    expect(result.album).toBe('Unknown Album')

    globalThis.Audio = OriginalAudio
  })

  it('uses metadata from music-metadata-browser when available', async () => {
    const { parseBlob } = await import('music-metadata-browser')
    const picture = { data: new Uint8Array([1, 2, 3]), format: 'image/png' }
    ;(parseBlob as Mock).mockResolvedValue({
      common: {
        title: 'WASM Song',
        artist: 'WASM Artist',
        album: 'WASM Album',
        picture: [picture]
      },
      format: {
        duration: 5,
        sampleRate: 48000,
        numberOfChannels: 2,
        bitsPerSample: 16,
        bitrate: 128000
      }
    })

    const { extractMetadata } = await import('../wasm')
    const result = await extractMetadata(mockFile)

    expect(parseBlob).toHaveBeenCalled()
    expect(result.title).toBe('WASM Song')
    expect(result.artist).toBe('WASM Artist')
    expect(result.album_art).toBeInstanceOf(Uint8Array)
    expect(result.album_art_mime).toBe('image/png')
    expect(result.bitrate).toBe(128)
    expect(result.sample_rate).toBe(48000)
    expect(result.channels).toBe(2)
  })
})
