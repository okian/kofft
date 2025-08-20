import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";
// Minimal browser APIs for modules that depend on animation frames.
(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(cb, 0);
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
let CanvasWaveformSeekbar: any;
beforeAll(async () => {
  CanvasWaveformSeekbar = (
    await import("../spectrogram/CanvasWaveformSeekbar")
  ).CanvasWaveformSeekbar;
});

describe("CanvasWaveformSeekbar", () => {
  const mockCtx = {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D;
  let resizeCb: any;
  let mutationCb: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockCtx.fillRect.mockReset();
    mockCtx.clearRect.mockReset();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      mockCtx,
    );
    resizeCb = undefined;
    mutationCb = undefined;
    (global as any).ResizeObserver = class {
      constructor(cb: any) {
        resizeCb = cb;
      }
      observe() {}
      disconnect() {}
    };
    (global as any).MutationObserver = class {
      constructor(cb: any) {
        mutationCb = cb;
      }
      observe() {}
      disconnect() {}
    };
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as any);
    // Provide browser APIs required by imported utilities
    (global as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(cb, 0);
    (global as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  });

  it("renders waveform bars centered on canvas", () => {
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
    // First fillRect paints the background. The second represents the first bar.
    const barCall = mockCtx.fillRect.mock.calls[1];
    expect(barCall[1]).toBe(19); // y position centered for barHeight 2
    expect(barCall[3]).toBe(2); // barHeight
  });

  it("renders a fixed number of bars", () => {
    const audioData = new Float32Array(1000);
    render(
      <CanvasWaveformSeekbar
        audioData={audioData}
        currentTime={0}
        duration={10}
        onSeek={() => {}}
        numBars={10}
      />,
    );
    const firstBarWidth = mockCtx.fillRect.mock.calls[1][2];
    const barCalls = mockCtx.fillRect.mock.calls.filter(
      (c) => c[2] === firstBarWidth,
    );
    expect(barCalls.length).toBe(10);
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
    const canvas = bar.querySelector("canvas") as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
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

    fireEvent.pointerDown(bar, { clientX: 50 });
    fireEvent.pointerUp(bar, { clientX: 50 });

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

  it("debounces rapid seeking", () => {
    vi.useFakeTimers();
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
    const canvas = bar.querySelector("canvas") as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
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

    fireEvent.pointerDown(bar, { clientX: 0 });
    for (let i = 1; i < 5; i++) {
      fireEvent.pointerMove(bar, { clientX: i * 10 });
    }
    expect(onSeek).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    fireEvent.pointerMove(bar, { clientX: 60 });
    expect(onSeek).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(bar, { clientX: 80 });
    expect(onSeek).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("does not dispatch seek twice on drag release", () => {
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
    const canvas = bar.querySelector("canvas") as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
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

    vi.useFakeTimers();
    fireEvent.pointerDown(bar, { clientX: 0 });
    fireEvent.pointerMove(bar, { clientX: 50 });
    vi.advanceTimersByTime(250);
    fireEvent.pointerMove(bar, { clientX: 50 });
    expect(onSeek).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(bar, { clientX: 50 });
    expect(onSeek).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("ignores rapid repeated clicks at same position", () => {
    vi.useFakeTimers();
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
    const canvas = bar.querySelector("canvas") as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
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

    fireEvent.pointerDown(bar, { clientX: 30 });
    fireEvent.pointerUp(bar, { clientX: 30 });
    expect(onSeek).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(bar, { clientX: 30 });
    fireEvent.pointerUp(bar, { clientX: 30 });
    expect(onSeek).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(250);
    fireEvent.pointerDown(bar, { clientX: 30 });
    fireEvent.pointerUp(bar, { clientX: 30 });
    expect(onSeek).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("redraws when theme changes", async () => {
    const audioData = new Float32Array(1000);
    render(
      <CanvasWaveformSeekbar
        audioData={audioData}
        currentTime={0}
        duration={10}
        onSeek={() => {}}
      />,
    );
    expect(mockCtx.clearRect).toHaveBeenCalledTimes(1);
    // Trigger MutationObserver callback to simulate theme change.
    mutationCb([{ attributeName: "class" }]);
    await Promise.resolve();
    expect(mockCtx.clearRect).toHaveBeenCalledTimes(2);
  });
});
