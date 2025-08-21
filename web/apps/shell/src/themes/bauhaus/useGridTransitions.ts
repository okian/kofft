import { CSSProperties, useEffect, useMemo, useState } from "react";
import { SLIDE_DURATION_MS } from "../../ui/AnimationDurations";

/**
 * Translate used to keep elements just below the viewport before animation.
 */
export const OFFSCREEN_TRANSLATE_Y = "translateY(100%)";

/**
 * Translate that positions elements in-view once the animation completes.
 */
export const ONSCREEN_TRANSLATE_Y = "translateY(0)";

/**
 * Exposes a memoised style object enabling sliding grid reveals.
 * The element begins off-screen and slides into view on mount.
 * Pulling the duration from {@link SLIDE_DURATION_MS} ensures consistent
 * motion, while using `transform` avoids reflow and `willChange` hints the
 * browser to optimise for upcoming animations.
 */
export function useGridTransitions(): { readonly style: CSSProperties } {
  // Track the current transform. Starting off-screen improves perceived performance.
  const [transform, setTransform] = useState<string>(OFFSCREEN_TRANSLATE_Y);

  // After the component mounts, move into view to trigger the CSS transition.
  useEffect(() => {
    setTransform(ONSCREEN_TRANSLATE_Y);
  }, []);

  const style = useMemo<CSSProperties>(
    () => ({
      transition: `transform ${SLIDE_DURATION_MS}ms ease-out`,
      transform,
      willChange: "transform",
    }),
    [transform],
  );

  return { style };
}
