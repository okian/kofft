import { Palette } from "../../designs";

/** Pure white representing blank negative space in Japanese layouts. */
export const WHITE = "#ffffff" as const;

/** Absolute black providing maximal contrast for text and lines. */
export const BLACK = "#000000" as const;

/** Muted red accent used only by the OptionB variant. */
export const RED = "#cc0000" as const;

/** Light mode palette for minimalist OptionA design using monochrome accents. */
export const OPTION_A_LIGHT_PALETTE: Palette = {
  background: WHITE,
  text: BLACK,
  accent: BLACK,
} as const;

/** Dark mode palette for minimalist OptionA design. */
export const OPTION_A_DARK_PALETTE: Palette = {
  background: BLACK,
  text: WHITE,
  accent: WHITE,
} as const;

/** Light mode palette for OptionB variant introducing a red accent. */
export const OPTION_B_LIGHT_PALETTE: Palette = {
  background: WHITE,
  text: BLACK,
  accent: RED,
} as const;

/** Dark mode palette for OptionB variant with red accent preserved. */
export const OPTION_B_DARK_PALETTE: Palette = {
  background: BLACK,
  text: WHITE,
  accent: RED,
} as const;
