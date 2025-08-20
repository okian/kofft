import type { AudioTrack } from "@/types";
import { createTimeUpdater, TIME_UPDATE_INTERVAL_MS } from "./timeUpdater";

interface AudioPlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

/**
 * State callback signature used by subscribers listening to playback
 * updates from the player.
 */
type AudioPlayerCallback = (state: AudioPlayerState) => void;

/**
 * Default volume used when initializing the gain node. Exported for tests
 * and to avoid magic numbers sprinkled through the codebase.
 */
export const DEFAULT_VOLUME = 0.5;

class AudioPlayerEngine {
  private static instance: AudioPlayerEngine | null = null;
  private audioContext: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private isPaused: boolean = false;
  private callbacks: Set<AudioPlayerCallback> = new Set();
  private currentTrack: AudioTrack | null = null;
  private currentTime: number = 0;
  private playRequestId = 0;
  private timeUpdater = createTimeUpdater({
    onUpdate: (now) => {
      if (!this.audioContext) return;
      const currentTime = this.audioContext.currentTime - this.startTime;
      this.currentTime = Math.min(currentTime, this.getDuration());
      this.notifySubscribers(now);
    },
    shouldUpdate: () => !!this.source && !this.isPaused && !!this.audioContext,
    intervalMs: TIME_UPDATE_INTERVAL_MS,
  });
  /**
   * Registered callbacks for when the current track finishes playback. We
   * keep a set so multiple listeners (e.g. tests or hooks) can respond
   * without overwriting each other.
   */
  private trackEndCallbacks: Set<() => void> = new Set();

  // Microphone-related properties
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  private microphoneStream: MediaStream | null = null;
  private microphoneActive: boolean = false;

  private constructor() {
    // Private constructor to enforce singleton
  }

  static getInstance(): AudioPlayerEngine {
    if (!AudioPlayerEngine.instance) {
      AudioPlayerEngine.instance = new AudioPlayerEngine();
    }
    return AudioPlayerEngine.instance;
  }

  // Subscribe to state changes
  subscribe(callback: AudioPlayerCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Register a callback invoked exactly once per track completion. Consumers
   * (the React hook, tests, etc.) use this to react to natural playback end
   * without directly coupling to the player internals.
   */
  onTrackEnd(callback: () => void): () => void {
    this.trackEndCallbacks.add(callback);
    return () => this.trackEndCallbacks.delete(callback);
  }

  // Notify all subscribers of state changes and record dispatch time.
  private notifySubscribers(now: number = performance.now()) {
    this.timeUpdater.record(now);
    const state: AudioPlayerState = {
      isPlaying: this.isPlaying(),
      isPaused: this.isPaused,
      isStopped: this.isStopped(),
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      volume: this.getVolume(),
      isMuted: this.getMuted(),
    };

    this.callbacks.forEach((callback) => callback(state));
  }

  // Initialize audio context - this is the ONLY place where AudioContext is created
  async initAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      const win = window as Window & {
        webkitAudioContext?: typeof AudioContext;
      };
      this.audioContext = new (window.AudioContext ||
        win.webkitAudioContext)!();

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = DEFAULT_VOLUME; // Initialize to sane default

      // Create analyser for frequency data
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      // Connect nodes
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }

    // Resume context if suspended
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  // Get the shared audio context (for other components to use)
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  // Get the shared analyser node
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  // Get the shared gain node
  getGainNode(): GainNode | null {
    return this.gainNode;
  }

  // Start microphone input using the shared audio context
  async startMicrophone(stream: MediaStream): Promise<boolean> {
    try {
      const context = await this.initAudioContext();

      // Stop any current playback
      this.stopCurrentPlayback();

      // Store the stream
      this.microphoneStream = stream;

      // Create audio source from stream
      this.microphoneSource = context.createMediaStreamSource(stream);
      this.microphoneSource.connect(this.gainNode!);

      this.microphoneActive = true;

      return true;
    } catch (error) {
      return false;
    }
  }

  // Stop microphone input
  stopMicrophone(): boolean {
    try {
      // Stop all tracks in the stream
      if (this.microphoneStream) {
        this.microphoneStream.getTracks().forEach((track) => track.stop());
        this.microphoneStream = null;
      }

      // Disconnect audio source
      if (this.microphoneSource) {
        this.microphoneSource.disconnect();
        this.microphoneSource = null;
      }

      this.microphoneActive = false;

      return true;
    } catch (error) {
      return false;
    }
  }

  // Check if microphone is active
  isMicrophoneActive(): boolean {
    return this.microphoneActive;
  }

  // Stop all current playback
  private stopCurrentPlayback() {
    if (this.source) {
      try {
        // Prevent old onended handlers from firing after stop
        this.source.onended = null;
        this.source.stop();
      } catch (e) {
        // Source might already be stopped
      }
      try {
        this.source.disconnect();
      } catch (e) {
        // Source might already be disconnected
      }
      this.source = null;
    }

    this.timeUpdater.stop();
  }

