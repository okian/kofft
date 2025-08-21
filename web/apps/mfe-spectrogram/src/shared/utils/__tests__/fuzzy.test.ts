import { init, fuzzyMatch, fuzzyScore, fuzzyScores } from "../fuzzy";

/**
 * Integration tests for the fuzzy matching utilities. These tests assert that
 * the module falls back to the pure JavaScript implementation when the WASM
 * bundle fails to load and that all inputs are validated thoroughly.
 */

describe("fuzzy utils", () => {
  // Ensures we handle missing WASM gracefully by using the JS fallback
  it("falls back to JS implementation when WASM fails to load", async () => {
    const wasm = await init();
    expect(wasm).toBeNull();
    await expect(fuzzyScore("abc", "a-b-c")).resolves.toBe(2);
    await expect(fuzzyMatch("abc", "ac")).resolves.toBe(true);
  });

  // Verifies basic edit distance calculations using the fallback algorithm
  it("computes Levenshtein distance", async () => {
    await expect(fuzzyScore("abc", "a-b-c")).resolves.toBe(2);
    await expect(fuzzyScore("kitten", "sitting")).resolves.toBe(3);
  });

  // Confirms matching behaviour relative to half-length threshold
  it("matches within threshold", async () => {
    await expect(fuzzyMatch("abc", "ac")).resolves.toBe(true);
    await expect(fuzzyMatch("abc", "xyz")).resolves.toBe(false);
  });

  // Checks batch scoring against sequential computation for consistency
  it("batch scores large candidate sets accurately", async () => {
    const candidates = Array.from({ length: 1000 }, (_, i) => `abc${i}`);
    const batch = await fuzzyScores("abc", candidates);
    const seq = await Promise.all(
      candidates.map((c) => fuzzyScore("abc", c)),
    );
    expect(batch.length).toBe(candidates.length);
    expect(batch).toEqual(seq);
  });

  // Validates that candidate arrays and elements are strictly typed
  it("validates candidate input types", async () => {
    await expect(
      fuzzyScores("abc", ["abc", 123 as any]),
    ).rejects.toThrow(TypeError);
    await expect(
      fuzzyScores("abc", "not-an-array" as any),
    ).rejects.toThrow(TypeError);
  });
});
