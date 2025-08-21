import { describe, it, expect } from "vitest";
import { render, renderHook } from "@testing-library/react";
import type { CSSProperties } from "react";
import {
  useGridTransitions,
  OFFSCREEN_TRANSLATE_Y,
  ONSCREEN_TRANSLATE_Y,
} from "./useGridTransitions";
import { SLIDE_DURATION_MS } from "../../ui/AnimationDurations";

/** Validate behaviour of the sliding transition hook. */
describe("useGridTransitions", () => {
  it("animates from off-screen and exposes deterministic transition", () => {
    const styles: CSSProperties[] = [];
    function TestComponent() {
      const { style } = useGridTransitions();
      styles.push(style);
      return null;
    }
    render(<TestComponent />);
    expect(styles).toHaveLength(2);
    expect(styles[0]!.transform).toBe(OFFSCREEN_TRANSLATE_Y);
    expect(styles[1]!.transform).toBe(ONSCREEN_TRANSLATE_Y);
    expect(styles[1]!.transition).toBe(
      `transform ${SLIDE_DURATION_MS}ms ease-out`,
    );
  });

  it("memoises the style object to avoid reflows after animation", () => {
    const { result, rerender } = renderHook(() => useGridTransitions());
    const first = result.current.style;
    rerender();
    expect(result.current.style).toBe(first);
  });
});
