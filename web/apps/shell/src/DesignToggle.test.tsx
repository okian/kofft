import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { DesignProvider } from "./DesignContext";
import { DesignToggle, applyDesign, applyMode, parseDesign, parseMode } from "./DesignToggle";
import type { Design, Mode } from "./designs";
import { PALETTES } from "./designs";

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

  /**
   * Applying a known design should update the provided setter.
   */
  it("applies valid design selection", () => {
    let selected: Design | undefined;
    applyDesign("bauhaus", (d) => {
      selected = d;
    });
    expect(selected).toBe("bauhaus");
  });

  /**
   * Attempting to apply an unknown design must throw immediately.
   */
  it("rejects invalid design selection", () => {
    expect(() => applyDesign("mystery" as string, () => {})).toThrow(
      /Unknown design/,
    );
  });

  /**
    * Applying a valid mode should reach the setter unchanged.
    */
  it("applies valid mode selection", () => {
    let selected: Mode | undefined;
    applyMode("dark", (m) => {
      selected = m;
    });
    expect(selected).toBe("dark");
  });

  /**
   * Unknown modes are rejected to prevent unsupported UI states.
   */
  it("rejects invalid mode selection", () => {
    expect(() => applyMode("pink" as string, () => {})).toThrow(/Unknown mode/);
  });
});
