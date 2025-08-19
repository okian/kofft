let wasm: any | null = null;
// @ts-ignore -- dynamic import of generated wasm bindings
import(/* @vite-ignore */ "../wasm/react_spectrogram_wasm.js")
  .then((m) => {
    wasm = m;
  })
  .catch(() => {
    wasm = null;
  });

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

export function fuzzyScore(pattern: string, text: string): number {
  if (wasm?.fuzzy_score) return wasm.fuzzy_score(pattern, text);
  return levenshtein(pattern.toLowerCase(), text.toLowerCase());
}

export function fuzzyMatch(pattern: string, text: string): boolean {
  return fuzzyScore(pattern, text) <= Math.floor(pattern.length / 2);
}

export function fuzzyScores(pattern: string, candidates: string[]): number[] {
  if (!candidates.every((c) => typeof c === "string")) {
    throw new TypeError("All candidates must be strings");
  }
  if (wasm?.fuzzy_scores) {
    const arr: Uint32Array = wasm.fuzzy_scores(pattern, candidates);
    return Array.from(arr);
  }
  return candidates.map((c) => fuzzyScore(pattern, c));
}
