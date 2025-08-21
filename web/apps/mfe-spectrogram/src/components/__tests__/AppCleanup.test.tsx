import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

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
    playlistPanelOpen: false,
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
    theme: "japanese-a-dark",
    updateSettings: vi.fn(),
    loadFromStorage: vi.fn(),
  }),
}));

// Mock unified keyboard shortcut hook to prevent real listeners during tests
vi.mock("@shared/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("../../hooks/useScreenSize", () => ({
  useScreenSize: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock("@/shared/utils/wasm", () => ({
  initWASM: vi.fn(async () => ({})),
  extractMetadata: vi.fn().mockResolvedValue({}),
  generateAmplitudeEnvelope: vi.fn().mockResolvedValue(new Float32Array()),
}));

vi.mock("@/shared/utils/audioPlayer", () => ({
  audioPlayer: {
    cleanup: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    onTrackEnd: vi.fn(() => () => {}),
  },
}));

import App from "../../App";
import { audioPlayer } from "@/shared/utils/audioPlayer";

describe("App cleanup", () => {
  it("cleans up audio resources on unmount", () => {
    const { unmount } = render(<App />);
    unmount();
    expect(audioPlayer.cleanup).toHaveBeenCalled();
  });
});
