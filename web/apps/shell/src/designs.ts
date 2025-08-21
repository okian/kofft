/**
 * Colour definitions for each supported design and colour mode.
 * Splitting these constants avoids scattering raw hex codes and
 * clarifies the intent of each palette entry.
 */
export type Mode = "light" | "dark";

/**
 * Available design systems that the shell can render.
 * "japanese-a"  -> Minimalist monochrome palette.
 * "japanese-b"  -> Minimalist palette with red accents.
 * "bauhaus"     -> Geometric palette using primary colours.
 */
export type Design = "japanese-a" | "japanese-b" | "bauhaus";

/** Distinct shades used across designs. */
const WHITE = "#ffffff" as const;
const BLACK = "#000000" as const;
const RED = "#cc0000" as const; // Calm red to avoid eye strain
const BAUHAUS_BLUE = "#0047ab" as const;
const BAUHAUS_YELLOW = "#ffde00" as const;

/**
 * Complete palette for each design + mode combination.
 * background  - page background colour.
 * text        - default text colour.
 * accent      - primary accent colour.
 * secondary   - optional secondary accent used only by Bauhaus.
 * tertiary    - optional tertiary accent used only by Bauhaus.
 */
export interface Palette {
  readonly background: string;
  readonly text: string;
  readonly accent: string;
  readonly secondary?: string;
  readonly tertiary?: string;
}

/** Lookup table of palettes by design and mode. */
export const PALETTES: Record<Design, Record<Mode, Palette>> = {
  "japanese-a": {
    light: { background: WHITE, text: BLACK, accent: BLACK },
    dark: { background: BLACK, text: WHITE, accent: WHITE },
  },
  "japanese-b": {
    light: { background: WHITE, text: BLACK, accent: RED },
    dark: { background: BLACK, text: WHITE, accent: RED },
  },
  bauhaus: {
    light: {
      background: WHITE,
      text: BLACK,
      accent: RED,
      secondary: BAUHAUS_BLUE,
      tertiary: BAUHAUS_YELLOW,
    },
    dark: {
      background: BLACK,
      text: WHITE,
      accent: RED,
      secondary: BAUHAUS_BLUE,
      tertiary: BAUHAUS_YELLOW,
    },
  },
} as const;
