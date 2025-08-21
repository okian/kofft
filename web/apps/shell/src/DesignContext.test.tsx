import React from "react";
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { DesignProvider } from "./DesignContext";
import { DesignToggle } from "./DesignToggle";

/** Helper wrapper combining provider and toggle for tests. */
function setup() {
  render(
    <DesignProvider>
      <DesignToggle />
    </DesignProvider>,
  );
}

describe("DesignProvider", () => {
  it("applies attributes and palette variables", () => {
    setup();
    const root = document.documentElement;
    expect(root.getAttribute("data-design")).toBe("japanese-a");
    expect(root.getAttribute("data-mode")).toBe("light");
    // Switching to Bauhaus dark should update attributes and colours.
    fireEvent.change(screen.getByTestId("design-select"), {
      target: { value: "bauhaus" },
    });
    fireEvent.change(screen.getByTestId("mode-select"), {
      target: { value: "dark" },
    });
    expect(root.getAttribute("data-design")).toBe("bauhaus");
    expect(root.getAttribute("data-mode")).toBe("dark");
    const styles = getComputedStyle(root);
    expect(styles.getPropertyValue("--color-secondary").trim()).toBe("#0047ab");
  });
});
