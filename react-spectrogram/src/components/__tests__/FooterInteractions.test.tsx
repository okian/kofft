import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Footer } from "../layout/Footer";
import type { AudioTrack } from "@/types";

interface MockState {
  isPlaying: boolean;
  isStopped: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  currentTrack: AudioTrack | null;
  playlist: AudioTrack[];
  currentTrackIndex: number;
  shuffle: boolean;
  loopMode: "off" | "one" | "all";
  setShuffle: (v: boolean) => void;
  setLoopMode: (v: "off" | "one" | "all") => void;
  nextTrack: () => void;
  previousTrack: () => void;
}

const mockState: MockState = {
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

const audioFileMock = {
  playTrack: vi.fn(),
  pausePlayback: vi.fn(),
  resumePlayback: vi.fn(),
  stopPlayback: vi.fn(),
  seekTo: vi.fn(),
  setAudioVolume: vi.fn(),
  toggleMute: vi.fn(),
};

vi.mock("../../../hooks/useAudioFile", () => ({
  useAudioFile: () => audioFileMock,
}));

vi.mock("../../../hooks/useScreenSize", () => ({
  useScreenSize: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock("@/components/spectrogram/CanvasWaveformSeekbar", () => ({
  CanvasWaveformSeekbar: ({ onSeek }: { onSeek: (time: number) => void }) => (
    <div data-testid="progress-bar" onClick={() => onSeek(30)} />
  ),
}));

describe("Footer interactions", () => {
  it("resumes playback when seeking while paused", async () => {
    const user = userEvent.setup();
    mockState.isPlaying = false;
    mockState.isStopped = false;
    const track: AudioTrack = {
      id: "1",
      file: new File([], "track.mp3"),
      metadata: { title: "t", artist: "a", album: "b", format: "mp3" },
      duration: 100,
      url: "",
      waveform: [],
    };
    mockState.currentTrack = track;
    render(<Footer />);

    await user.click(screen.getByTestId("progress-bar"));

    expect(audioFileMock.seekTo).toHaveBeenCalledWith(30);
    expect(audioFileMock.resumePlayback).toHaveBeenCalled();
    expect(audioFileMock.playTrack).not.toHaveBeenCalled();
  });
});
