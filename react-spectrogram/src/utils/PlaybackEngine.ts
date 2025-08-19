import type { AudioTrack } from '@/types'

interface PlaybackState {
  isPlaying: boolean
  isPaused: boolean
  isStopped: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
}

type PlaybackCallback = (state: PlaybackState) => void

class PlaybackEngine {
  private static instance: PlaybackEngine | null = null

  private audioContext: AudioContext | null = null
  private gainNode: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private currentBuffer: AudioBuffer | null = null
  private startTime = 0
  private pausedAt = 0
  private isPaused = false
  private callbacks: Set<PlaybackCallback> = new Set()
  private currentTime = 0
  private animationFrameId: number | null = null

  private playRequestId = 0
  private loadController: AbortController | null = null

  private constructor() {}

  static getInstance(): PlaybackEngine {
    if (!PlaybackEngine.instance) {
      PlaybackEngine.instance = new PlaybackEngine()
    }
    return PlaybackEngine.instance
  }

  subscribe(cb: PlaybackCallback): () => void {
    this.callbacks.add(cb)
    return () => this.callbacks.delete(cb)
  }

  private notify() {
    const state: PlaybackState = {
      isPlaying: this.isPlaying(),
      isPaused: this.isPaused,
      isStopped: this.isStopped(),
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      volume: this.getVolume(),
      isMuted: this.isMuted()
    }
    this.callbacks.forEach(cb => cb(state))
  }

  private async initContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      this.audioContext = new Ctx()
      this.gainNode = this.audioContext.createGain()
      this.gainNode.gain.value = 1
      this.gainNode.connect(this.audioContext.destination)
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
    return this.audioContext
  }

  private async abortable<T>(promise: Promise<T>, controller: AbortController): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        controller.signal.onabort = null
        reject(new DOMException('Aborted', 'AbortError'))
      }
      controller.signal.onabort = onAbort
      promise
        .then(v => {
          controller.signal.onabort = null
          resolve(v)
        })
        .catch(err => {
          controller.signal.onabort = null
          reject(err)
        })
    })
  }

  async load(track: AudioTrack): Promise<void> {
    const requestId = ++this.playRequestId
    this.loadController?.abort()
    const controller = new AbortController()
    this.loadController = controller

    const context = await this.initContext()
    // stop any current playback
    this.stopSource()

    try {
      const arrayBuffer = await this.abortable(track.file.arrayBuffer(), controller)
      if (controller.signal.aborted || requestId !== this.playRequestId) throw new DOMException('Aborted', 'AbortError')
      const decoded = await this.abortable((context.decodeAudioData as any)(arrayBuffer), controller)
      if (controller.signal.aborted || requestId !== this.playRequestId) throw new DOMException('Aborted', 'AbortError')
      this.currentBuffer = decoded
      this.pausedAt = 0
      this.isPaused = false
      this.notify()
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err
      }
      throw err
    }
  }

  play(startAt = 0): void {
    if (!this.currentBuffer || !this.audioContext) return
    const context = this.audioContext
    this.stopSource()

    const source = context.createBufferSource()
    source.buffer = this.currentBuffer
    source.connect(this.gainNode!)
    const requestId = this.playRequestId
    source.onended = () => {
      if (requestId === this.playRequestId) {
        this.handleEnded()
      }
    }
    source.start(0, startAt)
    this.startTime = context.currentTime - startAt
    this.source = source
    this.isPaused = false
    this.updateTime()
    this.notify()
  }

  pause(): void {
    if (this.source && this.audioContext) {
      try {
        this.source.stop()
      } catch {}
      this.pausedAt = this.audioContext.currentTime - this.startTime
      this.source.disconnect()
      this.source = null
      this.isPaused = true
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId)
        this.animationFrameId = null
      }
      this.notify()
    }
  }

  resume(): void {
    if (this.isPaused) {
      this.play(this.pausedAt)
    }
  }

  stop(): void {
    this.playRequestId++
    this.stopSource()
    this.currentBuffer = null
    this.isPaused = false
    this.pausedAt = 0
    this.currentTime = 0
    this.notify()
  }

  seek(time: number): void {
    if (!this.currentBuffer) return
    const clamped = Math.max(0, Math.min(time, this.currentBuffer.duration))
    if (this.isPaused) {
      this.pausedAt = clamped
      this.notify()
    } else {
      this.play(clamped)
    }
  }

  setVolume(v: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, v))
      this.notify()
    }
  }

  toggleMute(): void {
    if (this.gainNode) {
      this.gainNode.gain.value = this.gainNode.gain.value > 0 ? 0 : 1
      this.notify()
    }
  }

  private updateTime = () => {
    if (this.source && this.audioContext) {
      this.currentTime = Math.min(this.audioContext.currentTime - this.startTime, this.getDuration())
      this.animationFrameId = requestAnimationFrame(this.updateTime)
      this.notify()
    }
  }

  private handleEnded(): void {
    this.stopSource()
    this.isPaused = false
    this.pausedAt = 0
    this.currentTime = 0
    this.notify()
  }

  private stopSource() {
    if (this.source) {
      try { this.source.stop() } catch {}
      try { this.source.disconnect() } catch {}
      this.source = null
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  // State getters
  isPlaying(): boolean {
    return !!this.source && !this.isPaused
  }

  isStopped(): boolean {
    return !this.source && !this.isPaused
  }

  getCurrentTime(): number {
    if (this.isPaused) return this.pausedAt
    if (this.source && this.audioContext) return Math.min(this.audioContext.currentTime - this.startTime, this.getDuration())
    return 0
  }

  getDuration(): number {
    return this.currentBuffer?.duration || 0
  }

  getVolume(): number {
    return this.gainNode?.gain.value || 0
  }

  isMuted(): boolean {
    return this.gainNode?.gain.value === 0
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  cleanup(): void {
    this.stop()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.gainNode = null
    this.currentBuffer = null
    this.callbacks.clear()
  }
}

export const playbackEngine = PlaybackEngine.getInstance()
export type { PlaybackState, PlaybackCallback }
