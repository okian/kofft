import { CSSProperties, useMemo } from "react";
import { SLIDE_DURATION_MS } from "../../ui/AnimationDurations";

/**
 * Memoised style object enabling sliding grid reveals.
 * Pulling the duration from {@link SLIDE_DURATION_MS} ensures consistent
 * motion, while using `transform` avoids reflow and `willChange` hints the
 * browser to optimise for upcoming animations.
 */
export function useGridTransitions(): { readonly style: CSSProperties } {
  const style = useMemo<CSSProperties>(
    () => ({
      transition: `transform ${SLIDE_DURATION_MS}ms ease-out`,
      transform: "translateY(0)",
      willChange: "transform",
    }),
    [],
  );
  return { style };
}
