// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, vi, beforeEach } from "vitest";
import { PlaylistPanel } from "../PlaylistPanel";
import { useSettingsStore } from "@/shared/stores/settingsStore";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: (props: any) => <div {...props} /> },
}));

// Minimal mocks for hooks used internally.
vi.mock("@/shared/hooks/useAudioFile", () => ({
  useAudioFile: () => ({ loadAudioFiles: vi.fn() }),
}));
vi.mock("@/shared/utils/file", () => ({
  getFilesFromDataTransfer: async () => [],
}));
vi.mock("@/shared/stores/playlistSearchStore", () => ({
  usePlaylistSearchStore: () => ({ searchQuery: "", setSearchQuery: vi.fn(), suggestions: [], hasMoreSuggestions: false, moreCount: 0 }),
}));

describe("PlaylistPanel animation presets", () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  // Bare minimum props to render the panel without external data.
  const minimalProps = {
    tracks: [],
    currentTrackIndex: 0,
    isOpen: true,
    onClose: () => {},
    onTrackSelect: () => {},
    onTrackRemove: () => {},
    onTrackReorder: () => {},
  };

  it("selects presets based on theme", () => {
    render(<PlaylistPanel {...minimalProps} />);
    let panel = screen.getByTestId("playlist-panel");
    expect(panel.getAttribute("data-preset")).toBe("CALM_SLIDE");

    useSettingsStore.getState().setTheme("bauhaus-light");
    render(<PlaylistPanel {...minimalProps} />);
    panel = screen.getAllByTestId("playlist-panel").pop()!;
    expect(panel.getAttribute("data-preset")).toBe("GEOMETRIC_SLIDE");
  });
});

