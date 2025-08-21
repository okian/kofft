import React, { createContext, useContext, useState, useEffect } from "react";
import { Design, Mode, PALETTES, Palette } from "./designs";

/**
 * Shape of the design context exposed to React components.
 * design    - currently active design system.
 * mode      - light or dark colour mode.
 * setDesign - updates the active design system.
 * setMode   - updates the colour mode.
 */
export interface DesignContextValue {
  readonly design: Design;
  readonly mode: Mode;
  setDesign: (design: Design) => void;
  setMode: (mode: Mode) => void;
}

/** Default context used when no provider is present. */
const DesignContext = createContext<DesignContextValue | undefined>(undefined);

/** Name of the DOM attribute storing the active design. */
const DESIGN_ATTR = "data-design";
/** Name of the DOM attribute storing the active colour mode. */
const MODE_ATTR = "data-mode";
/** Prefix shared by Japanese design identifiers. */
const JAPANESE_PREFIX = "japanese" as const;

/** Name of the CSS variable for page background colour. */
const VAR_BG = "--color-bg" as const;
/** Name of the CSS variable for default text colour. */
const VAR_TEXT = "--color-text" as const;
/** Name of the CSS variable for primary accent colour. */
const VAR_ACCENT = "--color-accent" as const;
/** Name of the CSS variable for secondary accent colour. */
const VAR_SECONDARY = "--color-secondary" as const;
/** Name of the CSS variable for tertiary accent colour. */
const VAR_TERTIARY = "--color-tertiary" as const;

/**
 * Apply a palette to the document root.
 * Secondary and tertiary colours are explicitly removed when absent to
 * prevent stale values from previous designs leaking into the current theme.
 */
function applyPalette(palette: Palette): void {
  const root = document.documentElement;
  root.style.setProperty(VAR_BG, palette.background);
  root.style.setProperty(VAR_TEXT, palette.text);
  root.style.setProperty(VAR_ACCENT, palette.accent);
  if (palette.secondary) {
    root.style.setProperty(VAR_SECONDARY, palette.secondary);
  } else {
    root.style.removeProperty(VAR_SECONDARY);
  }
  if (palette.tertiary) {
    root.style.setProperty(VAR_TERTIARY, palette.tertiary);
  } else {
    root.style.removeProperty(VAR_TERTIARY);
  }
}

/**
 * Dynamically load the CSS theme corresponding to a design. Using a
 * function avoids duplicating import logic within effects and ensures
 * the bundler can split CSS for performance.
 */
async function loadTheme(design: Design): Promise<void> {
  const base = design.startsWith(JAPANESE_PREFIX) ? "japanese" : "bauhaus";
  await import(`./themes/${base}.css`);
}

/**
 * Provider component holding design state and synchronising
 * palette variables with the DOM. It ensures deterministic
 * behaviour by restricting design and mode to explicit enums.
 */
export function DesignProvider({ children }: { children: React.ReactNode }) {
  const [design, setDesign] = useState<Design>("japanese-a");
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const palette = PALETTES[design][mode];
    applyPalette(palette);
    const root = document.documentElement;
    root.setAttribute(DESIGN_ATTR, design);
    root.setAttribute(MODE_ATTR, mode);
    loadTheme(design).catch((err) => {
      console.error("Failed to load theme", err);
    });
  }, [design, mode]);

  return (
    <DesignContext.Provider value={{ design, mode, setDesign, setMode }}>
      {children}
    </DesignContext.Provider>
  );
}

/**
 * Accessor hook for the design context. Throws early when used
 * outside of the provider, making failures immediately visible.
 */
export function useDesign(): DesignContextValue {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error("useDesign must be used within DesignProvider");
  return ctx;
}
