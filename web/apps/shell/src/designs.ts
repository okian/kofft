/**
 * Centralised definitions of design systems and colour palettes.
 * Palettes are imported from theme-specific modules to maintain
 * separation of concerns and ensure reuse across components.
 */
import {
  JAPANESE_A_LIGHT_PALETTE,
  JAPANESE_A_DARK_PALETTE,
  JAPANESE_B_LIGHT_PALETTE,
  JAPANESE_B_DARK_PALETTE,
} from "./themes/japanese/palette";
import {
  BAUHAUS_LIGHT_PALETTE,
  BAUHAUS_DARK_PALETTE,
} from "./themes/bauhaus/palette";

/** Supported colour modes. */
export type Mode = "light" | "dark";

/**
 * Available design systems that the shell can render.
 * "japanese-a"  -> Minimalist monochrome palette.
 * "japanese-b"  -> Minimalist palette with red accents.
 * "bauhaus"     -> Geometric palette using primary colours.
 */
export type Design = "japanese-a" | "japanese-b" | "bauhaus";

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
    light: JAPANESE_A_LIGHT_PALETTE,
    dark: JAPANESE_A_DARK_PALETTE,
  },
  "japanese-b": {
    light: JAPANESE_B_LIGHT_PALETTE,
    dark: JAPANESE_B_DARK_PALETTE,
  },
  bauhaus: {
    light: BAUHAUS_LIGHT_PALETTE,
    dark: BAUHAUS_DARK_PALETTE,
  },
} as const;
