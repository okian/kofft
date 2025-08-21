import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import { PlaylistPanel } from '../layout/PlaylistPanel'
import { vi } from 'vitest'

const loadAudioFiles = vi.fn().mockResolvedValue([])

vi.mock('@/hooks/useAudioFile', () => ({
  useAudioFile: () => ({
    loadAudioFiles
  })
}))

vi.mock('@/shared/utils/wasm', () => ({
  extractMetadata: vi.fn()
}))

describe('PlaylistPanel external drop', () => {
  it('loads files dropped onto the panel', async () => {
    const file = new File(['data'], 'track.mp3', { type: 'audio/mpeg' })
    const dt: any = {
      items: [
        {
          kind: 'file',
          getAsFile: () => file,
          webkitGetAsEntry: () => ({ isFile: true, file: (cb: (f: File) => void) => cb(file) })
        }
      ],
      types: ['Files'],
      files: [file]
    }

    render(
      <PlaylistPanel
        tracks={[]}
        currentTrackIndex={-1}
        isOpen={true}
        onClose={() => {}}
        onTrackSelect={() => {}}
        onTrackRemove={() => {}}
        onTrackReorder={() => {}}
      />
    )

    const panel = screen.getByTestId('playlist-panel')
    fireEvent.drop(panel, { dataTransfer: dt })

    await waitFor(() => {
      expect(loadAudioFiles).toHaveBeenCalled()
      const callFiles = (loadAudioFiles as any).mock.calls[0][0]
      expect(callFiles).toHaveLength(1)
      expect(callFiles[0].name).toBe('track.mp3')
    })
  })
})
