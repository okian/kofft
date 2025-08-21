import React, { useEffect } from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DesignProvider, useDesign } from "./DesignContext";
import { DesignLayout } from "./DesignLayout";
import { Design, Mode } from "./designs";

/**
 * Helper forcing a specific design and mode to exercise the runtime switching
 * logic. Running it within an effect ensures state updates after mounting.
 */
function Apply({ design, mode }: { design: Design; mode: Mode }) {
  const { setDesign, setMode } = useDesign();
  useEffect(() => {
    setDesign(design);
    setMode(mode);
  }, [design, mode, setDesign, setMode]);
  return null;
}

// Ensure DOM is reset between tests to prevent cross-test contamination.
afterEach(() => cleanup());

describe("DesignLayout", () => {
  it.each([
    ["japanese-a", "flex"],
    ["japanese-b", "flex"],
    ["bauhaus", "grid"],
  ])("renders %s layout", (design, expectedDisplay) => {
    const { container, getByText } = render(
      <DesignProvider>
        <Apply design={design as Design} mode={"light"} />
        <DesignLayout header={<div>H</div>} footer={<div>F</div>}>
          <div>C</div>
        </DesignLayout>
      </DesignProvider>,
    );
    const layout = container.firstElementChild as HTMLElement;
    expect(layout.style.display).toBe(expectedDisplay);
    getByText("H");
    getByText("F");
    getByText("C");
  });

  it("throws when header missing", () => {
    expect(() =>
      render(
        <DesignProvider>
          <DesignLayout header={null as any} footer={<div />}>
            <div />
          </DesignLayout>
        </DesignProvider>,
      ),
    ).toThrow("header is required");
  });
});
