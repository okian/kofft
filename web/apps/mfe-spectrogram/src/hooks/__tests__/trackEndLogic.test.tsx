import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { useAudioFile } from '../useAudioFile'
import { useAudioStore } from '@/stores/audioStore'
import { audioPlayer } from '@/shared/utils/audioPlayer'

function Register() {
  useAudioFile()
  return null
}

const track = (id: string) => ({ id, file: { arrayBuffer: async () => new ArrayBuffer(8) }, metadata: {} } as any)

describe('track end behaviour', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAudioStore.setState({
      playlist: [],
      currentTrackIndex: -1,
      currentTrack: null,
      loopMode: 'off',
      shuffle: false,
      setPlaying: vi.fn(),
      setPaused: vi.fn(),
      setStopped: vi.fn(),
      playTrack: vi.fn().mockResolvedValue(undefined),
      nextTrack: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('advances to next track when not at end', async () => {
    const t1 = track('1')
    const t2 = track('2')
    useAudioStore.setState({ playlist: [t1, t2], currentTrackIndex: 0, currentTrack: t1 })
    render(<Register />)
    ;(audioPlayer as any).handleTrackEnded()
    expect(useAudioStore.getState().playTrack).toHaveBeenCalledWith(1)
  })

  it('stops when playlist ends and loop off', () => {
    const t1 = track('1')
    useAudioStore.setState({ playlist: [t1], currentTrackIndex: 0, currentTrack: t1 })
    render(<Register />)
    ;(audioPlayer as any).handleTrackEnded()
    const state = useAudioStore.getState()
    expect(state.playTrack).not.toHaveBeenCalled()
    expect(state.setPlaying).toHaveBeenCalledWith(false)
    expect(state.setPaused).toHaveBeenCalledWith(false)
    expect(state.setStopped).toHaveBeenCalledWith(true)
  })

  it('repeats same track when loopMode="one"', () => {
    const t1 = track('1')
    useAudioStore.setState({ playlist: [t1], currentTrackIndex: 0, currentTrack: t1, loopMode: 'one' })
    render(<Register />)
    ;(audioPlayer as any).handleTrackEnded()
    expect(useAudioStore.getState().playTrack).toHaveBeenCalledWith(0)
  })

  it('loops to first track when loopMode="all" at end', () => {
    const t1 = track('1')
    const t2 = track('2')
    useAudioStore.setState({ playlist: [t1, t2], currentTrackIndex: 1, currentTrack: t2, loopMode: 'all' })
    render(<Register />)
    ;(audioPlayer as any).handleTrackEnded()
    expect(useAudioStore.getState().playTrack).toHaveBeenCalledWith(0)
  })

  it('uses nextTrack when shuffle enabled', () => {
    const t1 = track('1')
    const t2 = track('2')
    useAudioStore.setState({ playlist: [t1, t2], currentTrackIndex: 0, currentTrack: t1, shuffle: true })
    render(<Register />)
    ;(audioPlayer as any).handleTrackEnded()
    expect(useAudioStore.getState().nextTrack).toHaveBeenCalled()
  })

  it('stops when shuffle has one track and loop off', () => {
    const t1 = track('1')
    useAudioStore.setState({ playlist: [t1], currentTrackIndex: 0, currentTrack: t1, shuffle: true })
    render(<Register />)
    ;(audioPlayer as any).handleTrackEnded()
    const state = useAudioStore.getState()
    expect(state.nextTrack).not.toHaveBeenCalled()
    expect(state.setPlaying).toHaveBeenCalledWith(false)
    expect(state.setPaused).toHaveBeenCalledWith(false)
    expect(state.setStopped).toHaveBeenCalledWith(true)
  })
})
