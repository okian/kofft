import { X, Music, User, Disc, Calendar, FileAudio } from 'lucide-react'
import { AudioTrack } from '@/types'
import { formatDuration, formatFileSize } from '@/utils/audio'

interface MetadataPanelProps {
  track: AudioTrack | null
  isOpen: boolean
  onClose: () => void
}

export function MetadataPanel({ track, isOpen, onClose }: MetadataPanelProps) {
  if (!isOpen) return null
  
  return (
    <div className="h-full flex flex-col" data-testid="metadata-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-800">
        <h3 className="text-base font-semibold text-neutral-100">Track Info</h3>
        <button
          onClick={onClose}
          className="icon-btn"
          title="Close metadata panel"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {track ? (
          <div className="space-y-4">
                         {/* Album Art */}
            {(track.artwork?.data && track.artwork.data.length > 0) || (track.metadata.album_art && track.metadata.album_art.length > 0) ? (
              <div className="flex justify-center">
                {(() => {
                  try {
                    // Use new artwork system first
                    if (track.artwork?.data && track.artwork.data.length > 0) {
                      const artworkData = track.artwork.data
                      const mimeType = track.artwork.mimeType || 'image/jpeg'
                      
                      const blob = new Blob([artworkData], { type: mimeType })
                      const url = URL.createObjectURL(blob)
                      
                      return (
                        <div className="text-center">
                          <img
                            src={url}
                            alt="Album Art"
                            className="w-32 h-32 object-cover rounded-lg shadow-lg mx-auto"
                            onLoad={() => setTimeout(() => URL.revokeObjectURL(url), 1000)}
                            onError={(e) => {
                              console.warn('Failed to load album art image:', e)
                              URL.revokeObjectURL(url)
                            }}
                          />
                          <div className="mt-2 text-xs text-neutral-400">
                            Source: {track.artwork.type} 
                            {track.artwork.confidence && ` (${Math.round(track.artwork.confidence * 100)}% confidence)`}
                          </div>
                        </div>
                      )
                    }
                    
                    // Fallback to old metadata album art
                    if (track.metadata.album_art && track.metadata.album_art.length > 0) {
                      const albumArtData = track.metadata.album_art
                      const mimeType = track.metadata.album_art_mime || 'image/jpeg'
                      
                      const blob = new Blob([albumArtData], { type: mimeType })
                      const url = URL.createObjectURL(blob)
                      
                      return (
                        <div className="text-center">
                          <img
                            src={url}
                            alt="Album Art"
                            className="w-32 h-32 object-cover rounded-lg shadow-lg mx-auto"
                            onLoad={() => setTimeout(() => URL.revokeObjectURL(url), 1000)}
                            onError={(e) => {
                              console.warn('Failed to load album art image:', e)
                              URL.revokeObjectURL(url)
                            }}
                          />
                          <div className="mt-2 text-xs text-neutral-400">
                            Source: Embedded metadata
                          </div>
                        </div>
                      )
                    }
                    
                    return null
                  } catch (error) {
                    console.warn('Failed to create album art URL:', error)
                    return null
                  }
                })()}
              </div>
            ) : null}

            {/* Track Info */}
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-semibold text-neutral-100 mb-2">
                  {track.metadata.title || track.file.name}
                </h4>
                <p className="text-neutral-400">
                  {track.metadata.artist || 'Unknown Artist'}
                </p>
              </div>

                             {/* Metadata Grid */}
               <div className="grid grid-cols-1 gap-2">
                                  {track.metadata.album && (
                   <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg">
                     <Disc size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-400">Album</p>
                      <p className="text-neutral-100">{track.metadata.album}</p>
                    </div>
                  </div>
                )}

                                 {track.metadata.artist && (
                   <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg">
                     <User size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-400">Artist</p>
                      <p className="text-neutral-100">{track.metadata.artist}</p>
                    </div>
                  </div>
                )}

                                 {track.metadata.year && (
                   <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg">
                     <Calendar size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-400">Year</p>
                      <p className="text-neutral-100">{track.metadata.year}</p>
                    </div>
                  </div>
                )}

                                 {track.metadata.genre && (
                   <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg">
                     <Music size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-400">Genre</p>
                      <p className="text-neutral-100">{track.metadata.genre}</p>
                    </div>
                  </div>
                )}

                                 {track.duration && (
                   <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg">
                     <FileAudio size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-400">Duration</p>
                      <p className="text-neutral-100">{formatDuration(track.duration)}</p>
                    </div>
                  </div>
                )}

                                 {track.file.size && (
                   <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg">
                     <FileAudio size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-400">File Size</p>
                      <p className="text-neutral-100">{formatFileSize(track.file.size)}</p>
                    </div>
                  </div>
                )}

                                 {track.metadata.bitrate && (
                   <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg">
                     <FileAudio size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-400">Bitrate</p>
                      <p className="text-neutral-100">{track.metadata.bitrate} kbps</p>
                    </div>
                  </div>
                )}

                                                  {track.metadata.sample_rate && (
                   <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg">
                     <FileAudio size={18} className="text-neutral-400" />
                     <div>
                       <p className="text-sm text-neutral-400">Sample Rate</p>
                       <p className="text-neutral-100">{track.metadata.sample_rate} Hz</p>
                     </div>
                   </div>
                 )}

                 {track.metadata.bit_depth && (
                   <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg">
                     <FileAudio size={18} className="text-neutral-400" />
                     <div>
                       <p className="text-sm text-neutral-400">Bit Depth</p>
                       <p className="text-neutral-100">{track.metadata.bit_depth} bit</p>
                     </div>
                   </div>
                 )}

                 {track.metadata.channels && (
                   <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg">
                     <FileAudio size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-400">Channels</p>
                      <p className="text-neutral-100">{track.metadata.channels}</p>
                    </div>
                  </div>
                )}

                                 {track.metadata.format && (
                   <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg">
                     <FileAudio size={18} className="text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-400">Format</p>
                      <p className="text-neutral-100">{track.metadata.format}</p>
                    </div>
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
