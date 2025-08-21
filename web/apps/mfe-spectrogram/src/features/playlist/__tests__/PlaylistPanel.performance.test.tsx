// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, vi, beforeEach } from "vitest";
import { PlaylistPanel } from "../PlaylistPanel";
import { useSettingsStore } from "@/shared/stores/settingsStore";

// Minimal motion and file helpers to isolate playlist logic during tests.
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: (props: any) => <div {...props} /> },
}));

vi.mock("@/shared/hooks/useAudioFile", () => ({
  useAudioFile: () => ({ loadAudioFiles: vi.fn() }),
}));

vi.mock("@/shared/utils/file", () => ({
  getFilesFromDataTransfer: async () => [],
}));

/** Dummy store setter spied by tests to ensure sanitisation and throttling. */
const setSearchQuery = vi.fn();

/** Delay used for throttling search input within the component. */
const THROTTLE_MS = 200;
/** Maximum accepted search query length in the component. */
const MAX_LEN = 100;

vi.mock("@/shared/stores/playlistSearchStore", () => ({
  usePlaylistSearchStore: () => ({ searchQuery: "", setSearchQuery }),
}));

/** Creates a large playlist of synthetic tracks for stress testing. */
function createTracks(count: number) {
  const file = new File([""], "track.mp3");
  return Array.from({ length: count }, (_, i) => ({
    id: `${i}`,
    file,
    metadata: {},
    duration: 0,
    url: "",
  }));
}

describe("PlaylistPanel performance characteristics", () => {
  beforeEach(() => {
    setSearchQuery.mockClear();
    useSettingsStore.getState().resetToDefaults();
  });

  const baseProps = {
    currentTrackIndex: 0,
    isOpen: true,
    onClose: () => {},
    onTrackSelect: () => {},
    onTrackRemove: () => {},
    onTrackReorder: () => {},
  };

  it("virtualises thousands of tracks to avoid DOM bloat", () => {
    const tracks = createTracks(5000);
    render(<PlaylistPanel {...baseProps} tracks={tracks} />);
    const rendered = screen.getAllByTestId("playlist-item");
    expect(rendered.length).toBeLessThan(50);
  });

  it("throttles and sanitises search input before hitting the store", () => {
    vi.useFakeTimers();
    render(<PlaylistPanel {...baseProps} tracks={[]} />);
    const input = screen.getByTestId("playlist-search-input") as HTMLInputElement;

    // Long but safe query should be truncated to the allowed length.
    const longQuery = "a".repeat(150);
    fireEvent.change(input, { target: { value: longQuery } });
    vi.advanceTimersByTime(THROTTLE_MS);
    expect(setSearchQuery).toHaveBeenCalledWith("a".repeat(MAX_LEN));

    // Unsafe characters should prevent store updates.
    setSearchQuery.mockClear();
    fireEvent.change(input, { target: { value: "bad<>" } });
    vi.advanceTimersByTime(THROTTLE_MS);
    expect(setSearchQuery).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

