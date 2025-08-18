import React, { useState, useRef, useCallback } from 'react'
import { X, Play, Trash2, FileAudio, Pause } from 'lucide-react'
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

interface CircularProgressControlProps {
  track: AudioTrack
  size?: number
  progress?: number
  buffered?: number
  isPlaying?: boolean
  onPlayPause?: () => void
  onSeek?: (progress: number) => void
}

function CircularProgressControl({ 
  track, 
  size = 64, 
  progress = 0, 
  buffered = 0, 
  isPlaying = false, 
  onPlayPause,
  onSeek 
}: CircularProgressControlProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Calculate dimensions
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  
  // Calculate stroke dasharray for progress
  const progressDasharray = `${progress * circumference} ${circumference}`
  const bufferedDasharray = `${buffered * circumference} ${circumference}`
  
  // Handle play/pause click
  const handlePlayPause = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onPlayPause?.()
  }, [onPlayPause])
  
  // Calculate progress from mouse position
  const getProgressFromMouse = useCallback((clientX: number, clientY: number): number => {
    if (!containerRef.current) return 0
    
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    // Calculate angle from center
    const deltaX = clientX - centerX
    const deltaY = clientY - centerY
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI)
    
    // Convert to 0-1 progress (starting from top, clockwise)
    let progress = (angle + 90) / 360
    if (progress < 0) progress += 1
    
    return Math.max(0, Math.min(1, progress))
  }, [])
  
  // Handle ring click for seeking
  const handleRingClick = useCallback((e: React.MouseEvent) => {
    if (isScrubbing) return
    
    const newProgress = getProgressFromMouse(e.clientX, e.clientY)
    onSeek?.(newProgress)
  }, [isScrubbing, getProgressFromMouse, onSeek])
  
  // Handle mouse down for scrubbing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsScrubbing(true)
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isScrubbing) return
      
      const newProgress = getProgressFromMouse(moveEvent.clientX, moveEvent.clientY)
      onSeek?.(newProgress)
    }
    
    const handleMouseUp = () => {
      setIsScrubbing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [isScrubbing, getProgressFromMouse, onSeek])
  
  // Handle keyboard controls
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault()
        onPlayPause?.()
        break
      case 'ArrowLeft':
        e.preventDefault()
        const seekBack = e.shiftKey ? 10 : 5
        const newProgressBack = Math.max(0, progress - seekBack / track.duration)
        onSeek?.(newProgressBack)
        break
      case 'ArrowRight':
        e.preventDefault()
        const seekForward = e.shiftKey ? 10 : 5
        const newProgressForward = Math.min(1, progress + seekForward / track.duration)
        onSeek?.(newProgressForward)
        break
    }
  }, [progress, track.duration, onPlayPause, onSeek])

  return (
    <div 
      ref={containerRef}
      className="relative flex-shrink-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Album Art Background */}
      <div className="relative">
        {(() => {
          try {
            if (track.artwork && track.artwork.data && track.artwork.data.length > 0) {
              const artworkData = track.artwork.data
              const mimeType = track.artwork.mimeType || 'image/jpeg'
              
              const blob = new Blob([artworkData], { type: mimeType })
              const url = URL.createObjectURL(blob)
              
              return (
                <img
                  src={url}
                  alt="Album Art"
                  className="w-16 h-16 object-cover rounded-md transition-transform hover:scale-105"
                  onLoad={() => setTimeout(() => URL.revokeObjectURL(url), 1000)}
                  onError={(e) => {
                    URL.revokeObjectURL(url)
                  }}
                />
              )
            }
            
            if (track.metadata.album_art && track.metadata.album_art.length > 0) {
              const albumArtData = track.metadata.album_art
              const mimeType = track.metadata.album_art_mime || 'image/jpeg'
              
              const blob = new Blob([albumArtData], { type: mimeType })
              const url = URL.createObjectURL(blob)
              
              return (
                <img
                  src={url}
                  alt="Album Art"
                  className="w-16 h-16 object-cover rounded-md transition-transform hover:scale-105"
                  onLoad={() => setTimeout(() => URL.revokeObjectURL(url), 1000)}
                  onError={(e) => {
                    URL.revokeObjectURL(url)
                  }}
                />
              )
            }
            
            return (
              <div className="w-16 h-16 bg-neutral-800 rounded-md flex items-center justify-center">
                <FileAudio size={20} className="text-neutral-500" />
              </div>
            )
          } catch (error) {
            return (
              <div className="w-16 h-16 bg-neutral-800 rounded-md flex items-center justify-center">
                <FileAudio size={20} className="text-neutral-500" />
              </div>
            )
          }
        })()}
      </div>

      {/* Progress Ring Overlay */}
      <div className="absolute inset-0">
        <svg
          width={size}
          height={size}
          className="absolute inset-0"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#374151"
            strokeWidth={strokeWidth}
            opacity={0.3}
          />
          
          {/* Buffered progress */}
          {buffered > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#6b7280"
              strokeWidth={strokeWidth}
              strokeDasharray={bufferedDasharray}
              opacity={0.6}
            />
          )}
          
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={strokeWidth}
            strokeDasharray={progressDasharray}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
        </svg>
        
        {/* Clickable ring area for seeking */}
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={handleRingClick}
          onMouseDown={handleMouseDown}
          style={{ transform: 'rotate(-90deg)' }}
        />
      </div>
      
      {/* Play/Pause Button */}
      <button
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded-full",
          "transition-all duration-300 ease-out",
          "bg-black/60 backdrop-blur-sm",
          isHovered && "bg-black/80 scale-105",
          isScrubbing && "scale-110"
        )}
        onClick={handlePlayPause}
        onKeyDown={handleKeyDown}
        role="button"
        aria-pressed={isPlaying}
        aria-label={`${isPlaying ? 'Pause' : 'Play'} ${track.metadata.title || track.file.name}`}
        tabIndex={0}
      >
        {isPlaying ? (
          <Pause 
            size={16} 
            className="text-white fill-white transition-transform duration-200"
          />
        ) : (
          <Play 
            size={16} 
            className="text-white fill-white transition-transform duration-200 ml-0.5"
          />
        )}
      </button>
    </div>
  )
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
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const trackRefs = useRef<(HTMLDivElement | null)[]>([])

  const handleDragStart = (event: React.DragEvent, index: number) => {
    setDragIndex(index)
    event.dataTransfer.setData('text/plain', index.toString())
    event.dataTransfer.effectAllowed = 'move'
    
    // Create a custom drag image
    const dragElement = event.currentTarget as HTMLElement
    const rect = dragElement.getBoundingClientRect()
    const dragImage = dragElement.cloneNode(true) as HTMLElement
    dragImage.style.width = `${rect.width}px`
    dragImage.style.opacity = '0.8'
    dragImage.style.transform = 'rotate(5deg)'
    dragImage.style.pointerEvents = 'none'
    document.body.appendChild(dragImage)
    
    event.dataTransfer.setDragImage(dragImage, rect.width / 2, rect.height / 2)
    
    // Remove the drag image after a short delay
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage)
      }
    }, 100)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDropIndex(null)
  }

  const handleDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    
    if (dragIndex !== null && dragIndex !== index) {
      setDropIndex(index)
    }
  }

  const handleDrop = (event: React.DragEvent, dropIndex: number) => {
    event.preventDefault()
    const dragIndex = parseInt(event.dataTransfer.getData('text/plain'))
    if (dragIndex !== dropIndex) {
      onTrackReorder(dragIndex, dropIndex)
    }
    setDragIndex(null)
    setDropIndex(null)
  }

  const totalDuration = tracks.reduce((total, track) => total + track.duration, 0)

  const renderAlbumArt = (track: AudioTrack, index: number) => {
    const isCurrentTrack = currentTrackIndex === index
    
    if (isCurrentTrack) {
      // Use the circular progress control for current track
      return (
        <CircularProgressControl
          track={track}
          size={64}
          progress={0.3} // This should come from actual playback state
          buffered={0.5} // This should come from actual buffer state
          isPlaying={false} // This should come from actual play state
          onPlayPause={() => onTrackSelect(index)}
          onSeek={(progress) => {
            // Handle seeking for current track
            // Seek to progress
          }}
        />
      )
    }
    
    // Regular album art for non-current tracks
    // Use the new artwork system if available
    
    
    if (track.artwork && track.artwork.data && track.artwork.data.length > 0) {
      try {
        const artworkData = track.artwork.data
        const mimeType = track.artwork.mimeType || 'image/jpeg'
        
        // Validate the data before creating blob
        if (artworkData.length < 100) {
          return renderFallbackAlbumArt(index)
        }
        
        // Create blob from the Uint8Array
        // Ensure we have a Uint8Array
        const dataArray = artworkData instanceof Uint8Array ? artworkData : new Uint8Array(artworkData)
        const blob = new Blob([dataArray], { type: mimeType })
        const url = URL.createObjectURL(blob)
        
        return (
          <div className="relative flex-shrink-0">
            <img
              src={url}
              alt="Album Art"
              className="w-16 h-16 object-cover rounded-md cursor-pointer transition-transform hover:scale-105"
              onLoad={() => {
                // Clean up the URL after the image loads
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}
              onError={(e) => {
                // Clean up the URL on error
                URL.revokeObjectURL(url)
              }}
              onClick={() => onTrackSelect(index)}
            />
          </div>
        )
      } catch (error) {
        return renderFallbackAlbumArt(index)
      }
    }
    
    // Fallback to old metadata album art if available
    if (track.metadata.album_art && track.metadata.album_art.length > 0) {
      try {
        const albumArtData = track.metadata.album_art
        const mimeType = track.metadata.album_art_mime || 'image/jpeg'
        
        // Validate the data before creating blob
        if (albumArtData.length < 100) {
          return renderFallbackAlbumArt(index)
        }
        
        // Create blob from the Uint8Array
        const blob = new Blob([albumArtData], { type: mimeType })
        const url = URL.createObjectURL(blob)
        
        return (
          <div className="relative flex-shrink-0">
            <img
              src={url}
              alt="Album Art"
              className="w-16 h-16 object-cover rounded-md cursor-pointer transition-transform hover:scale-105"
              onLoad={() => {
                // Clean up the URL after the image loads
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}
              onError={(e) => {
                // Clean up the URL on error
                URL.revokeObjectURL(url)
              }}
              onClick={() => onTrackSelect(index)}
            />
          </div>
        )
      } catch (error) {
        return renderFallbackAlbumArt(index)
      }
    }
    
    // Fallback album art placeholder
    return renderFallbackAlbumArt(index)
  }

    const renderFallbackAlbumArt = (index: number) => (
    <div 
      className="w-16 h-16 bg-neutral-800 rounded-md flex-shrink-0 flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
      onClick={() => onTrackSelect(index)}
    >
      <FileAudio size={20} className="text-neutral-500" />
    </div>
  )

  return (
    <div className="h-full flex flex-col" data-testid="playlist-panel">
      {/* Header - More compact */}
      <div className="flex items-center justify-between py-0.5 px-1 border-b border-neutral-800">
        <h3 className="text-sm font-medium text-neutral-100">Playlist</h3>
        <button
          onClick={onClose}
          className="icon-btn"
          title="Close playlist panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content - Reduced padding */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <FileAudio size={48} className="text-neutral-600 mb-4" />
            <h4 className="text-lg font-medium text-neutral-400 mb-2">
              Playlist Empty
            </h4>
            <p className="text-sm text-neutral-500">
              Drag and drop audio files here or use the file picker
            </p>
          </div>
        ) : (
          <div className="p-1 space-y-1">
            {tracks.map((track, index) => {
              const isDragging = dragIndex === index
              const isDropTarget = dropIndex === index
              
              return (
                <div
                  key={track.id}
                  ref={(el) => (trackRefs.current[index] = el)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  className={cn(
                    'group flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all duration-300 ease-out',
                    'hover:bg-neutral-800 hover:shadow-sm',
                    'border border-transparent hover:border-neutral-700',
                    currentTrackIndex === index && 'bg-neutral-800 border-neutral-600 shadow-sm',
                    isDragging && 'opacity-50 scale-95 rotate-1 z-50',
                    isDropTarget && 'bg-neutral-700/30'
                  )}
                  onClick={() => onTrackSelect(index)}
                >
                  {/* Album Art - Bigger and clickable */}
                  {renderAlbumArt(track, index)}

                  {/* Track info - More space now */}
                  <div className="flex-1 min-w-0">
                    {/* Title - Most important */}
                    <div className="mb-1">
                      <h4 className={cn(
                        'text-sm font-medium truncate',
                        currentTrackIndex === index ? 'text-accent-blue' : 'text-neutral-100'
                      )}>
                        {track.metadata.title || track.file.name}
                      </h4>
                    </div>
                    
                    {/* Artist and Duration - Second most important */}
                    <div className="flex items-center justify-between text-xs text-neutral-400 mb-0.5">
                      <span className="truncate">
                        {track.metadata.artist || 'Unknown Artist'}
                      </span>
                      <span className="flex-shrink-0 ml-2 text-neutral-500">
                        {formatDuration(track.duration)}
                      </span>
                    </div>
                    
                    {/* Album - Third most important, only if available */}
                    {track.metadata.album && (
                      <p className="text-xs text-neutral-500 truncate">
                        {track.metadata.album}
                      </p>
                    )}
                  </div>

                  {/* Actions - Only visible on hover, no space when hidden */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onTrackRemove(index)
                      }}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        'text-neutral-400 hover:text-red-400 hover:bg-red-400/10'
                      )}
                      title="Remove from playlist"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer - More compact */}
      {tracks.length > 0 && (
        <div className="p-2 border-t border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-neutral-300 font-medium">
                {tracks.length} track{tracks.length !== 1 ? 's' : ''}
              </span>
              <span className="text-neutral-400">
                {formatDuration(totalDuration)}
              </span>
            </div>
            <div className="text-neutral-400">
              {formatDuration(totalDuration)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
