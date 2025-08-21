import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { playbackEngine } from "../PlaybackEngine";
import { useAudioStore } from "@/shared/stores/audioStore";
import { TIME_UPDATE_INTERVAL_MS } from "../timeUpdater";

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
  createMediaStreamSource(_stream: MediaStream) {
    return { connect: vi.fn(), disconnect: vi.fn() } as any;
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
    // Delay long enough to ensure the load is still pending when a subsequent
    // load is triggered.
    const LONG_DELAY_MS = 50;
    const slowTrack = {
      file: {
        arrayBuffer: () =>
          new Promise<ArrayBuffer>((resolve) =>
            setTimeout(() => resolve(new ArrayBuffer(8)), LONG_DELAY_MS),
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
      loopMode: "off",
    });

    const playSpy = vi
      .spyOn(useAudioStore.getState(), "playTrack")
      .mockResolvedValue(undefined);

    (playbackEngine as any).handleEnded();

    expect(playSpy).toHaveBeenCalledWith(1);
  });

  // When no additional tracks exist the engine should stop and update the store
  // exactly once to avoid intermediate inconsistent states.
  it("stops when there is no next track", () => {
    const track1 = {
      id: "1",
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;

    useAudioStore.setState({
      playlist: [track1],
      currentTrackIndex: 0,
      currentTrack: track1,
      loopMode: "off",
    });

    const playSpy = vi.spyOn(useAudioStore.getState(), "playTrack");
    let updates = 0;
    const unsub = useAudioStore.subscribe(() => {
      updates++;
    });

    (playbackEngine as any).handleEnded();

    const state = useAudioStore.getState();
    expect(playSpy).not.toHaveBeenCalled();
    expect(state.isPlaying).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.isStopped).toBe(true);
    expect(updates).toBe(1);
    unsub();
  });

  it('repeats the same track when loopMode is "one"', () => {
    const track1 = {
      id: "1",
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;
    useAudioStore.setState({
      playlist: [track1],
      currentTrackIndex: 0,
      currentTrack: track1,
      loopMode: "one",
    });

    const playSpy = vi
      .spyOn(useAudioStore.getState(), "playTrack")
      .mockResolvedValue(undefined);
    (playbackEngine as any).handleEnded();
    expect(playSpy).toHaveBeenCalledWith(0);
  });

  it('loops to next track when loopMode is "all" at playlist end', () => {
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
      currentTrackIndex: 1,
      currentTrack: track2,
      loopMode: "all",
    });

    const playSpy = vi
      .spyOn(useAudioStore.getState(), "playTrack")
      .mockResolvedValue(undefined);
    (playbackEngine as any).handleEnded();
    expect(playSpy).toHaveBeenCalledWith(0);
  });

  it("chooses a random next track when shuffle is enabled", () => {
    const track1 = {
      id: "1",
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;
    const track2 = {
      id: "2",
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;
    const track3 = {
      id: "3",
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;
    useAudioStore.setState({
      playlist: [track1, track2, track3],
      currentTrackIndex: 0,
      currentTrack: track1,
      shuffle: true,
      loopMode: "off",
    });

    vi.spyOn(Math, "random").mockReturnValue(0.7); // -> index 2
    const playSpy = vi
      .spyOn(useAudioStore.getState(), "playTrack")
      .mockResolvedValue(undefined);

    (playbackEngine as any).handleEnded();

    expect(playSpy).toHaveBeenCalledWith(2);
    (Math.random as any).mockRestore();
  });

  // When shuffle is enabled with a single track the engine should stop and
  // update the store only once.
  it("stops when shuffle is enabled but only one track exists", () => {
    const track1 = {
      id: "1",
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;
    useAudioStore.setState({
      playlist: [track1],
      currentTrackIndex: 0,
      currentTrack: track1,
      shuffle: true,
      loopMode: "off",
    });

    const playSpy = vi.spyOn(useAudioStore.getState(), "playTrack");
    let updates = 0;
    const unsub = useAudioStore.subscribe(() => {
      updates++;
    });

    (playbackEngine as any).handleEnded();

    const state = useAudioStore.getState();
    expect(playSpy).not.toHaveBeenCalled();
    expect(state.isPlaying).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.isStopped).toBe(true);
    expect(updates).toBe(1);
    unsub();
  });

  // Rapid consecutive load calls should abort previous operations and only
  // resolve the last one.
    it("handles rapid successive load calls", async () => {
      // Delay long enough to ensure the first load is still pending when the
      // subsequent ones start.
      const LONG_DELAY_MS = 50;
      const slowTrack = {
        file: {
          arrayBuffer: () =>
            new Promise<ArrayBuffer>((resolve) =>
              setTimeout(() => resolve(new ArrayBuffer(8)), LONG_DELAY_MS),
            ),
        },
      } as any;
    const fastTrack1 = {
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;
    const fastTrack2 = {
      file: { arrayBuffer: async () => new ArrayBuffer(8) },
    } as any;

    const p1 = playbackEngine.load(slowTrack).catch((e) => e);
    const p2 = playbackEngine.load(fastTrack1).catch((e) => e);
    await playbackEngine.load(fastTrack2);

    const r1 = await p1;
    const r2 = await p2;
    expect(r1).toBeInstanceOf(DOMException);
    expect(r1.name).toBe("AbortError");
    expect(r2).toBeInstanceOf(DOMException);
    expect(r2.name).toBe("AbortError");
    expect(playbackEngine.getDuration()).toBe(2);
  });

  // Microphone streams should connect and disconnect cleanly.
  it("activates and deactivates microphone", async () => {
    const stream = {} as any;
    await playbackEngine.startMicrophone(stream);
    const mic = (playbackEngine as any).micSource;
    expect(mic.connect).toHaveBeenCalled();
    const disconnectSpy = vi.spyOn(mic, "disconnect");
    playbackEngine.stopMicrophone();
    expect(disconnectSpy).toHaveBeenCalled();
  });

  // If the audio context is suspended the engine should resume it before use.
  it("resumes suspended audio context", async () => {
    (MockAudioContext as any).prototype.state = "suspended";
    const ctx = await playbackEngine.initializeAudioContext();
    expect(ctx.resume).toHaveBeenCalled();
    (MockAudioContext as any).prototype.state = "running";
  });

  // The time updater should dispatch updates at the configured interval.
  it("emits time updates at fixed interval", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const track = { file: { arrayBuffer: async () => new ArrayBuffer(8) } } as any;
    await playbackEngine.load(track);
    const cb = vi.fn();
    const unsub = playbackEngine.subscribe(cb);
    playbackEngine.play();

    cb.mockReset();
    vi.advanceTimersByTime(TIME_UPDATE_INTERVAL_MS * 3 + 5);
    expect(cb).toHaveBeenCalledTimes(3);
    unsub();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // abortable should resolve once and remove attached listeners.
  it("cleans up abort listeners", async () => {
    const controller = new AbortController();
    const addSpy = vi.spyOn(controller.signal, "addEventListener");
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

    const p = (playbackEngine as any).abortable(Promise.resolve(1), controller);
    await p;
    controller.abort();

    expect(addSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
