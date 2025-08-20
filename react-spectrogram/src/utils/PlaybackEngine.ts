import type { AudioTrack } from "@/types";
import { useAudioStore } from "@/stores/audioStore";
import { createTimeUpdater } from "./timeUpdater";

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

  /**
   * Shared time updater driven by `requestAnimationFrame`.  Using the utility
   * ensures consistent timing semantics across different playback engines and
   * avoids duplicated boilerplate.
   */
  private timeUpdater = createTimeUpdater({
    getTime: () => {
      if (!this.audioContext || !this.source) return this.currentTime;
      return Math.min(
        this.audioContext.currentTime - this.startTime,
        this.getDuration(),
      );
    },
    onUpdate: (time) => {
      this.currentTime = time;
      this.notify();
    },
    shouldContinue: () => !!this.source && !!this.audioContext,
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

  private notify() {
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

  private async initContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.audioContext = new Ctx();
      this.gainNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.gainNode.gain.value = 1;
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  async initializeAudioContext(): Promise<AudioContext> {
    return this.initContext();
  }

  private async abortable<T>(
    promise: Promise<T>,
    controller: AbortController,
  ): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      let finished = false;
      const onAbort = () => {
        if (finished) return;
        finished = true;
        controller.signal.onabort = null;
        reject(new DOMException("Aborted", "AbortError"));
      };
      controller.signal.onabort = onAbort;
      promise
        .then((v) => {
          if (finished) return;
          finished = true;
          controller.signal.onabort = null;
          resolve(v);
        })
        .catch((err) => {
          if (finished) return;
          finished = true;
          controller.signal.onabort = null;
          reject(err);
        });
    });
  }

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
        throw new DOMException("Aborted", "AbortError");
      const decoded = await this.abortable(
        context.decodeAudioData(arrayBuffer),
        controller,
      );
      if (controller.signal.aborted || requestId !== this.playRequestId)
        throw new DOMException("Aborted", "AbortError");
      this.currentBuffer = decoded;
      this.pausedAt = 0;
      this.isPaused = false;
      this.notify();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Don't throw AbortError, just return silently
        return;
      }
      throw err;
    }
  }

  play(startAt = 0): void {
    if (!this.currentBuffer || !this.audioContext) return;
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
    source.start(0, startAt);
    this.startTime = context.currentTime - startAt;
    this.source = source;
    this.isPaused = false;
    // Start dispatching time updates using the shared updater.
    this.timeUpdater.start();
    this.notify();
  }

  pause(): void {
    if (this.source && this.audioContext) {
      try {
        this.source.stop();
      } catch {
        // Source might already be stopped
      }
      this.pausedAt = this.audioContext.currentTime - this.startTime;
      this.source.disconnect();
      this.source = null;
      this.isPaused = true;
      // Stop updating time while paused to avoid stale frames.
      this.timeUpdater.stop();
      this.notify();
    }
  }

  resume(): void {
    if (this.isPaused) {
      this.play(this.pausedAt);
    }
  }

  stop(): void {
    this.playRequestId++;
    this.stopSource();
    this.currentBuffer = null;
    this.isPaused = false;
    this.pausedAt = 0;
    this.currentTime = 0;
    this.notify();
  }

  seek(time: number): void {
    if (!this.currentBuffer) return;
    const clamped = Math.max(0, Math.min(time, this.currentBuffer.duration));
    if (this.isPaused) {
      this.pausedAt = clamped;
      this.notify();
    } else {
      this.play(clamped);
    }
  }

  async startMicrophone(stream: MediaStream): Promise<boolean> {
    const context = await this.initContext();
    this.stopSource();
    try {
      this.micSource?.disconnect();
    } catch {
      // Ignore disconnection errors
    }
    this.micSource = context.createMediaStreamSource(stream);
    this.micSource.connect(this.gainNode!);
    this.currentBuffer = null;
    this.isPaused = false;
    this.playRequestId++;
    this.notify();
    return true;
  }

  stopMicrophone(): boolean {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // Ignore disconnection errors
      }
      this.micSource = null;
      this.notify();
    }
    return true;
  }

  setVolume(v: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, v));
      this.notify();
    }
  }

  toggleMute(): void {
    if (this.gainNode) {
      this.gainNode.gain.value = this.gainNode.gain.value > 0 ? 0 : 1;
      this.notify();
    }
  }

  private handleEnded(): void {
    this.stopSource();
    this.isPaused = false;
    this.pausedAt = 0;
    this.currentTime = 0;

    const {
      playlist,
      currentTrackIndex,
      playTrack,
      setPlaying,
      setPaused,
      setStopped,
      loopMode,
      shuffle,
    } = useAudioStore.getState();

    const playlistLength = playlist.length;
    if (playlistLength === 0) {
      this.notify();
      setPlaying(false);
      setPaused(false);
      setStopped(true);
      return;
    }

    if (loopMode === "one") {
      playTrack(currentTrackIndex);
      return;
    }

    if (shuffle) {
      if (playlistLength <= 1 && loopMode === "off") {
        this.notify();
        setPlaying(false);
        setPaused(false);
        setStopped(true);
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
    setPlaying(false);
    setPaused(false);
    setStopped(true);
  }

  private stopSource() {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // Source might already be stopped
      }
      try {
        this.source.disconnect();
      } catch {
        // Source might already be disconnected
      }
      this.source = null;
    }
    // Ensure the shared updater is halted whenever playback stops.
    this.timeUpdater.stop();
  }

  // State getters
  isPlaying(): boolean {
    return !!this.source && !this.isPaused;
  }

  isStopped(): boolean {
    return !this.source && !this.isPaused;
  }

  getCurrentTime(): number {
    if (this.isPaused) return this.pausedAt;
    if (this.source && this.audioContext)
      return Math.min(
        this.audioContext.currentTime - this.startTime,
        this.getDuration(),
      );
    return 0;
  }

  getDuration(): number {
    return this.currentBuffer?.duration || 0;
  }

  getVolume(): number {
    return this.gainNode?.gain.value || 0;
  }

  isMuted(): boolean {
    return this.gainNode?.gain.value === 0;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    return dataArray;
  }

  getTimeData(): Uint8Array | null {
    if (!this.analyser) return null;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    return dataArray;
  }

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
