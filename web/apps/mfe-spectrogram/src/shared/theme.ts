/**
 * Mapping of themes to their accent and primary colors.
 * Centralizes color definitions to avoid scattering hex literals and
 * allows components to derive consistent styling from the active theme.
 */
import { Theme } from "@/shared/types";

/**
 * Hard-coded color palette for each supported theme.
 * Both accent and primary colors are hex strings and intentionally kept
 * minimal to reduce memory and avoid runtime color computation.
 */
export const THEME_COLORS: Record<
  Theme,
  { accent: string; primary: string; background: string }
> = {
  // Japanese A: strict black and white; light uses white canvas with black ink.
  "japanese-a-light": {
    accent: "#000000",
    primary: "#000000",
    background: "#ffffff",
  },
  // Japanese A dark flips the monochrome scheme for night viewing.
  "japanese-a-dark": {
    accent: "#ffffff",
    primary: "#ffffff",
    background: "#000000",
  },
  // Japanese B introduces the flag's red sun against neutral companions.
  "japanese-b-light": {
    accent: "#e60026",
    primary: "#000000",
    background: "#ffffff",
  },
  // Japanese B dark keeps the red accent while swapping text to white.
  "japanese-b-dark": {
    accent: "#e60026",
    primary: "#ffffff",
    background: "#000000",
  },
  // Bauhaus light draws from modernist primaries: red accents, blue primaries.
  "bauhaus-light": {
    accent: "#ff0000",
    primary: "#0000ff",
    background: "#ffffff",
  },
  // Bauhaus dark uses red on yellow with black backdrop for stark blocks.
  "bauhaus-dark": {
    accent: "#ff0000",
    primary: "#ffff00",
    background: "#000000",
  },
} as const;
