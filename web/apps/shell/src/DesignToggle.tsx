import React from "react";
import { useDesign } from "./DesignContext";
import type { Design, Mode } from "./designs";

/**
 * Controlled dropdown allowing users to switch design system and colour mode.
 * The component is intentionally simple to avoid unnecessary re-renders and
 * does not perform any validation beyond the enums enforced by context.
 */
export function DesignToggle() {
  const { design, mode, setDesign, setMode } = useDesign();

  const handleDesignChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDesign(e.target.value as Design);
  };

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMode(e.target.value as Mode);
  };

  return (
    <div style={{ padding: "0.5rem", display: "flex", gap: "0.5rem" }}>
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
