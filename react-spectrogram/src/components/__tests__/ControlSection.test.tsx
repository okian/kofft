import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ControlSection from "../common/ControlSection";
import * as PIXI from "pixi.js";

vi.mock("pixi.js", () => {
  const Application = vi.fn().mockImplementation(() => ({
    stage: { addChild: vi.fn(), removeChildren: vi.fn() },
    destroy: vi.fn(),
  }));

  const Sprite = { from: vi.fn(() => ({}) as any) };
  const Text = vi.fn(() => ({}));
  return { Application, Sprite, Text };
});

describe("ControlSection", () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let OriginalImage: any;
  beforeEach(() => {
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype as any, "getContext")
      .mockImplementation(
        () =>
          ({
            clearRect: vi.fn(),
            drawImage: vi.fn(),
            fillText: vi.fn(),
            fillStyle: "",
            font: "",
          }) as any,
      );
    OriginalImage = (global as any).Image;
    (global as any).Image = class {
      onload: (() => void) | null = null;
      set src(_: string) {
        this.onload && this.onload();
      }
    };
    cleanup();
  });

  afterEach(() => {
    getContextSpy.mockRestore();
    (global as any).Image = OriginalImage;
  });

  it("uses webgl renderer when pixi initializes", async () => {
    render(
      <ControlSection
        art="art.jpg"
        title="Song"
        artist="Artist"
        album="Album"
        mode="now"
      />,
    );
    const canvas = await screen.findByTestId("control-section");
    await waitFor(() =>
      expect((canvas as HTMLCanvasElement).dataset.renderer).toBe("webgl"),
    );
  });

  it("falls back to 2d canvas when pixi throws", async () => {
    (PIXI.Application as any).mockImplementationOnce(() => {
      throw new Error("no webgl");
    });
    render(
      <ControlSection
        art="art.jpg"
        title="Song"
        artist="Artist"
        album="Album"
        mode="now"
      />,
    );
    const canvas = await screen.findByTestId("control-section");
    await waitFor(() =>
      expect((canvas as HTMLCanvasElement).dataset.renderer).toBe("2d"),
    );
  });
});
