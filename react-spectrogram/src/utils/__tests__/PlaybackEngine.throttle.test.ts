/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { playbackEngine } from "../PlaybackEngine";

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
  gain = { value: 1 };
  connect = vi.fn();
}

class MockAudioContext {
  destination = {};
  get currentTime() {
    return performance.now() / 1000;
  }
  createGain() {
    return new MockGain() as any;
  }
  createBufferSource() {
    return new MockSource() as any;
  }
  createAnalyser() {
    return { connect: vi.fn(), fftSize: 0 } as any;
  }
  resume = vi.fn();
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
  (playbackEngine as any).audioContext = new MockAudioContext() as any;
  (playbackEngine as any).gainNode = new MockGain() as any;
  (playbackEngine as any).currentBuffer = { duration: 5 } as any;
});

afterEach(() => {
  playbackEngine.stop();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("PlaybackEngine throttling", () => {
  it("dispatches at most once per 20ms", () => {
    const cb = vi.fn();
    playbackEngine.subscribe(cb);
    playbackEngine.play(0);
    cb.mockClear();

    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("resets throttle after seek and pause", () => {
    const cb = vi.fn();
    playbackEngine.subscribe(cb);
    playbackEngine.play(0);

    // Seek should reset throttling
    playbackEngine.seek(1);
    cb.mockClear();
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(1);

    // Pause/resume should also reset
    playbackEngine.pause();
    playbackEngine.resume();
    cb.mockClear();
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(10);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
