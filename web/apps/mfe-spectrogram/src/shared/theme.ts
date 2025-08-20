/**
 * Mapping of themes to their accent and primary colors.
 * Centralizes color definitions to avoid scattering hex literals and
 * allows components to derive consistent styling from the active theme.
 */
import { Theme } from "@/types";

/**
 * Hard-coded color palette for each supported theme.
 * Both accent and primary colors are hex strings and intentionally kept
 * minimal to reduce memory and avoid runtime color computation.
 */
export const THEME_COLORS: Record<Theme, { accent: string; primary: string }> =
  {
    // Classic dark theme: blue accents with neutral grays.
    dark: { accent: "#3b82f6", primary: "#6b7280" },
    // Light theme uses slightly darker blues and lighter grays for contrast.
    light: { accent: "#2563eb", primary: "#9ca3af" },
    // Neon theme favours a vivid teal accent; primary remains neutral to
    // prevent eye strain despite the bright palette.
    neon: { accent: "#14b8a6", primary: "#a3a3a3" },
    // High contrast aims for maximal legibility: white accent on black primary.
    "high-contrast": { accent: "#ffffff", primary: "#000000" },
  } as const;
