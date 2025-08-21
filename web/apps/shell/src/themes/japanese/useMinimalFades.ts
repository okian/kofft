import { CSSProperties, useEffect, useMemo, useState } from "react";
import { FADE_DURATION_MS } from "../../ui/AnimationDurations";

/** Opacity at component mount ensuring content is initially hidden. */
const INITIAL_OPACITY = 0 as const;

/** Target opacity reached after the fade-in completes. */
const TARGET_OPACITY = 1 as const;

/** Delay before the fade-in starts allowing the initial paint. */
const FADE_DELAY_MS = 0 as const;

/**
 * Hook producing memoised style props for minimal fade transitions.
 * Leveraging the shared {@link FADE_DURATION_MS} constant keeps timings
 * consistent while memoisation avoids repeated allocations, reducing
 * garbage collection pressure during re-renders.
 */
export function useMinimalFades(): { readonly style: CSSProperties } {
  const [opacity, setOpacity] = useState<number>(INITIAL_OPACITY);

  // Trigger a single fade-in once the component has mounted. The update is
  // deferred to the next task to ensure callers observe the initial
  // transparency before the transition begins.
  useEffect(() => {
    const handle = setTimeout(() => setOpacity(TARGET_OPACITY), FADE_DELAY_MS);
    return () => clearTimeout(handle);
  }, []);

  const style = useMemo<CSSProperties>(
    () => ({
      opacity,
      transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
    }),
    [opacity],
  );
  return { style };
}
