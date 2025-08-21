import { describe, it, expect } from "vitest";
import { LAYOUT_GAP_REM, GRID_GAP_REM, LINE_THICKNESS_REM } from "./Spacing";

/** Verify that shared spacing constants expose stable numeric values. */
describe("Spacing constants", () => {
  it("yields the expected layout gap", () => {
    expect(LAYOUT_GAP_REM).toBe(1);
  });

  it("yields the expected grid gap", () => {
    expect(GRID_GAP_REM).toBe(0.5);
  });

  it("yields the expected line thickness", () => {
    expect(LINE_THICKNESS_REM).toBe(0.25);
  });
});
