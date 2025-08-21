import { render, screen, fireEvent } from '@testing-library/react'
import { AudioTrack } from '@/types'
import { vi } from 'vitest'
import { usePlaylistSearchStore } from '@/shared/stores/playlistSearchStore'

vi.mock('@/utils/wasm', () => ({}), { virtual: true })

vi.mock('@/hooks/useAudioFile', () => ({
  useAudioFile: () => ({
    loadAudioFiles: vi.fn()
  })
}))

import { PlaylistPanel } from '../layout/PlaylistPanel'

describe('PlaylistPanel search', () => {
  const tracks: AudioTrack[] = [
    {
      id: '1',
      file: new File(['test'], 'alpha.mp3', { type: 'audio/mp3' }),
      metadata: {
        title: 'Alpha Song',
        artist: 'Artist1',
        album: 'Album1',
        genre: 'Rock',
        year: 2000
      },
      duration: 180,
      url: 'url1'
    },
    {
      id: '2',
      file: new File(['test'], 'beta.mp3', { type: 'audio/mp3' }),
      metadata: {
        title: 'Beta Song',
        artist: 'Artist2',
        album: 'Album2',
        genre: 'Pop',
        year: 2001
      },
      duration: 200,
      url: 'url2'
    },
    {
      id: '3',
      file: new File(['test'], 'gamma.mp3', { type: 'audio/mp3' }),
      metadata: {
        title: 'Gamma Song',
        artist: 'Artist3',
        album: 'Album3',
        genre: 'Jazz',
        year: 2002
      },
      duration: 210,
      url: 'url3'
    }
  ]

  afterEach(() => {
    usePlaylistSearchStore.setState({ searchQuery: '' })
  })

  it('filters tracks and provides suggestions', () => {
    render(
      <PlaylistPanel
        tracks={tracks}
        currentTrackIndex={-1}
        isOpen={true}
        onClose={() => {}}
        onTrackSelect={() => {}}
        onTrackRemove={() => {}}
        onTrackReorder={() => {}}
      />
    )

    const datalist = screen.getByTestId('playlist-search-suggestions')
    const options = Array.from(datalist.querySelectorAll('option'))
    expect(options).toHaveLength(11)
    const alphaOption = datalist.querySelector('option[value="Alpha Song"]')
    expect(alphaOption?.getAttribute('label')).toBe('🎵 Alpha Song')
    expect(options[options.length - 1].disabled).toBe(true)
    expect(options[options.length - 1].textContent).toContain('more')

    const input = screen.getByTestId('playlist-search-input')
    fireEvent.change(input, { target: { value: 'Art2' } })
    expect(screen.getByText('Beta Song')).toBeInTheDocument()
    expect(screen.queryByText('Alpha Song')).toBeNull()

    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByText('Alpha Song')).toBeInTheDocument()
    expect(screen.getByText('Beta Song')).toBeInTheDocument()
  })
})
