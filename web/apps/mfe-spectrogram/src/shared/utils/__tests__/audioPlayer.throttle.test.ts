/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { audioPlayer, DEFAULT_VOLUME } from "../audioPlayer";

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

class MockSource {
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  disconnect = vi.fn();
  onended: (() => void) | null = null;
  buffer: AudioBuffer | null = null;
}

class MockGain {
  gain = { value: DEFAULT_VOLUME };
  connect = vi.fn();
}

class MockAnalyser {
  connect = vi.fn();
  fftSize = 0;
}

class MockAudioContext {
  destination = {};
  get currentTime() {
    return performance.now() / 1000;
  }
  createGain() {
    return new MockGain() as any;
  }
  createAnalyser() {
    return new MockAnalyser() as any;
  }
  createBufferSource() {
    return new MockSource() as any;
  }
  decodeAudioData = vi.fn().mockResolvedValue({ duration: 5 } as any);
  resume = vi.fn();
  close = vi.fn();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 10),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  (global as any).AudioContext = MockAudioContext as any;
  (global as any).webkitAudioContext = MockAudioContext as any;
  (window as any).AudioContext = MockAudioContext as any;
  (window as any).webkitAudioContext = MockAudioContext as any;
});

afterEach(() => {
  audioPlayer.stopPlayback();
  audioPlayer.cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("audioPlayer throttling", () => {
  it("dispatches at most once per 20ms", async () => {
    const cb = vi.fn();
    audioPlayer.subscribe(cb);
    const track = {
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;
    await audioPlayer.playTrack(track, 0);
    cb.mockClear();

    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("resets throttle after seek and pause", async () => {
    const cb = vi.fn();
    audioPlayer.subscribe(cb);
    const track = {
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;
    await audioPlayer.playTrack(track, 0);

    // Seek should reset throttling
    audioPlayer.seekTo(1);
    cb.mockClear();
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(1);

    // Pause/resume should also reset
    audioPlayer.pausePlayback();
    await audioPlayer.resumePlayback();
    cb.mockClear();
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
