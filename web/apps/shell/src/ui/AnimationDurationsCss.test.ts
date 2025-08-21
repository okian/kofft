import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import {
  THEME_ANIMATION_MS,
  THEME_ANIMATION_CSS_VAR,
} from "./AnimationDurations";

/** Resolve path to the generated CSS file relative to this test. */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Paths to theme styles that should consume the shared animation variable. */
const THEME_CSS_PATHS = [
  "../themes/bauhaus.css",
  "../themes/japanese.css",
] as const;

/**
 * Ensure the CSS variable for animation duration remains in sync with the
 * TypeScript constant and is referenced by theme styles.
 */
describe("animation duration CSS variable", () => {
  it("matches THEME_ANIMATION_MS", () => {
    const cssPath = resolve(__dirname, "./animation-durations.css");
    const css = readFileSync(cssPath, "utf8");
    const match = css.match(
      new RegExp(`${THEME_ANIMATION_CSS_VAR}:\\s*(\\d+)ms`),
    );
    if (!match)
      throw new Error(`${THEME_ANIMATION_CSS_VAR} not found in CSS`);
    expect(Number(match[1])).toBe(THEME_ANIMATION_MS);
  });

  it("is referenced by all themes", () => {
    for (const rel of THEME_CSS_PATHS) {
      const themeCss = readFileSync(resolve(__dirname, rel), "utf8");
      expect(themeCss).toContain(`var(${THEME_ANIMATION_CSS_VAR})`);
    }
  });
});
