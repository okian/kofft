import { describe, it, expect } from "vitest";
import { computeWaveformPeaks, clearWaveformPeaksCache } from "../waveform";

describe("computeWaveformPeaks", () => {
  it("zeroes trailing bars without samples", () => {
    const data = new Float32Array([1, -1, 1, -1]);
    const peaks = computeWaveformPeaks(data, 10);
    expect(peaks[peaks.length - 1]).toBe(0);
  });

  it("caches results per buffer and bar count", () => {
    const data = new Float32Array([1, -1, 1, -1]);
    const first = computeWaveformPeaks(data, 2);
    const second = computeWaveformPeaks(data, 2);
    expect(first).toBe(second);
    clearWaveformPeaksCache();
  });
});
