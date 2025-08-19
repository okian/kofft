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
};

vi.mock("../../stores/audioStore", () => ({
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
    const file1 = new File([""], "track1.mp3", { type: "audio/mpeg" });
    const file2 = new File([""], "track2.mp3", { type: "audio/mpeg" });
    const track1 = {
      id: "1",
      file: file1,
      metadata: { title: "Track 1", artist: "Artist 1", album: "Album 1" },
      duration: 60,
      url: "track1",
    };
    const track2 = {
      id: "2",
      file: file2,
      metadata: { title: "Track 2", artist: "Artist 2", album: "Album 2" },
      duration: 60,
      url: "track2",
    };
    mockState.currentTrack = track1;
    mockState.playlist = [track1, track2];
    mockState.currentTrackIndex = 0;
    mockState.currentTime = 0;
    mockState.duration = 60;
  });

  it("shows next track when within last 10 seconds", () => {
    mockState.currentTime = 55;
    render(<Footer />);
    expect(
      screen.getByText("Coming up: Track 2 by Artist 2"),
    ).toBeInTheDocument();
  });

  it("shows alternating info when not near end", () => {
    mockState.currentTime = 30;
    render(<Footer />);
    expect(screen.queryByText("Coming up: Track 2 by Artist 2")).toBeNull();
    expect(screen.getByTestId("alternating-info-text")).toHaveTextContent(
      "Artist 1",
    );
  });
});
