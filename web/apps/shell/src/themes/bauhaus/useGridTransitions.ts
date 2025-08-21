import { CSSProperties, useMemo } from "react";

/** Duration in milliseconds for slide transitions. */
export const SLIDE_DURATION_MS = 250 as const;

/**
 * Memoised style object enabling sliding grid reveals.
 * Using `transform` avoids expensive reflow operations and `willChange`
 * hints the browser to optimise for upcoming animations.
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
