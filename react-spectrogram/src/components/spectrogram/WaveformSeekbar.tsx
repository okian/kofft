import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { cn } from '@/utils/cn'

interface WaveformSeekbarProps {
  audioData: Float32Array | null
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  className?: string
  numBars?: number
  barWidth?: number
  barGap?: number
  maxBarHeight?: number
  disabled?: boolean
  bufferedTime?: number
}

export function WaveformSeekbar({
  audioData,
  currentTime,
  duration,
  onSeek,
  className,
  numBars = 300,
  barWidth = 2,
  barGap = 1,
  maxBarHeight = 40,
  disabled = false,
  bufferedTime = 0,
}: WaveformSeekbarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekPosition, setSeekPosition] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const [hoverPosition, setHoverPosition] = useState(0)

  // Generate simplified waveform data
  const waveformData = useMemo(() => {
    if (!audioData || audioData.length === 0) {
      // Generate a simple pattern for visibility
      return Array.from({ length: numBars }, (_, i) => {
        const progress = i / numBars
        return 0.3 + 0.4 * Math.sin(progress * Math.PI * 4) + 0.1 * Math.random()
      })
    }

    // Simple waveform generation without WASM
    const data = new Array(numBars)
    const samplesPerBar = Math.ceil(audioData.length / numBars)
    
    for (let i = 0; i < numBars; i++) {
      const start = i * samplesPerBar
      const end = Math.min(start + samplesPerBar, audioData.length)
      const chunk = audioData.slice(start, end)
      
      if (chunk.length > 0) {
        // Calculate RMS (Root Mean Square) for amplitude
        const sumSquares = chunk.reduce((sum, sample) => sum + sample * sample, 0)
        const rms = Math.sqrt(sumSquares / chunk.length)
        data[i] = Math.min(rms * 3, 1.0) // Scale and clamp
      } else {
        data[i] = 0.1 // Minimum visibility
      }
    }
    
    return data
  }, [audioData, numBars])

  // Calculate positions
  const currentPosition = duration > 0 ? currentTime / duration : 0
  const bufferedPosition = duration > 0 ? bufferedTime / duration : 0

  // Handle seek interactions
  const getPositionFromEvent = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return 0

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const x = clientX - rect.left
    return Math.max(0, Math.min(1, x / rect.width))
  }, [])

  const handleSeekStart = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return
    setIsSeeking(true)
    const position = getPositionFromEvent(event)
    setSeekPosition(position)
  }, [disabled, getPositionFromEvent])

  const handleSeek = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!isSeeking || disabled) return
    const position = getPositionFromEvent(event)
    setSeekPosition(position)
  }, [isSeeking, disabled, getPositionFromEvent])

  const handleSeekEnd = useCallback(() => {
    if (!isSeeking || disabled) return
    setIsSeeking(false)
    const seekTime = seekPosition * duration
    onSeek(seekTime)
  }, [isSeeking, disabled, seekPosition, duration, onSeek])

  // Handle hover
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (disabled) return
    const position = getPositionFromEvent(event)
    setHoverPosition(position)
    setIsHovering(true)
  }, [disabled, getPositionFromEvent])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return

    let newTime = currentTime
    const step = event.shiftKey ? 5 : 1

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        newTime = Math.max(0, currentTime - step)
        break
      case 'ArrowRight':
        event.preventDefault()
        newTime = Math.min(duration, currentTime + step)
        break
      case 'Home':
        event.preventDefault()
        newTime = 0
        break
      case 'End':
        event.preventDefault()
        newTime = duration
        break
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        event.preventDefault()
        const percentage = parseInt(event.key) / 10
        newTime = duration * percentage
        break
      default:
        return
    }

    onSeek(newTime)
  }, [disabled, currentTime, duration, onSeek])

  // Update seek position when current time changes
  useEffect(() => {
    if (!isSeeking) {
      setSeekPosition(currentPosition)
    }
  }, [currentTime, duration, isSeeking, currentPosition])

  // Format time for display
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Calculate total width for layout
  const totalWidth = numBars * (barWidth + barGap) - barGap

  return (
    <div
      ref={containerRef}
      className={cn(
        'waveform-seekbar relative w-full select-none',
        'transition-colors duration-200',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-800/20',
        'border border-neutral-700/50 rounded-lg p-2',
        className
      )}
      style={{ height: maxBarHeight + 20 }}
      onMouseDown={handleSeekStart}
      onMouseMove={handleMouseMove}
      onMouseUp={handleSeekEnd}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleSeekStart}
      onTouchMove={handleSeek}
      onTouchEnd={handleSeekEnd}
      onKeyDown={handleKeyDown}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
      tabIndex={disabled ? -1 : 0}
    >
      {/* Time labels */}
      <div className="absolute top-0 left-0 right-0 flex justify-between text-xs px-2" style={{ color: 'var(--seek-time-label)' }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Waveform bars container */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ top: 16 }} // Below time labels
      >
        <div 
          className="flex items-end gap-0.5 relative"
          style={{ 
            width: totalWidth,
            height: maxBarHeight
          }}
        >
          {/* Waveform bars */}
          {waveformData.map((amplitude, index) => {
            const barPosition = index / (numBars - 1)
            const isPlayed = barPosition <= currentPosition
            const isBuffered = barPosition <= bufferedPosition
            const isHovered = isHovering && Math.abs(barPosition - hoverPosition) < 0.01
            
            // Calculate bar height
            const barHeight = Math.max(amplitude * maxBarHeight, 2)
            
            // Determine colors
            let barColor = 'var(--seek-unplayed)'
            if (disabled) {
              barColor = 'var(--seek-disabled)'
            } else if (isPlayed) {
              barColor = isHovered ? 'var(--seek-hover-played)' : 'var(--seek-played)'
            } else if (isBuffered) {
              barColor = 'var(--seek-buffered)'
            } else if (isHovered) {
              barColor = 'var(--seek-hover-unplayed)'
            }

            return (
              <div
                key={index}
                className="transition-all duration-150 ease-out"
                style={{
                  width: barWidth,
                  height: barHeight,
                  backgroundColor: barColor,
                  borderRadius: barWidth / 2,
                  transform: isHovered ? 'scaleY(1.2)' : 'scaleY(1)',
                }}
              />
            )
          })}

          {/* Playhead line */}
          {!disabled && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-400 pointer-events-none transition-all duration-150"
              style={{
                left: `${currentPosition * 100}%`,
                transform: 'translateX(-50%)',
              }}
            />
          )}

          {/* Hover indicator */}
          {isHovering && !disabled && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-300/50 pointer-events-none"
              style={{
                left: `${hoverPosition * 100}%`,
                transform: 'translateX(-50%)',
              }}
            />
          )}
        </div>
      </div>

      {/* Focus ring for accessibility */}
      <div
        className={cn(
          'absolute inset-0 rounded border-2 border-transparent',
          'focus-within:border-blue-400 focus-within:border-opacity-50',
          'transition-colors duration-200'
        )}
      />
    </div>
  )
}
