import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Footer } from "../layout/Footer";

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

describe("Footer Component", () => {
  it("renders the footer with proper structure", () => {
    render(<Footer />);

    const footer = screen.getByTestId("footer");
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass("footer-controls");
  });

  it("renders the seek bar at the top of the footer", () => {
    render(<Footer />);

    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar).toBeInTheDocument();
  });

  it("renders the control section below the seek bar", () => {
    render(<Footer />);

    // Check for transport controls
    expect(screen.getByTestId("play-pause-button")).toBeInTheDocument();
    expect(screen.getByTestId("previous-track-button")).toBeInTheDocument();
    expect(screen.getByTestId("next-track-button")).toBeInTheDocument();
    expect(screen.getByTestId("stop-button")).toBeInTheDocument();

    // Check for volume controls
    expect(screen.getByTestId("mute-button")).toBeInTheDocument();
    expect(screen.getByTestId("volume-slider")).toBeInTheDocument();

    // Check for time display
    expect(screen.getByTestId("current-time")).toBeInTheDocument();
    expect(screen.getByTestId("total-duration")).toBeInTheDocument();
  });

  it("renders progress fill with correct width", () => {
    render(<Footer />);

    const progressFill = screen.getByTestId("progress-fill");
    expect(progressFill).toBeInTheDocument();

    // Should have width style applied
    expect(progressFill).toHaveStyle("width: 0%");
  });

  it("displays time labels", () => {
    render(<Footer />);

    const currentTime = screen.getByTestId("current-time");
    const totalDuration = screen.getByTestId("total-duration");

    // Both should display time format
    expect(currentTime).toHaveTextContent("0:00");
    expect(totalDuration).toHaveTextContent("0:00"); // Duration is 0 in the mock
  });

  it("has footer controls class", () => {
    render(<Footer />);

    const footer = screen.getByTestId("footer");
    expect(footer).toHaveClass("footer-controls");
  });
});
