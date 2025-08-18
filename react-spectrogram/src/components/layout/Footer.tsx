import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import { useAudioFile } from '@/hooks/useAudioFile'
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Square,
  Volume2,
  VolumeX,
  Heart,
  Shuffle,
  Repeat,
  FileAudio
} from 'lucide-react'
import { cn } from '@/utils/cn'

export const Footer: React.FC = () => {
  const seekBarRef = useRef<HTMLDivElement>(null)
  const volumeSliderRef = useRef<HTMLInputElement>(null)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekPosition, setSeekPosition] = useState(0)
  
  const { 
    isPlaying, 
    isStopped, 
    currentTime, 
    duration, 
    volume, 
    isMuted,
    currentTrack,
    playlist,
    currentTrackIndex
  } = useAudioStore()
  
  const audioFile = useAudioFile()

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle seek bar interaction
  const handleSeekStart = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    setIsSeeking(true)
    handleSeek(event)
  }, [])

  const handleSeek = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!seekBarRef.current || !isSeeking) return

    const rect = seekBarRef.current.getBoundingClientRect()
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    
    setSeekPosition(percentage)
  }, [isSeeking])

  const handleSeekEnd = useCallback(() => {
    if (!isSeeking) return
    
    setIsSeeking(false)
    const newTime = seekPosition * duration
    audioFile.seekTo(newTime)
  }, [isSeeking, seekPosition, duration, audioFile])

  // Update seek position based on current time
  useEffect(() => {
    if (!isSeeking && duration > 0) {
      setSeekPosition(currentTime / duration)
    }
  }, [currentTime, duration, isSeeking])

  // Handle volume change
  const handleVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value) / 100
    audioFile.setAudioVolume(newVolume)
  }, [audioFile])

  // Toggle mute
  const toggleMute = useCallback(() => {
    audioFile.toggleMute()
  }, [audioFile])

  // Transport controls
  const togglePlayPause = useCallback(() => {
    if (isStopped) {
      if (currentTrack) {
        audioFile.playTrack(currentTrack)
      }
    } else if (isPlaying) {
      audioFile.pausePlayback()
    } else {
      audioFile.resumePlayback()
    }
  }, [isStopped, isPlaying, currentTrack, audioFile])

  const stopPlayback = useCallback(() => {
    audioFile.stopPlayback()
  }, [audioFile])

  const previousTrack = useCallback(() => {
    if (playlist.length === 0) return
    
    const prevIndex = currentTrackIndex <= 0 ? playlist.length - 1 : currentTrackIndex - 1
    const prevTrack = playlist[prevIndex]
    if (prevTrack) {
      audioFile.playTrack(prevTrack)
    }
  }, [playlist, currentTrackIndex, audioFile])

  const nextTrack = useCallback(() => {
    if (playlist.length === 0) return
    
    const nextIndex = (currentTrackIndex + 1) % playlist.length
    const nextTrack = playlist[nextIndex]
    if (nextTrack) {
      audioFile.playTrack(nextTrack)
    }
  }, [playlist, currentTrackIndex, audioFile])

  // Render album art for current track
  const renderCurrentTrackAlbumArt = () => {
    // Use the new artwork system if available
    if (currentTrack?.artwork && currentTrack.artwork.data && currentTrack.artwork.data.length > 0) {
      try {
        const artworkData = currentTrack.artwork.data
        const mimeType = currentTrack.artwork.mimeType || 'image/jpeg'
        
        // Create blob from the Uint8Array
        const blob = new Blob([artworkData], { type: mimeType })
        const url = URL.createObjectURL(blob)
        
        return (
          <div className="relative group">
            <img
              src={url}
              alt="Album Art"
              className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
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
              {currentTrack.artwork.type}
            </div>
          </div>
        )
      } catch (error) {
        console.warn('Failed to create album art URL:', error)
      }
    }
    
    // Fallback to old metadata album art if available
    if (currentTrack?.metadata.album_art && currentTrack.metadata.album_art.length > 0) {
      try {
        const albumArtData = currentTrack.metadata.album_art
        const mimeType = currentTrack.metadata.album_art_mime || 'image/jpeg'
        
        // Create blob from the Uint8Array
        const blob = new Blob([albumArtData], { type: mimeType })
        const url = URL.createObjectURL(blob)
        
        return (
          <img
            src={url}
            alt="Album Art"
            className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
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
      <div className="w-12 h-12 bg-neutral-800 rounded-lg flex-shrink-0 flex items-center justify-center">
        <FileAudio size={20} className="text-neutral-500" />
      </div>
    )
  }

  return (
    <footer 
      className="footer-controls"
      data-testid="footer"
    >
      {/* Seek Bar - Top of footer */}
      <div
        ref={seekBarRef}
        className={cn(
          'absolute top-0 left-0 right-0 h-3 bg-neutral-800',
          'cursor-pointer transition-colors duration-200',
          'hover:bg-neutral-700'
        )}
        onMouseDown={handleSeekStart}
        onMouseMove={handleSeek}
        onMouseUp={handleSeekEnd}
        onMouseLeave={handleSeekEnd}
        onTouchStart={handleSeekStart}
        onTouchMove={handleSeek}
        onTouchEnd={handleSeekEnd}
        data-testid="progress-bar"
      >
        {/* Progress bar */}
        <div
          className="h-full bg-blue-500 transition-all duration-200"
          style={{ width: `${seekPosition * 100}%` }}
          data-testid="progress-fill"
        />
        
        {/* Seek handle */}
        <div
          className={cn(
            'absolute top-1/2 w-4 h-4 bg-blue-400 rounded-full',
            'transform -translate-y-1/2 -translate-x-1/2',
            'transition-all duration-200',
            'hover:scale-125 hover:bg-blue-300'
          )}
          style={{ left: `${seekPosition * 100}%` }}
        />
      </div>

      {/* Control Section - Below seek bar */}
      <div className="flex items-center justify-between w-full h-full pt-3 px-6">
        {/* Left side - Current track info */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {currentTrack && (
            <>
              {/* Album art */}
              {renderCurrentTrackAlbumArt()}
              
              {/* Track info */}
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium text-neutral-100 truncate">
                  {currentTrack.metadata.title || currentTrack.file.name}
                </h4>
                <p className="text-xs text-neutral-400 truncate">
                  {currentTrack.metadata.artist || 'Unknown Artist'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Center - Transport controls */}
        <div className="flex items-center gap-6 flex-shrink-0">
          {/* Previous track */}
          <button
            onClick={previousTrack}
            disabled={playlist.length === 0}
            className={cn(
              'p-3 rounded-lg transition-colors duration-200',
              'hover:bg-neutral-800 active:bg-neutral-700',
              'text-neutral-400 hover:text-neutral-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Previous track (←)"
            data-testid="previous-track-button"
          >
            <SkipBack size={24} />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlayPause}
            disabled={!currentTrack && !isPlaying}
            className={cn(
              'p-4 rounded-full transition-colors duration-200',
              'hover:bg-neutral-800 active:bg-neutral-700',
              'text-neutral-400 hover:text-neutral-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Play/Pause (Space)"
            data-testid="play-pause-button"
          >
            {isPlaying ? <Pause size={28} /> : <Play size={28} />}
          </button>

          {/* Stop */}
          <button
            onClick={stopPlayback}
            disabled={isStopped}
            className={cn(
              'p-3 rounded-lg transition-colors duration-200',
              'hover:bg-neutral-800 active:bg-neutral-700',
              'text-neutral-400 hover:text-neutral-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Stop"
            data-testid="stop-button"
          >
            <Square size={24} />
          </button>

          {/* Next track */}
          <button
            onClick={nextTrack}
            disabled={playlist.length === 0}
            className={cn(
              'p-3 rounded-lg transition-colors duration-200',
              'hover:bg-neutral-800 active:bg-neutral-700',
              'text-neutral-400 hover:text-neutral-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Next track (→)"
            data-testid="next-track-button"
          >
            <SkipForward size={24} />
          </button>
        </div>

        {/* Right side - Additional controls and volume */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Time display */}
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <span data-testid="current-time">{formatTime(currentTime)}</span>
            <span>/</span>
            <span data-testid="total-duration">{formatTime(duration)}</span>
          </div>

          {/* Additional controls */}
          <div className="flex items-center gap-2">
            <button
              className={cn(
                'p-2 rounded-lg transition-colors duration-200',
                'hover:bg-neutral-800 active:bg-neutral-700',
                'text-neutral-400 hover:text-neutral-200'
              )}
              title="Like"
            >
              <Heart size={20} />
            </button>
            
            <button
              className={cn(
                'p-2 rounded-lg transition-colors duration-200',
                'hover:bg-neutral-800 active:bg-neutral-700',
                'text-neutral-400 hover:text-neutral-200'
              )}
              title="Shuffle"
            >
              <Shuffle size={20} />
            </button>
            
            <button
              className={cn(
                'p-2 rounded-lg transition-colors duration-200',
                'hover:bg-neutral-800 active:bg-neutral-700',
                'text-neutral-400 hover:text-neutral-200'
              )}
              title="Repeat"
            >
              <Repeat size={20} />
            </button>
          </div>

          {/* Volume control */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className={cn(
                'p-2 rounded-lg transition-colors duration-200',
                'hover:bg-neutral-800 active:bg-neutral-700',
                'text-neutral-400 hover:text-neutral-200'
              )}
              title="Mute/Unmute"
              data-testid="mute-button"
            >
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            <div className="w-24">
              <input
                ref={volumeSliderRef}
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume * 100}
                onChange={handleVolumeChange}
                className={cn(
                  'w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer',
                  'slider-thumb:appearance-none slider-thumb:w-4 slider-thumb:h-4',
                  'slider-thumb:bg-neutral-300 slider-thumb:rounded-full',
                  'slider-thumb:cursor-pointer slider-thumb:border-0',
                  'hover:slider-thumb:bg-neutral-200'
                )}
                title="Volume"
                data-testid="volume-slider"
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
