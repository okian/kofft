import React from 'react'
import { X, Play, Trash2, GripVertical, FileAudio } from 'lucide-react'
import { AudioTrack } from '@/types'
import { cn } from '@/utils/cn'
import { formatDuration } from '@/utils/audio'

interface PlaylistPanelProps {
  tracks: AudioTrack[]
  currentTrackIndex: number
  isOpen: boolean
  onClose: () => void
  onTrackSelect: (index: number) => void
  onTrackRemove: (index: number) => void
  onTrackReorder: (fromIndex: number, toIndex: number) => void
}

export function PlaylistPanel({
  tracks,
  currentTrackIndex,
  isOpen: _isOpen,
  onClose,
  onTrackSelect,
  onTrackRemove,
  onTrackReorder,
}: PlaylistPanelProps) {
  const handleDragStart = (event: React.DragEvent, index: number) => {
    event.dataTransfer.setData('text/plain', index.toString())
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  const handleDrop = (event: React.DragEvent, dropIndex: number) => {
    event.preventDefault()
    const dragIndex = parseInt(event.dataTransfer.getData('text/plain'))
    if (dragIndex !== dropIndex) {
      onTrackReorder(dragIndex, dropIndex)
    }
  }

  const totalDuration = tracks.reduce((total, track) => total + track.duration, 0)

  const renderAlbumArt = (track: AudioTrack) => {
    // Use the new artwork system if available
    if (track.artwork && track.artwork.data && track.artwork.data.length > 0) {
      try {
        const artworkData = track.artwork.data
        const mimeType = track.artwork.mimeType || 'image/jpeg'
        
        // Create blob from the Uint8Array
        const blob = new Blob([artworkData], { type: mimeType })
        const url = URL.createObjectURL(blob)
        
        return (
          <div className="relative group">
            <img
              src={url}
              alt="Album Art"
              className="w-10 h-10 object-cover rounded-md flex-shrink-0"
              onLoad={() => {
                // Clean up the URL after the image loads
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}
              onError={(e) => {
                console.warn('Failed to load album art image:', e)
                // Clean up the URL on error
                URL.revokeObjectURL(url)
              }}
            />
            {/* Show artwork source on hover */}
            <div className="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-1 rounded-tl opacity-0 group-hover:opacity-100 transition-opacity">
              {track.artwork.type}
            </div>
          </div>
        )
      } catch (error) {
        console.warn('Failed to create album art URL:', error)
      }
    }
    
    // Fallback to old metadata album art if available
    if (track.metadata.album_art && track.metadata.album_art.length > 0) {
      try {
        const albumArtData = track.metadata.album_art
        const mimeType = track.metadata.album_art_mime || 'image/jpeg'
        
        // Create blob from the Uint8Array
        const blob = new Blob([albumArtData], { type: mimeType })
        const url = URL.createObjectURL(blob)
        
        return (
          <img
            src={url}
            alt="Album Art"
            className="w-10 h-10 object-cover rounded-md flex-shrink-0"
            onLoad={() => {
              // Clean up the URL after the image loads
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}
            onError={(e) => {
              console.warn('Failed to load album art image:', e)
              // Clean up the URL on error
              URL.revokeObjectURL(url)
            }}
          />
        )
      } catch (error) {
        console.warn('Failed to create album art URL:', error)
      }
    }
    
    // Fallback album art placeholder
    return (
      <div className="w-10 h-10 bg-neutral-800 rounded-md flex-shrink-0 flex items-center justify-center">
        <FileAudio size={16} className="text-neutral-500" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" data-testid="playlist-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-neutral-800">
        <h3 className="text-xl font-semibold text-neutral-100">Playlist</h3>
        <button
          onClick={onClose}
          className="icon-btn"
          title="Close playlist panel"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <FileAudio size={48} className="text-neutral-600 mb-4" />
            <h4 className="text-lg font-medium text-neutral-400 mb-2">
              Playlist Empty
            </h4>
            <p className="text-sm text-neutral-500">
              Drag and drop audio files here or use the file picker
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className={cn(
                  'group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200',
                  'hover:bg-neutral-800 hover:shadow-md',
                  'border border-transparent hover:border-neutral-700',
                  currentTrackIndex === index && 'bg-neutral-800 border-neutral-600 shadow-md'
                )}
                onClick={() => onTrackSelect(index)}
              >
                {/* Drag handle */}
                <div className="flex-shrink-0">
                  <GripVertical 
                    size={16} 
                    className="text-neutral-500 group-hover:text-neutral-400 cursor-grab active:cursor-grabbing" 
                  />
                </div>

                {/* Album Art */}
                <div className="flex-shrink-0">
                  {renderAlbumArt(track)}
                </div>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={cn(
                      'text-sm font-medium truncate',
                      currentTrackIndex === index ? 'text-accent-blue' : 'text-neutral-100'
                    )}>
                      {track.metadata.title || track.file.name}
                    </h4>
                    {currentTrackIndex === index && (
                      <div className="w-2 h-2 bg-accent-blue rounded-full animate-pulse-subtle" />
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span className="truncate">
                      {track.metadata.artist || 'Unknown Artist'}
                    </span>
                    <span className="flex-shrink-0 ml-2">
                      {formatDuration(track.duration)}
                    </span>
                  </div>
                  
                  {track.metadata.album && (
                    <p className="text-xs text-neutral-500 truncate mt-1">
                      {track.metadata.album}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTrackSelect(index)
                    }}
                    className={cn(
                      'p-1 rounded transition-colors',
                      'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700'
                    )}
                    title="Play track"
                  >
                    <Play size={14} />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTrackRemove(index)
                    }}
                    className={cn(
                      'p-1 rounded transition-colors',
                      'text-neutral-400 hover:text-red-400 hover:bg-red-400/10'
                    )}
                    title="Remove from playlist"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - Moved to very bottom */}
      {tracks.length > 0 && (
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-neutral-300 font-medium">
                {tracks.length} track{tracks.length !== 1 ? 's' : ''}
              </span>
              <span className="text-neutral-400 text-xs">
                Total duration: {formatDuration(totalDuration)}
              </span>
            </div>
            <div className="text-neutral-400 text-xs">
              {formatDuration(totalDuration)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
