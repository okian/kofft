import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../../App";

// Mock the audio hooks
vi.mock("../../hooks/useAudioFile", () => ({
  useAudioFile: () => ({
    isLoading: false,
    error: null,
    loadAudioFiles: vi.fn(),
    playTrack: vi.fn(),
    stopPlayback: vi.fn(),
    pausePlayback: vi.fn(),
    resumePlayback: vi.fn(),
    seekTo: vi.fn(),
    setAudioVolume: vi.fn(),
    toggleMute: vi.fn(),
    getFrequencyData: vi.fn(() => new Uint8Array(1024)),
    getTimeData: vi.fn(() => new Uint8Array(1024)),
    cleanup: vi.fn(),
    initAudioContext: vi.fn(),
  }),
}));

vi.mock("../../hooks/useMicrophone", () => ({
  useMicrophone: () => ({
    isInitialized: false,
    isRequestingPermission: false,
    error: null,
    startMicrophone: vi.fn(),
    stopMicrophone: vi.fn(),
    toggleMicrophone: vi.fn(),
    getInputDevices: vi.fn(),
    switchInputDevice: vi.fn(),
    getFrequencyData: vi.fn(() => new Uint8Array(1024)),
    getTimeData: vi.fn(() => new Uint8Array(1024)),
    startAnalysis: vi.fn(),
    stopAnalysis: vi.fn(),
    getInputLevel: vi.fn(),
    initAudioContext: vi.fn(),
  }),
}));

vi.mock("../../hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("../../hooks/useScreenSize", () => ({
  useScreenSize: () => ({ isMobile: false, isTablet: false }),
}));

// Mock the stores
vi.mock("../../stores/audioStore", () => ({
  useAudioStore: () => ({
    isPlaying: false,
    isPaused: false,
    isStopped: true,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    currentTrack: null,
    playlist: [],
    currentTrackIndex: -1,
    isLive: false,
    isMicrophoneActive: false,
    inputDevice: null,
    shuffle: false,
    loopMode: "off",
    setShuffle: vi.fn(),
    setLoopMode: vi.fn(),
    addToPlaylist: vi.fn(),
    setCurrentTrack: vi.fn(),
    setPlaying: vi.fn(),
    setPaused: vi.fn(),
    setStopped: vi.fn(),
    setCurrentTime: vi.fn(),
    setDuration: vi.fn(),
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setLive: vi.fn(),
    setMicrophoneActive: vi.fn(),
    setInputDevice: vi.fn(),
    nextTrack: vi.fn(),
    previousTrack: vi.fn(),
    playTrack: vi.fn(),
    stopPlayback: vi.fn(),
    togglePlayPause: vi.fn(),
    toggleMute: vi.fn(),
    seekTo: vi.fn(),
    updateVolume: vi.fn(),
  }),
}));

vi.mock("../../stores/uiStore", () => ({
  useUIStore: () => ({
    metadataPanelOpen: false,
    playlistPanelOpen: false,
    settingsPanelOpen: false,
    isFullscreen: false,
    isMobile: false,
    isTablet: false,
    shortcutsHelpOpen: false,
    setMetadataPanelOpen: vi.fn(),
    setPlaylistPanelOpen: vi.fn(),
    setSettingsPanelOpen: vi.fn(),
    setShortcutsHelpOpen: vi.fn(),
    setFullscreen: vi.fn(),
    setMobile: vi.fn(),
    setTablet: vi.fn(),
    toggleMetadataPanel: vi.fn(),
    togglePlaylistPanel: vi.fn(),
    toggleSettingsPanel: vi.fn(),
    toggleShortcutsHelp: vi.fn(),
    closeAllPanels: vi.fn(),
    updateScreenSize: vi.fn(),
  }),
}));

vi.mock("../../stores/settingsStore", () => ({
  useSettingsStore: () => ({
    theme: "dark",
    amplitudeScale: "db",
    frequencyScale: "logarithmic",
    resolution: "medium",
    refreshRate: 60,
    colormap: "viridis",
    showLegend: true,
    setTheme: vi.fn(),
    setAmplitudeScale: vi.fn(),
    setFrequencyScale: vi.fn(),
    setResolution: vi.fn(),
    setRefreshRate: vi.fn(),
    setColormap: vi.fn(),
    setShowLegend: vi.fn(),
    updateSettings: vi.fn(),
    resetToDefaults: vi.fn(),
    loadFromStorage: vi.fn(),
    saveToStorage: vi.fn(),
  }),
}));

describe("PlaybackControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render playback controls", async () => {
    render(<App />);

    // Check that playback controls are present
    expect(screen.getByTestId("play-pause-button")).toBeInTheDocument();
    expect(screen.getByTestId("stop-button")).toBeInTheDocument();
    expect(screen.getByTestId("previous-track-button")).toBeInTheDocument();
    expect(screen.getByTestId("next-track-button")).toBeInTheDocument();
    expect(screen.getByTestId("volume-slider")).toBeInTheDocument();
    expect(screen.getByTestId("mute-button")).toBeInTheDocument();
  });

  it("should show time display", async () => {
    render(<App />);

    // Check that time display is present
    expect(screen.getByTestId("current-time")).toBeInTheDocument();
    expect(screen.getByTestId("total-duration")).toBeInTheDocument();
  });

  it("should show progress bar", async () => {
    render(<App />);

    // Check that progress bar is present
    expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
    expect(screen.getByTestId("progress-fill")).toBeInTheDocument();
  });
});
