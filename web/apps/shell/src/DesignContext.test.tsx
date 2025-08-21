import React, { useEffect } from "react";
import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { DesignProvider, useDesign, applyPalette } from "./DesignContext";
import { PALETTES, Design, Mode } from "./designs";

/**
 * Helper component forcing a specific design and mode when mounted.
 * It exercises the setter functions to ensure state updates propagate
 * correctly through the provider.
 */
function Apply({ design, mode }: { design: Design; mode: Mode }) {
  const { setDesign, setMode } = useDesign();
  useEffect(() => {
    setDesign(design);
    setMode(mode);
  }, [design, mode, setDesign, setMode]);
  return null;
}

/** Retrieve computed styles for the document root. */
function rootStyles(): CSSStyleDeclaration {
  return getComputedStyle(document.documentElement);
}

/** Name of the CSS variable for secondary accent colour. */
const VAR_SECONDARY = "--color-secondary" as const;
/** Name of the CSS variable for tertiary accent colour. */
const VAR_TERTIARY = "--color-tertiary" as const;

describe("DesignProvider", () => {
  it.each([
    ["japanese-a", "light"],
    ["japanese-a", "dark"],
    ["japanese-b", "light"],
    ["japanese-b", "dark"],
    ["bauhaus", "light"],
    ["bauhaus", "dark"],
  ])("applies palette for %s in %s mode", (design, mode) => {
    render(
      <DesignProvider>
        <Apply design={design as Design} mode={mode as Mode} />
      </DesignProvider>,
    );
    const styles = rootStyles();
    const palette = PALETTES[design as Design][mode as Mode];
    expect(styles.getPropertyValue("--color-bg").trim()).toBe(
      palette.background,
    );
    expect(styles.getPropertyValue("--color-text").trim()).toBe(palette.text);
    expect(styles.getPropertyValue("--color-accent").trim()).toBe(
      palette.accent,
    );
    if (palette.secondary)
      expect(styles.getPropertyValue("--color-secondary").trim()).toBe(
        palette.secondary,
      );
    if (palette.tertiary)
      expect(styles.getPropertyValue("--color-tertiary").trim()).toBe(
        palette.tertiary,
      );
  });

  /**
   * Switching from Bauhaus to Japanese should clear Bauhaus-only CSS variables
   * to avoid stale values polluting minimalist designs.
   */
  it("removes Bauhaus-only variables when switching to Japanese", async () => {
    const { rerender } = render(
      <DesignProvider>
        <Apply design={"bauhaus" as Design} mode={"light" as Mode} />
      </DesignProvider>,
    );
    const bauhaus = PALETTES.bauhaus.light;
    expect(rootStyles().getPropertyValue(VAR_SECONDARY).trim()).toBe(
      bauhaus.secondary,
    );
    expect(rootStyles().getPropertyValue(VAR_TERTIARY).trim()).toBe(
      bauhaus.tertiary,
    );
    rerender(
      <DesignProvider>
        <Apply design={"japanese-a" as Design} mode={"light" as Mode} />
      </DesignProvider>,
    );
    await waitFor(() => {
      const styles = rootStyles();
      expect(styles.getPropertyValue(VAR_SECONDARY)).toBe("");
      expect(styles.getPropertyValue(VAR_TERTIARY)).toBe("");
    });
  });

  it("throws on invalid palette", () => {
    /** Regular expression matching palette validation errors. */
    const ERR_RE = /valid palette/;
    /**
     * Palettes intentionally missing required fields or providing
     * incorrect types. Each entry exercises a separate validation path.
     */
    const badPalettes = [
      undefined,
      {},
      { background: "#fff", text: "#000" },
      { background: "#fff", accent: "#000" },
      { text: "#000", accent: "#fff" },
      { background: "#fff", text: "#000", accent: 123 },
    ] as const;
    for (const p of badPalettes) {
      expect(() => applyPalette(p as any)).toThrow(ERR_RE);
    }
  });
});
