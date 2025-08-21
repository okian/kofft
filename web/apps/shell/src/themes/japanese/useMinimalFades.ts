import { useMemo } from "react";
import { CSSProperties } from "react";

/** Duration in milliseconds for fade transitions ensuring subtlety. */
export const FADE_DURATION_MS = 200 as const;

/**
 * Hook producing memoised style props for minimal fade transitions.
 * The memoisation avoids repeatedly allocating style objects, reducing
 * garbage collection pressure during re-renders.
 */
export function useMinimalFades(): { readonly style: CSSProperties } {
  const style = useMemo<CSSProperties>(
    () => ({ transition: `opacity ${FADE_DURATION_MS}ms ease-in-out` }),
    [],
  );
  return { style };
}
