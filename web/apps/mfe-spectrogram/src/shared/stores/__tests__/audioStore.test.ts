import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAudioStore } from "../audioStore";
import type { AudioTrack } from "@/shared/types";
import { revokeTrackUrl } from "@/shared/utils/audio";
import { audioPlayer } from "@/shared/utils/audioPlayer";

vi.mock("@/shared/utils/audio", () => ({
  revokeTrackUrl: vi.fn(),
}));

// Mock the audio player to avoid hitting real media APIs during tests and to
// enable assertions on playback controls.
vi.mock("@/shared/utils/audioPlayer", () => ({
  audioPlayer: {
    playTrack: vi.fn().mockResolvedValue(undefined),
    pausePlayback: vi.fn(),
    resumePlayback: vi.fn(),
    stopPlayback: vi.fn(),
    seekTo: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
  },
}));

// Sentinel index representing "no selection" used by the store.
const NO_INDEX = -1;
// Generic track duration used across tests to avoid magic numbers.
const TEST_DURATION = 100;
// Arbitrary time value used when verifying idempotent currentTime updates.
const TARGET_TIME = 42;
// Time value for concurrent seek tests.
const SEEK_TARGET = 25;

describe("audioStore", () => {
  beforeEach(() => {
    // reset store state before each test
    useAudioStore.setState({
      playlist: [],
      currentTrackIndex: NO_INDEX,
      currentTrack: null,
    });
    vi.resetAllMocks();
  });

  it("revokes track URL when removed from playlist", () => {
    const track: AudioTrack = {
      id: "1",
      file: new File([], "test.mp3"),
      metadata: { title: "t", artist: "a", album: "b", duration: 0 },
      duration: 0,
      url: "blob:test",
    };

    const store = useAudioStore.getState();
    store.setPlaylist([track]);

    store.removeFromPlaylist(0);

    expect(revokeTrackUrl).toHaveBeenCalledWith(track);
  });

  it("updates track in playlist and currentTrack", () => {
    const track: AudioTrack = {
      id: "1",
      file: new File([], "test.mp3"),
      metadata: { title: "t", artist: "a", album: "b", duration: 0 },
      duration: 0,
      url: "blob:test",
      isLoading: true,
    };

    const store = useAudioStore.getState();
    store.setPlaylist([track]);
    store.setCurrentTrack(track);

    store.updateTrack("1", {
      metadata: { ...track.metadata, title: "updated" },
      isLoading: false,
    });

    const updated = useAudioStore.getState().playlist[0];
    expect(updated.metadata.title).toBe("updated");
    expect(updated.isLoading).toBe(false);
    expect(useAudioStore.getState().currentTrack?.metadata.title).toBe(
      "updated",
    );
  });

  it("avoids state updates when setting identical currentTime", () => {
    const store = useAudioStore.getState();
    // Ensure duration is long enough for the time we will set.
    store.setDuration(TEST_DURATION);

    const listener = vi.fn();
    const unsubscribe = useAudioStore.subscribe((s) => s.currentTime, listener);

    // First update should trigger the subscription.
    store.setCurrentTime(TARGET_TIME);
    // Second update with the same value must not trigger another call.
    store.setCurrentTime(TARGET_TIME);

    expect(useAudioStore.getState().currentTime).toBe(TARGET_TIME);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("keeps state coherent when play, pause, and seek occur simultaneously", async () => {
    const store = useAudioStore.getState();
    // Establish a valid duration so seeking is within range.
    store.setDuration(TEST_DURATION);

    await Promise.all([
      // Trigger play state change.
      new Promise<void>((resolve) => {
        setTimeout(() => {
          store.setPlaying(true);
          resolve();
        }, 0);
      }),
      // Trigger pause state change.
      new Promise<void>((resolve) => {
        setTimeout(() => {
          store.setPaused(true);
          resolve();
        }, 0);
      }),
      // Trigger seek operation and store update simultaneously.
      new Promise<void>((resolve) => {
        setTimeout(() => {
          store.setCurrentTime(SEEK_TARGET);
          store.seekTo(SEEK_TARGET);
          resolve();
        }, 0);
      }),
    ]);

    const state = useAudioStore.getState();
    expect(state.isPaused).toBe(!state.isPlaying);
    expect(state.isStopped).toBe(false);
    expect(state.currentTime).toBe(SEEK_TARGET);
    expect(audioPlayer.seekTo).toHaveBeenCalledWith(SEEK_TARGET);
  });
});