  // Play a track
  async playTrack(track: AudioTrack, startAt = 0): Promise<void> {
    const requestId = ++this.playRequestId;
    const context = await this.initAudioContext();

    // Stop any current playback and microphone
    this.stopCurrentPlayback();
    this.stopMicrophone();

    // Reset state
    this.isPaused = false;
    this.pausedTime = 0;
    this.currentTrack = track;

    // Load audio buffer
    const arrayBuffer = await track.file.arrayBuffer();
    const decodedBuffer = await context.decodeAudioData(arrayBuffer);
    if (requestId !== this.playRequestId) {
      return;
    }
    this.currentBuffer = decodedBuffer;

    // Clamp start offset to valid range before starting playback
    const duration = this.currentBuffer.duration;
    const safeStart = Math.max(
      0,
      Math.min(Number.isFinite(startAt) ? startAt : 0, duration),
    );

    // Create new source
    this.source = context.createBufferSource();
    this.source.buffer = this.currentBuffer;
    this.source.connect(this.gainNode!);

    // Set up ended callback
    this.source.onended = () => {
      this.handleTrackEnded();
    };

    // Start playback at the requested offset
    this.source.start(0, safeStart);
    this.startTime = context.currentTime - safeStart;

    // Notify immediately then begin update loop
    this.notifySubscribers();
    this.timeUpdater.start();
  }

  // Pause playback
  pausePlayback(): void {
    // Always stop updater to avoid stray callbacks.
    this.timeUpdater.stop();
    if (this.source && !this.isPaused) {
      try {
        this.source.stop();
      } catch (e) {
        // Source might already be stopped
      }

      this.pausedTime = this.audioContext!.currentTime - this.startTime;
      this.isPaused = true;
      this.source = null;
      this.notifySubscribers();
    }
  }

  // Resume playback
  async resumePlayback(): Promise<void> {
    if (this.isPaused && this.currentBuffer && this.audioContext) {
      // Create new source starting from paused position
      this.source = this.audioContext.createBufferSource();
      this.source.buffer = this.currentBuffer;
      this.source.connect(this.gainNode!);

      // Set up ended callback
      this.source.onended = () => {
        this.handleTrackEnded();
      };

      // Start playback from paused position
      this.source.start(0, this.pausedTime);
      this.startTime = this.audioContext.currentTime - this.pausedTime;
      this.isPaused = false;

      // Notify immediately then restart update loop
      this.notifySubscribers();
      this.timeUpdater.start();
    }
  }

  // Stop playback
  stopPlayback(): void {
    this.playRequestId++;
    this.stopCurrentPlayback();
    this.stopMicrophone();
    this.isPaused = false;
    this.pausedTime = 0;
    this.currentTime = 0;
    this.currentTrack = null;

    this.notifySubscribers();
  }

  // Seek to position
  seekTo(time: number): void {
    if (!this.currentBuffer) return;

    const duration = this.currentBuffer.duration;
    const clampedTime = Math.max(
      0,
      Math.min(Number.isFinite(time) ? time : 0, duration),
    );

    if (this.isPaused) {
      this.pausedTime = clampedTime;
      this.notifySubscribers();
    } else if (this.source) {
      // Stop current playback and restart from new position
      this.stopCurrentPlayback();
      this.startTime = this.audioContext!.currentTime - clampedTime;

      // Create new source
      this.source = this.audioContext!.createBufferSource();
      this.source.buffer = this.currentBuffer;
      this.source.connect(this.gainNode!);

      this.source.onended = () => {
        this.handleTrackEnded();
      };

      this.source.start(0, clampedTime);
      // Notify immediately then restart update loop
      this.notifySubscribers();
      this.timeUpdater.start();
    }
  }

  // Set volume
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
      this.notifySubscribers();
    }
  }

  // Toggle mute
  toggleMute(): void {
    if (this.gainNode) {
      const currentVolume = this.gainNode.gain.value;
      if (currentVolume > 0) {
        this.gainNode.gain.value = 0;
      } else {
        this.gainNode.gain.value = DEFAULT_VOLUME; // Restore to default volume
      }
      this.notifySubscribers();
    }
  }

  // Get frequency data
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    return dataArray;
  }

  // Get time domain data
  getTimeData(): Uint8Array | null {
    if (!this.analyser) return null;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    return dataArray;
  }

  // Handle track ended
  private handleTrackEnded(): void {
    this.isPaused = false;
    this.pausedTime = 0;
    this.currentTime = 0;
    this.source = null;
    this.currentTrack = null;

    this.timeUpdater.stop();
    this.notifySubscribers();

    // Inform any listeners that playback naturally reached the end. The
    // surrounding application (store, hooks) decides what to do next—play
    // another track, loop, or stop entirely.
    this.trackEndCallbacks.forEach((cb) => {
      try {
        cb();
      } catch {
        /* swallow listener errors to avoid breaking player state */
      }
    });
  }

  // State getters
  isPlaying(): boolean {
    return !!this.source && !this.isPaused;
  }

  isStopped(): boolean {
    return !this.source && !this.isPaused && !this.microphoneActive;
  }

  getCurrentTime(): number {
    if (this.isPaused) {
      return this.pausedTime;
    }
    if (this.source && this.audioContext) {
      return Math.min(
        this.audioContext.currentTime - this.startTime,
        this.getDuration(),
      );
    }
    return 0;
  }

  getDuration(): number {
    return this.currentBuffer?.duration || 0;
  }

  getVolume(): number {
    return this.gainNode?.gain.value || 0;
  }

  getMuted(): boolean {
    return this.gainNode?.gain.value === 0;
  }

  // Cleanup
  cleanup(): void {
    this.stopCurrentPlayback();
    this.stopMicrophone();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.gainNode = null;
    this.analyser = null;
    this.currentBuffer = null;
    this.currentTrack = null;
    this.callbacks.clear();
  }
}

// Export singleton instance
export const audioPlayer = AudioPlayerEngine.getInstance();

// Export types
export type { AudioPlayerState, AudioPlayerCallback };
