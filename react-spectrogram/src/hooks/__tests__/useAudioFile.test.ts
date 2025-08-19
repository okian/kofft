import { describe, it, expect, vi, act } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAudioFile } from '../useAudioFile'

const state: any = { playlist: [], currentTrack: null }
const addToPlaylist = vi.fn(track => state.playlist.push(track))
const setCurrentTrack = vi.fn(track => { state.currentTrack = track })
const updateTrack = vi.fn()

const useAudioStore = () => ({ addToPlaylist, setCurrentTrack }) as any
useAudioStore.getState = () => ({ ...state, updateTrack })

vi.mock('@/stores/audioStore', () => ({ useAudioStore }))

vi.mock('@/utils/wasm', () => ({
  extractMetadata: vi.fn().mockResolvedValue({ title: 'meta', artist: 'artist', album: 'album', duration: 1, sample_rate: 44100 }),
  generateAmplitudeEnvelope: vi.fn().mockResolvedValue(new Float32Array([1, 2, 3]))
}))

vi.mock('@/utils/artwork', () => ({
  extractArtwork: vi.fn().mockResolvedValue({ artwork: null })
}))

vi.mock('@/utils/audioPlayer', () => ({
  audioPlayer: {
    initAudioContext: vi.fn().mockResolvedValue({ decodeAudioData: vi.fn().mockResolvedValue({ getChannelData: () => new Float32Array(0) }) })
  }
}))

vi.mock('@/utils/toast', () => ({
  conditionalToast: { success: vi.fn(), error: vi.fn() }
}))

describe('useAudioFile', () => {
  it('adds placeholder and updates track asynchronously', async () => {
    const file = new File(['data'], 'track.mp3', { type: 'audio/mpeg' })
    ;(file as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8))
    const { result } = renderHook(() => useAudioFile())
    let placeholder: any
    await act(async () => { placeholder = await result.current.loadAudioFile(file) })
    expect(addToPlaylist).toHaveBeenCalledWith(expect.objectContaining({ isLoading: true }))
    await Promise.resolve()
    await Promise.resolve()
    expect(updateTrack).toHaveBeenCalledWith(placeholder.id, expect.objectContaining({ isLoading: false }))
  })
})
