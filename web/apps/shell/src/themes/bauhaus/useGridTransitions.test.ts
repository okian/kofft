import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGridTransitions } from "./useGridTransitions";
import { SLIDE_DURATION_MS } from "../../ui/AnimationDurations";

/** Validate behaviour of the sliding transition hook. */
describe("useGridTransitions", () => {
  it("returns deterministic transition style", () => {
    const { result } = renderHook(() => useGridTransitions());
    expect(result.current.style.transition).toBe(
      `transform ${SLIDE_DURATION_MS}ms ease-out`,
    );
    expect(result.current.style.transform).toBe("translateY(0)");
  });

  it("memoises the style object to avoid reflows", () => {
    const { result, rerender } = renderHook(() => useGridTransitions());
    const first = result.current.style;
    rerender();
    expect(result.current.style).toBe(first);
  });
});
