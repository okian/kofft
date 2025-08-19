import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MarqueeText } from "@/components/common/MarqueeText";
import {
  MARQUEE_DELAY_MS,
  MARQUEE_DURATION_MULTIPLIER,
  MARQUEE_MIN_DURATION,
} from "@/config";

vi.useFakeTimers();

describe("useMarquee", () => {
  it("activates marquee when text overflows", async () => {
    render(
      <div style={{ width: "100px" }}>
        <MarqueeText text={"Long text that will overflow the container"} />
      </div>,
    );
    const span = screen.getByText(/Long text/);
    const container = span.parentElement as HTMLElement;
    Object.defineProperty(container, "clientWidth", {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(span, "scrollWidth", {
      value: 300,
      configurable: true,
    });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    const expectedDuration = Math.max(
      (300 / 100) * MARQUEE_DURATION_MULTIPLIER,
      MARQUEE_MIN_DURATION,
    );
    expect(span.style.getPropertyValue("--marquee-duration")).toBe(
      `${expectedDuration}s`,
    );
    expect(span.classList.contains("marquee-active")).toBe(false);
    vi.advanceTimersByTime(MARQUEE_DELAY_MS + 100);
    expect(span.classList.contains("marquee-active")).toBe(true);
  });

  it("does not activate marquee when text fits", () => {
    render(
      <div style={{ width: "500px" }}>
        <MarqueeText text={"Short"} />
      </div>,
    );
    const span = screen.getByText("Short");
    vi.advanceTimersByTime(MARQUEE_DELAY_MS + 100);
    expect(span.classList.contains("marquee-active")).toBe(false);
  });
});
