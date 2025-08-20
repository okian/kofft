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

  it("uses wasm when available", async () => {
    const data = new Float32Array([0.1, -0.2, 0.5, -0.6]);
    const fake = new Float32Array([0.6, 0.6]);
    vi.mocked(computeWaveformPeaksWASM).mockResolvedValue(fake);
    const peaks = await computeWaveformPeaks(data, 2);
    expect(peaks).toBe(fake);
  });

  it("throws when wasm invocation fails", async () => {
    const data = new Float32Array([0, 0, 0, 1]);
    vi.mocked(computeWaveformPeaksWASM).mockRejectedValue(new Error("no wasm"));
    await expect(computeWaveformPeaks(data, 4)).rejects.toThrow("no wasm");
  });

  it("caches results per buffer and bar count", async () => {
    const data = new Float32Array([1, -1, 1, -1]);
    const fake = new Float32Array([1, 1]);
    vi.mocked(computeWaveformPeaksWASM).mockResolvedValue(fake);
    const first = await computeWaveformPeaks(data, 2);
    const second = await computeWaveformPeaks(data, 2);
    expect(first).toBe(second);
  });

  it("maintains bar count and last-bar alignment across lengths", async () => {
    vi.mocked(computeWaveformPeaksWASM).mockImplementation(
      async (data: Float32Array, bars: number) => computeWaveformPeaksJS(data, bars),
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2048 }),
        fc.integer({ min: 1, max: 64 }),
        async (len, bars) => {
          const data = new Float32Array(len);
          data[len - 1] = 1; // ensure final sample is non-zero
          const peaks = await computeWaveformPeaks(data, bars);
          expect(peaks.length).toBe(bars);
          expect(peaks[bars - 1]).toBeCloseTo(1, 5);
          expect(computeWaveformPeaksWASM).toHaveBeenCalled();
        },
      ),
    );
  });

  it("normalizes constant signals", async () => {
    vi.mocked(computeWaveformPeaksWASM).mockImplementation(
      async (data: Float32Array, bars: number) => computeWaveformPeaksJS(data, bars),
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
        async (len, bars, amp) => {
          const data = new Float32Array(len).fill(amp);
          const peaks = await computeWaveformPeaks(data, bars);
          for (const p of peaks) {
            expect(p).toBeCloseTo(1, 5);
          }
          expect(computeWaveformPeaksWASM).toHaveBeenCalled();
        },
      ),
    );
  });
});
