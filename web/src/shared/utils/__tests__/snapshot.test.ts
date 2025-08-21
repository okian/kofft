import { describe, it, expect, vi, beforeEach } from "vitest";
import { takeSnapshot } from "../snapshot";
import { useSpectrogramStore } from "@/shared/stores/spectrogramStore";

// Minimal canvas stand-in used to provide a testable `toBlob` implementation
// without requiring a DOM environment.
function createMockCanvas(blob: Blob | null): HTMLCanvasElement {
  return {
    // Vitest runs in a non-DOM environment so we stub out only the pieces
    // `takeSnapshot` relies on.
    toBlob: (cb: BlobCallback) => cb(blob),
  } as unknown as HTMLCanvasElement;
}

describe("takeSnapshot", () => {
  beforeEach(() => {
    useSpectrogramStore.setState({ canvasRef: null });
  });

  it("returns true and invokes callback when canvas is available", async () => {
    const blob = new Blob(["data"], { type: "image/png" });
    useSpectrogramStore.setState({
      canvasRef: { getCanvas: () => createMockCanvas(blob) } as any,
    });
    const onCapture = vi.fn();
    const result = await takeSnapshot({ onCapture });
    expect(result).toBe(true);
    expect(onCapture).toHaveBeenCalledWith(blob);
  });

  it("returns false when no canvas is present", async () => {
    const onCapture = vi.fn();
    const result = await takeSnapshot({ onCapture });
    expect(result).toBe(false);
    expect(onCapture).not.toHaveBeenCalled();
  });
});
