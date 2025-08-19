import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { span: (props: any) => <span {...props} /> },
}));
import { AlternatingInfo } from "../layout/AlternatingInfo";

describe("AlternatingInfo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  it("activates marquee when text overflows", () => {
    render(
      <div style={{ width: "50px" }}>
        <AlternatingInfo
          artist="This is a very long artist name that should overflow"
          album="Album"
          interval={1000}
        />
      </div>,
    );

    const container = screen.getByTestId("alternating-info-text").parentElement as HTMLElement;
    const span = screen.getByTestId("alternating-info-text");

    Object.defineProperty(container, "clientWidth", {
      value: 50,
      configurable: true,
    });
    Object.defineProperty(span, "scrollWidth", {
      value: 200,
      configurable: true,
    });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(span.classList.contains("marquee")).toBe(true);
  });
});
