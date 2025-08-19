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
    const titleScale = Number(
      container.style.getPropertyValue("--title-scale"),
    );
    const metaScale = Number(container.style.getPropertyValue("--meta-scale"));
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
    await new Promise((r) => setTimeout(r, 610));
    const container = screen.getByTestId("control-section");

    const titleScale = Number(
      container.style.getPropertyValue("--title-scale"),
    );
    const metaScale = Number(container.style.getPropertyValue("--meta-scale"));

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
  it("animates album art when switching to next with a new album", async () => {
    const { rerender } = render(
      <ControlSection
        art="art1.jpg"
        title="Song"
        artist="Artist"
        album="Album1"
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
        art="art2.jpg"
        title="Song2"
        artist="Artist2"
        album="Album2"
        mode="next"
      />,
    );
    const stack = screen
      .getByTestId("control-section")
      .querySelector(".art-stack");
    expect(stack?.children.length).toBe(2);
    const next = screen.getByTestId("next-art");
    expect(next.className).toContain("animating");
    await new Promise((r) => setTimeout(r, 310));
    expect(screen.queryByTestId("next-art")).toBeNull();
    const current = screen.getByTestId("current-art");
    expect(current).toHaveAttribute("src", "art2.jpg");
  });
});
