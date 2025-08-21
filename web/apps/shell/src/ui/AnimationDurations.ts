/**
 * Animation timing constants used across shell UI components.
 * Consolidating durations encourages consistent motion design and
 * simplifies future tuning for performance.
 */

/** Fade transition duration in milliseconds providing subtlety without lag. */
export const FADE_DURATION_MS = 200 as const;

/** Slide transition duration in milliseconds balancing speed and clarity. */
export const SLIDE_DURATION_MS = 250 as const;

/**
 * Base animation duration in milliseconds used by global theme transitions.
 * Centralising this value prevents magic numbers in CSS and keeps JavaScript
 * timing in sync with stylesheets.
 */
export const THEME_ANIMATION_MS = 300 as const;

/**
 * Name of the CSS custom property mirroring {@link THEME_ANIMATION_MS}.
 * The build step reads this constant to emit `animation-durations.css`,
 * ensuring that styles and logic derive from a single authoritative value.
 */
export const THEME_ANIMATION_CSS_VAR = "--anim-duration" as const;
