import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "../../App";

// Mock the stores and hooks
vi.mock("../../stores/audioStore", () => ({
  useAudioStore: () => ({
    currentTrack: null,
    playlist: [],
    currentTrackIndex: -1,
    playTrack: vi.fn(),
    removeFromPlaylist: vi.fn(),
    reorderPlaylist: vi.fn(),
    isPlaying: false,
    isStopped: true,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isLive: false,
    isMicrophoneActive: false,
    shuffle: false,
    loopMode: "off",
    setShuffle: vi.fn(),
    setLoopMode: vi.fn(),
    nextTrack: vi.fn(),
    previousTrack: vi.fn(),
  }),
}));

vi.mock("../../stores/uiStore", () => ({
  useUIStore: () => ({
    isMobile: false,
    metadataPanelOpen: false,
    playlistPanelOpen: true, // Playlist should be visible by default
    settingsPanelOpen: false,
    shortcutsHelpOpen: false,
    setMetadataPanelOpen: vi.fn(),
    setPlaylistPanelOpen: vi.fn(),
    setSettingsPanelOpen: vi.fn(),
    setShortcutsHelpOpen: vi.fn(),
    toggleShortcutsHelp: vi.fn(),
  }),
}));

vi.mock("../../stores/settingsStore", () => ({
  useSettingsStore: () => ({
    theme: "dark",
    updateSettings: vi.fn(),
  }),
}));

// Mock unified keyboard shortcut hook to prevent real listeners during tests
vi.mock("../../shared/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("../../hooks/useScreenSize", () => ({
  useScreenSize: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock("../../utils/wasm", () => ({
  initWASM: vi.fn(async () => ({})),
}));

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(screen.getByTestId("app-container")).toBeInTheDocument();
  });

  it("renders header with app title", () => {
    render(<App />);
    expect(screen.getByText("Spectrogram")).toBeInTheDocument();
  });

  it("renders footer with controls", () => {
    render(<App />);
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    expect(screen.getByTestId("play-pause-button")).toBeInTheDocument();
  });

  it("renders spectrogram view", () => {
    render(<App />);
    expect(screen.getByTestId("spectrogram-view")).toBeInTheDocument();
  });

  it("shows drop zone when no track is loaded", () => {
    render(<App />);
    expect(screen.getByTestId("drop-zone")).toBeInTheDocument();
    expect(screen.getByText("Drop audio files here")).toBeInTheDocument();
  });

  it("preserves existing body classes when applying theme", () => {
    document.body.className = "keep-me";
    render(<App />);
    expect(document.body.classList.contains("keep-me")).toBe(true);
    expect(document.body.classList.contains("theme-dark")).toBe(true);
  });
});
