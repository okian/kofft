import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import ControlSection from "../common/ControlSection";

describe("ControlSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("is in now playing mode without coming-up class by default", () => {
    render(
      <ControlSection
        art="art.jpg"
        title="Song"
        artist="Artist"
        album="Album"
        mode="now"
      />,
    );
    const container = screen.getByTestId("control-section");
    expect(container.classList.contains("coming-up")).toBe(false);
  });

  it("flips ratio and shows coming up text when mode changes", async () => {
    const { rerender } = render(
      <ControlSection
        art="art.jpg"
        title="Song"
        artist="Artist"
        album="Album"
        mode="now"
      />,
    );
    rerender(
      <ControlSection
        art="art.jpg"
        title="Next Song"
        artist="Next Artist"
        album="Next Album"
        mode="next"
      />,
    );
    await new Promise((r) => setTimeout(r, 610));
    const container = screen.getByTestId("control-section");
    const meta = screen.getByTestId("song-meta");
    expect(meta).toHaveTextContent("Coming Up Next");
    expect(container.classList.contains("coming-up")).toBe(true);
  });

  it("uses quick fade when only text changes", async () => {
    const { rerender } = render(
      <ControlSection
        art="art.jpg"
        title="Song"
        artist="Artist"
        album="Album"
        mode="now"
      />,
    );
    rerender(
      <ControlSection
        art="art.jpg"
        title="Song 2"
        artist="Artist"
        album="Album"
        mode="now"
      />,
    );
    const container = screen.getByTestId("control-section");
    expect(container.style.getPropertyValue("--fade-duration")).toBe("200ms");
    await new Promise((r) => setTimeout(r, 210));
    await screen.findByText("Song 2");
  });

  it("toggles fade and scale classes in order", async () => {
    const { rerender } = render(
      <ControlSection
        art="art.jpg"
        title="Song"
        artist="Artist"
        album="Album"
        mode="now"
      />,
    );
    rerender(
      <ControlSection
        art="art.jpg"
        title="Next Song"
        artist="Next Artist"
        album="Next Album"
        mode="next"
      />,
    );
    const container = screen.getByTestId("control-section");
    expect(container.classList.contains("fade-out")).toBe(true);
    await new Promise((r) => setTimeout(r, 310));
    expect(container.classList.contains("fade-in")).toBe(true);
    expect(container.classList.contains("fade-out")).toBe(false);
    await new Promise((r) => setTimeout(r, 310));
    expect(container.classList.contains("coming-up")).toBe(true);
    expect(container.classList.contains("fade-in")).toBe(false);
  });
});
