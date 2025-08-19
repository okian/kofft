export const TITLE_FONT_STEP = 0.125; // rem
export const INFO_MAX_CH = 36; // characters for max width
export const MARQUEE_DELAY_MS = 1500; // ms
export const MARQUEE_DURATION_MULTIPLIER = 8; // seconds
export const MARQUEE_MIN_DURATION = 5; // seconds
export const NEXT_WINDOW_SEC = 7; // seconds
export const SIZE_SWAP_DURATION_MS = 300; // ms
export const PREFERS_REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
