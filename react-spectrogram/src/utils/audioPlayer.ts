// Singleton Audio Player Engine
// This ensures only one audio context and source is active at any time

interface AudioPlayerState {
  isPlaying: boolean
  isPaused: boolean
  isStopped: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
}

type AudioPlayerCallback = (state: AudioPlayerState) => void

class AudioPlayerEngine {
  private static instance: AudioPlayerEngine | null = null
  private audioContext: AudioContext | null = null
  private source: AudioBufferSourceNode | null = null
  private gainNode: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private currentBuffer: AudioBuffer | null = null
  private startTime: number = 0
  private pausedTime: number = 0
  private isPaused: boolean = false
  private animationFrameId: number | null = null
  private callbacks: Set<AudioPlayerCallback> = new Set()
  private currentTrack: any = null
  private currentTime: number = 0
  private playRequestId = 0

  // Microphone-related properties
  private microphoneSource: MediaStreamAudioSourceNode | null = null
  private microphoneStream: MediaStream | null = null
  private microphoneActive: boolean = false

  private constructor() {
    // Private constructor to enforce singleton
  }

  static getInstance(): AudioPlayerEngine {
    if (!AudioPlayerEngine.instance) {
      AudioPlayerEngine.instance = new AudioPlayerEngine()
    }
    return AudioPlayerEngine.instance
  }

  // Subscribe to state changes
  subscribe(callback: AudioPlayerCallback): () => void {
    this.callbacks.add(callback)
    return () => {
      this.callbacks.delete(callback)
    }
  }

  // Notify all subscribers of state changes
  private notifySubscribers() {
    const state: AudioPlayerState = {
      isPlaying: this.isPlaying(),
      isPaused: this.isPaused,
      isStopped: this.isStopped(),
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      volume: this.getVolume(),
      isMuted: this.getMuted()
    }
    
    this.callbacks.forEach(callback => callback(state))
  }

  // Initialize audio context - this is the ONLY place where AudioContext is created
  async initAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain()
      this.gainNode.gain.value = 0.5 // Default volume
      
