import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAudioStore } from "../audioStore";
import type { AudioTrack } from "@/types";

vi.mock("@/utils/audioPlayer", () => ({
  audioPlayer: {
    playTrack: vi.fn().mockResolvedValue(undefined),
    stopPlayback: vi.fn(),
    pausePlayback: vi.fn(),
    resumePlayback: vi.fn(),
    toggleMute: vi.fn(),
    seekTo: vi.fn(),
    setVolume: vi.fn(),
    onTrackEnd: vi.fn(),
  },
}));

describe("audioStore shuffle", () => {
  const tracks: AudioTrack[] = [1, 2, 3].map((n) => ({
    id: `${n}`,
    file: new File([], `${n}.mp3`),
    metadata: { title: `${n}`, artist: "a", album: "b", duration: 0 },
    duration: 0,
    url: `${n}`,
  }));

  beforeEach(() => {
    useAudioStore.setState({
      playlist: tracks,
      currentTrackIndex: 0,
      currentTrack: tracks[0],
      shuffle: false,
    });
    vi.clearAllMocks();
  });

  it("shuffles through tracks without repetition and supports previous", async () => {
    const store = useAudioStore.getState();
    store.setShuffle(true);
    vi.spyOn(Math, "random").mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);

    await store.nextTrack();
    expect(useAudioStore.getState().currentTrackIndex).toBe(1);
    await store.nextTrack();
    expect(useAudioStore.getState().currentTrackIndex).toBe(2);
    await store.previousTrack();
    expect(useAudioStore.getState().currentTrackIndex).toBe(1);
  });
});
