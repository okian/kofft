import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { DesignProvider } from "./DesignContext";
import { DesignToggle } from "./DesignToggle";
import { PALETTES } from "./designs";
import { parseDesign, parseMode } from "./DesignToggle";

/**
 * Convenience helper rendering the toggle within its provider. The wrapper
 * mirrors real-world usage and allows tests to interact with context state
 * exactly as the application does.
 */
function renderWithProvider() {
  return render(
    <DesignProvider>
      <DesignToggle />
    </DesignProvider>,
  );
}

/**
 * Retrieve computed styles for the document root. Named function keeps tests
 * concise while ensuring the call site is obvious.
 */
function rootStyles(): CSSStyleDeclaration {
  return getComputedStyle(document.documentElement);
}

/** Validate that selecting each design updates the DOM attribute. */
describe("DesignToggle", () => {
  afterEach(cleanup);
  it.each(["japanese-a", "japanese-b", "bauhaus"] as const)(
    "switches to %s",
    (design) => {
      const { getByTestId } = renderWithProvider();
      fireEvent.change(getByTestId("design-select"), {
        target: { value: design },
      });
      expect(document.documentElement.getAttribute("data-design")).toBe(design);
    },
  );

  /** Ensure colour mode changes propagate to the root element. */
  it("switches mode", () => {
    const { getByTestId } = renderWithProvider();
    fireEvent.change(getByTestId("mode-select"), { target: { value: "dark" } });
    expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
  });

  /** Japanese Option B should expose the red accent colour in all modes. */
  it.each(["light", "dark"] as const)(
    "applies red accent for Option B in %s mode",
    (mode) => {
      const { getByTestId } = renderWithProvider();
      fireEvent.change(getByTestId("design-select"), {
        target: { value: "japanese-b" },
      });
      fireEvent.change(getByTestId("mode-select"), { target: { value: mode } });
      const accent = rootStyles().getPropertyValue("--color-accent").trim();
      expect(accent).toBe(PALETTES["japanese-b"][mode].accent);
    },
  );

  /** Option A remains monochrome and must not adopt the red accent. */
  it.each(["light", "dark"] as const)(
    "keeps Option A monochrome in %s mode",
    (mode) => {
      const { getByTestId } = renderWithProvider();
      fireEvent.change(getByTestId("design-select"), {
        target: { value: "japanese-a" },
      });
      fireEvent.change(getByTestId("mode-select"), { target: { value: mode } });
      const accent = rootStyles().getPropertyValue("--color-accent").trim();
      expect(accent).toBe(PALETTES["japanese-a"][mode].accent);
      expect(accent).not.toBe(PALETTES["japanese-b"][mode].accent);
    },
  );

  /**
   * Switching away from Bauhaus should remove secondary and tertiary colour
   * variables so that minimalist designs remain free of unused values.
   */
  it("clears Bauhaus-only variables when switching to Japanese", () => {
    const { getByTestId } = renderWithProvider();
    fireEvent.change(getByTestId("design-select"), {
      target: { value: "bauhaus" },
    });
    const palette = PALETTES.bauhaus.light;
    expect(rootStyles().getPropertyValue("--color-secondary").trim()).toBe(
      palette.secondary,
    );
    expect(rootStyles().getPropertyValue("--color-tertiary").trim()).toBe(
      palette.tertiary,
    );
    fireEvent.change(getByTestId("design-select"), {
      target: { value: "japanese-a" },
    });
    expect(rootStyles().getPropertyValue("--color-secondary")).toBe("");
    expect(rootStyles().getPropertyValue("--color-tertiary")).toBe("");
  });

  /**
   * The parser rejects unknown design identifiers, preventing undefined
   * themes from reaching application state.
   */
  it("throws on invalid design", () => {
    expect(() => parseDesign("invalid" as string)).toThrow(/Unknown design/);
  });

  /**
   * The parser rejects unknown colour modes, ensuring the shell only switches
   * between light and dark configurations.
   */
  it("throws on invalid mode", () => {
    expect(() => parseMode("weird" as string)).toThrow(/Unknown mode/);
  });
});
