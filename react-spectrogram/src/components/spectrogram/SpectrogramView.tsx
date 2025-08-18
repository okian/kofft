import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAudioFile } from '@/hooks/useAudioFile'
import { useMicrophone } from '@/hooks/useMicrophone'
import { SpectrogramCanvas, SpectrogramCanvasRef } from './SpectrogramCanvas'
import { SpectrogramLegend } from './SpectrogramLegend'
import { SpectrogramTooltip } from './SpectrogramTooltip'

export const SpectrogramView: React.FC = () => {
  const canvasRef = useRef<SpectrogramCanvasRef>(null)
  const [tooltipData, setTooltipData] = useState<{
    frequency: number
    time: number
    intensity: number
    x: number
    y: number
  } | null>(null)

  const { isMicrophoneActive, currentTrack, isPlaying, isLive } = useAudioStore()
  const { showLegend, theme } = useSettingsStore()

  // Audio hooks
  const audioFile = useAudioFile()
  const microphone = useMicrophone()

  // Animation frame for real-time updates
  const animationFrameRef = useRef<number | null>(null)

  // Handle mouse movement for tooltip
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Convert pixel coordinates to frequency and time
    const frequency = Math.round((1 - y / rect.height) * 20000) // 0-20kHz
    const time = Math.round((x / rect.width) * 120) // 0-120 seconds (example)
    const intensity = Math.round(Math.random() * 60 - 60) // Mock intensity in dB

    setTooltipData({ frequency, time, intensity, x, y })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTooltipData(null)
  }, [])

  // Real-time spectrogram update loop
  const updateSpectrogram = useCallback(() => {
    if (!canvasRef.current) return

    let frequencyData: Uint8Array | null = null

    // Get frequency data from appropriate source
    if (isMicrophoneActive) {
      frequencyData = microphone.getFrequencyData()
    } else if (isPlaying && currentTrack) {
      frequencyData = audioFile.getFrequencyData()
    }

    // Add frame to spectrogram if we have data
    if (frequencyData) {
      canvasRef.current.addFrame(frequencyData)
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(updateSpectrogram)
  }, [isMicrophoneActive, isPlaying, currentTrack, microphone, audioFile])

  // Start/stop real-time updates
  useEffect(() => {
    if (isMicrophoneActive || (isPlaying && currentTrack)) {
      updateSpectrogram()
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [isMicrophoneActive, isPlaying, currentTrack, updateSpectrogram])

  // Clear spectrogram when switching modes
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.clear()
    }
  }, [isMicrophoneActive, currentTrack])

  // Handle file drops
  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault()
    
    const files = Array.from(event.dataTransfer.files)
    const audioFiles = files.filter(file => file.type.startsWith('audio/'))
    
    if (audioFiles.length > 0) {
      try {
        await audioFile.loadAudioFiles(audioFiles)
      } catch (error) {
        console.error('Failed to load dropped files:', error)
      }
    }
  }, [audioFile])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
  }, [])

  return (
    <div 
      className="relative flex-1 bg-neutral-900 overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      data-testid="spectrogram-view"
    >
      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-red-400">LIVE</span>
          </div>
        </div>
      )}

      {/* Microphone level indicator */}
      {isMicrophoneActive && (
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-xs font-medium text-blue-400">MIC</span>
          </div>
        </div>
      )}

      {/* Spectrogram canvas */}
      <SpectrogramCanvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Legend */}
      {showLegend && (
        <div className="absolute top-4 right-4 z-10">
          <SpectrogramLegend theme={theme} />
        </div>
      )}

      {/* Tooltip */}
      {tooltipData && tooltipData.x !== undefined && tooltipData.y !== undefined && (
        <SpectrogramTooltip
          event={{
            type: 'hover',
            position: { x: tooltipData.x, y: tooltipData.y },
            frequency: tooltipData.frequency,
            time: tooltipData.time,
            intensity: tooltipData.intensity
          }}
        />
      )}

      {/* Drop zone overlay */}
      {!currentTrack && !isLive && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm" data-testid="drop-zone">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 border-2 border-dashed border-neutral-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-8 h-8 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-neutral-400 text-lg font-medium">
              Drop audio files here
            </p>
            <p className="text-neutral-500 text-sm mt-2">
              or click the file button to browse
            </p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {(audioFile.isLoading || microphone.isRequestingPermission) && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80 backdrop-blur-sm z-20" data-testid="loading-indicator">
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin"></div>
            <p className="text-neutral-400">
              {audioFile.isLoading ? 'Loading audio file...' : 'Requesting microphone permission...'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
