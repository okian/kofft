import { render, screen, fireEvent } from '@testing-library/react'
import { AudioTrack } from '@/types'
import { vi } from 'vitest'

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
    }
  ]

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
    const options = Array.from(datalist.querySelectorAll('option')).map((o) => o.getAttribute('value'))
    expect(options).toContain('Alpha Song')
    expect(options).toContain('Artist2')

    const input = screen.getByTestId('playlist-search-input')
    fireEvent.change(input, { target: { value: 'Artist2' } })
    expect(screen.getByText('Beta Song')).toBeInTheDocument()
    expect(screen.queryByText('Alpha Song')).toBeNull()

    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByText('Alpha Song')).toBeInTheDocument()
    expect(screen.getByText('Beta Song')).toBeInTheDocument()
  })
})
