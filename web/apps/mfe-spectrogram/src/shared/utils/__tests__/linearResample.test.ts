import { describe, it, expect, vi } from "vitest";
// Stub modules with heavy browser dependencies before importing subjects.
vi.mock("../audioPlayer", () => ({ audioPlayer: {} }));
vi.mock("../wasm", () => ({
  computeWaveformPeaksWASM: vi.fn(),
  linearResample: vi.fn(),
}));

import { linearResample as linearResampleTS } from "../waveform";

// Negative target length to verify graceful handling of invalid sizes.
const NEGATIVE_LENGTH = -5;
// Zero target length should yield an empty array.
const ZERO_LENGTH = 0;
// Positive target length used for normal resampling behavior.
const POSITIVE_LENGTH = 4;

// Implementation under test.
const RESAMPLERS = [{ label: "TS", fn: linearResampleTS }];

/**
 * Ensure linearResample gracefully handles edge-case target lengths.
 */
for (const { label, fn } of RESAMPLERS) {
  describe(`linearResample ${label}`, () => {
    it("returns empty array for negative length", () => {
      const out = fn(new Float32Array([1, 2, 3]), NEGATIVE_LENGTH);
      expect(out.length).toBe(0);
    });

    it("returns empty array for zero length", () => {
      const out = fn(new Float32Array([1, 2, 3]), ZERO_LENGTH);
      expect(out.length).toBe(0);
    });

    it("resamples correctly for positive length", () => {
      const input = new Float32Array([0, 1, 2, 3]);
      const out = fn(input, POSITIVE_LENGTH);
      expect(out.length).toBe(POSITIVE_LENGTH);
      expect(out[POSITIVE_LENGTH - 1]).toBeCloseTo(input[input.length - 1], 6);
    });

    it("returns zero-filled output for empty input", () => {
      const out = fn(new Float32Array(), POSITIVE_LENGTH);
      expect(out.length).toBe(POSITIVE_LENGTH);
      for (const v of out) {
        expect(v).toBe(0);
      }
    });
  });
}
