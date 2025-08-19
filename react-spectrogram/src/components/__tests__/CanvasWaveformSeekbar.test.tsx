import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CanvasWaveformSeekbar } from "../spectrogram/CanvasWaveformSeekbar";

describe("CanvasWaveformSeekbar", () => {
  const mockCtx = {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      mockCtx,
    );
  });

  it("renders waveform bars on canvas", () => {
    const audioData = new Float32Array(1000);
    render(
      <CanvasWaveformSeekbar
        audioData={audioData}
        currentTime={0}
        duration={10}
        onSeek={() => {}}
      />,
    );
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it("handles click to seek", () => {
    const audioData = new Float32Array(1000);
    const onSeek = vi.fn();
    const { getByTestId } = render(
      <CanvasWaveformSeekbar
        audioData={audioData}
        currentTime={0}
        duration={100}
        onSeek={onSeek}
      />,
    );

    const bar = getByTestId("progress-bar");
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      height: 10,
      bottom: 10,
      right: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.mouseDown(bar, { clientX: 50 });
    fireEvent.mouseUp(bar, { clientX: 50 });

    expect(onSeek).toHaveBeenCalledWith(50);
  });

  it("supports keyboard seeking", () => {
    const audioData = new Float32Array(1000);
    const onSeek = vi.fn();
    const { getByTestId } = render(
      <CanvasWaveformSeekbar
        audioData={audioData}
        currentTime={10}
        duration={100}
        onSeek={onSeek}
      />,
    );

    const bar = getByTestId("progress-bar");
    bar.focus();
    fireEvent.keyDown(bar, { key: "ArrowRight" });
    expect(onSeek).toHaveBeenCalledWith(11);
  });
});
