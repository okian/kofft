import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractMetadata } from '../wasm'
// import { AudioMetadata } from '@/types'

// Mock the WASM module completely
vi.mock('../wasm/web_spectrogram', () => ({
  default: {
    start: vi.fn(),
    MetadataExtractor: vi.fn(() => ({
      free: vi.fn(),
      extract_metadata: vi.fn()
    }))
  },
  start: vi.fn(),
  MetadataExtractor: vi.fn(() => ({
    free: vi.fn(),
    extract_metadata: vi.fn()
  }))
}))

describe('WASM Metadata Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should extract basic metadata when WASM is not available', async () => {
    const mockFile = new File(['test audio data'], 'test-song.mp3', { type: 'audio/mp3' })

    const result = await extractMetadata(mockFile)

    expect(result.title).toBe('test-song')
    expect(result.artist).toBe('Unknown Artist')
    expect(result.album).toBe('Unknown Album')
    expect(result.format).toBe('audio/mp3')
  })

  it('should handle files with different extensions', async () => {
    const testCases = [
      { name: 'song.flac', type: 'audio/flac' },
      { name: 'song.wav', type: 'audio/wav' },
      { name: 'song.m4a', type: 'audio/mp4' },
      { name: 'song.ogg', type: 'audio/ogg' }
    ]

    for (const testCase of testCases) {
      const mockFile = new File(['test audio data'], testCase.name, { type: testCase.type })
      const result = await extractMetadata(mockFile)

      expect(result.title).toBe('song')
      expect(result.format).toBe(testCase.type)
    }
  })

  it('should handle files with special characters in names', async () => {
    const mockFile = new File(['test audio data'], 'My Song - Artist (2023).mp3', { type: 'audio/mp3' })

    const result = await extractMetadata(mockFile)

    expect(result.title).toBe('My Song - Artist (2023)')
    expect(result.artist).toBe('Unknown Artist')
    expect(result.album).toBe('Unknown Album')
  })

  it('should provide reasonable defaults for missing metadata', async () => {
    const mockFile = new File(['test audio data'], 'test-song.mp3', { type: 'audio/mp3' })

    const result = await extractMetadata(mockFile)

    expect(result).toMatchObject({
      title: 'test-song',
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      format: 'audio/mp3'
    })
  })
})
