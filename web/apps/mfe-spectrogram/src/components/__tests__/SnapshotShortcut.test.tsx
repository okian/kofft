import { render, waitFor } from "@testing-library/react";
import { describe, it, beforeEach, expect, vi, Mock } from "vitest";
import React from "react";

// Mock modules that carry heavy dependencies to keep the test lightweight
vi.mock("@/shared/hooks/useAudioFile", () => ({
  useAudioFile: () => ({
    playTrack: vi.fn(),
    pausePlayback: vi.fn(),
    resumePlayback: vi.fn(),
    seekTo: vi.fn(),
    setAudioVolume: vi.fn(),
    toggleMute: vi.fn(),
  }),
}));

vi.mock("@/shared/utils/takeSnapshot", () => ({
  takeSnapshot: vi.fn(),
}));

vi.mock("@/shared/utils/toast", () => ({
  conditionalToast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock WASM utilities to avoid loading heavy modules
vi.mock("@/shared/utils/wasm", () => ({
  extractMetadata: vi.fn(),
  generateAmplitudeEnvelope: vi.fn(),
  resampleAudio: vi.fn(),
}));

vi.mock("@wasm/web_spectrogram", () => ({}));

import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts";
import { conditionalToast } from "@/shared/utils/toast";
import { takeSnapshot } from "@/shared/utils/takeSnapshot";

/** Simple component that wires up the keyboard shortcuts hook. */
const TestHarness: React.FC = () => {
  useKeyboardShortcuts();
  return <canvas data-testid="spectrogram-canvas" />;
};

describe("snapshot keyboard shortcut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows success toast on snapshot", async () => {
    (takeSnapshot as Mock).mockResolvedValue("data:image/png");
    render(<TestHarness />);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, shiftKey: true }),
    );

    await waitFor(() => {
      expect(takeSnapshot).toHaveBeenCalled();
      expect(conditionalToast.success).toHaveBeenCalled();
    });
  });

  it("shows error toast when snapshot fails", async () => {
    (takeSnapshot as Mock).mockRejectedValue(new Error("fail"));
    render(<TestHarness />);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, shiftKey: true }),
    );

    await waitFor(() => {
      expect(takeSnapshot).toHaveBeenCalled();
      expect(conditionalToast.error).toHaveBeenCalled();
    });
  });
});
