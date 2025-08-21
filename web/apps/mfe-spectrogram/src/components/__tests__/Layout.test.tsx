import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "../../App";

// Mock the stores and hooks
vi.mock("@/shared/stores/audioStore", () => ({
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

vi.mock("@/shared/stores/uiStore", () => ({
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

vi.mock("@/shared/stores/settingsStore", () => ({
  useSettingsStore: () => ({
    theme: "dark",
    updateSettings: vi.fn(),
  }),
}));

// Mock unified keyboard shortcut hook to prevent real listeners during tests
vi.mock("@/shared/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("@/shared/hooks/useScreenSize", () => ({
  useScreenSize: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock("@/shared/hooks/useAudioFile", () => ({
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

vi.mock("@/shared/utils/wasm", () => ({
  initWASM: vi.fn().mockResolvedValue({}),
}));

describe("Layout System", () => {
  it("renders the app with proper layout structure", () => {
    render(<App />);

    // Check that the main app container has the correct layout class
    const appContainer = screen.getByTestId("app-container");
    expect(appContainer).toHaveClass("app-layout");
  });

  it("renders the header", () => {
    render(<App />);

    const header = screen.getByTestId("header");
    expect(header).toBeInTheDocument();
  });

  it("renders the footer controls with proper height", () => {
    render(<App />);

    const footer = screen.getByTestId("footer");
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass("footer-controls");
  });

  it("renders the spectrogram view", () => {
    render(<App />);

    const spectrogramView = screen.getByTestId("spectrogram-view");
    expect(spectrogramView).toBeInTheDocument();
  });

  it("renders the playlist panel by default", () => {
    render(<App />);

    // The playlist panel should be visible by default
    const playlistPanel = screen.getByTestId("playlist-panel");
    expect(playlistPanel).toBeInTheDocument();
  });

  it("does not render metadata panel by default", () => {
    render(<App />);

    // The metadata panel should not be visible by default
    const metadataPanel = screen.queryByTestId("metadata-panel");
    expect(metadataPanel).not.toBeInTheDocument();
  });

  it("renders transport controls in footer", () => {
    render(<App />);

    // Check for transport control buttons
    expect(screen.getByTestId("play-pause-button")).toBeInTheDocument();
    expect(screen.getByTestId("previous-track-button")).toBeInTheDocument();
    expect(screen.getByTestId("next-track-button")).toBeInTheDocument();
    expect(screen.getByTestId("stop-button")).toBeInTheDocument();
  });

  it("renders volume controls in footer", () => {
    render(<App />);

    // Check for volume controls
    expect(screen.getByTestId("mute-button")).toBeInTheDocument();
    expect(screen.getByTestId("volume-slider")).toBeInTheDocument();
  });

  it("renders progress bar in footer", () => {
    render(<App />);

    // Check for progress bar
    expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
    expect(screen.getByTestId("progress-fill")).toBeInTheDocument();
  });

  it("renders time display in footer", () => {
    render(<App />);

    // Check for time display
    expect(screen.getByTestId("current-time")).toBeInTheDocument();
    expect(screen.getByTestId("total-duration")).toBeInTheDocument();
  });
});
