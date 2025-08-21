import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { audioPlayer } from "@/shared/utils/audioPlayer";

const { state, addToPlaylist, setCurrentTrack, updateTrack, useAudioStore } =
  vi.hoisted(() => {
    const state: any = { playlist: [], currentTrack: null };
    const addToPlaylist = vi.fn((track) => state.playlist.push(track));
    const setCurrentTrack = vi.fn((track) => {
      state.currentTrack = track;
    });
    const updateTrack = vi.fn();
    const useAudioStore: any = () => ({ addToPlaylist, setCurrentTrack });
    useAudioStore.getState = () => ({ ...state, updateTrack });
    return {
      state,
      addToPlaylist,
      setCurrentTrack,
      updateTrack,
      useAudioStore,
    };
  });

vi.mock("@/shared/stores/audioStore", () => ({ useAudioStore }));

const { extractMetadata, generateAmplitudeEnvelope } = vi.hoisted(() => {
  return {
    extractMetadata: vi.fn().mockResolvedValue({
      title: "meta",
      artist: "artist",
      album: "album",
      duration: 1,
      sample_rate: 44100,
    }),
    generateAmplitudeEnvelope: vi
      .fn()
      .mockResolvedValue(new Float32Array([1, 2, 3])),
  };
});

vi.mock("@/shared/utils/wasm", () => ({
  extractMetadata,
  generateAmplitudeEnvelope,
}));

vi.mock("@/shared/utils/artwork", () => ({
  extractArtwork: vi.fn().mockResolvedValue({ artwork: null }),
}));

vi.mock("@/shared/utils/audioPlayer", () => ({
  audioPlayer: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    initAudioContext: vi.fn().mockResolvedValue({
      decodeAudioData: vi
        .fn()
        .mockResolvedValue({ getChannelData: () => new Float32Array(0) }),
    }),
    playTrack: vi.fn(),
    stopPlayback: vi.fn(),
    pausePlayback: vi.fn(),
    resumePlayback: vi.fn(),
    seekTo: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    getFrequencyData: vi.fn(),
    getTimeData: vi.fn(),
    cleanup: vi.fn(),
  },
}));

vi.mock("@/shared/utils/toast", () => ({
  conditionalToast: { success: vi.fn(), error: vi.fn() },
}));

import { useAudioFile } from "../useAudioFile";
describe("useAudioFile", () => {
  beforeEach(() => {
    state.playlist = [];
    state.currentTrack = null;
    addToPlaylist.mockClear();
    setCurrentTrack.mockClear();
    updateTrack.mockClear();
    extractMetadata.mockClear();
    (localStorage.getItem as any).mockReset();
    (localStorage.setItem as any).mockReset();
    (audioPlayer.initAudioContext as any).mockResolvedValue({
      decodeAudioData: vi.fn().mockResolvedValue({
        getChannelData: () => new Float32Array(0),
      }),
    });
  });

  it("adds placeholder and updates track asynchronously", async () => {
    const file = new File(["data"], "track.mp3", { type: "audio/mpeg" });
    (file as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    const { result } = renderHook(() => useAudioFile());
    let placeholder: any;
    await act(async () => {
      placeholder = await result.current.loadAudioFile(file);
    });
    expect(addToPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({ isLoading: true }),
    );
    await waitFor(() =>
      expect(updateTrack).toHaveBeenCalledWith(
        placeholder.id,
        expect.objectContaining({ isLoading: false }),
      ),
    );
  });

  it("uses cached metadata and skips extractMetadata", async () => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode("data").buffer;
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const cacheKey = `audio-metadata-${hash}`;
    const store: Record<string, string> = {
      [cacheKey]: JSON.stringify({
        metadata: {
          title: "cached",
          artist: "artist",
          album: "album",
          duration: 1,
          sample_rate: 44100,
        },
        artwork: null,
      }),
    };
    (localStorage.getItem as any).mockImplementation(
      (key) => store[key] || null,
    );
    (localStorage.setItem as any).mockImplementation((key, val) => {
      store[key] = val;
    });

    const file = new File(["data"], "track.mp3", { type: "audio/mpeg" });
    (file as any).arrayBuffer = vi.fn().mockResolvedValue(buffer);

    const { result } = renderHook(() => useAudioFile());
    await act(async () => {
      await result.current.loadAudioFile(file);
    });

    await waitFor(() => expect(updateTrack).toHaveBeenCalled());

    expect(localStorage.getItem).toHaveBeenCalledWith(cacheKey);
    expect(extractMetadata).not.toHaveBeenCalled();
    expect(updateTrack).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        metadata: expect.objectContaining({ title: "cached" }),
      }),
    );
  });

  // Ensures that any object URLs created for audio playback are revoked
  // when the hook unmounts, preventing resource leaks.
  it("revokes object URLs on unmount", async () => {
    const file = new File(["data"], "track.mp3", { type: "audio/mpeg" });
    (file as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL as any;
    global.URL.revokeObjectURL = revokeObjectURL as any;

    const { result, unmount } = renderHook(() => useAudioFile());
    await act(async () => {
      await result.current.loadAudioFile(file);
    });
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  // Verifies that an error while reading the file's binary data
  // surfaces through the hook's error state.
  it("reports error when arrayBuffer fails", async () => {
    const file = new File(["data"], "bad.mp3", { type: "audio/mpeg" });
    (file as any).arrayBuffer = vi
      .fn()
      .mockRejectedValue(new Error("read fail"));

    const { result } = renderHook(() => useAudioFile());
    await act(async () => {
      await result.current.loadAudioFile(file);
    });

    await waitFor(() => expect(result.current.error).toBe("read fail"));
    await waitFor(() =>
      expect(updateTrack).toHaveBeenCalledWith(expect.any(String), {
        isLoading: false,
      }),
    );
  });

  // Confirms that decodeAudioData failures are propagated and exposed
  // to consumers via the error state.
  it("reports error when decoding fails", async () => {
    const file = new File(["data"], "track.mp3", { type: "audio/mpeg" });
    (file as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const decodeAudioData = vi.fn().mockRejectedValue(new Error("boom"));
    (audioPlayer.initAudioContext as any).mockResolvedValue({
      decodeAudioData,
    });

    const { result } = renderHook(() => useAudioFile());
    await act(async () => {
      await result.current.loadAudioFile(file);
    });

    await waitFor(() =>
      expect(result.current.error).toBe("Failed to decode audio data"),
    );
    await waitFor(() =>
      expect(updateTrack).toHaveBeenCalledWith(expect.any(String), {
        isLoading: false,
      }),
    );
  });
});
