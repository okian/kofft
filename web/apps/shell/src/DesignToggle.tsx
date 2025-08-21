import React from "react";
import { useDesign } from "./DesignContext";
import type { Design, Mode } from "./designs";
import { PALETTES } from "./designs";

/** Consistent spacing for the toggle container. */
const CONTROL_SPACING = "0.5rem" as const;

/**
 * Lookup set of allowed design identifiers. Using a Set provides constant
 * time membership checks and avoids repeatedly allocating arrays on each
 * render.
 */
const VALID_DESIGNS: ReadonlySet<Design> = new Set(
  Object.keys(PALETTES) as Design[],
);

/**
 * Lookup set of allowed colour modes. Maintained separately so that any
 * change in supported modes requires updating a single constant.
 */
const VALID_MODES: ReadonlySet<Mode> = new Set<Mode>(["light", "dark"]);

/**
 * Convert an arbitrary string into a validated Design. Rejects unknown values
 * with a descriptive error to prevent silent fallbacks.
 */
export function parseDesign(value: string): Design {
  if (!VALID_DESIGNS.has(value as Design)) {
    throw new Error(`Unknown design: ${value}`);
  }
  return value as Design;
}

/**
 * Convert an arbitrary string into a validated Mode. Rejects unknown values
 * with a descriptive error to prevent silent fallbacks.
 */
export function parseMode(value: string): Mode {
  if (!VALID_MODES.has(value as Mode)) {
    throw new Error(`Unknown mode: ${value}`);
  }
  return value as Mode;
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
    const value = parseDesign(e.target.value);
    setDesign(value);
  };

  /**
   * Handles mode changes with the same defensive checks as designs, ensuring
   * only supported modes reach the context state.
   */
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseMode(e.target.value);
    setMode(value);
  };

  return (
    <div style={{ padding: CONTROL_SPACING, display: "flex", gap: CONTROL_SPACING }}>
      <label>
        Design:
        <select
          value={design}
          onChange={handleDesignChange}
          data-testid="design-select"
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
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </div>
  );
}
