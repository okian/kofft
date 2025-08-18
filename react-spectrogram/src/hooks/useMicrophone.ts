import { useState, useCallback, useRef, useEffect } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import toast from 'react-hot-toast'

export const useMicrophone = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  
  const { setMicrophoneActive, setLive, setCurrentTrack } = useAudioStore()

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
      
      setIsInitialized(true)
      return context
    } catch (error) {
      console.error('Failed to initialize audio context:', error)
      throw new Error('Audio context initialization failed')
    }
  }, [])

  // Request microphone permission
  const requestPermission = useCallback(async () => {
    setIsRequestingPermission(true)
    setError(null)

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not supported in this browser')
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
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
        toast.error('Microphone permission denied. Please allow microphone access.')
      } else {
        toast.error(errorMessage)
      }
      
      throw error
    }
  }, [])

  // Start microphone input
  const startMicrophone = useCallback(async () => {
    try {
      // Initialize audio context if needed
      const context = await initAudioContext()
      
      // Resume context if suspended
      if (context.state === 'suspended') {
        await context.resume()
      }

      // Request permission and get stream
      const stream = await requestPermission()

      // Create audio source from stream
      const source = context.createMediaStreamSource(stream)
      source.connect(gainNodeRef.current!)
      
      sourceRef.current = source

      // Set up live mode
      setMicrophoneActive(true)
      setLive(true)
      setCurrentTrack(null) // Clear any file track

      toast.success('Microphone activated')
      return true

    } catch (error) {
      console.error('Failed to start microphone:', error)
      return false
    }
  }, [initAudioContext, requestPermission, setMicrophoneActive, setLive, setCurrentTrack])

  // Stop microphone input
  const stopMicrophone = useCallback(() => {
    try {
      // Stop all tracks in the stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
      }

      // Disconnect audio source
      if (sourceRef.current) {
        sourceRef.current.disconnect()
        sourceRef.current = null
      }

      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      // Update state
      setMicrophoneActive(false)
      setLive(false)

      toast.success('Microphone deactivated')
      return true

    } catch (error) {
      console.error('Failed to stop microphone:', error)
      return false
    }
  }, [setMicrophoneActive, setLive])

  // Toggle microphone
  const toggleMicrophone = useCallback(async () => {
    const { isMicrophoneActive } = useAudioStore.getState()
    
    if (isMicrophoneActive) {
      return stopMicrophone()
    } else {
      return startMicrophone()
    }
  }, [startMicrophone, stopMicrophone])

  // Get available input devices
  const getInputDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter(device => device.kind === 'audioinput')
    } catch (error) {
      console.error('Failed to enumerate devices:', error)
      return []
    }
  }, [])

  // Switch to specific input device
  const switchInputDevice = useCallback(async (deviceId: string) => {
    try {
      // Stop current microphone
      await stopMicrophone()

      // Request new stream with specific device
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })

      mediaStreamRef.current = stream

      // Reconnect to audio context
      const context = audioContextRef.current
      if (context && gainNodeRef.current) {
        const source = context.createMediaStreamSource(stream)
        source.connect(gainNodeRef.current)
        sourceRef.current = source
      }

      toast.success('Input device switched')
      return true

    } catch (error) {
      console.error('Failed to switch input device:', error)
      toast.error('Failed to switch input device')
      return false
    }
  }, [stopMicrophone])

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

  // Start real-time analysis loop
  const startAnalysis = useCallback((onData: (frequencyData: Uint8Array, timeData: Uint8Array) => void) => {
    if (!analyserRef.current) return

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

  // Stop analysis loop
  const stopAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  // Get input level
  const getInputLevel = useCallback(() => {
    const timeData = getTimeData()
    if (!timeData) return 0

    // Calculate RMS (Root Mean Square) of the audio data
    let sum = 0
    for (let i = 0; i < timeData.length; i++) {
      const sample = (timeData[i] - 128) / 128 // Convert to -1 to 1 range
      sum += sample * sample
    }
    const rms = Math.sqrt(sum / timeData.length)
    
    // Convert to dB
    const db = 20 * Math.log10(Math.max(rms, 1e-10))
    
    // Normalize to 0-1 range (assuming -60dB to 0dB range)
    return Math.max(0, Math.min(1, (db + 60) / 60))
  }, [getTimeData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMicrophone()
    }
  }, [stopMicrophone])

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
