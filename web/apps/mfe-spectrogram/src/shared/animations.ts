import { MotionProps } from "framer-motion";
import { useSettingsStore } from "./stores/settingsStore";
import { AnimationStyle } from "./types";

/** Default duration for relaxed animations in seconds. */
const CALM_DURATION_S = 0.4;
/** Default duration for snappy animations in seconds. */
const GEOMETRIC_DURATION_S = 0.2;
/** Horizontal offset used when sliding elements into view. */
const SLIDE_OFFSET_PX = 16;

/**
 * CALM_FADE gently fades components in and out.
 * User impact: reduces visual jitter for continuous reading.
 * Performance: opacity changes avoid layout recalculation so they stay cheap.
 */
export const CALM_FADE: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: CALM_DURATION_S, ease: "easeInOut" },
};

/**
 * CALM_SLIDE moves content a short distance while fading.
 * User impact: subtle spatial cue helps orientation without distraction.
 * Performance: small translate values leverage GPU acceleration.
 */
export const CALM_SLIDE: MotionProps = {
  initial: { opacity: 0, x: -SLIDE_OFFSET_PX },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -SLIDE_OFFSET_PX },
  transition: { duration: CALM_DURATION_S, ease: "easeInOut" },
};

/**
 * GEOMETRIC_SLIDE snaps content linearly with no easing.
 * User impact: crisp movement mirrors Bauhaus aesthetics.
 * Performance: linear tween keeps calculations deterministic and light.
 */
export const GEOMETRIC_SLIDE: MotionProps = {
  initial: { x: -SLIDE_OFFSET_PX },
  animate: { x: 0 },
  exit: { x: -SLIDE_OFFSET_PX },
  transition: { duration: GEOMETRIC_DURATION_S, ease: "linear" },
};

/**
 * GRID_REVEAL scales and fades items like tiles appearing in sequence.
 * User impact: emphasises structured layouts while remaining quick.
 * Performance: combines transform and opacity to stay on the GPU path.
 */
export const GRID_REVEAL: MotionProps = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
  transition: { duration: GEOMETRIC_DURATION_S, ease: "linear" },
};

const PRESETS = {
  CALM_FADE,
  CALM_SLIDE,
  GEOMETRIC_SLIDE,
  GRID_REVEAL,
} as const;

export type PresetName = keyof typeof PRESETS;
export type AnimationKind = "fade" | "slide" | "grid";

/** Lookup from animation kind and style to preset name. */
const STYLE_PRESET_MAP: Record<
  AnimationKind,
  Record<AnimationStyle, PresetName>
> = {
  fade: { calm: "CALM_FADE", geometric: "GEOMETRIC_SLIDE" },
  slide: { calm: "CALM_SLIDE", geometric: "GEOMETRIC_SLIDE" },
  grid: { calm: "CALM_SLIDE", geometric: "GRID_REVEAL" },
};

/**
 * Returns motion properties for the current theme's animation style.
 * The data-preset attribute allows tests to assert which preset was chosen.
 */
export function useAnimationPreset(
  kind: AnimationKind,
): MotionProps & { "data-preset": PresetName } {
  const style = useSettingsStore((s) => s.animationStyle);
  const presetName = STYLE_PRESET_MAP[kind][style];
  const preset = PRESETS[presetName];
  return { ...preset, "data-preset": presetName };
}

