import React from "react";
import { useDesign } from "./DesignContext";
import type { Design, Mode } from "./designs";

/** Consistent spacing for the toggle container. */
const CONTROL_SPACING = "0.5rem" as const;

/** CSS variable exposing the theme's primary accent colour. */
const ACCENT_VAR = "var(--color-accent)" as const;

/**
 * Validate a candidate design string against the supported set.
 * Using an explicit `switch` provides compile-time exhaustiveness
 * checks so new designs cannot be forgotten.
 */
export function parseDesign(value: string): Design {
  switch (value) {
    case "japanese-a":
    case "japanese-b":
    case "bauhaus":
      return value;
    default:
      throw new Error(`Unknown design: ${value}`);
  }
}

/**
 * Validate a candidate colour mode. A `switch` keeps the check
 * explicit and ensures unsupported modes fail fast.
 */
export function parseMode(value: string): Mode {
  switch (value) {
    case "light":
    case "dark":
      return value;
    default:
      throw new Error(`Unknown mode: ${value}`);
  }
}

/**
 * Validate and apply a new design value via the provided setter. The helper
 * is exported to enable direct unit testing of the defensive parsing logic.
 */
export function applyDesign(value: string, setter: (d: Design) => void): void {
  const design = parseDesign(value);
  setter(design);
}

/**
 * Validate and apply a new colour mode. Exported for unit testing of invalid
 * inputs without needing to interact with the DOM.
 */
export function applyMode(value: string, setter: (m: Mode) => void): void {
  const modeValue = parseMode(value);
  setter(modeValue);
}

/**
 * Controlled dropdown allowing users to switch design system and colour mode.
 * Runtime validation is performed to guard against unknown values originating
 * from malformed DOM or malicious scripts.
 */
export function DesignToggle() {
  const { design, mode, setDesign, setMode } = useDesign();

  /**
   * Handles design changes by verifying the selected value exists in the
   * predefined set. Throws an error when an unknown design is encountered to
   * surface issues immediately.
   */
  const handleDesignChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    applyDesign(e.target.value, setDesign);
  };

  /**
   * Handles mode changes with the same defensive checks as designs, ensuring
   * only supported modes reach the context state.
   */
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    applyMode(e.target.value, setMode);
  };

  return (
    <div
      style={{
        padding: CONTROL_SPACING,
        display: "flex",
        gap: CONTROL_SPACING,
      }}
    >
      <label>
        Design:
        <select
          value={design}
          onChange={handleDesignChange}
          data-testid="design-select"
          style={{ color: ACCENT_VAR, borderColor: ACCENT_VAR }}
        >
          <option value="japanese-a">Japanese A</option>
          <option value="japanese-b">Japanese B</option>
          <option value="bauhaus">Bauhaus</option>
        </select>
      </label>
      <label>
        Mode:
        <select
          value={mode}
          onChange={handleModeChange}
          data-testid="mode-select"
          style={{ color: ACCENT_VAR, borderColor: ACCENT_VAR }}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </div>
  );
}
