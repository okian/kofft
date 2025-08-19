import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeWaveformPeaks, clearWaveformPeaksCache } from "../waveform";
import { computeWaveformPeaksWASM } from "../wasm";

vi.mock("../wasm", () => ({
  computeWaveformPeaksWASM: vi.fn(),
}));

describe("computeWaveformPeaks", () => {
  beforeEach(() => {
    clearWaveformPeaksCache();
    vi.mocked(computeWaveformPeaksWASM).mockReset();
  });

  it("uses wasm when available", () => {
    const data = new Float32Array([0.1, -0.2, 0.5, -0.6]);
    const fake = new Float32Array([0.6, 0.6]);
    vi.mocked(computeWaveformPeaksWASM).mockReturnValue(fake);
    const peaks = computeWaveformPeaks(data, 2);
    expect(peaks).toBe(fake);
  });

  it("falls back to JS when wasm unavailable", () => {
    const data = new Float32Array([1, -1, 1, -1]);
    vi.mocked(computeWaveformPeaksWASM).mockReturnValue(null);
    const peaks = computeWaveformPeaks(data, 10);
    expect(peaks[peaks.length - 1]).toBe(0);
  });

  it("caches results per buffer and bar count", () => {
    const data = new Float32Array([1, -1, 1, -1]);
    const fake = new Float32Array([1, 1]);
    vi.mocked(computeWaveformPeaksWASM).mockReturnValue(fake);
    const first = computeWaveformPeaks(data, 2);
    const second = computeWaveformPeaks(data, 2);
    expect(first).toBe(second);
  });
});
