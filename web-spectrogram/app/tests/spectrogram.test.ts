import { describe, it, expect, vi } from "vitest";
import { generateSpectrogram } from "../src/utils/spectrogram";

vi.mock(
  "@wasm",
  () => ({
    default: vi.fn().mockResolvedValue(undefined),
    stft_magnitudes: vi.fn(() => ({
      mags: [0.1, 0.2],
      width: 1,
      height: 2,
      max_mag: 1,
    })),
    color_from_magnitude_u8: vi.fn(() => new Uint8Array([1, 2, 3, 255])),
    Colormap: { Rainbow: 0 },
  }),
  { virtual: true },
);

class MockAudioBuffer {
  getChannelData() {
    return new Float32Array(4);
  }
}

class MockAudioContext {
  decodeAudioData = vi.fn(async () => new MockAudioBuffer());
}

// @ts-ignore
globalThis.AudioContext = MockAudioContext;

describe("generateSpectrogram", () => {
  it("produces pixel data using WASM", async () => {
    const file = { arrayBuffer: async () => new ArrayBuffer(8) } as File;
    const res = await generateSpectrogram(file);
    expect(res.width).toBe(1);
    expect(res.height).toBe(2);
    expect(res.pixels.length).toBe(8);
  });
});
