import { useState, useCallback } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import { audioPlayer } from '@/utils/audioPlayer'
import { AudioTrack, AudioMetadata } from '@/types'
import { extractMetadata, generateAmplitudeEnvelope } from '@/utils/wasm'
import { extractArtwork } from '@/utils/artwork'
import { conditionalToast } from '@/utils/toast'

export const useAudioFile = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { setCurrentTrack, addToPlaylist } = useAudioStore()

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
  const generateAmplitudeEnvelopeData = useCallback(async (file: File): Promise<Float32Array> => {
    try {
      // Get audio metadata first to get sample rate
      const metadata = await parseMetadata(file)
      const sampleRate = metadata.sample_rate || 44100
      
      // Use the shared audio context to decode audio data
      const context = await audioPlayer.initAudioContext()
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await context.decodeAudioData(arrayBuffer)
      
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
  }, [parseMetadata])

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

      // Parse metadata
      const metadata = await parseMetadata(file)
      
      // Generate amplitude envelope
      const audioData = await generateAmplitudeEnvelopeData(file)

      // Extract artwork
      const arrayBuffer = await file.arrayBuffer()
      const artworkResult = await extractArtwork(metadata, file.name, arrayBuffer)

      const track: AudioTrack = {
        id: crypto.randomUUID(),
        file,
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
          album_art_mime: metadata.album_art_mime
        },
        duration: metadata.duration || 0,
        url: URL.createObjectURL(file),
        audioData: audioData,
        artwork: artworkResult.artwork
      }
      


      // Add to playlist
      addToPlaylist(track)
      
      // Set as current track if it's the first one
      const { playlist } = useAudioStore.getState()
      if (playlist.length === 1) {
        setCurrentTrack(track)
      }

      conditionalToast.success(`Loaded: ${track.metadata.title}`)
      return track

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load audio file'
      setError(errorMessage)
      conditionalToast.error(errorMessage)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [validateAudioFile, parseMetadata, generateAmplitudeEnvelope, addToPlaylist, setCurrentTrack])

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

      const tracks: AudioTrack[] = []
      const invalidFileNames: string[] = []

      for (const file of validFiles) {
        try {
          const track = await loadAudioFile(file)
          tracks.push(track)
        } catch (error) {
          invalidFileNames.push(file.name)
        }
      }

      // Set first track as current if no current track
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
