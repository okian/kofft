import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Footer } from "../layout/Footer";

const mockState: any = {
  isPlaying: false,
  isStopped: true,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  currentTrack: null,
  playlist: [],
  currentTrackIndex: -1,
  shuffle: false,
  loopMode: "off" as const,
  setShuffle: vi.fn((v: boolean) => {
    mockState.shuffle = v;
  }),
  setLoopMode: vi.fn((v: "off" | "one" | "all") => {
    mockState.loopMode = v;
  }),
  nextTrack: vi.fn(),
  previousTrack: vi.fn(),
};

vi.mock("../../../stores/audioStore", () => ({
  useAudioStore: () => mockState,
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

vi.mock("../../../hooks/useScreenSize", () => ({
  useScreenSize: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock("../../../components/spectrogram/CanvasWaveformSeekbar", () => ({
  CanvasWaveformSeekbar: () => <div data-testid="seekbar" />,
}));

describe("Footer interactions", () => {
  it("toggles shuffle and loop mode", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Footer />);

    const shuffleBtn = screen.getByTestId("shuffle-button");
    await user.click(shuffleBtn);
    expect(mockState.setShuffle).toHaveBeenCalledWith(true);
    mockState.shuffle = true;
    rerender(<Footer />);
    expect(shuffleBtn).toHaveClass("bg-neutral-700");

    const repeatBtn = screen.getByTestId("repeat-button");
    await user.click(repeatBtn);
    expect(mockState.setLoopMode).toHaveBeenCalledWith("all");
    mockState.loopMode = "all";
    rerender(<Footer />);
    expect(repeatBtn).toHaveClass("bg-neutral-700");
  });
});
