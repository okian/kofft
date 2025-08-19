import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'

vi.mock('@wasm/react_spectrogram_wasm', () => ({
  __esModule: true,
  default: vi.fn(),
  MetadataExtractor: vi.fn(),
}))

describe('extractMetadata', () => {
  beforeEach(async () => {
    vi.resetModules()
    const wasm = await import('@wasm/react_spectrogram_wasm')
    ;(wasm.MetadataExtractor as unknown as Mock).mockImplementation(() => ({
      extract_metadata: () => {
        throw new Error('fail')
      },
      free: vi.fn(),
    }))
  })

  it('falls back when WASM extraction fails', async () => {
    const { extractMetadata } = await import('../wasm')
    const mockFile = new File(['data'], 'test.mp3', { type: 'audio/mp3' })
    const result = await extractMetadata(mockFile)
    expect(result.title).toBe('test')
    expect(result.artist).toBe('Unknown Artist')
    expect(result.album).toBe('Unknown Album')
  })

  it('uses WASM MetadataExtractor when available', async () => {
    const wasm = await import('@wasm/react_spectrogram_wasm')
    const albumArt = new Uint8Array([1, 2, 3])
    const extractMock = vi.fn(() => ({
      title: 'WASM Song',
      artist: 'WASM Artist',
      album: 'WASM Album',
      album_art: albumArt,
      album_art_mime: 'image/png',
    }))
    const freeMock = vi.fn()
    ;(wasm.MetadataExtractor as unknown as Mock).mockImplementation(() => ({
      extract_metadata: extractMock,
      free: freeMock,
    }))
    const { extractMetadata } = await import('../wasm')
    const mockFile = new File([new Uint8Array([0])], 'song.mp3', { type: 'audio/mp3' })
    const result = await extractMetadata(mockFile)
    expect(extractMock).toHaveBeenCalled()
    expect(freeMock).toHaveBeenCalled()
    expect(result.title).toBe('WASM Song')
    expect(result.album_art).toBeInstanceOf(Uint8Array)
    expect(result.album_art?.length).toBe(3)
    expect(result.album_art_mime).toBe('image/png')
  })
})
