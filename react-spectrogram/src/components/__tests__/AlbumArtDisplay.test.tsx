import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlaylistPanel } from "../layout/PlaylistPanel";
import { Footer } from "../layout/Footer";
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

describe("Album Art Display - Complete Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue("blob:mock-url");
  });

  it("should display album art in playlist when available", () => {
    // Create a mock track with album art
    const mockTrack: AudioTrack = {
      id: "1",
      file: new File(["test"], "test-song.mp3", { type: "audio/mp3" }),
      metadata: {
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        album_art: new Uint8Array([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
        ]), // JPEG header
        album_art_mime: "image/jpeg",
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
    expect(albumArt).toHaveAttribute("src", "blob:mock-url");
  });

  it("should display fallback icon when no album art is available", () => {
    // Create a mock track without album art
    const mockTrack: AudioTrack = {
      id: "1",
      file: new File(["test"], "test-song.mp3", { type: "audio/mp3" }),
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

  it("should display album art in footer when current track has album art", () => {
    // Create a mock track with album art
    const mockTrack: AudioTrack = {
      id: "1",
      file: new File(["test"], "test-song.mp3", { type: "audio/mp3" }),
      metadata: {
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        album_art: new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]), // PNG header
        album_art_mime: "image/png",
        duration: 180,
        format: "mp3",
      },
      duration: 180,
      url: "blob:test",
    };

    // Mock the store to return the track as current track
    vi.mocked(
      require("../../../stores/audioStore").useAudioStore,
    ).mockReturnValue({
      isPlaying: false,
      isStopped: true,
      currentTime: 0,
      duration: 120,
      volume: 1,
      isMuted: false,
      currentTrack: mockTrack,
      playlist: [mockTrack],
      currentTrackIndex: 0,
      shuffle: false,
      loopMode: "off",
      setShuffle: vi.fn(),
      setLoopMode: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
    });

    render(<Footer />);

    // Check that album art is rendered in footer
    const albumArt = screen.getByAltText("Album Art");
    expect(albumArt).toBeInTheDocument();
    expect(albumArt).toHaveClass("w-12", "h-12", "object-cover", "rounded-lg");
    expect(albumArt).toHaveAttribute("src", "blob:mock-url");
  });

  it("should display fallback icon in footer when current track has no album art", () => {
    // Create a mock track without album art
    const mockTrack: AudioTrack = {
      id: "1",
      file: new File(["test"], "test-song.mp3", { type: "audio/mp3" }),
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

    // Mock the store to return the track as current track
    vi.mocked(
      require("../../../stores/audioStore").useAudioStore,
    ).mockReturnValue({
      isPlaying: false,
      isStopped: true,
      currentTime: 0,
      duration: 120,
      volume: 1,
      isMuted: false,
      currentTrack: mockTrack,
      playlist: [mockTrack],
      currentTrackIndex: 0,
      shuffle: false,
      loopMode: "off",
      setShuffle: vi.fn(),
      setLoopMode: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
    });

    render(<Footer />);

    // Check that fallback icon is rendered in footer
    const fallbackIcon = screen
      .getByTestId("footer")
      .querySelector(".text-neutral-500");
    expect(fallbackIcon).toBeInTheDocument();
  });

  it("should handle different image formats correctly", () => {
    const testCases = [
      {
        mime: "image/jpeg",
        data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
        description: "JPEG",
      },
      {
        mime: "image/png",
        data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        description: "PNG",
      },
      {
        mime: "image/gif",
        data: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]),
        description: "GIF",
      },
    ];

    testCases.forEach(({ mime, data, description: _description }) => {
      const mockTrack: AudioTrack = {
        id: "1",
        file: new File(["test"], "test-song.mp3", { type: "audio/mp3" }),
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
      expect(albumArt).toHaveAttribute("src", "blob:mock-url");

      // Clean up before next iteration
      unmount();
    });
  });

  it("should handle multiple tracks with and without album art", () => {
    const tracks: AudioTrack[] = [
      {
        id: "1",
        file: new File(["test"], "song1.mp3", { type: "audio/mp3" }),
        metadata: {
          title: "Song 1",
          artist: "Artist 1",
          album: "Album 1",
          album_art: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), // Has album art
          album_art_mime: "image/jpeg",
          duration: 180,
          format: "mp3",
        },
        duration: 180,
        url: "blob:test1",
      },
      {
        id: "2",
        file: new File(["test"], "song2.mp3", { type: "audio/mp3" }),
        metadata: {
          title: "Song 2",
          artist: "Artist 2",
          album: "Album 2",
          duration: 200, // No album art
          format: "mp3",
        },
        duration: 200,
        url: "blob:test2",
      },
      {
        id: "3",
        file: new File(["test"], "song3.mp3", { type: "audio/mp3" }),
        metadata: {
          title: "Song 3",
          artist: "Artist 3",
          album: "Album 3",
          album_art: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), // Has album art
          album_art_mime: "image/png",
          duration: 160,
          format: "mp3",
        },
        duration: 160,
        url: "blob:test3",
      },
    ];

    render(
      <PlaylistPanel
        tracks={tracks}
        currentTrackIndex={0}
        isOpen={true}
        onClose={vi.fn()}
        onTrackSelect={vi.fn()}
        onTrackRemove={vi.fn()}
        onTrackReorder={vi.fn()}
      />,
    );

    // Should have 2 album art images and 1 fallback icon
    const albumArtImages = screen.getAllByAltText("Album Art");
    expect(albumArtImages).toHaveLength(2);

    const fallbackIcons = screen
      .getByTestId("playlist-panel")
      .querySelectorAll(".text-neutral-500");
    expect(fallbackIcons.length).toBeGreaterThan(0);
  });
});
