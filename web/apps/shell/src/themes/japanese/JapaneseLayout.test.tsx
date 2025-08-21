import React from "react";
import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { JapaneseLayout } from "./JapaneseLayout";
import { LAYOUT_GAP_REM } from "../../ui/Spacing";

/** Style opacity representing transparent state before fade-in. */
const OPACITY_TRANSPARENT = "0" as const;

/** Style opacity representing opaque state after fade-in. */
const OPACITY_OPAQUE = "1" as const;

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

  it("fades sections from transparent to opaque", async () => {
    const { container } = render(
      <JapaneseLayout header={<div>H</div>} footer={<div>F</div>}>
        <p>C</p>
      </JapaneseLayout>,
    );
    const [header, main, footer] = Array.from(
      container.querySelectorAll("header, main, footer"),
    ) as HTMLElement[];
    expect(header.style.opacity).toBe(OPACITY_TRANSPARENT);
    expect(main.style.opacity).toBe(OPACITY_TRANSPARENT);
    expect(footer.style.opacity).toBe(OPACITY_TRANSPARENT);
    await waitFor(() => expect(header.style.opacity).toBe(OPACITY_OPAQUE));
    await waitFor(() => expect(main.style.opacity).toBe(OPACITY_OPAQUE));
    await waitFor(() => expect(footer.style.opacity).toBe(OPACITY_OPAQUE));
  });

  it("throws on missing required props", () => {
    expect(() =>
      render(
        <JapaneseLayout header={null as any} footer={<div />}>
          text
        </JapaneseLayout>,
      ),
    ).toThrow();
    expect(() =>
      render(
        <JapaneseLayout header={<div />} footer={null as any}>
          text
        </JapaneseLayout>,
      ),
    ).toThrow();
    expect(() =>
      render(
        <JapaneseLayout header={<div />} footer={<div />}>
          {null}
        </JapaneseLayout>,
      ),
    ).toThrow();
  });
});
