import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAudioStore } from "../audioStore";
import type { AudioTrack } from "@/shared/types";
import { revokeTrackUrl } from "@/shared/utils/audio";

vi.mock("@/shared/utils/audio", () => ({
  revokeTrackUrl: vi.fn(),
}));

describe("audioStore", () => {
  beforeEach(() => {
    // reset store state before each test
    useAudioStore.setState({
      playlist: [],
      currentTrackIndex: -1,
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
    store.setDuration(100);

    const listener = vi.fn();
    const unsubscribe = useAudioStore.subscribe((s) => s.currentTime, listener);

    // First update should trigger the subscription.
    store.setCurrentTime(42);
    // Second update with the same value must not trigger another call.
    store.setCurrentTime(42);

    expect(useAudioStore.getState().currentTime).toBe(42);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
