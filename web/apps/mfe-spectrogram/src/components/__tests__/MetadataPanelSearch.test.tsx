import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MetadataPanel } from '../layout/MetadataPanel'
import { PlaylistPanel } from '../layout/PlaylistPanel'
import { AudioTrack } from '@/types'
import { usePlaylistSearchStore } from '@/shared/stores/playlistSearchStore'

vi.mock('@/shared/utils/wasm', () => ({}), { virtual: true })
vi.mock('@/hooks/useAudioFile', () => ({
  useAudioFile: () => ({
    loadAudioFiles: vi.fn(),
  }),
}))

const tracks: AudioTrack[] = [
  {
    id: '1',
    file: new File(['test'], 'alpha.mp3', { type: 'audio/mp3' }),
    metadata: {
      title: 'Alpha Song',
      artist: 'Artist1',
      album: 'Album1',
      genre: 'Rock',
      year: 2000,
    },
    duration: 180,
    url: 'url1',
  },
  {
    id: '2',
    file: new File(['test'], 'beta.mp3', { type: 'audio/mp3' }),
    metadata: {
      title: 'Beta Song',
      artist: 'Artist2',
      album: 'Album2',
      genre: 'Pop',
      year: 2001,
    },
    duration: 200,
    url: 'url2',
  },
]

describe('MetadataPanel search links', () => {
  beforeEach(() => {
    usePlaylistSearchStore.setState({ searchQuery: '' })
  })

  it('sets search query when metadata value clicked', () => {
    render(
      <>
        <MetadataPanel track={tracks[0]} isOpen={true} onClose={() => {}} />
        <PlaylistPanel
          tracks={tracks}
          currentTrackIndex={-1}
          isOpen={true}
          onClose={() => {}}
          onTrackSelect={() => {}}
          onTrackRemove={() => {}}
          onTrackReorder={() => {}}
        />
      </>
    )

    fireEvent.click(screen.getByText('Artist1'))
    const input = screen.getByTestId('playlist-search-input') as HTMLInputElement
    expect(input.value).toBe('Artist1')
    expect(screen.getByText('Alpha Song')).toBeInTheDocument()
    expect(screen.queryByText('Beta Song')).toBeNull()

    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByText('Beta Song')).toBeInTheDocument()
  })
})
