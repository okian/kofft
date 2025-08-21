import { describe, it, expect } from "vitest";
import { FADE_DURATION_MS, SLIDE_DURATION_MS } from "./AnimationDurations";

/** Ensure animation duration constants remain stable for predictable motion. */
describe("Animation duration constants", () => {
  it("exposes the fade duration", () => {
    expect(FADE_DURATION_MS).toBe(200);
  });

  it("exposes the slide duration", () => {
    expect(SLIDE_DURATION_MS).toBe(250);
  });
});
