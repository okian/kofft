import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { playbackEngine } from "../PlaybackEngine";
import { useAudioStore } from "@/stores/audioStore";

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
  currentTime = 0;
  destination = {};
  createGain() {
    return new MockGain() as any;
  }
  createBufferSource() {
    return new MockSource() as any;
  }
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  decodeAudioData(_arrayBuffer: ArrayBuffer) {
    return new Promise<AudioBuffer>((resolve) => {
      setTimeout(() => resolve({ duration: 2 } as any), 0);
    });
  }
}

beforeEach(() => {
  (global as any).AudioContext = MockAudioContext as any;
  (global as any).webkitAudioContext = MockAudioContext as any;
  (window as any).AudioContext = MockAudioContext as any;
  (window as any).webkitAudioContext = MockAudioContext as any;
  useAudioStore.setState({
    playlist: [],
    currentTrackIndex: -1,
    currentTrack: null,
    isPlaying: false,
    isPaused: false,
    isStopped: true,
  });
});

afterEach(() => {
  playbackEngine.cleanup();
  vi.clearAllMocks();
});

describe("PlaybackEngine", () => {
  it("stops previous playback when a new track starts", async () => {
    const track1 = {
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;
    const track2 = {
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;

    await playbackEngine.load(track1);
    playbackEngine.play();
    const stopSpy = vi.spyOn((playbackEngine as any).source!, "stop");

    await playbackEngine.load(track2);
    expect(stopSpy).toHaveBeenCalled();
  });

  it("cancels pending decode when loading a new track", async () => {
    const slowTrack = {
      file: {
        arrayBuffer: () =>
          new Promise<ArrayBuffer>((resolve) =>
            setTimeout(() => resolve(new ArrayBuffer(8)), 50),
          ),
      },
    } as any;
    const fastTrack = {
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;

    const p1 = playbackEngine.load(slowTrack).catch((e) => e);
    await playbackEngine.load(fastTrack);
    const result = await p1;
    expect(result).toBeInstanceOf(DOMException);
    expect(result.name).toBe("AbortError");
  });

  it("auto-advances to the next track when current track ends", () => {
    const track1 = {
      id: "1",
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;
    const track2 = {
      id: "2",
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;

    useAudioStore.setState({
      playlist: [track1, track2],
      currentTrackIndex: 0,
      currentTrack: track1,
    });

    const playSpy = vi
      .spyOn(useAudioStore.getState(), "playTrack")
      .mockResolvedValue(undefined);

    (playbackEngine as any).handleEnded();

    expect(playSpy).toHaveBeenCalledWith(1);
  });

  it("stops when there is no next track", () => {
    const track1 = {
      id: "1",
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;

    useAudioStore.setState({
      playlist: [track1],
      currentTrackIndex: 0,
      currentTrack: track1,
    });

    const playSpy = vi
      .spyOn(useAudioStore.getState(), "playTrack")
      .mockResolvedValue(undefined);
    const setPlayingSpy = vi.spyOn(useAudioStore.getState(), "setPlaying");
    const setPausedSpy = vi.spyOn(useAudioStore.getState(), "setPaused");
    const setStoppedSpy = vi.spyOn(useAudioStore.getState(), "setStopped");

    (playbackEngine as any).handleEnded();

    expect(playSpy).not.toHaveBeenCalled();
    expect(setPlayingSpy).toHaveBeenCalledWith(false);
    expect(setPausedSpy).toHaveBeenCalledWith(false);
    expect(setStoppedSpy).toHaveBeenCalledWith(true);
  });
});
