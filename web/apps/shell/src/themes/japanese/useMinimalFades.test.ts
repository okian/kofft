import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMinimalFades } from "./useMinimalFades";
import { FADE_DURATION_MS } from "../../ui/AnimationDurations";

/** Style opacity representing transparency at mount. */
const OPACITY_TRANSPARENT = 0 as const;

/** Style opacity representing full visibility after fade completes. */
const OPACITY_OPAQUE = 1 as const;

/** Validate behaviour of the fade hook. */
describe("useMinimalFades", () => {
  it("starts transparent, fades in and exposes configured transition", async () => {
    const { result } = renderHook(() => useMinimalFades());
    expect(result.current.style.opacity).toBe(OPACITY_TRANSPARENT);
    expect(result.current.style.transition).toBe(
      `opacity ${FADE_DURATION_MS}ms ease-in-out`,
    );
    await waitFor(() =>
      expect(result.current.style.opacity).toBe(OPACITY_OPAQUE),
    );
  });

  it("memoises the style object after fade completion", async () => {
    const { result, rerender } = renderHook(() => useMinimalFades());
    await waitFor(() =>
      expect(result.current.style.opacity).toBe(OPACITY_OPAQUE),
    );
    const first = result.current.style;
    rerender();
    expect(result.current.style).toBe(first);
  });
});
