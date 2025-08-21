/* @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";
import { useSpectrogramStore } from "@/shared/stores/spectrogramStore";

const { snapshotMock, toastSuccess, toastError } = vi.hoisted(() => ({
  snapshotMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/utils/takeSnapshot", () => ({
  takeSnapshot: snapshotMock,
  DEFAULT_SNAPSHOT_FILENAME: "test.png",
  SNAPSHOT_SUCCESS_MESSAGE: "Snapshot saved",
  SNAPSHOT_ERROR_MESSAGE: "Failed to capture snapshot",
}));

vi.mock("@/utils/toast", () => ({
  conditionalToast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/shared/utils/wasm", () => ({}));

afterEach(() => {
  snapshotMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("useKeyboardShortcuts snapshot integration", () => {
  it("invokes snapshot utility on shortcut", () => {
    const canvas = document.createElement("canvas");
    useSpectrogramStore.setState({
      canvasRef: { getCanvas: () => canvas } as any,
    });

    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, shiftKey: true }),
    );

    expect(snapshotMock).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Snapshot saved");
  });

  it("shows error toast when snapshot fails", () => {
    snapshotMock.mockImplementation(() => {
      throw new Error("fail");
    });
    useSpectrogramStore.setState({
      canvasRef: { getCanvas: () => null } as any,
    });

    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, shiftKey: true }),
    );

    expect(toastError).toHaveBeenCalledWith("Failed to capture snapshot");
  });
});
