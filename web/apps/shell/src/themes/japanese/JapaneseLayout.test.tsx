import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { JapaneseLayout, LAYOUT_GAP_REM } from "./JapaneseLayout";

/** Validate JapaneseLayout behaviour and structure. */
describe("JapaneseLayout", () => {
  it("renders header, content and footer with balanced spacing", () => {
    const { getByText, container } = render(
      <JapaneseLayout header={<div>H</div>} footer={<div>F</div>}>
        <p>C</p>
      </JapaneseLayout>,
    );
    expect(getByText("H")).toBeDefined();
    expect(getByText("C")).toBeDefined();
    expect(getByText("F")).toBeDefined();
    const root = container.firstChild as HTMLElement;
    expect(root.style.display).toBe("flex");
    expect(root.style.gap).toBe(`${LAYOUT_GAP_REM}rem`);
  });

  it("throws on missing required props", () => {
    expect(() =>
      render(
        <JapaneseLayout header={null as any} footer={<div />}>text</JapaneseLayout>,
      ),
    ).toThrow();
    expect(() =>
      render(
        <JapaneseLayout header={<div />} footer={null as any}>text</JapaneseLayout>,
      ),
    ).toThrow();
    expect(() =>
      render(
        <JapaneseLayout header={<div />} footer={<div />}>{null}</JapaneseLayout>,
      ),
    ).toThrow();
  });
});
