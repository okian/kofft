// @vitest-environment jsdom
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: (props: any) => <div {...props} /> },
}));
import { useSettingsStore } from "@/shared/stores/settingsStore";
import { AlternatingInfo } from "../layout/AlternatingInfo";

describe("AlternatingInfo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSettingsStore.getState().resetToDefaults();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("alternates between artist and album", async () => {
    render(
      <AlternatingInfo
        artist="Artist Name"
        album="Album Title"
        interval={1000}
      />,
    );

    await act(async () => {});

    const getLastText = () => {
      const nodes = screen.getAllByTestId("alternating-info-text");
      return nodes[nodes.length - 1];
    };

    expect(getLastText()).toHaveTextContent("Artist Name");

    await vi.advanceTimersByTimeAsync(1000);
    expect(getLastText()).toHaveTextContent("Album Title");

    await vi.advanceTimersByTimeAsync(1000);
    expect(getLastText()).toHaveTextContent("Artist Name");
  });

  it("uses calm preset for Japanese themes and geometric for Bauhaus", () => {
    useSettingsStore.getState().setTheme("japanese-a-light");
    render(<AlternatingInfo artist="A" album="B" />);
    let wrapper = screen.getByTestId("alternating-info-animation");
    expect(wrapper.getAttribute("data-preset")).toBe("CALM_FADE");

    useSettingsStore.getState().setTheme("bauhaus-light");
    render(<AlternatingInfo artist="A" album="B" />);
    wrapper = screen.getAllByTestId("alternating-info-animation").pop()!;
    expect(wrapper.getAttribute("data-preset")).toBe("GEOMETRIC_SLIDE");
  });
});
