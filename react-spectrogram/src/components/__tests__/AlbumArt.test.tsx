import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlaylistPanel } from "../layout/PlaylistPanel";
import { AudioTrack } from "@/types";

// Mock the stores and hooks
vi.mock("../../../stores/audioStore", () => ({
  useAudioStore: () => ({
    isPlaying: false,
    isStopped: true,
    currentTime: 0,
    duration: 120,
    volume: 1,
    isMuted: false,
    currentTrack: null,
    playlist: [],
    currentTrackIndex: -1,
    shuffle: false,
    loopMode: "off",
    setShuffle: vi.fn(),
    setLoopMode: vi.fn(),
    nextTrack: vi.fn(),
    previousTrack: vi.fn(),
  }),
}));

vi.mock("../../../hooks/useAudioFile", () => ({
  useAudioFile: () => ({
    playTrack: vi.fn(),
    pausePlayback: vi.fn(),
    resumePlayback: vi.fn(),
    stopPlayback: vi.fn(),
    seekTo: vi.fn(),
    setAudioVolume: vi.fn(),
    toggleMute: vi.fn(),
  }),
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();

Object.defineProperty(global, "URL", {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

describe("Album Art Display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue("blob:mock-url");
  });

  it("should display album art in playlist panel when available", () => {
    const mockTrack: AudioTrack = {
      id: "1",
      file: new File(["test"], "test.mp3", { type: "audio/mp3" }),
      metadata: {
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        album_art: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), // PNG header
        album_art_mime: "image/png",
        duration: 180,
        format: "mp3",
      },
      duration: 180,
      url: "blob:test",
    };

    render(
      <PlaylistPanel
        tracks={[mockTrack]}
        currentTrackIndex={0}
        isOpen={true}
        onClose={vi.fn()}
        onTrackSelect={vi.fn()}
        onTrackRemove={vi.fn()}
        onTrackReorder={vi.fn()}
      />,
    );

    // Check that album art is rendered
    const albumArt = screen.getByAltText("Album Art");
    expect(albumArt).toBeInTheDocument();
    expect(albumArt).toHaveClass("w-10", "h-10", "object-cover", "rounded-md");
  });

  it("should display fallback icon when album art is not available", () => {
    const mockTrack: AudioTrack = {
      id: "1",
      file: new File(["test"], "test.mp3", { type: "audio/mp3" }),
      metadata: {
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        duration: 180,
        format: "mp3",
      },
      duration: 180,
      url: "blob:test",
    };

    render(
      <PlaylistPanel
        tracks={[mockTrack]}
        currentTrackIndex={0}
        isOpen={true}
        onClose={vi.fn()}
        onTrackSelect={vi.fn()}
        onTrackRemove={vi.fn()}
        onTrackReorder={vi.fn()}
      />,
    );

    // Check that fallback icon is rendered
    const fallbackIcon = screen
      .getByTestId("playlist-panel")
      .querySelector(".text-neutral-500");
    expect(fallbackIcon).toBeInTheDocument();
  });

  it("should handle different image formats correctly", () => {
    const testCases = [
      { mime: "image/jpeg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
      { mime: "image/png", data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
      { mime: "image/gif", data: new Uint8Array([0x47, 0x49, 0x46, 0x38]) },
    ];

    testCases.forEach(({ mime, data }) => {
      const mockTrack: AudioTrack = {
        id: "1",
        file: new File(["test"], "test.mp3", { type: "audio/mp3" }),
        metadata: {
          title: "Test Song",
          artist: "Test Artist",
          album: "Test Album",
          album_art: data,
          album_art_mime: mime,
          duration: 180,
          format: "mp3",
        },
        duration: 180,
        url: "blob:test",
      };

      const { unmount } = render(
        <PlaylistPanel
          tracks={[mockTrack]}
          currentTrackIndex={0}
          isOpen={true}
          onClose={vi.fn()}
          onTrackSelect={vi.fn()}
          onTrackRemove={vi.fn()}
          onTrackReorder={vi.fn()}
        />,
      );

      const albumArt = screen.getByAltText("Album Art");
      expect(albumArt).toBeInTheDocument();

      // Clean up before next iteration
      unmount();
    });
  });
});