      // Create analyser for frequency data
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      
      // Connect nodes
      this.gainNode.connect(this.analyser)
      this.analyser.connect(this.audioContext.destination)
    }

    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    return this.audioContext
  }

  // Get the shared audio context (for other components to use)
  getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  // Get the shared analyser node
  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  // Get the shared gain node
  getGainNode(): GainNode | null {
    return this.gainNode
  }

  // Start microphone input using the shared audio context
  async startMicrophone(stream: MediaStream): Promise<boolean> {
    try {
      const context = await this.initAudioContext()
      
      // Stop any current playback
      this.stopCurrentPlayback()
      
      // Store the stream
      this.microphoneStream = stream
      
      // Create audio source from stream
      this.microphoneSource = context.createMediaStreamSource(stream)
      this.microphoneSource.connect(this.gainNode!)
      
      this.microphoneActive = true
      
      return true
      
    } catch (error) {
      return false
    }
  }

  // Stop microphone input
  stopMicrophone(): boolean {
    try {
      // Stop all tracks in the stream
      if (this.microphoneStream) {
        this.microphoneStream.getTracks().forEach(track => track.stop())
        this.microphoneStream = null
      }

      // Disconnect audio source
      if (this.microphoneSource) {
        this.microphoneSource.disconnect()
        this.microphoneSource = null
      }

      this.microphoneActive = false
      
      return true
      
    } catch (error) {
      return false
    }
  }

  // Check if microphone is active
  isMicrophoneActive(): boolean {
    return this.microphoneActive
  }

  // Stop all current playback
  private stopCurrentPlayback() {
    if (this.source) {
      try {
        this.source.stop()
      } catch (e) {
        // Source might already be stopped
      }
      try {
        this.source.disconnect()
      } catch (e) {
        // Source might already be disconnected
      }
      this.source = null
    }
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  // Play a track
  async playTrack(track: any, startAt = 0): Promise<void> {
    const requestId = ++this.playRequestId
    try {
      const context = await this.initAudioContext()

      // Stop any current playback and microphone
      this.stopCurrentPlayback()
      this.stopMicrophone()

      // Reset state
      this.isPaused = false
      this.pausedTime = 0
      this.currentTrack = track

      // Load audio buffer
      const arrayBuffer = await track.file.arrayBuffer()
      const decodedBuffer = await context.decodeAudioData(arrayBuffer)
      if (requestId !== this.playRequestId) {
        return
      }
      this.currentBuffer = decodedBuffer

      // Create new source
      this.source = context.createBufferSource()
      this.source.buffer = this.currentBuffer
      this.source.connect(this.gainNode!)

      // Set up ended callback
      this.source.onended = () => {
        this.handleTrackEnded()
      }

      // Start playback at the requested offset
      this.source.start(0, startAt)
      this.startTime = context.currentTime - startAt

      // Start time update loop
      this.updateTime()

      this.notifySubscribers()

    } catch (error) {
      throw error
    }
  }

  // Pause playback
  pausePlayback(): void {
    if (this.source && !this.isPaused) {
      try {
        this.source.stop()
      } catch (e) {
        // Source might already be stopped
      }
      
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId)
        this.animationFrameId = null
      }
      
      this.pausedTime = this.audioContext!.currentTime - this.startTime
      this.isPaused = true
      this.source = null
      
      this.notifySubscribers()
    }
  }

  // Resume playback
  resumePlayback(): void {
    if (this.isPaused && this.currentBuffer && this.currentTrack) {
      const offset = this.pausedTime
      this.playTrack(this.currentTrack, offset)
    }
  }

  // Stop playback
  stopPlayback(): void {
    this.playRequestId++
    this.stopCurrentPlayback()
    this.stopMicrophone()
    this.isPaused = false
    this.pausedTime = 0
    this.currentTime = 0
    this.currentTrack = null

    this.notifySubscribers()
  }

  // Seek to position
  seekTo(time: number): void {
    if (!this.currentBuffer) return

    const clampedTime = Math.max(0, Math.min(time, this.currentBuffer.duration))
    
    if (this.isPaused) {
      this.pausedTime = clampedTime
      this.notifySubscribers()
    } else if (this.source) {
      // Stop current playback and restart from new position
      this.stopCurrentPlayback()
      this.startTime = this.audioContext!.currentTime - clampedTime
      
      // Create new source
      this.source = this.audioContext!.createBufferSource()
      this.source.buffer = this.currentBuffer
      this.source.connect(this.gainNode!)
      
      this.source.onended = () => {
        this.handleTrackEnded()
      }
      
      this.source.start(0, clampedTime)
      this.updateTime()
      
      this.notifySubscribers()
    }
  }

  // Set volume
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume))
      this.notifySubscribers()
    }
  }

  // Toggle mute
  toggleMute(): void {
    if (this.gainNode) {
      const currentVolume = this.gainNode.gain.value
      if (currentVolume > 0) {
        this.gainNode.gain.value = 0
      } else {
        this.gainNode.gain.value = 0.5 // Restore to default volume
      }
      this.notifySubscribers()
    }
  }

  // Get frequency data
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null
    
    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteFrequencyData(dataArray)
    
    return dataArray
  }

  // Get time domain data
  getTimeData(): Uint8Array | null {
    if (!this.analyser) return null
    
    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteTimeDomainData(dataArray)
    
    return dataArray
  }

  // Update time and notify subscribers
  private updateTime = () => {
    if (this.source && !this.isPaused && this.audioContext) {
      const currentTime = this.audioContext.currentTime - this.startTime
      this.currentTime = Math.min(currentTime, this.getDuration())
      
      if (currentTime < this.getDuration()) {
        this.animationFrameId = requestAnimationFrame(this.updateTime)
      }
      
      this.notifySubscribers()
    }
  }

  // Handle track ended
  private handleTrackEnded(): void {
    this.isPaused = false
    this.pausedTime = 0
    this.currentTime = 0
    this.source = null
    this.currentTrack = null
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    
    this.notifySubscribers()
  }

  // State getters
  isPlaying(): boolean {
    return !!this.source && !this.isPaused
  }

  isStopped(): boolean {
    return !this.source && !this.isPaused && !this.microphoneActive
  }

  getCurrentTime(): number {
    if (this.isPaused) {
      return this.pausedTime
    }
    if (this.source && this.audioContext) {
      return Math.min(this.audioContext.currentTime - this.startTime, this.getDuration())
    }
    return 0
  }

  getDuration(): number {
    return this.currentBuffer?.duration || 0
  }

  getVolume(): number {
    return this.gainNode?.gain.value || 0
  }

  getMuted(): boolean {
    return this.gainNode?.gain.value === 0
  }

  // Cleanup
  cleanup(): void {
    this.stopCurrentPlayback()
    this.stopMicrophone()
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    this.gainNode = null
    this.analyser = null
    this.currentBuffer = null
    this.currentTrack = null
    this.callbacks.clear()
  }
}

// Export singleton instance
export const audioPlayer = AudioPlayerEngine.getInstance()

// Export types
export type { AudioPlayerState, AudioPlayerCallback }
