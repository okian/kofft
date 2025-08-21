import { Theme } from "@/shared/types";
import { cn } from "@/shared/utils/cn";

/**
 * Base spacing tokens expressed as Tailwind utility strings. Values are kept as
 * constants to avoid magic numbers and allow reuse across theme mappings.
 */
const SPACE_STANDARD = "px-4 py-2"; // Neutral balance for modern themes.
const SPACE_JAPANESE = "px-6 py-3"; // Generous whitespace for Japanese minimalism.
const SPACE_BAUHAUS = "px-3 py-2"; // Compact rhythm matching Bauhaus grids.

/**
 * Border radius tokens. Japanese styles prefer subtle rounding, Bauhaus keeps
 * sharp edges to mirror modular geometry, while defaults remain moderately
 * rounded for familiarity.
 */
const RADIUS_STANDARD = "rounded-md";
const RADIUS_JAPANESE = "rounded-sm";
const RADIUS_BAUHAUS = "rounded-none";

/**
 * Typography tokens. Japanese minimalism favours light weights, Bauhaus uses
 * bold uppercase grid-aligned type, while defaults use regular sans text.
 */
const TYPO_STANDARD = "font-sans text-sm";
const TYPO_JAPANESE = "font-light text-sm";
const TYPO_BAUHAUS = "font-bold uppercase tracking-wide text-sm";

/**
 * Grid unit tokens. Defaults rely on simple flex layouts, Japanese themes
 * favour single-column calmness, and Bauhaus uses a strict 12-column grid.
 */
const GRID_STANDARD = "flex";
const GRID_JAPANESE = "grid grid-cols-1";
const GRID_BAUHAUS = "grid grid-cols-12";

/**
 * Tailwind spacing classes keyed by theme. Each entry references a spacing
 * constant above, enabling components to derive consistent whitespace
 * without sprinkling literal values.
 */
export const SPACING: Record<Theme, string> = {
  dark: SPACE_STANDARD,
  light: SPACE_STANDARD,
  neon: SPACE_STANDARD,
  "high-contrast": SPACE_STANDARD,
  "japanese-a-light": SPACE_JAPANESE,
  "japanese-a-dark": SPACE_JAPANESE,
  "japanese-b-light": SPACE_JAPANESE,
  "japanese-b-dark": SPACE_JAPANESE,
  "bauhaus-light": SPACE_BAUHAUS,
  "bauhaus-dark": SPACE_BAUHAUS,
} as const;

/** Border radius classes keyed by theme. */
export const BORDER_RADIUS: Record<Theme, string> = {
  dark: RADIUS_STANDARD,
  light: RADIUS_STANDARD,
  neon: RADIUS_STANDARD,
  "high-contrast": RADIUS_STANDARD,
  "japanese-a-light": RADIUS_JAPANESE,
  "japanese-a-dark": RADIUS_JAPANESE,
  "japanese-b-light": RADIUS_JAPANESE,
  "japanese-b-dark": RADIUS_JAPANESE,
  "bauhaus-light": RADIUS_BAUHAUS,
  "bauhaus-dark": RADIUS_BAUHAUS,
} as const;

/** Typography classes keyed by theme. */
export const TYPOGRAPHY: Record<Theme, string> = {
  dark: TYPO_STANDARD,
  light: TYPO_STANDARD,
  neon: TYPO_STANDARD,
  "high-contrast": TYPO_STANDARD,
  "japanese-a-light": TYPO_JAPANESE,
  "japanese-a-dark": TYPO_JAPANESE,
  "japanese-b-light": TYPO_JAPANESE,
  "japanese-b-dark": TYPO_JAPANESE,
  "bauhaus-light": TYPO_BAUHAUS,
  "bauhaus-dark": TYPO_BAUHAUS,
} as const;

/** Grid classes keyed by theme. */
export const GRID: Record<Theme, string> = {
  dark: GRID_STANDARD,
  light: GRID_STANDARD,
  neon: GRID_STANDARD,
  "high-contrast": GRID_STANDARD,
  "japanese-a-light": GRID_JAPANESE,
  "japanese-a-dark": GRID_JAPANESE,
  "japanese-b-light": GRID_JAPANESE,
  "japanese-b-dark": GRID_JAPANESE,
  "bauhaus-light": GRID_BAUHAUS,
  "bauhaus-dark": GRID_BAUHAUS,
} as const;

/**
 * Derives a base panel class list for a given theme. Panels use this to avoid
 * duplicating spacing/border/typography/grid logic and to ensure a cohesive
 * aesthetic across the application.
 */
export function getPanelClasses(theme: Theme): string {
  return cn(
    "h-full", // Panels occupy available vertical space.
    SPACING[theme],
    BORDER_RADIUS[theme],
    TYPOGRAPHY[theme],
    GRID[theme],
  );
}
