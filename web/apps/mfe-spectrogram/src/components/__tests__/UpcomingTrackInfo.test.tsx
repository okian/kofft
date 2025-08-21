import { render, screen } from "@testing-library/react";
import { describe, it, beforeEach } from "vitest";
import { Footer } from "../layout/Footer";
import { vi } from "vitest";

const mockState: any = {
  isPlaying: true,
  isStopped: false,
  currentTime: 0,
  duration: 60,
  volume: 1,
  isMuted: false,
  currentTrack: null,
  playlist: [],
  currentTrackIndex: 0,
  shuffle: false,
  loopMode: "off",
  setShuffle: vi.fn(),
  setLoopMode: vi.fn(),
  nextTrack: vi.fn(),
  previousTrack: vi.fn(),
};

vi.mock("../../shared/stores/audioStore", () => ({
  useAudioStore: () => mockState,
}));

vi.mock("../../hooks/useAudioFile", () => ({
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

vi.mock("../../hooks/useScreenSize", () => ({
  useScreenSize: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock("../../components/spectrogram/CanvasWaveformSeekbar", () => ({
  CanvasWaveformSeekbar: () => <div data-testid="seekbar" />,
}));

describe("Upcoming track info", () => {
  beforeEach(() => {
    mockState.currentTime = 55;
    mockState.duration = 60;
  });

  const createTrack = (
    id: string,
    title: string,
    artist: string,
    album: string,
  ) => {
    const file = new File([""], `${title}.mp3`, { type: "audio/mpeg" });
    return {
      id,
      file,
      metadata: { title, artist, album },
      duration: 60,
      url: id,
    };
  };

  const setupPlaylist = (track1: any, track2: any) => {
    mockState.currentTrack = track1;
    mockState.playlist = [track1, track2];
    mockState.currentTrackIndex = 0;
  };

  it("shows song when upcoming track has same artist and album", () => {
    const track1 = createTrack("1", "Track 1", "Artist", "Album");
    const track2 = createTrack("2", "Track 2", "Artist", "Album");
    setupPlaylist(track1, track2);
    render(<Footer />);
    expect(screen.getByTestId("upcoming-track-info")).toHaveTextContent(
      "Coming up: Track 2",
    );
  });

  it("shows song and album when same artist different album", () => {
    const track1 = createTrack("1", "Track 1", "Artist", "Album 1");
    const track2 = createTrack("2", "Track 2", "Artist", "Album 2");
    setupPlaylist(track1, track2);
    render(<Footer />);
    expect(screen.getByTestId("upcoming-track-info")).toHaveTextContent(
      "Coming up: Track 2 from Album 2",
    );
  });

  it("shows song and artist when different artist", () => {
    const track1 = createTrack("1", "Track 1", "Artist 1", "Album 1");
    const track2 = createTrack("2", "Track 2", "Artist 2", "Album 2");
    setupPlaylist(track1, track2);
    render(<Footer />);
    expect(screen.getByTestId("upcoming-track-info")).toHaveTextContent(
      "Coming up: Track 2 by Artist 2",
    );
  });

  it("shows only song when title matches upcoming artist", () => {
    const track1 = createTrack("1", "Track 1", "Artist 1", "Album 1");
    const track2 = createTrack(
      "2",
      "Black Sabbath",
      "Black Sabbath",
      "Album 2",
    );
    setupPlaylist(track1, track2);
    render(<Footer />);
    expect(screen.getByTestId("upcoming-track-info")).toHaveTextContent(
      "Coming up: Black Sabbath",
    );
  });

  it("shows only song when title matches upcoming album", () => {
    const track1 = createTrack("1", "Track 1", "Artist", "Album 1");
    const track2 = createTrack("2", "Album 2", "Artist", "Album 2");
    setupPlaylist(track1, track2);
    render(<Footer />);
    expect(screen.getByTestId("upcoming-track-info")).toHaveTextContent(
      "Coming up: Album 2",
    );
  });

  it("ignores case and whitespace differences", () => {
    const track1 = createTrack("1", "Track 1", "Artist", "Album");
    const track2 = createTrack("2", "Track 2", " artist ", " album ");
    setupPlaylist(track1, track2);
    render(<Footer />);
    expect(screen.getByTestId("upcoming-track-info")).toHaveTextContent(
      "Coming up: Track 2",
    );
  });

  it("normalizes album variants", () => {
    const track1 = createTrack("1", "Track 1", "Artist", "Album");
    const track2 = createTrack(
      "2",
      "Track 2",
      "Artist",
      "Album (Deluxe Edition)",
    );
    setupPlaylist(track1, track2);
    render(<Footer />);
    expect(screen.getByTestId("upcoming-track-info")).toHaveTextContent(
      "Coming up: Track 2",
    );
  });

  it("falls back to album when artist missing", () => {
    const track1 = createTrack("1", "Track 1", "Artist", "Album 1");
    const track2 = {
      ...createTrack("2", "Track 2", "", "Album 2"),
      metadata: { title: "Track 2", artist: "", album: "Album 2" },
    };
    setupPlaylist(track1, track2);
    render(<Footer />);
    expect(screen.getByTestId("upcoming-track-info")).toHaveTextContent(
      "Coming up: Track 2 from Album 2",
    );
  });

  it("falls back to song when album missing", () => {
    const track1 = createTrack("1", "Track 1", "Artist", "Album 1");
    const track2 = {
      ...createTrack("2", "Track 2", "Artist", ""),
      metadata: { title: "Track 2", artist: "Artist", album: "" },
    };
    setupPlaylist(track1, track2);
    render(<Footer />);
    expect(screen.getByTestId("upcoming-track-info")).toHaveTextContent(
      "Coming up: Track 2",
    );
  });

  it("shows alternating info when not near end", () => {
    const track1 = createTrack("1", "Track 1", "Artist 1", "Album 1");
    const track2 = createTrack("2", "Track 2", "Artist 2", "Album 2");
    setupPlaylist(track1, track2);
    mockState.currentTime = 30;
    render(<Footer />);
    expect(screen.queryByTestId("upcoming-track-info")).toBeNull();
    expect(screen.getByTestId("alternating-info-text")).toHaveTextContent(
      "Artist 1",
    );
  });
});
