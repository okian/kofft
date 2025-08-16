import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import App from "../src/App";

vi.mock("../src/utils/metadata", () => ({
  extractMetadata: vi.fn(async () => null),
}));

vi.mock("../src/utils/spectrogram", () => ({
  generateSpectrogram: vi.fn(async () => ({
    pixels: new Uint8ClampedArray([1, 2, 3, 255]),
    width: 1,
    height: 1,
  })),
}));

describe("App", () => {
  it("processes uploaded file", async () => {
    const putImageData = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      putImageData,
    })) as any;
    const { container } = render(<App />);
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File([new Uint8Array([0])], "t.wav", {
      type: "audio/wav",
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(putImageData).toHaveBeenCalled());
  });
});
