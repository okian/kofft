import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAudioStore } from '../audioStore'
import type { AudioTrack } from '@/types'
import { revokeTrackUrl } from '@/utils/audio'

vi.mock('@/utils/audio', () => ({
  revokeTrackUrl: vi.fn()
}))

describe('audioStore', () => {
  beforeEach(() => {
    // reset store state before each test
    useAudioStore.setState({
      playlist: [],
      currentTrackIndex: -1,
      currentTrack: null
    })
    vi.resetAllMocks()
  })

  it('revokes track URL when removed from playlist', () => {
    const track: AudioTrack = {
      id: '1',
      file: new File([], 'test.mp3'),
      metadata: { title: 't', artist: 'a', album: 'b', duration: 0 },
      duration: 0,
      url: 'blob:test'
    }

    const store = useAudioStore.getState()
    store.setPlaylist([track])

    store.removeFromPlaylist(0)

    expect(revokeTrackUrl).toHaveBeenCalledWith(track)
  })
})
