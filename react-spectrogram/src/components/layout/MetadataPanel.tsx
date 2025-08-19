import { X, Music, User, Disc, Calendar, FileAudio } from 'lucide-react'
import { AudioTrack } from '@/types'
import { formatDuration, formatFileSize } from '@/utils/audio'
import { useUIStore } from '@/stores/uiStore'
import { usePlaylistSearchStore } from '@/stores/playlistSearchStore'

// Helper function to format sample rate in kHz
const formatSampleRate = (sampleRate: number): string => {
  return `${(sampleRate / 1000).toFixed(1)} kHz`
}

interface MetadataPanelProps {
  track: AudioTrack | null
  isOpen: boolean
  onClose: () => void
}

export function MetadataPanel({ track, isOpen, onClose }: MetadataPanelProps) {
  if (!isOpen) return null

  const { setPlaylistPanelOpen } = useUIStore()
  const { setSearchQuery } = usePlaylistSearchStore()

  const handleMetadataSearch = (value: string) => {
    setSearchQuery(value)
    setPlaylistPanelOpen(true)
  }

  const renderFallbackAlbumArt = () => (
    <div className="w-full h-48 bg-neutral-800 rounded-lg flex items-center justify-center">
      <FileAudio size={48} className="text-neutral-500" />
    </div>
  )
  
  return (
    <div className="h-full flex flex-col" data-testid="metadata-panel">
      {/* Header */}
      <div className="flex items-center justify-between py-0.5 px-1 border-b border-neutral-800">
        <h3 className="text-sm font-medium text-neutral-100">Track Info</h3>
        <button
          onClick={onClose}
          className="icon-btn"
          title="Close metadata panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-1">
        {track ? (
          <div className="space-y-2">
            {/* Album Art - Much larger with minimal spacing */}
            {(track.artwork?.data && track.artwork.data.length > 0) || (track.metadata.album_art && track.metadata.album_art.length > 0) ? (
              <div className="w-full">
                {(() => {
                  try {
                    // Use new artwork system first
                    if (track.artwork?.data && track.artwork.data.length > 0) {
                      const artworkData = track.artwork.data
                      const mimeType = track.artwork.mimeType || 'image/jpeg'
                      
                      // Validate the data before creating blob
                      if (artworkData.length < 100) {
                        return renderFallbackAlbumArt()
                      }
                      
                      const blob = new Blob([artworkData], { type: mimeType })
                      const url = URL.createObjectURL(blob)
                      
                      return (
                        <img
                          src={url}
                          alt="Album Art"
                          className="w-full h-auto object-cover rounded-lg shadow-lg"
                          onLoad={() => setTimeout(() => URL.revokeObjectURL(url), 1000)}
                          onError={(e) => {
                            URL.revokeObjectURL(url)
                          }}
                        />
                      )
                    }
                    
                    // Fallback to old metadata album art
                    if (track.metadata.album_art && track.metadata.album_art.length > 0) {
                      const albumArtData = track.metadata.album_art
                      const mimeType = track.metadata.album_art_mime || 'image/jpeg'
                      
                      // Validate the data before creating blob
                      if (albumArtData.length < 100) {
                        return renderFallbackAlbumArt()
                      }
                      
                      const blob = new Blob([albumArtData], { type: mimeType })
                      const url = URL.createObjectURL(blob)
                      
                      return (
                        <img
                          src={url}
                          alt="Album Art"
                          className="w-full h-auto object-cover rounded-lg shadow-lg"
                          onLoad={() => setTimeout(() => URL.revokeObjectURL(url), 1000)}
                          onError={(e) => {
                            URL.revokeObjectURL(url)
                          }}
                        />
                      )
                    }
                    
                    return null
                  } catch (error) {
                    return renderFallbackAlbumArt()
                  }
                })()}
              </div>
            ) : null}

            {/* Track Title - Most important */}
            <div className="px-1">
              <h4 className="text-lg font-semibold text-neutral-100 mb-1">
                {track.metadata.title || track.file.name}
              </h4>
            </div>

            {/* Compact Metadata Grid - Reordered by importance */}
            <div className="space-y-1 px-1">
              {/* Artist - Second most important */}
              {track.metadata.artist && (
                <div className="flex items-center gap-2 py-1">
                  <User size={14} className="text-neutral-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-400">Artist</p>
                    <button
                      type="button"
                      onClick={() => handleMetadataSearch(track.metadata.artist as string)}
                      className="text-sm text-neutral-100 truncate bg-transparent p-0 text-left"
                    >
                      {track.metadata.artist}
                    </button>
                  </div>
                </div>
              )}

              {/* Album - Third most important */}
              {track.metadata.album && (
                <div className="flex items-center gap-2 py-1">
                  <Disc size={14} className="text-neutral-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-400">Album</p>
                    <button
                      type="button"
                      onClick={() => handleMetadataSearch(track.metadata.album as string)}
                      className="text-sm text-neutral-100 truncate bg-transparent p-0 text-left"
                    >
                      {track.metadata.album}
                    </button>
                  </div>
                </div>
              )}

              {/* Year - Fourth most important */}
              {track.metadata.year && (
                <div className="flex items-center gap-2 py-1">
                  <Calendar size={14} className="text-neutral-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-400">Year</p>
                    <button
                      type="button"
                      onClick={() => handleMetadataSearch(String(track.metadata.year))}
                      className="text-sm text-neutral-100 truncate bg-transparent p-0 text-left"
                    >
                      {track.metadata.year}
                    </button>
                  </div>
                </div>
              )}

              {/* Genre - Fifth most important */}
              {track.metadata.genre && (
                <div className="flex items-center gap-2 py-1">
                  <Music size={14} className="text-neutral-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-400">Genre</p>
                    <button
                      type="button"
                      onClick={() => handleMetadataSearch(track.metadata.genre as string)}
                      className="text-sm text-neutral-100 truncate bg-transparent p-0 text-left"
                    >
                      {track.metadata.genre}
                    </button>
                  </div>
                </div>
              )}

              {/* Duration - Technical info */}
              {track.duration && (
                <div className="flex items-center gap-2 py-1">
                  <FileAudio size={14} className="text-neutral-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-400">Duration</p>
                    <p className="text-sm text-neutral-100">{formatDuration(track.duration)}</p>
                  </div>
                </div>
              )}

              {/* Technical metadata - Less important, more compact */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-800">
                {track.metadata.bitrate && (
                  <div className="text-xs">
                    <p className="text-neutral-400">Bitrate</p>
                    <p className="text-neutral-100">{track.metadata.bitrate} kbps</p>
                  </div>
                )}

                {track.metadata.sample_rate && (
                  <div className="text-xs">
                    <p className="text-neutral-400">Sample Rate</p>
                    <p className="text-neutral-100">{formatSampleRate(track.metadata.sample_rate)}</p>
                  </div>
                )}

                {track.metadata.bit_depth && (
                  <div className="text-xs">
                    <p className="text-neutral-400">Bit Depth</p>
                    <p className="text-neutral-100">{track.metadata.bit_depth} bit</p>
                  </div>
                )}

                {track.metadata.channels && (
                  <div className="text-xs">
                    <p className="text-neutral-400">Channels</p>
                    <p className="text-neutral-100">{track.metadata.channels}</p>
                  </div>
                )}

                {track.metadata.format && (
                  <div className="text-xs">
                    <p className="text-neutral-400">Format</p>
                    <p className="text-neutral-100">{track.metadata.format.toUpperCase()}</p>
                  </div>
                )}

                {track.file.size && (
                  <div className="text-xs">
                    <p className="text-neutral-400">File Size</p>
                    <p className="text-neutral-100">{formatFileSize(track.file.size)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Music size={48} className="text-neutral-600 mb-4" />
            <h4 className="text-lg font-medium text-neutral-400 mb-2">
              No Track Selected
            </h4>
            <p className="text-sm text-neutral-500">
              Select a track from the playlist to view its metadata
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
