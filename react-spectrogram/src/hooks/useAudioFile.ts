import { useState, useCallback, useRef } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import { AudioTrack, AudioMetadata, ArtworkSource } from '@/types'
import { extractMetadata } from '@/utils/wasm'
import { extractArtwork } from '@/utils/artwork'
import toast from 'react-hot-toast'

export const useAudioFile = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  
  const { addToPlaylist, setCurrentTrack, setPlaying, setPaused, setStopped, setCurrentTime, setDuration, setVolume, setMuted } = useAudioStore()

  // Initialize audio context
  const initAudioContext = useCallback(async () => {
    if (audioContextRef.current) return audioContextRef.current

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const context = new AudioContextClass()
      
      const analyser = context.createAnalyser()
      const gainNode = context.createGain()
      
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      
      gainNode.connect(analyser)
      analyser.connect(context.destination)
      
      audioContextRef.current = context
      analyserRef.current = analyser
      gainNodeRef.current = gainNode
      
      return context
    } catch (error) {
      console.error('Failed to initialize audio context:', error)
      throw new Error('Audio context initialization failed')
    }
  }, [])

  // Parse audio metadata using WASM if available, fallback to basic extraction
  const parseMetadata = useCallback(async (file: File): Promise<AudioMetadata> => {
    return await extractMetadata(file)
  }, [])

  // Load and process audio file with artwork extraction
  const loadAudioFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)

    console.log('🚀 Starting audio file load process for:', file.name)

    try {
      // Validate file type
      if (!file.type.startsWith('audio/')) {
        throw new Error('Invalid file type. Please select an audio file.')
      }

      console.log('📋 File validation passed, starting metadata extraction...')

      // Parse metadata
      const metadata = await parseMetadata(file)
      
      console.log('✅ Metadata extraction completed')
      console.log('📊 Final metadata summary:', {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        duration: metadata.duration,
        format: metadata.format,
        hasAlbumArt: metadata.album_art ? metadata.album_art.length > 0 : false,
        albumArtSize: metadata.album_art?.length || 0
      })

      // Extract artwork using the multi-step system
      let artwork: ArtworkSource | undefined = undefined
      try {
        console.log('🎨 Starting artwork extraction...')
        const audioData = await file.arrayBuffer()
        const artworkResult = await extractArtwork(metadata, file.name, audioData)
        if (artworkResult.success && artworkResult.artwork) {
          artwork = artworkResult.artwork
          console.log(`🎨 Artwork extraction completed: ${artwork.type} (${artwork.data?.length || 0} bytes)`)
        } else {
          console.log('❌ Artwork extraction failed:', artworkResult.error)
        }
      } catch (artworkError) {
        console.warn('❌ Failed to extract artwork:', artworkError)
        // Continue without artwork
      }

      // Create audio track
      const track: AudioTrack = {
        id: crypto.randomUUID(),
        file,
        metadata,
        duration: metadata.duration || 0,
        url: URL.createObjectURL(file),
        artwork
      }

      console.log('🎵 Created audio track:', {
        id: track.id,
        title: track.metadata.title,
        artist: track.metadata.artist,
        hasArtwork: !!track.artwork,
        artworkType: track.artwork?.type
      })

      // Add to playlist
      addToPlaylist(track)

      // Set as current track if it's the first one
      const { playlist } = useAudioStore.getState()
      if (playlist.length === 1) {
        setCurrentTrack(track)
      }

      toast.success(`Loaded: ${metadata.title || file.name}`)
      console.log('✅ Audio file load process completed successfully')
      return track

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load audio file'
      setError(errorMessage)
      toast.error(errorMessage)
      console.error('❌ Audio file load process failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [addToPlaylist, setCurrentTrack, parseMetadata])

  // Load multiple audio files
  const loadAudioFiles = useCallback(async (files: FileList | File[]) => {
    setIsLoading(true)
    setError(null)

    try {
      const fileArray = Array.from(files)
      const validFiles = fileArray.filter(file => file.type.startsWith('audio/'))

      if (validFiles.length === 0) {
        throw new Error('No valid audio files found')
      }

      const tracks: AudioTrack[] = []

      for (const file of validFiles) {
        try {
          const metadata = await parseMetadata(file)
          
          // Extract artwork for each file
          let artwork: ArtworkSource | undefined = undefined
          try {
            const audioData = await file.arrayBuffer()
            const artworkResult = await extractArtwork(metadata, file.name, audioData)
            if (artworkResult.success && artworkResult.artwork) {
              artwork = artworkResult.artwork
            }
          } catch (artworkError) {
            console.warn(`Failed to extract artwork for ${file.name}:`, artworkError)
          }

          const track: AudioTrack = {
            id: crypto.randomUUID(),
            file,
            metadata,
            duration: metadata.duration || 0,
            url: URL.createObjectURL(file),
            artwork
          }
          tracks.push(track)
        } catch (error) {
          console.warn(`Failed to load ${file.name}:`, error)
        }
      }

      // Add all tracks to playlist
      tracks.forEach(track => addToPlaylist(track))

      // Set first track as current if no current track
      const { currentTrack } = useAudioStore.getState()
      if (!currentTrack && tracks.length > 0) {
        setCurrentTrack(tracks[0])
      }

      toast.success(`Loaded ${tracks.length} audio file${tracks.length > 1 ? 's' : ''}`)
      return tracks

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load audio files'
      setError(errorMessage)
      toast.error(errorMessage)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [addToPlaylist, setCurrentTrack, parseMetadata])

  // Play audio track
  const playTrack = useCallback(async (track: AudioTrack) => {
    try {
      const context = await initAudioContext()
      
      // Resume context if suspended
      if (context.state === 'suspended') {
        await context.resume()
      }

      // Stop current playback
      if (sourceRef.current) {
        sourceRef.current.stop()
        sourceRef.current = null
      }

      // Load audio buffer
      const arrayBuffer = await track.file.arrayBuffer()
      const audioBuffer = await context.decodeAudioData(arrayBuffer)

      // Create source
      const source = context.createBufferSource()
      source.buffer = audioBuffer
      source.connect(gainNodeRef.current!)

      // Set up time tracking
      let startTime = context.currentTime
      let pausedTime = 0
      let isPaused = false

      source.onended = () => {
        setPlaying(false)
        setStopped(true)
        setCurrentTime(0)
      }

      // Start playback
      source.start(0)
      sourceRef.current = source
      startTime = context.currentTime
      setPlaying(true)
      setPaused(false)
      setStopped(false)
      setDuration(audioBuffer.duration)

      // Time update loop
      const updateTime = () => {
        if (!isPaused && sourceRef.current) {
          const currentTime = context.currentTime - startTime + pausedTime
          setCurrentTime(currentTime)
          
          if (currentTime < audioBuffer.duration) {
            requestAnimationFrame(updateTime)
          }
        }
      }
      updateTime()

      // Store pause/resume functions
      const pause = () => {
        if (sourceRef.current && !isPaused) {
          sourceRef.current.stop()
          pausedTime = context.currentTime - startTime
          isPaused = true
          setPaused(true)
          setPlaying(false)
        }
      }

      const resume = () => {
        if (isPaused) {
          playTrack(track) // Restart with current paused time
        }
      }

      // Store in track for external control
      ;(track as any).pause = pause
      ;(track as any).resume = resume

    } catch (error) {
      console.error('Failed to play track:', error)
      toast.error('Failed to play audio track')
      throw error
    }
  }, [initAudioContext, setPlaying, setPaused, setStopped, setCurrentTime, setDuration])

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop()
      sourceRef.current = null
    }
    setPlaying(false)
    setPaused(false)
    setStopped(true)
    setCurrentTime(0)
  }, [setPlaying, setPaused, setStopped, setCurrentTime])

  // Pause playback
  const pausePlayback = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop()
      sourceRef.current = null
    }
    setPlaying(false)
    setPaused(true)
  }, [setPlaying, setPaused])

  // Resume playback
  const resumePlayback = useCallback(() => {
    const { currentTrack } = useAudioStore.getState()
    if (currentTrack) {
      playTrack(currentTrack)
    }
  }, [playTrack])

  // Seek to time
  const seekTo = useCallback((time: number) => {
    const { currentTrack } = useAudioStore.getState()
    if (currentTrack && time >= 0) {
      setCurrentTime(time)
      // Note: Actual seeking would require recreating the audio source
      // This is a simplified implementation
    }
  }, [setCurrentTime])

  // Set volume
  const setAudioVolume = useCallback((volume: number) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume
    }
    setVolume(volume)
  }, [setVolume])

  // Toggle mute
  const toggleMute = useCallback(() => {
    const { isMuted } = useAudioStore.getState()
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? useAudioStore.getState().volume : 0
    }
    setMuted(!isMuted)
  }, [setMuted])

  // Get frequency data for spectrogram
  const getFrequencyData = useCallback(() => {
    if (!analyserRef.current) return null
    
    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    return dataArray
  }, [])

  // Get time domain data
  const getTimeData = useCallback(() => {
    if (!analyserRef.current) return null
    
    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteTimeDomainData(dataArray)
    
    return dataArray
  }, [])

  // Cleanup
  const cleanup = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop()
      sourceRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    analyserRef.current = null
    gainNodeRef.current = null
  }, [])

  return {
    isLoading,
    error,
    loadAudioFile,
    loadAudioFiles,
    playTrack,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    seekTo,
    setAudioVolume,
    toggleMute,
    getFrequencyData,
    getTimeData,
    cleanup,
    initAudioContext
  }
}
