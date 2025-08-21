import type { AudioTrack } from "@/shared/types";
import { useAudioStore } from "@/shared/stores/audioStore";
import { createTimeUpdater, TIME_UPDATE_INTERVAL_MS } from "./timeUpdater";

/**
 * FFT size for the analyser node. Chosen as a power of two to satisfy the
 * WebAudio API requirement and to provide a reasonable frequency resolution
 * without allocating excessive memory.
 */
const ANALYSER_FFT_SIZE = 2048;

/**
 * Default gain value applied to the master gain node. A value of one preserves
 * the original signal amplitude.
 */
const DEFAULT_GAIN_VALUE = 1;

/** Name of the DOMException thrown when an async operation is aborted. */
const ABORT_ERROR_NAME = "AbortError";

/** Message supplied with DOMException when an async operation is aborted. */
const ABORT_ERROR_MESSAGE = "Aborted";

interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

type PlaybackCallback = (state: PlaybackState) => void;

/**
 * Core audio playback controller. Manages the WebAudio graph, loading and
 * decoding of tracks, microphone input, and time update notifications. The
 * engine is implemented as a singleton because the WebAudio API performs best
 * with a single shared AudioContext per page.
 */
class PlaybackEngine {
  private static instance: PlaybackEngine | null = null;

  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private startTime = 0;
  private pausedAt = 0;
  private isPaused = false;
  private callbacks: Set<PlaybackCallback> = new Set();
  private currentTime = 0;
  private timeUpdater = createTimeUpdater({
    onUpdate: (now) => {
      if (!this.audioContext) return;
      this.currentTime = Math.min(
        this.audioContext.currentTime - this.startTime,
        this.getDuration(),
      );
      this.notify(now);
    },
    shouldUpdate: () => !!this.source && !!this.audioContext,
    intervalMs: TIME_UPDATE_INTERVAL_MS,
  });

  private playRequestId = 0;
  private loadController: AbortController | null = null;

  private constructor() {}

  static getInstance(): PlaybackEngine {
    if (!PlaybackEngine.instance) {
      PlaybackEngine.instance = new PlaybackEngine();
    }
    return PlaybackEngine.instance;
  }

  subscribe(cb: PlaybackCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  private notify(now = performance.now()) {
    this.timeUpdater.record(now);
    const state: PlaybackState = {
      isPlaying: this.isPlaying(),
      isPaused: this.isPaused,
      isStopped: this.isStopped(),
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      volume: this.getVolume(),
      isMuted: this.isMuted(),
    };
    this.callbacks.forEach((cb) => cb(state));
  }

  /**
   * Lazily create the AudioContext and associated node graph. If the context
   * is suspended, it is resumed to ensure audio can play.
   */
  private async initContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      const win = window as Window & {
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctx = window.AudioContext || win.webkitAudioContext;
      this.audioContext = new Ctx();
      this.gainNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();
      // Configure the analyser with a reasonable FFT size and connect the
      // graph: source -> gain -> analyser -> destination.
      this.analyser.fftSize = ANALYSER_FFT_SIZE;
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.gainNode.gain.value = DEFAULT_GAIN_VALUE;
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Public wrapper to initialise the AudioContext. Provided primarily for
   * tests that need access without triggering other side effects.
   */
  async initializeAudioContext(): Promise<AudioContext> {
    return this.initContext();
  }

  /**
   * Wrap an async operation with abort support. Resolves or rejects at most
   * once and detaches the abort listener regardless of outcome to prevent
   * memory leaks.
   */
  private async abortable<T>(
    promise: Promise<T>,
    controller: AbortController,
  ): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        controller.signal.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new DOMException(ABORT_ERROR_MESSAGE, ABORT_ERROR_NAME));
      };
      controller.signal.addEventListener("abort", onAbort);

