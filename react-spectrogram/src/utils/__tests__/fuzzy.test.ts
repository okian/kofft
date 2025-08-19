import { fuzzyMatch, fuzzyScore, fuzzyScores } from "../fuzzy";

describe("fuzzy utils", () => {
  it("computes Levenshtein distance", () => {
    expect(fuzzyScore("abc", "a-b-c")).toBe(2);
    expect(fuzzyScore("kitten", "sitting")).toBe(3);
  });

  it("matches within threshold", () => {
    expect(fuzzyMatch("abc", "ac")).toBe(true);
    expect(fuzzyMatch("abc", "xyz")).toBe(false);
  });

  it("batch scores large candidate sets accurately", () => {
    const candidates = Array.from({ length: 1000 }, (_, i) => `abc${i}`);
    const batch = fuzzyScores("abc", candidates);
    const seq = candidates.map((c) => fuzzyScore("abc", c));
    expect(batch.length).toBe(candidates.length);
    expect(batch).toEqual(seq);
  });
});
