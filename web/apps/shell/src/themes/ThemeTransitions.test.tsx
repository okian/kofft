import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

import { JapaneseLayout } from "./japanese/JapaneseLayout";
import { BauhausLayout, Block, Line } from "./bauhaus/BauhausLayout";
import { WHITE } from "./bauhaus/palette";
import { THEME_TRANSITION_CLASS } from "../ui/ThemeTransitionClass";

/** Resolve path to this test file for locating stylesheets. */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load a theme stylesheet to verify presence of the transition rule.
 * Using a helper avoids duplicating path resolution logic.
 */
function loadCss(relative: string): string {
  const cssPath = resolve(__dirname, relative);
  return readFileSync(cssPath, "utf8");
}

/** Placeholder element rendered in layout sections during tests. */
const DUMMY = <div />;

describe("theme transition class", () => {
  it("is defined in Japanese theme CSS", () => {
    const css = loadCss("./japanese.css");
    expect(css).toMatch(/\.theme-transition\s*{[^}]*transition/);
  });

  it("is defined in Bauhaus theme CSS", () => {
    const css = loadCss("./bauhaus.css");
    expect(css).toMatch(/\.theme-transition\s*{[^}]*transition/);
  });

  it("applies to Japanese layout sections", () => {
    const { container } = render(
      <JapaneseLayout header={DUMMY} footer={DUMMY}>
        {DUMMY}
      </JapaneseLayout>,
    );
    const sections = container.querySelectorAll(`.${THEME_TRANSITION_CLASS}`);
    expect(sections.length).toBe(3);
  });

  it("applies to Bauhaus layout primitives", () => {
    const { container: layout } = render(
      <BauhausLayout header={DUMMY} footer={DUMMY}>
        {DUMMY}
      </BauhausLayout>,
    );
    expect(layout.querySelectorAll(`.${THEME_TRANSITION_CLASS}`).length).toBe(3);

    const { container: block } = render(
      <Block color={WHITE} column={1} row={1} />,
    );
    expect(
      block.firstElementChild?.classList.contains(THEME_TRANSITION_CLASS),
    ).toBe(true);

    const { container: line } = render(
      <Line color={WHITE} orientation="horizontal" index={1} />,
    );
    expect(
      line.firstElementChild?.classList.contains(THEME_TRANSITION_CLASS),
    ).toBe(true);
  });
});
