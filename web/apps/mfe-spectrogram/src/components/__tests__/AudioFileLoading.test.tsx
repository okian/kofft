import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../../App";

// Mock the audio hooks
const mockUseAudioFile = vi.fn(() => ({
  isLoading: false,
  error: null as string | null,
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
}));

vi.mock("@/shared/hooks/useAudioFile", () => ({
  useAudioFile: mockUseAudioFile,
}));

vi.mock("@/shared/hooks/useMicrophone", () => ({
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

// Mock unified keyboard shortcut hook to prevent real listeners during tests
vi.mock("@shared/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("@/shared/hooks/useScreenSize", () => ({
  useScreenSize: () => ({ isMobile: false, isTablet: false }),
}));

// Mock the stores
vi.mock("@/shared/stores/audioStore", () => ({
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

vi.mock("@/shared/stores/uiStore", () => ({
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

describe("AudioFileLoading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the app with file loading functionality", async () => {
    render(<App />);

    // Check that the app loads without errors
    expect(screen.getByTestId("app-container")).toBeInTheDocument();

    // Check that the file input is present
    expect(screen.getByTestId("file-input")).toBeInTheDocument();

    // Check that the open file button is present
    expect(screen.getByTestId("open-file-button")).toBeInTheDocument();

    // Check that the drop zone is visible when no file is loaded
    expect(screen.getByTestId("drop-zone")).toBeInTheDocument();
  });

  it("should show loading state when file is being processed", async () => {
    // Mock loading state
    mockUseAudioFile.mockReturnValue({
      isLoading: true,
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
    });

    render(<App />);

    // Check that loading indicator is shown
    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
  });

  it("should handle file loading errors gracefully", async () => {
    // Mock error state
    mockUseAudioFile.mockReturnValue({
      isLoading: false,
      error: "Failed to load audio file",
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
    });

    render(<App />);

    // The app should still render even with errors
    expect(screen.getByTestId("app-container")).toBeInTheDocument();
  });
});
