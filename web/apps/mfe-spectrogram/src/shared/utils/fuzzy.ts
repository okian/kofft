/** Path to the compiled WASM bundle. */
const WASM_BUNDLE_PATH = "@wasm/react_spectrogram_wasm.js";

/**
 * Lazily initialised promise for the WASM module. It is created on first
 * request and cached for subsequent calls, ensuring the module loads only
 * once and callers can await its resolution.
 */
let wasmInitPromise: Promise<any | null> | null = null;

/**
 * Initiates loading of the WASM module. Any failure (e.g. missing bundle) is
 * caught and results in a resolved `null` value so callers can gracefully
 * fall back to the JavaScript implementation.
 */
export async function init(): Promise<any | null> {
  if (!wasmInitPromise) {
    // Using dynamic import allows bundlers to split the WASM code. The
    // `@vite-ignore` comment prevents Vite from transforming the path.
    // A rejected import (e.g. in tests) resolves to `null`.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore -- dynamic import of generated wasm bindings
    wasmInitPromise = import(/* @vite-ignore */ WASM_BUNDLE_PATH).catch(
      () => null,
    );
  }
  return wasmInitPromise;
}

/**
 * Computes the Levenshtein distance between two strings using a dynamic
 * programming matrix. This pure TypeScript implementation acts as a fallback
 * when the WASM module is unavailable.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Allocate a matrix of (m + 1) x (n + 1) to hold edit distances. All values
  // are initialised to zero to avoid accidental usage of uninitialised memory.
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  // Initialise first row/column representing edits from/to empty string.
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Returns the edit distance between `pattern` and `text`. The WASM
 * implementation is preferred for performance; otherwise the slower
 * JavaScript fallback is used. The function is asynchronous to ensure the
 * WASM module is fully initialised before invocation.
 */
export async function fuzzyScore(
  pattern: string,
  text: string,
): Promise<number> {
  const wasm = await init();
  if (wasm?.fuzzy_score) return wasm.fuzzy_score(pattern, text);
  return levenshtein(pattern.toLowerCase(), text.toLowerCase());
}

/**
 * Determines whether `text` matches `pattern` within a threshold of half the
 * pattern length. Uses the same WASM-first strategy as `fuzzyScore`.
 */
export async function fuzzyMatch(
  pattern: string,
  text: string,
): Promise<boolean> {
  return (await fuzzyScore(pattern, text)) <= Math.floor(pattern.length / 2);
}

/**
 * Computes fuzzy scores for an array of candidate strings. The function
 * validates input strictly to fail fast on incorrect types, preventing subtle
 * bugs and potential runtime errors.
 */
export async function fuzzyScores(
  pattern: string,
  candidates: string[],
): Promise<number[]> {
  if (!Array.isArray(candidates)) {
    throw new TypeError("Candidates must be an array of strings");
  }
  if (!candidates.every((c) => typeof c === "string")) {
    throw new TypeError("All candidates must be strings");
  }
  const wasm = await init();
  if (wasm?.fuzzy_scores) {
    const arr: Uint32Array = wasm.fuzzy_scores(pattern, candidates);
    // Convert the typed array to a regular array for easier consumption.
    return Array.from(arr);
  }
  // JS fallback: compute scores sequentially to avoid unbounded concurrency.
  const results: number[] = [];
  for (const c of candidates) {
    results.push(await fuzzyScore(pattern, c));
  }
  return results;
}

