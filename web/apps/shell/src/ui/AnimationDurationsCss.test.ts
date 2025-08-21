import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { THEME_ANIMATION_MS } from "./AnimationDurations";

/** Resolve path to the generated CSS file relative to this test. */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Ensure the CSS variable for animation duration remains in sync with the
 * TypeScript constant to avoid divergence between JS and styles.
 */
describe("animation duration CSS variable", () => {
  it("matches THEME_ANIMATION_MS", () => {
    const cssPath = resolve(__dirname, "./animation-durations.css");
    const css = readFileSync(cssPath, "utf8");
    const match = css.match(/--anim-duration:\s*(\d+)ms/);
    if (!match) throw new Error("--anim-duration not found in CSS");
    expect(Number(match[1])).toBe(THEME_ANIMATION_MS);
  });
});
