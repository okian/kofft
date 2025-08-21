import { describe, it, expect, vi, beforeEach } from "vitest";
import { takeSnapshot, DEFAULT_SNAPSHOT_FILENAME } from "../takeSnapshot";

/**
 * Test suite for the takeSnapshot utility. The tests use a real canvas element
 * but mock out DOM interactions like the synthetic download link to keep the
 * environment deterministic.
 */
describe("takeSnapshot", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("captures canvas and triggers download", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    // Deterministically encode to a data URL
    const dataUrl = "data:image/png;base64,TEST";
    vi.spyOn(canvas, "toDataURL").mockReturnValue(dataUrl);
    document.body.appendChild(canvas);

    // Spy on link click without actually navigating
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const result = await takeSnapshot({ canvas });

    expect(result).toBe(dataUrl);
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
    expect(clickSpy).toHaveBeenCalled();
    // Ensure default filename is applied
    const link = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(link.download).toBe(DEFAULT_SNAPSHOT_FILENAME);
  });

  it("throws when no canvas is available", async () => {
    await expect(takeSnapshot()).rejects.toThrow(
      "Spectrogram canvas not found",
    );
  });
});
