import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import {
  computeWaveformPeaks,
  computeWaveformPeaksJS,
  clearWaveformPeaksCache,
} from "../waveform";
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

  it("throws when wasm invocation fails", () => {
    const data = new Float32Array([0, 0, 0, 1]);
    vi.mocked(computeWaveformPeaksWASM).mockImplementation(() => {
      throw new Error("no wasm");
    });
    expect(() => computeWaveformPeaks(data, 4)).toThrow("no wasm");
  });

  it("caches results per buffer and bar count", () => {
    const data = new Float32Array([1, -1, 1, -1]);
    const fake = new Float32Array([1, 1]);
    vi.mocked(computeWaveformPeaksWASM).mockReturnValue(fake);
    const first = computeWaveformPeaks(data, 2);
    const second = computeWaveformPeaks(data, 2);
    expect(first).toBe(second);
  });

  it("maintains bar count and last-bar alignment across lengths", () => {
    vi.mocked(computeWaveformPeaksWASM).mockImplementation(
      computeWaveformPeaksJS,
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2048 }),
        fc.integer({ min: 1, max: 64 }),
        (len, bars) => {
          const data = new Float32Array(len);
          data[len - 1] = 1; // ensure final sample is non-zero
          const peaks = computeWaveformPeaks(data, bars);
          expect(peaks.length).toBe(bars);
          expect(peaks[bars - 1]).toBeCloseTo(1, 5);
          expect(computeWaveformPeaksWASM).toHaveBeenCalled();
        },
      ),
    );
  });

  it("normalizes constant signals", () => {
    vi.mocked(computeWaveformPeaksWASM).mockImplementation(
      computeWaveformPeaksJS,
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1024 }),
        fc.integer({ min: 1, max: 64 }),
        fc.float({
          min: Math.fround(0.1),
          max: 1,
          noNaN: true,
          noDefaultInfinity: true,
        }),
        (len, bars, amp) => {
          const data = new Float32Array(len).fill(amp);
          const peaks = computeWaveformPeaks(data, bars);
          for (const p of peaks) {
            expect(p).toBeCloseTo(1, 5);
          }
          expect(computeWaveformPeaksWASM).toHaveBeenCalled();
        },
      ),
    );
  });
});
