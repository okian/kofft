import { Palette } from "../../designs";

/** Hex code representing pure white. Forms the base of light mode designs. */
export const WHITE = "#ffffff" as const;

/** Hex code representing pure black. Provides maximum contrast. */
export const BLACK = "#000000" as const;

/** Primary red accent echoing Bauhaus colour theory. */
export const RED = "#cc0000" as const;

/** Deep blue secondary accent. */
export const BAUHAUS_BLUE = "#0047ab" as const;

/** Bright yellow tertiary accent. */
export const BAUHAUS_YELLOW = "#ffde00" as const;

/** Light mode palette for Bauhaus design. */
export const BAUHAUS_LIGHT_PALETTE: Palette = {
  background: WHITE,
  text: BLACK,
  accent: RED,
  secondary: BAUHAUS_BLUE,
  tertiary: BAUHAUS_YELLOW,
} as const;

/** Dark mode palette for Bauhaus design. */
export const BAUHAUS_DARK_PALETTE: Palette = {
  background: BLACK,
  text: WHITE,
  accent: RED,
  secondary: BAUHAUS_BLUE,
  tertiary: BAUHAUS_YELLOW,
} as const;
