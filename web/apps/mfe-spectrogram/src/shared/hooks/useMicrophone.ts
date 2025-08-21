import { useState, useCallback, useRef, useEffect } from 'react'
import { useAudioStore } from '@/shared/stores/audioStore'
import { audioPlayer } from '@/shared/utils/audioPlayer'
import { conditionalToast } from '@/shared/utils/toast'

/** Default microphone sampling rate in Hertz. */
const MIC_SAMPLE_RATE_HZ = 44100

/** Center of 8-bit PCM sample range used for normalization. */
const PCM_SAMPLE_CENTER = 128

/** Minimum RMS value to avoid logarithm of zero during dB conversion. */
const MIN_RMS_VALUE = 1e-10

/** Conversion multiplier from RMS to decibels. */
const DB_MULTIPLIER = 20

/** Decibel range used for normalizing input level to 0-1. */
const DB_NORMALIZATION_RANGE = 60

/**
 * React hook that manages microphone access and analysis.
 * Exposes utilities for permission handling, input device management,
 * and real-time signal processing.
 */
export const useMicrophone = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const { setMicrophoneActive, setLive, setCurrentTrack } = useAudioStore()

  /**
   * Initialize the shared audio context.
   * Ensures a single AudioContext is used throughout the app
   * to minimize resource usage.
   */
  const initAudioContext = useCallback(async () => {
    try {
      const context = await audioPlayer.initAudioContext()
      setIsInitialized(true)
      return context
    } catch (error) {
      throw new Error('Audio context initialization failed')
    }
  }, [])

  /**
   * Request permission to access the microphone.
   * Handles unsupported browsers and permission denial gracefully.
   */
  const requestPermission = useCallback(async () => {
    setIsRequestingPermission(true)
    setError(null)

    try {
      // Ensure getUserMedia is available before requesting access.
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not supported in this browser')
      }

      // Request microphone access with sensible defaults.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: MIC_SAMPLE_RATE_HZ
        }
      })

      mediaStreamRef.current = stream
      setIsRequestingPermission(false)
      return stream

    } catch (error) {
      setIsRequestingPermission(false)
      const errorMessage = error instanceof Error ? error.message : 'Failed to access microphone'
      setError(errorMessage)

      if (error instanceof Error && error.name === 'NotAllowedError') {
        conditionalToast.error('Microphone permission denied. Please allow microphone access.')
      } else {
        conditionalToast.error(errorMessage)
      }

      throw error
    }
  }, [])

  /**
   * Start capturing audio from the microphone.
   * Handles permission requests and cleans up stale streams before starting.
   */
  const startMicrophone = useCallback(async () => {
    try {
      // Initialize audio context if needed.
      await initAudioContext()

      // Stop any existing stream to prevent leaks.
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop())
        mediaStreamRef.current = null
      }

      // Request permission and obtain stream.
      const stream = await requestPermission()

      // Use the shared audio player to start microphone.
      const success = await audioPlayer.startMicrophone(stream)

      if (success) {
        // Enable live mode state.
        setMicrophoneActive(true)
        setLive(true)
        setCurrentTrack(null) // Clear any file track

        conditionalToast.success('Microphone activated')
        return true
      } else {
        throw new Error('Failed to start microphone')
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start microphone'
      setError(message)
      conditionalToast.error(message)
      mediaStreamRef.current?.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
      setMicrophoneActive(false)
      setLive(false)
      return false
    }
  }, [initAudioContext, requestPermission, setMicrophoneActive, setLive, setCurrentTrack])

  /**
   * Stop capturing audio from the microphone and release resources.
   * Always stops media tracks even if the audio player fails.
   */
  const stopMicrophone = useCallback(() => {
    try {
      // Attempt to stop microphone in shared audio player.
      const success = audioPlayer.stopMicrophone()

      // Always stop tracks to avoid dangling audio input.
      mediaStreamRef.current?.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null

      // Reset state regardless of player outcome.
      setMicrophoneActive(false)
      setLive(false)

      if (success) {
        conditionalToast.success('Microphone deactivated')
        return true
      } else {
        conditionalToast.error('Failed to stop microphone')
        return false
      }

    } catch (error) {
      mediaStreamRef.current?.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
      setMicrophoneActive(false)
      setLive(false)
      conditionalToast.error('Failed to stop microphone')
      return false
    }
  }, [setMicrophoneActive, setLive])

  /**
   * Toggle microphone on or off depending on current state.
   */
  const toggleMicrophone = useCallback(async () => {
    const { isMicrophoneActive } = useAudioStore.getState()

    if (isMicrophoneActive) {
      return stopMicrophone()
    } else {
      return startMicrophone()
    }
  }, [startMicrophone, stopMicrophone])

  /**
   * Enumerate available audio input devices.
   * Returns an empty array on failure and reports the issue.
   */
  const getInputDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter(device => device.kind === 'audioinput')
    } catch (error) {
      conditionalToast.error('Failed to enumerate input devices')
      return []
    }
  }, [])

  /**
   * Switch the microphone to use a specific input device.
   * Cleans up the existing stream before activating the new one.
   */
  const switchInputDevice = useCallback(async (deviceId: string) => {
    try {
      // Stop current microphone before switching.
      await stopMicrophone()

      // Request new stream with the specific device.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: MIC_SAMPLE_RATE_HZ
        }
      })

      mediaStreamRef.current = stream

      // Start microphone with new stream.
      const success = await audioPlayer.startMicrophone(stream)

      if (success) {
        conditionalToast.success('Input device switched')
        return true
      } else {
        throw new Error('Failed to switch input device')
      }

    } catch (error) {
      mediaStreamRef.current?.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
      conditionalToast.error('Failed to switch input device')
      return false
    }
  }, [stopMicrophone])

  /**
   * Retrieve frequency-domain data from the shared audio player.
   */
  const getFrequencyData = useCallback(() => {
    return audioPlayer.getFrequencyData()
  }, [])

  /**
   * Retrieve time-domain data from the shared audio player.
   */
  const getTimeData = useCallback(() => {
    return audioPlayer.getTimeData()
  }, [])

  /**
   * Start the real-time analysis loop delivering frequency and time data
   * to a provided callback.
   */
  const startAnalysis = useCallback((onData: (frequencyData: Uint8Array, timeData: Uint8Array) => void) => {
    const analyse = () => {
      const frequencyData = getFrequencyData()
      const timeData = getTimeData()

      if (frequencyData && timeData) {
        onData(frequencyData, timeData)
      }

      animationFrameRef.current = requestAnimationFrame(analyse)
    }

    analyse()
  }, [getFrequencyData, getTimeData])

  /**
   * Stop the analysis loop if it is running.
   */
  const stopAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  /**
   * Compute the current input level as a normalized value between 0 and 1.
   */
  const getInputLevel = useCallback(() => {
    const timeData = getTimeData()
    if (!timeData) return 0

    // Calculate RMS (Root Mean Square) of the audio data.
    let sum = 0
    for (let i = 0; i < timeData.length; i++) {
      const sample = (timeData[i] - PCM_SAMPLE_CENTER) / PCM_SAMPLE_CENTER // Convert to -1 to 1 range
      sum += sample * sample
    }
    const rms = Math.sqrt(sum / timeData.length)

    // Convert to decibels.
    const db = DB_MULTIPLIER * Math.log10(Math.max(rms, MIN_RMS_VALUE))

    // Normalize to 0-1 range (assuming DB_NORMALIZATION_RANGE dB span).
    return Math.max(0, Math.min(1, (db + DB_NORMALIZATION_RANGE) / DB_NORMALIZATION_RANGE))
  }, [getTimeData])

  /**
   * Ensure microphone resources are released when the hook is unmounted.
   */
  useEffect(() => {
    return () => {
      stopAnalysis()
      stopMicrophone()
      mediaStreamRef.current?.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
  }, [stopMicrophone, stopAnalysis])

  return {
    isInitialized,
    isRequestingPermission,
    error,
    startMicrophone,
    stopMicrophone,
    toggleMicrophone,
    getInputDevices,
    switchInputDevice,
    getFrequencyData,
    getTimeData,
    startAnalysis,
    stopAnalysis,
    getInputLevel,
    initAudioContext
  }
}
