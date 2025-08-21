import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BauhausLayout, Block, GRID_COLUMNS } from "./BauhausLayout";
import { GRID_GAP_REM } from "../../ui/Spacing";
import { RED } from "./palette";

/** Convert hex colour strings to rgb() format for style comparisons. */
function toRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Validate BauhausLayout structure and primitives. */
describe("BauhausLayout", () => {
  it("renders header, content and footer in a grid", () => {
    const { getByText, container } = render(
      <BauhausLayout header={<div>H</div>} footer={<div>F</div>}>
        <p>C</p>
      </BauhausLayout>,
    );
    expect(getByText("H")).toBeDefined();
    expect(getByText("C")).toBeDefined();
    expect(getByText("F")).toBeDefined();
    const root = container.firstChild as HTMLElement;
    expect(root.style.display).toBe("grid");
    expect(root.style.gap).toBe(`${GRID_GAP_REM}rem`);
    expect(root.style.gridTemplateColumns).toBe(`repeat(${GRID_COLUMNS}, 1fr)`);
  });

  it("positions blocks with correct colour", () => {
    const { container } = render(
      <Block color={RED} column={1} row={1} columnSpan={2} rowSpan={3} />,
    );
    const block = container.firstChild as HTMLElement;
    expect(getComputedStyle(block).backgroundColor).toBe(toRgb(RED));
    expect(block.style.gridColumn).toBe("1 / span 2");
    expect(block.style.gridRow).toBe("1 / span 3");
  });

  it("throws on invalid colour inputs", () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render(<Block color={"#fff" as any} column={1} row={1} />),
    ).toThrow();
  });
});
