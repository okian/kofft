import { describe, it, expect } from "vitest";
import {
  FADE_DURATION_MS,
  SLIDE_DURATION_MS,
  THEME_ANIMATION_MS,
} from "./AnimationDurations";

/** Ensure animation duration constants remain stable for predictable motion. */
describe("Animation duration constants", () => {
  it("exposes the fade duration", () => {
    expect(FADE_DURATION_MS).toBe(200);
  });

  it("exposes the slide duration", () => {
    expect(SLIDE_DURATION_MS).toBe(250);
  });

  it("exposes the theme transition duration", () => {
    expect(THEME_ANIMATION_MS).toBe(300);
  });
});
