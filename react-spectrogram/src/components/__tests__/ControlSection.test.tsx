import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import ControlSection from "../common/ControlSection";

describe("ControlSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies 3:1 typography ratio in now playing mode", () => {
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
    const titleScale = Number(
      container.style.getPropertyValue("--title-scale"),
    );
    const metaScale = Number(
      container.style.getPropertyValue("--meta-scale"),
    );
    expect(titleScale / metaScale).toBe(3);
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
    await new Promise((r) => setTimeout(r, 310));
    await screen.findByTestId("song-title");
    const container = screen.getByTestId("control-section");
    const titleScale = Number(
      container.style.getPropertyValue("--title-scale"),
    );
    const metaScale = Number(
      container.style.getPropertyValue("--meta-scale"),
    );
    const meta = screen.getByTestId("song-meta");
    expect(meta).toHaveTextContent("Coming Up Next");
    expect(metaScale / titleScale).toBe(3);
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
});
