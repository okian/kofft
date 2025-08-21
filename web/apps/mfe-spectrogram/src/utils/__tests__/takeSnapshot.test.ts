/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { takeSnapshot, DEFAULT_SNAPSHOT_FILENAME } from "../takeSnapshot";

// Helper to create a small canvas for testing without heavy memory use.
function createTestCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 2, 2);
  }
  return canvas;
}

describe("takeSnapshot", () => {
  it("returns data URL and invokes callback on success", () => {
    const canvas = createTestCanvas();
    const onSnapshot = vi.fn();

    const url = takeSnapshot({
      canvas,
      fileName: DEFAULT_SNAPSHOT_FILENAME,
      onSnapshot,
    });

    expect(url.startsWith("data:image/png")).toBe(true);
    expect(onSnapshot).toHaveBeenCalledWith(url);
  });

  it("throws an error when canvas is missing", () => {
    expect(() => takeSnapshot({ canvas: null })).toThrow(
      "takeSnapshot: canvas is required",
    );
  });
});
