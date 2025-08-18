import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MetadataPanel } from '../layout/MetadataPanel'
import { AudioTrack } from '@/types'

// Mock the utility functions
vi.mock('@/utils/audio', () => ({
  formatDuration: vi.fn((duration: number) => {
    const minutes = Math.floor(duration / 60)
    const seconds = Math.floor(duration % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }),
  formatFileSize: vi.fn((bytes: number) => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  })
}))

describe('MetadataPanel', () => {
  const mockTrack: AudioTrack = {
    id: 'test-track-1',
    file: new File(['test audio data'], 'test-song.mp3', { type: 'audio/mpeg' }),
    metadata: {
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      year: 2023,
      sample_rate: 44100,
      bit_depth: 16,
      bitrate: 320,
      channels: 2,
      duration: 180,
      format: 'audio/mpeg'
    },
    duration: 180,
    url: 'blob:test-url'
  }

  it('renders track information when track is provided', () => {
    render(
      <MetadataPanel 
        track={mockTrack}
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Track Info')).toBeInTheDocument()
    expect(screen.getByText('Test Song')).toBeInTheDocument()
    expect(screen.getAllByText('Test Artist')).toHaveLength(2) // One in header, one in metadata grid
    expect(screen.getByText('Test Album')).toBeInTheDocument()
    expect(screen.getByText('2023')).toBeInTheDocument()
  })

  it('displays technical details including bit depth', () => {
    render(
      <MetadataPanel 
        track={mockTrack}
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    // Check for technical details
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('File Size')).toBeInTheDocument()
    expect(screen.getByText('Sample Rate')).toBeInTheDocument()
    expect(screen.getByText('Bit Depth')).toBeInTheDocument()
    expect(screen.getByText('Bitrate')).toBeInTheDocument()
    expect(screen.getByText('Channels')).toBeInTheDocument()
    expect(screen.getByText('Format')).toBeInTheDocument()

    // Check for the actual values
    expect(screen.getByText('16 bit')).toBeInTheDocument()
    expect(screen.getByText('44100 Hz')).toBeInTheDocument()
    expect(screen.getByText('320 kbps')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('audio/mpeg')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(
      <MetadataPanel 
        track={mockTrack}
        isOpen={false}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByText('Track Info')).not.toBeInTheDocument()
  })

  it('shows placeholder when no track is provided', () => {
    render(
      <MetadataPanel 
        track={null}
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('No Track Selected')).toBeInTheDocument()
    expect(screen.getByText('Select a track from the playlist to view its metadata')).toBeInTheDocument()
  })

  it('handles track without bit depth information', () => {
    const trackWithoutBitDepth: AudioTrack = {
      ...mockTrack,
      metadata: {
        ...mockTrack.metadata,
        bit_depth: undefined
      }
    }

    render(
      <MetadataPanel 
        track={trackWithoutBitDepth}
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    // Bit depth should not be displayed
    expect(screen.queryByText('Bit Depth:')).not.toBeInTheDocument()
    expect(screen.queryByText('16 bit')).not.toBeInTheDocument()

    // Other technical details should still be shown
    expect(screen.getByText('Sample Rate')).toBeInTheDocument()
    expect(screen.getByText('Bitrate')).toBeInTheDocument()
  })

  it('handles different bit depth values', () => {
    const trackWith24Bit: AudioTrack = {
      ...mockTrack,
      metadata: {
        ...mockTrack.metadata,
        bit_depth: 24
      }
    }

    render(
      <MetadataPanel 
        track={trackWith24Bit}
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('24 bit')).toBeInTheDocument()
  })
})
