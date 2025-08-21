import React, { useEffect } from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DesignProvider, useDesign } from "./DesignContext";
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
    expect(styles.getPropertyValue("--color-bg").trim()).toBe(palette.background);
    expect(styles.getPropertyValue("--color-text").trim()).toBe(palette.text);
    expect(styles.getPropertyValue("--color-accent").trim()).toBe(palette.accent);
    if (palette.secondary)
      expect(styles.getPropertyValue("--color-secondary").trim()).toBe(palette.secondary);
    if (palette.tertiary)
      expect(styles.getPropertyValue("--color-tertiary").trim()).toBe(palette.tertiary);
  });
});
