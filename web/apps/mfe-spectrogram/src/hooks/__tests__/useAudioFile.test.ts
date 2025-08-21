import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const {
  state,
  addToPlaylist,
  setCurrentTrack,
  updateTrack,
  useAudioStore
} = vi.hoisted(() => {
  const state: any = { playlist: [], currentTrack: null }
  const addToPlaylist = vi.fn((track) => state.playlist.push(track))
  const setCurrentTrack = vi.fn((track) => { state.currentTrack = track })
  const updateTrack = vi.fn()
  const useAudioStore: any = () => ({ addToPlaylist, setCurrentTrack })
  useAudioStore.getState = () => ({ ...state, updateTrack })
  return { state, addToPlaylist, setCurrentTrack, updateTrack, useAudioStore }
})

vi.mock('@/shared/stores/audioStore', () => ({ useAudioStore }))

const { extractMetadata, generateAmplitudeEnvelope } = vi.hoisted(() => {
  return {
    extractMetadata: vi.fn().mockResolvedValue({
      title: 'meta',
      artist: 'artist',
      album: 'album',
      duration: 1,
      sample_rate: 44100,
    }),
    generateAmplitudeEnvelope: vi.fn().mockResolvedValue(new Float32Array([1, 2, 3]))
  }
})

vi.mock('@/utils/wasm', () => ({
  extractMetadata,
  generateAmplitudeEnvelope,
}))

vi.mock('@/utils/artwork', () => ({
  extractArtwork: vi.fn().mockResolvedValue({ artwork: null })
}))

vi.mock('@/utils/audioPlayer', () => ({
  audioPlayer: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    initAudioContext: vi.fn().mockResolvedValue({
      decodeAudioData: vi.fn().mockResolvedValue({ getChannelData: () => new Float32Array(0) })
    }),
    playTrack: vi.fn(),
    stopPlayback: vi.fn(),
    pausePlayback: vi.fn(),
    resumePlayback: vi.fn(),
    seekTo: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    getFrequencyData: vi.fn(),
    getTimeData: vi.fn(),
    cleanup: vi.fn()
  }
}))

vi.mock('@/utils/toast', () => ({
  conditionalToast: { success: vi.fn(), error: vi.fn() }
}))

import { useAudioFile } from '../useAudioFile'
describe('useAudioFile', () => {
  beforeEach(() => {
    state.playlist = []
    state.currentTrack = null
    addToPlaylist.mockClear()
    setCurrentTrack.mockClear()
    updateTrack.mockClear()
    extractMetadata.mockClear()
    ;(localStorage.getItem as any).mockReset()
    ;(localStorage.setItem as any).mockReset()
  })

  it('adds placeholder and updates track asynchronously', async () => {
    const file = new File(['data'], 'track.mp3', { type: 'audio/mpeg' })
    ;(file as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8))
    const { result } = renderHook(() => useAudioFile())
    let placeholder: any
    await act(async () => { placeholder = await result.current.loadAudioFile(file) })
    expect(addToPlaylist).toHaveBeenCalledWith(expect.objectContaining({ isLoading: true }))
    await waitFor(() =>
      expect(updateTrack).toHaveBeenCalledWith(placeholder.id, expect.objectContaining({ isLoading: false }))
    )
  })

  it('uses cached metadata and skips extractMetadata', async () => {
    const encoder = new TextEncoder()
    const buffer = encoder.encode('data').buffer
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    const cacheKey = `audio-metadata-${hash}`
    const store: Record<string, string> = {
      [cacheKey]: JSON.stringify({
        metadata: { title: 'cached', artist: 'artist', album: 'album', duration: 1, sample_rate: 44100 },
        artwork: null,
      }),
    }
    ;(localStorage.getItem as any).mockImplementation(key => store[key] || null)
    ;(localStorage.setItem as any).mockImplementation((key, val) => {
      store[key] = val
    })

    const file = new File(['data'], 'track.mp3', { type: 'audio/mpeg' })
    ;(file as any).arrayBuffer = vi.fn().mockResolvedValue(buffer)

    const { result } = renderHook(() => useAudioFile())
    await act(async () => {
      await result.current.loadAudioFile(file)
    })

    await waitFor(() => expect(updateTrack).toHaveBeenCalled())

    expect(localStorage.getItem).toHaveBeenCalledWith(cacheKey)
    expect(extractMetadata).not.toHaveBeenCalled()
    expect(updateTrack).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ metadata: expect.objectContaining({ title: 'cached' }) })
    )
  })
})
