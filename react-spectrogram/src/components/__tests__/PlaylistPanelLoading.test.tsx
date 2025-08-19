import { render, screen } from '@testing-library/react'
import { PlaylistPanel } from '../layout/PlaylistPanel'
import { describe, it, vi } from 'vitest'

vi.mock('@/hooks/useAudioFile', () => ({
  useAudioFile: () => ({ loadAudioFiles: vi.fn() })
}))

describe('PlaylistPanel loading placeholder', () => {
  it('shows spinner for loading tracks', () => {
    const track: any = {
      id: '1',
      file: new File([], 't.mp3'),
      metadata: { title: 't', artist: '', album: '', duration: 0 },
      duration: 0,
      url: '',
      isLoading: true,
    }

    render(
      <PlaylistPanel
        tracks={[track]}
        currentTrackIndex={-1}
        isOpen={true}
        onClose={() => {}}
        onTrackSelect={() => {}}
        onTrackRemove={() => {}}
        onTrackReorder={() => {}}
      />
    )

    expect(screen.getByTestId('track-loading-spinner')).toBeInTheDocument()
  })
})
