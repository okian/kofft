import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { SpectrogramCanvas } from "../src/components/SpectrogramCanvas";

describe("SpectrogramCanvas", () => {
  it("draws provided pixels", () => {
    const putImageData = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      putImageData,
    })) as any;
    const pixels = new Uint8ClampedArray([1, 2, 3, 255]);
    render(<SpectrogramCanvas pixels={pixels} width={1} height={1} />);
    expect(putImageData).toHaveBeenCalled();
  });
});
