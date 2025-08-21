import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMinimalFades, FADE_DURATION_MS } from "./useMinimalFades";

/** Validate behaviour of the fade hook. */
describe("useMinimalFades", () => {
  it("returns transition style with configured duration", () => {
    const { result } = renderHook(() => useMinimalFades());
    expect(result.current.style.transition).toBe(
      `opacity ${FADE_DURATION_MS}ms ease-in-out`,
    );
  });

  it("memoises the style object to avoid allocations", () => {
    const { result, rerender } = renderHook(() => useMinimalFades());
    const first = result.current.style;
    rerender();
    expect(result.current.style).toBe(first);
  });
});
