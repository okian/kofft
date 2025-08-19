import { useState, useCallback, useEffect, useRef } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import { audioPlayer, type AudioPlayerState } from '@/utils/audioPlayer'
import { AudioTrack, AudioMetadata, ArtworkSource } from '@/types'
import { extractMetadata, generateAmplitudeEnvelope } from '@/utils/wasm'
import { extractArtwork } from '@/utils/artwork'
import { conditionalToast } from '@/utils/toast'

// Utility to compute SHA-256 hash for a file buffer
const hashArrayBuffer = async (buffer: ArrayBuffer): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Utility to convert Uint8Array to base64
const uint8ToBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  bytes.forEach(b => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

// Utility to convert base64 to Uint8Array
const base64ToUint8 = (base64: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Utility to clean up localStorage when it's getting full
const cleanupLocalStorage = () => {
  try {
    const keys = Object.keys(localStorage)
    const audioKeys = keys.filter(key => key.startsWith('audio-metadata-'))
    
    if (audioKeys.length > 20) {
      // If we have more than 20 cached audio files, remove the oldest ones
      const sortedKeys = audioKeys.sort((a, b) => {
        try {
          const aData = localStorage.getItem(a)
          const bData = localStorage.getItem(b)
          if (!aData || !bData) return 0
          
          const aTime = JSON.parse(aData).timestamp || 0
          const bTime = JSON.parse(bData).timestamp || 0
          return aTime - bTime
        } catch {
          return 0
        }
      })
      
      // Remove the oldest 5 entries
      sortedKeys.slice(0, 5).forEach(key => {
        localStorage.removeItem(key)
      })
    }
  } catch (e) {
    console.warn('Failed to cleanup localStorage:', e)
  }
}

export const useAudioFile = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const {
    setPlaying,
    setPaused,
    setStopped,
    setCurrentTime,
    setDuration,
    setVolume,
    setMuted,
    setCurrentTrack,
    addToPlaylist
  } = useAudioStore()

  // Subscribe to audio player state changes
  useEffect(() => {
    const unsubscribe = audioPlayer.subscribe((state: AudioPlayerState) => {
      setPlaying(state.isPlaying)
      setPaused(state.isPaused)
      setStopped(state.isStopped)
      setCurrentTime(state.currentTime)
      setDuration(state.duration)
      setVolume(state.volume)
      setMuted(state.isMuted)
    })

    unsubscribeRef.current = unsubscribe

    return () => {
      unsubscribe()
    }
  }, [setPlaying, setPaused, setStopped, setCurrentTime, setDuration, setVolume, setMuted])

  // Parse metadata using WASM utility
  const parseMetadata = useCallback(async (file: File): Promise<AudioMetadata> => {
    try {
      return await extractMetadata(file)
    } catch (error) {
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        format: file.type || 'unknown'
      }
    }
  }, [])

  // Generate amplitude envelope using WASM utility
  const generateAmplitudeEnvelopeData = useCallback(async (
    file: File,
    metadata: AudioMetadata,
    arrayBuffer?: ArrayBuffer
  ): Promise<Float32Array> => {
    try {
      const sampleRate = metadata.sample_rate || 44100

      // Use the shared audio context to decode audio data
      const context = await audioPlayer.initAudioContext()
      const buffer = arrayBuffer ?? (await file.arrayBuffer())
      const audioBuffer = await context.decodeAudioData(buffer)

      // Get first channel data
      const channelData = audioBuffer.getChannelData(0)
      const audioData = new Float32Array(channelData.length)
      audioData.set(channelData)

      // Generate envelope
      const envelope = await generateAmplitudeEnvelope(audioData, sampleRate, 1000, 20, 3)

      return envelope
    } catch (error) {
      // Return empty array as fallback
      return new Float32Array(0)
    }
  }, [])

  // Validate audio file
  const validateAudioFile = useCallback((file: File): boolean => {
    const validTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/flac',
      'audio/x-flac',
      'audio/ogg',
      'audio/oga',
      'audio/m4a',
      'audio/x-m4a',
      'audio/aac',
      'audio/webm',
      'audio/x-webm'
    ]

    return validTypes.includes(file.type) || !!file.name.match(/\.(mp3|wav|flac|ogg|m4a|aac|webm)$/i)
  }, [])

  // Load single audio file
  const loadAudioFile = useCallback(async (file: File): Promise<AudioTrack> => {
    setIsLoading(true)
    setError(null)

    try {
      if (!validateAudioFile(file)) {
        throw new Error('Invalid audio file format')
      }

      const id = crypto.randomUUID()
      const placeholder: AudioTrack = {
        id,
        file,
        metadata: {
          title: file.name.replace(/\.[^/.]+$/, ''),
          artist: 'Loading...',
          album: '',
          duration: 0,
        },
        duration: 0,
        url: URL.createObjectURL(file),
        isLoading: true,
      }

      addToPlaylist(placeholder)

      const { playlist } = useAudioStore.getState()
      if (playlist.length === 1) {
        setCurrentTrack(placeholder)
      }

      ;(async () => {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const hash = await hashArrayBuffer(arrayBuffer)
          const cacheKey = `audio-metadata-${hash}`
          let metadata: AudioMetadata
          let artwork: ArtworkSource | undefined

          const cached = localStorage.getItem(cacheKey)
          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              metadata = {
                ...parsed.metadata,
                album_art: parsed.metadata.album_art ? base64ToUint8(parsed.metadata.album_art) : undefined,
              }
              artwork = parsed.artwork
                ? {
                    ...parsed.artwork,
                    data: parsed.artwork.data ? base64ToUint8(parsed.artwork.data) : undefined,
                  }
                : undefined
            } catch (parseError) {
              console.error(`Failed to parse cached metadata for key "${cacheKey}":`, parseError);
              metadata = await parseMetadata(file)
              const artworkResult = await extractArtwork(metadata, file.name, arrayBuffer)
              artwork = artworkResult.artwork
            }
          } else {
            metadata = await parseMetadata(file)
            const artworkResult = await extractArtwork(metadata, file.name, arrayBuffer)
            artwork = artworkResult.artwork

            const metadataToStore = {
              ...metadata,
              album_art: metadata.album_art ? uint8ToBase64(metadata.album_art) : undefined,
            }
            const artworkToStore = artwork
              ? { ...artwork, data: artwork.data ? uint8ToBase64(artwork.data) : undefined }
              : undefined
            try {
              // Clean up old entries if we have too many
              cleanupLocalStorage()
              
              // Check if we have enough space before storing
              const dataToStore = JSON.stringify({ 
                metadata: metadataToStore, 
                artwork: artworkToStore,
                timestamp: Date.now()
              })
              const estimatedSize = new Blob([dataToStore]).size
              
              // Estimate available space (localStorage is typically 5-10MB)
              const testKey = 'storage_test'
              const testData = 'x'.repeat(1024) // 1KB test
              try {
                localStorage.setItem(testKey, testData)
                localStorage.removeItem(testKey)
              } catch {
                // If we can't even store 1KB, localStorage is full
                console.warn('localStorage appears to be full, skipping metadata cache')
                return
              }
              
              // If estimated size is too large (>1MB), skip storing artwork
              if (estimatedSize > 1024 * 1024) {
                const metadataOnly = { 
                  metadata: metadataToStore, 
                  artwork: undefined,
                  timestamp: Date.now()
                }
                localStorage.setItem(cacheKey, JSON.stringify(metadataOnly))
              } else {
                localStorage.setItem(cacheKey, dataToStore)
              }
            } catch (e) {
              console.error('Failed to cache audio metadata in localStorage:', e);
            }
          }

          const audioData = await generateAmplitudeEnvelopeData(file, metadata, arrayBuffer)

          useAudioStore.getState().updateTrack(id, {
            metadata: {
              title: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
              artist: metadata.artist || 'Unknown Artist',
              album: metadata.album || 'Unknown Album',
              year: metadata.year ? parseInt(metadata.year.toString()) : undefined,
              genre: metadata.genre || '',
              duration: metadata.duration || 0,
              bitrate: metadata.bitrate || 0,
              sample_rate: metadata.sample_rate || 0,
              channels: metadata.channels || 0,
              album_art: metadata.album_art,
              album_art_mime: metadata.album_art_mime,
            },
            duration: metadata.duration || 0,
            audioData,
            artwork,
            isLoading: false,
          })
          conditionalToast.success(`Loaded: ${metadata.title || file.name.replace(/\.[^/.]+$/, '')}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load audio file'
          setError(errorMessage)
          conditionalToast.error(errorMessage)
          useAudioStore.getState().updateTrack(id, { isLoading: false })
        }
      })()

      return placeholder
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load audio file'
      setError(errorMessage)
      conditionalToast.error(errorMessage)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [validateAudioFile, parseMetadata, generateAmplitudeEnvelopeData, addToPlaylist, setCurrentTrack])

  // Load multiple audio files
  const loadAudioFiles = useCallback(async (files: FileList | File[]): Promise<AudioTrack[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const fileArray = Array.from(files)
      const validFiles = fileArray.filter(validateAudioFile)
      const invalidFiles = fileArray.filter(file => !validateAudioFile(file))

      if (validFiles.length === 0) {
        throw new Error('No valid audio files found')
      }

      const results = await Promise.all(
        validFiles.map(async (file) => {
          try {
            return await loadAudioFile(file)
          } catch {
            return null
          }
        })
      )

      const tracks = results.filter((t): t is AudioTrack => t !== null)

      if (tracks.length > 0) {
        const { currentTrack } = useAudioStore.getState()
        if (!currentTrack) {
          setCurrentTrack(tracks[0])
        }
      }

      const successMessage = `Loaded ${tracks.length} audio file${tracks.length > 1 ? 's' : ''}`
      if (invalidFiles.length > 0) {
        conditionalToast.success(`${successMessage} (${invalidFiles.length} skipped)`)
      } else {
        conditionalToast.success(successMessage)
      }

      return tracks

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load audio files'
      setError(errorMessage)
      conditionalToast.error(errorMessage)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [validateAudioFile, loadAudioFile, setCurrentTrack])

  // Play audio track
  const playTrack = useCallback(async (track: AudioTrack) => {
    try {
      await audioPlayer.playTrack(track)
    } catch (error) {
      conditionalToast.error('Failed to play audio track')
      throw error
    }
  }, [])

  // Stop playback
  const stopPlayback = useCallback(() => {
    audioPlayer.stopPlayback()
  }, [])

  // Pause playback
  const pausePlayback = useCallback(() => {
    audioPlayer.pausePlayback()
  }, [])

  // Resume playback
  const resumePlayback = useCallback(() => {
    audioPlayer.resumePlayback()
  }, [])

  // Seek to position
  const seekTo = useCallback((time: number) => {
    audioPlayer.seekTo(time)
  }, [])

  // Set volume
  const setAudioVolume = useCallback((volume: number) => {
    audioPlayer.setVolume(volume)
  }, [])

  // Toggle mute
  const toggleMute = useCallback(() => {
    audioPlayer.toggleMute()
  }, [])

  // Get frequency data for spectrogram
  const getFrequencyData = useCallback(() => {
    return audioPlayer.getFrequencyData()
  }, [])

  // Get time domain data
  const getTimeData = useCallback(() => {
    return audioPlayer.getTimeData()
  }, [])

  // Initialize audio context
  const initAudioContext = useCallback(async () => {
    return await audioPlayer.initAudioContext()
  }, [])

  // Cleanup
  const cleanup = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
    }
    audioPlayer.cleanup()
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
