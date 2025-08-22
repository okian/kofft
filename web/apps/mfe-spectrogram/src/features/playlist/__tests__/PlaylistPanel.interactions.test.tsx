// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PlaylistPanel } from "../PlaylistPanel";
import type { AudioTrack } from "@/shared/types";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  motion: { div: (props: any) => <div {...props} /> },
}));

vi.mock("@/shared/hooks/useAudioFile", () => ({
  useAudioFile: () => ({ loadAudioFiles: vi.fn() }),
}));

vi.mock("@/shared/utils/file", () => ({
  getFilesFromDataTransfer: async () => [],
}));

vi.mock("@/shared/stores/playlistSearchStore", () => ({
  usePlaylistSearchStore: () => ({
    searchQuery: "",
    setSearchQuery: vi.fn(),
    suggestions: [],
    hasMoreSuggestions: false,
    moreCount: 0,
  }),
}));

vi.mock("@/shared/utils/wasm", () => ({}), { virtual: true });

vi.mock("@/shared/utils/fuzzy", () => ({
  fuzzyMatch: async () => true,
  fuzzyScore: async () => 0,
}));

/**
 * Creates a minimal audio track fixture for testing playlist behaviour.
 * Using a factory avoids duplicate logic and keeps tests focused on intent.
 */
function createTrack(id: number): AudioTrack {
  const file = new File([""], `track${id}.mp3`, { type: "audio/mpeg" });
  return {
    id: String(id),
    file,
    metadata: { title: `Track ${id}`, artist: "", album: "" },
    duration: 0,
    url: "",
  };
}

/**
 * Local test harness wrapping the PlaylistPanel with stateful logic.
 * This simulates typical user interactions without touching the real store.
 */
function PlaylistHarness() {
  /** Playlist tracks managed locally to observe UI changes. */
  const [tracks, setTracks] = useState<AudioTrack[]>([
    createTrack(1),
    createTrack(2),
    createTrack(3),
  ]);
  /** Index of the currently selected track. */
  const [currentIndex, setCurrentIndex] = useState(0);

  /** Select a track by index. */
  const handleSelect = (index: number): void => {
    setCurrentIndex(index);
  };

  /** Remove a track and adjust the current index accordingly. */
  const handleRemove = (index: number): void => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
    setCurrentIndex((prev) =>
      prev > index ? prev - 1 : Math.min(prev, tracks.length - 2),
    );
  };

  /** Reorder tracks while keeping the current index in sync. */
  const handleReorder = (from: number, to: number): void => {
    setTracks((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setCurrentIndex((prev) => {
      if (prev === from) return to;
      if (from < prev && prev <= to) return prev - 1;
      if (to <= prev && prev < from) return prev + 1;
      return prev;
    });
  };

  /** Move to the next track, clamping at the end of the playlist. */
  const handleNext = (): void => {
    setCurrentIndex((i) => Math.min(i + 1, tracks.length - 1));
  };

  /** Move to the previous track, clamping at the start of the playlist. */
  const handlePrev = (): void => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  return (
    <div>
      <PlaylistPanel
        tracks={tracks}
        currentTrackIndex={currentIndex}
        isOpen={true}
        onClose={() => {}}
        onTrackSelect={handleSelect}
        onTrackRemove={handleRemove}
        onTrackReorder={handleReorder}
      />
      <button data-testid="next-button" onClick={handleNext}>
        Next
      </button>
      <button data-testid="prev-button" onClick={handlePrev}>
        Prev
      </button>
      <button data-testid="swap-button" onClick={() => handleReorder(1, 0)}>
        Swap
      </button>
    </div>
  );
}

/** Verify that playlist interactions update UI state and track selection. */
describe("PlaylistPanel interactions", () => {
  it("handles removal, reordering, and navigation", () => {
    render(<PlaylistHarness />);

    // Initial load of three tracks
    let items = screen.getAllByTestId("playlist-item");
    expect(items).toHaveLength(3);

    // Remove the second track
    const removeBtn = within(items[1]).getByTitle("Remove from playlist");
    fireEvent.click(removeBtn);
    items = screen.getAllByTestId("playlist-item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Track 1");
    expect(items[1].textContent).toContain("Track 3");

    // Reorder: move Track 3 before Track 1 via button
    fireEvent.click(screen.getByTestId("swap-button"));
    items = screen.getAllByTestId("playlist-item");
    expect(items[0].textContent).toContain("Track 3");
    expect(items[1].textContent).toContain("Track 1");

    // Navigate to next track and verify highlight
    fireEvent.click(screen.getByTestId("next-button"));
    items = screen.getAllByTestId("playlist-item");
    expect(within(items[1]).getByText("Track 1").className).toContain(
      "text-accent-blue",
    );

    // Navigate back to previous track
    fireEvent.click(screen.getByTestId("prev-button"));
    items = screen.getAllByTestId("playlist-item");
    expect(within(items[0]).getByText("Track 3").className).toContain(
      "text-accent-blue",
    );
  });
});
