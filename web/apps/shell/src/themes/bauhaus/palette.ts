import { Palette } from "../../designs";

/** Pure white base of Bauhaus compositions. */
export const BAUHAUS_WHITE = "#ffffff" as const;

/** Pure black providing strong contrast. */
export const BAUHAUS_BLACK = "#000000" as const;

/** Primary red accent echoing Bauhaus colour theory. */
export const BAUHAUS_RED = "#cc0000" as const;

/** Deep blue secondary accent. */
export const BAUHAUS_BLUE = "#0047ab" as const;

/** Bright yellow tertiary accent. */
export const BAUHAUS_YELLOW = "#ffde00" as const;

/** Light mode palette for Bauhaus design. */
export const BAUHAUS_LIGHT_PALETTE: Palette = {
  background: BAUHAUS_WHITE,
  text: BAUHAUS_BLACK,
  accent: BAUHAUS_RED,
  secondary: BAUHAUS_BLUE,
  tertiary: BAUHAUS_YELLOW,
} as const;

/** Dark mode palette for Bauhaus design. */
export const BAUHAUS_DARK_PALETTE: Palette = {
  background: BAUHAUS_BLACK,
  text: BAUHAUS_WHITE,
  accent: BAUHAUS_RED,
  secondary: BAUHAUS_BLUE,
  tertiary: BAUHAUS_YELLOW,
} as const;
