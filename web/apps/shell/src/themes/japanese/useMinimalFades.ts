import { useMemo } from "react";
import { CSSProperties } from "react";
import { FADE_DURATION_MS } from "../../ui/AnimationDurations";

/**
 * Hook producing memoised style props for minimal fade transitions.
 * Leveraging the shared {@link FADE_DURATION_MS} constant keeps timings
 * consistent while memoisation avoids repeated allocations, reducing
 * garbage collection pressure during re-renders.
 */
export function useMinimalFades(): { readonly style: CSSProperties } {
  const style = useMemo<CSSProperties>(
    () => ({ transition: `opacity ${FADE_DURATION_MS}ms ease-in-out` }),
    [],
  );
  return { style };
}