      promise
        .then((value) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        })
        .catch((err) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err);
        });
    });
  }

  /**
   * Load and decode a track into memory. Any previous load operation is
   * aborted to avoid wasting work on tracks the user skipped.
   */
  async load(track: AudioTrack): Promise<void> {
    const requestId = ++this.playRequestId;
    this.loadController?.abort();
    const controller = new AbortController();
    this.loadController = controller;

    const context = await this.initContext();
    // stop any current playback
    this.stopSource();

    try {
      const arrayBuffer = await this.abortable(
        track.file.arrayBuffer(),
        controller,
      );
      if (controller.signal.aborted || requestId !== this.playRequestId)
        throw new DOMException(ABORT_ERROR_MESSAGE, ABORT_ERROR_NAME);
      const decoded = await this.abortable(
        new Promise<AudioBuffer>((resolve, reject) =>
          context.decodeAudioData(arrayBuffer, resolve, reject),
        ),
        controller,
      );
      if (controller.signal.aborted || requestId !== this.playRequestId)
        throw new DOMException(ABORT_ERROR_MESSAGE, ABORT_ERROR_NAME);
      this.currentBuffer = decoded;
      this.pausedAt = 0;
      this.isPaused = false;
      this.notify();
    } catch (err) {
      const error = err as DOMException;
      if (error.name === ABORT_ERROR_NAME) {
        // Don't throw AbortError, just return silently
        return;
      }
      throw error;
    }
  }

  /**
   * Begin playback from the provided offset, clamping the offset to the
   * track's duration for safety.
   */
  play(startAt = 0): void {
    if (!this.currentBuffer || !this.audioContext) return;

    // Clamp start time to a valid range before scheduling playback.
    const duration = this.currentBuffer.duration;
    const safeStart = Math.max(
      0,
      Math.min(Number.isFinite(startAt) ? startAt : 0, duration),
    );

    const context = this.audioContext;
    this.stopSource();

    const source = context.createBufferSource();
    source.buffer = this.currentBuffer;
    source.connect(this.gainNode!);
    const requestId = this.playRequestId;
    source.onended = () => {
      if (requestId === this.playRequestId) {
        this.handleEnded();
      }
    };
    source.start(0, safeStart);
    this.startTime = context.currentTime - safeStart;
    this.source = source;
    this.isPaused = false;
    this.notify();
    this.timeUpdater.start();
  }

  /** Pause playback and remember the current position. */
  pause(): void {
    if (this.source && this.audioContext) {
      try {
        this.source.stop();
      } catch {
        /* ignore stop errors */
      }
      this.pausedAt = this.audioContext.currentTime - this.startTime;
      this.source.disconnect();
      this.source = null;
      this.isPaused = true;
      this.timeUpdater.stop();
      this.notify();
    }
  }

  /** Resume playback if currently paused. */
  resume(): void {
    if (this.isPaused) {
      this.play(this.pausedAt);
    }
  }

  /** Fully stop playback and reset internal state. */
  stop(): void {
    this.playRequestId++;
    this.stopSource();
    this.currentBuffer = null;
    this.isPaused = false;
    this.pausedAt = 0;
    this.currentTime = 0;
    this.notify();
  }

  /**
   * Seek to the specified time within the current track. Input is sanitized to
   * remain within the track's bounds.
   */
  seek(time: number): void {
    if (!this.currentBuffer) return;

    // Clamp seek time to valid range.
    const duration = this.currentBuffer.duration;
    const safeTime = Math.max(
      0,
      Math.min(Number.isFinite(time) ? time : 0, duration),
    );
    if (this.isPaused) {
      this.pausedAt = safeTime;
      this.notify();
    } else {
      this.play(safeTime);
    }
  }

  /**
   * Attach a MediaStream (microphone) to the audio graph, stopping any current
   * playback. Returns true once the stream is connected.
   */
  async startMicrophone(stream: MediaStream): Promise<boolean> {
    const context = await this.initContext();
    this.stopSource();
    try {
      this.micSource?.disconnect();
    } catch {
      /* ignore disconnect errors */
    }
    this.micSource = context.createMediaStreamSource(stream);
    this.micSource.connect(this.gainNode!);
    this.currentBuffer = null;
    this.isPaused = false;
    this.playRequestId++;
    this.notify();
    return true;
  }

  /** Disconnect the active microphone stream if present. */
  stopMicrophone(): boolean {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        /* ignore disconnect errors */
      }
      this.micSource = null;
      this.notify();
    }
    return true;
  }

  /** Set the master volume, clamped to the valid [0,1] range. */
  setVolume(v: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, v));
      this.notify();
    }
  }

  /** Toggle between muted (gain=0) and full volume. */
  toggleMute(): void {
    if (this.gainNode) {
      this.gainNode.gain.value = this.gainNode.gain.value > 0 ? 0 : 1;
      this.notify();
    }
  }

  /**
   * Handle the end of playback for the current track. Depending on playlist
   * state and user preferences, this may advance to another track or stop
   * playback entirely. Store updates are performed atomically to avoid
   * intermediate inconsistent states.
   */
  private handleEnded(): void {
    this.stopSource();
    this.isPaused = false;
    this.pausedAt = 0;
    this.currentTime = 0;

    const {
      playlist,
      currentTrackIndex,
      playTrack,
      loopMode,
      shuffle,
    } = useAudioStore.getState();

    const playlistLength = playlist.length;
    if (playlistLength === 0) {
      this.notify();
      useAudioStore.setState({
        isPlaying: false,
        isPaused: false,
        isStopped: true,
      });
      return;
    }

    if (loopMode === "one") {
      playTrack(currentTrackIndex);
      return;
    }

    if (shuffle) {
      if (playlistLength <= 1 && loopMode === "off") {
        this.notify();
        useAudioStore.setState({
          isPlaying: false,
          isPaused: false,
          isStopped: true,
        });
        return;
      }
      let nextIndex = currentTrackIndex;
      if (playlistLength > 1) {
        do {
          nextIndex = Math.floor(Math.random() * playlistLength);
        } while (nextIndex === currentTrackIndex);
      }
      playTrack(nextIndex);
      return;
    }

    const isLastTrack = currentTrackIndex >= playlistLength - 1;
    if (!isLastTrack) {
      playTrack(currentTrackIndex + 1);
      return;
    }

    if (loopMode === "all") {
      playTrack(0);
      return;
    }

    this.notify();
    useAudioStore.setState({
      isPlaying: false,
      isPaused: false,
      isStopped: true,
    });
  }

  /**
   * Stop and disconnect the currently playing AudioBufferSourceNode if any.
   * Errors from stopping or disconnecting are intentionally swallowed to avoid
   * disrupting playback flow.
   */
  private stopSource() {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* ignore stop errors */
      }
      try {
        this.source.disconnect();
      } catch {
        /* ignore disconnect errors */
      }
      this.source = null;
    }
    this.timeUpdater.stop();
  }

  // State getters
  /** True when audio is currently playing. */
  isPlaying(): boolean {
    return !!this.source && !this.isPaused;
  }

  /** True when playback is completely stopped. */
  isStopped(): boolean {
    return !this.source && !this.isPaused;
  }

  /**
   * Current playback position in seconds. While paused, returns the position
   * at which playback was paused.
   */
  getCurrentTime(): number {
    if (this.isPaused) return this.pausedAt;
    if (this.source && this.audioContext)
      return Math.min(
        this.audioContext.currentTime - this.startTime,
        this.getDuration(),
      );
    return 0;
  }

  /** Duration of the currently loaded track in seconds. */
  getDuration(): number {
    return this.currentBuffer?.duration || 0;
  }

  /** Current master volume level [0,1]. */
  getVolume(): number {
    return this.gainNode?.gain.value || 0;
  }

  /** True if master volume is muted. */
  isMuted(): boolean {
    return this.gainNode?.gain.value === 0;
  }

  /** Return the underlying AudioContext, mainly for testing purposes. */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Snapshot the current frequency-domain data from the analyser node.
   * Returns null if the analyser is not initialised.
   */
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    return dataArray;
  }

  /**
   * Snapshot the current time-domain waveform data from the analyser node.
   * Returns null if the analyser is not initialised.
   */
  getTimeData(): Uint8Array | null {
    if (!this.analyser) return null;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    return dataArray;
  }

  /**
   * Tear down the audio graph and release resources. Primarily used in tests
   * to ensure a clean environment between cases.
   */
  cleanup(): void {
    this.stop();
    this.stopMicrophone();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.gainNode = null;
    this.analyser = null;
    this.currentBuffer = null;
    this.callbacks.clear();
  }
}

export const playbackEngine = PlaybackEngine.getInstance();
export type { PlaybackState, PlaybackCallback };
