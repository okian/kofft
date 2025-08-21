import { Palette } from "../../designs";

/** Pure white representing empty space in Japanese layouts. */
export const JPN_WHITE = "#ffffff" as const;

/** Absolute black used for text in Japanese themes. */
export const JPN_BLACK = "#000000" as const;

/** Muted red accent for the 'B' variant. */
export const JPN_RED = "#cc0000" as const;

/** Light mode palette for Japanese design A with monochrome accent. */
export const JAPANESE_A_LIGHT_PALETTE: Palette = {
  background: JPN_WHITE,
  text: JPN_BLACK,
  accent: JPN_BLACK,
} as const;

/** Dark mode palette for Japanese design A. */
export const JAPANESE_A_DARK_PALETTE: Palette = {
  background: JPN_BLACK,
  text: JPN_WHITE,
  accent: JPN_WHITE,
} as const;

/** Light mode palette for Japanese design B using red accent. */
export const JAPANESE_B_LIGHT_PALETTE: Palette = {
  background: JPN_WHITE,
  text: JPN_BLACK,
  accent: JPN_RED,
} as const;

/** Dark mode palette for Japanese design B using red accent. */
export const JAPANESE_B_DARK_PALETTE: Palette = {
  background: JPN_BLACK,
  text: JPN_WHITE,
  accent: JPN_RED,
} as const;
