import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";
// Minimal browser APIs for modules that depend on animation frames.
(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(cb, 0);
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
// Mock WASM module used by waveform utilities to avoid resolution errors
vi.mock("@wasm/react_spectrogram_wasm", () => ({ default: async () => {} }), {
  virtual: true,
});
let CanvasWaveformSeekbar: any;
let BAR_WIDTH: number;
let BAR_GAP: number;
beforeAll(async () => {
  const mod = await import("../spectrogram/CanvasWaveformSeekbar");
  CanvasWaveformSeekbar = mod.CanvasWaveformSeekbar;
  BAR_WIDTH = mod.BAR_WIDTH;
  BAR_GAP = mod.BAR_GAP;
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
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (type: string) => (type === "2d" ? mockCtx : null),
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

  it("avoids partial bars across varying widths", async () => {
    const audioData = new Float32Array(1000);
    const widths = [100, 123, 157];
    for (const w of widths) {
      mockCtx.fillRect.mockReset();
      const { unmount } = render(
        <CanvasWaveformSeekbar
          audioData={audioData}
          currentTime={0}
          duration={10}
          onSeek={() => {}}
        />,
      );
      // Simulate container resize
      resizeCb([{ contentRect: { width: w } }]);
      await Promise.resolve();
      const barCalls = mockCtx.fillRect.mock.calls.slice(1, -1); // skip bg & playhead
      const expectedBars = Math.floor((w + BAR_GAP) / (BAR_WIDTH + BAR_GAP));
      expect(barCalls.length).toBe(expectedBars);
      const lastBar = barCalls[barCalls.length - 1];
      expect(lastBar[0] + lastBar[2]).toBe(w); // no partial bar
      expect(lastBar[2]).toBe(BAR_WIDTH);
      unmount();
    }
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

  it("renders correct colors for played, unplayed and disabled states", async () => {
    // Use a real canvas to inspect pixel data instead of the mocked context.
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    (global as any).ResizeObserver = class {
      constructor() {}
      observe() {}
      disconnect() {}
    };
    (global as any).MutationObserver = class {
      constructor() {}
      observe() {}
      disconnect() {}
    };
    const colorVars: Record<string, string> = {
      "--seek-played": "#010203",
      "--seek-unplayed": "#040506",
      "--seek-background": "#000000",
      "--seek-buffered": "#070809",
      "--seek-disabled": "#0a0b0c",
      "--seek-playhead": "#ffffff",
    };
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (prop: string) => colorVars[prop] || "",
    } as any);

    const audioData = new Float32Array([1, 1, 1, 1]);
    const { getByTestId, rerender } = render(
      <CanvasWaveformSeekbar
        audioData={audioData}
        currentTime={2}
        duration={4}
        onSeek={() => {}}
      />,
    );
    resizeCb([{ contentRect: { width: 40 } }]);
    await Promise.resolve();
    const canvas = getByTestId("progress-bar").querySelector("canvas")!;
    const ctx = canvas.getContext("2d")!;
    const y = Math.floor(canvas.height / 2);
    const played = ctx.getImageData(9, y, 1, 1).data;
    const unplayed = ctx.getImageData(37, y, 1, 1).data;
    expect(Array.from(played)).toEqual([1, 2, 3, 255]);
    expect(Array.from(unplayed)).toEqual([4, 5, 6, 255]);

    // Disabled state paints every bar using the disabled color.
    rerender(
      <CanvasWaveformSeekbar
        audioData={audioData}
        currentTime={0}
        duration={4}
        onSeek={() => {}}
        disabled
      />,
    );
    resizeCb([{ contentRect: { width: 40 } }]);
    await Promise.resolve();
    const disabled = ctx.getImageData(9, y, 1, 1).data;
    expect(Array.from(disabled)).toEqual([10, 11, 12, 255]);
  });

  it("prefers WebGPU when available", async () => {
    const gpuContext = {
      configure: vi.fn(),
      getCurrentTexture: () => ({ createView: vi.fn() }),
    } as any;
    const pass = {
      setPipeline: vi.fn(),
      setVertexBuffer: vi.fn(),
      draw: vi.fn(),
      end: vi.fn(),
    } as any;
    const encoder = {
      beginRenderPass: vi.fn().mockReturnValue(pass),
      finish: vi.fn(),
    } as any;
    const device = {
      createBuffer: vi.fn().mockReturnValue({}),
      queue: { writeBuffer: vi.fn(), submit: vi.fn() },
      createShaderModule: vi.fn().mockReturnValue({}),
      createRenderPipeline: vi.fn().mockReturnValue({}),
      createCommandEncoder: vi.fn().mockReturnValue(encoder),
    } as any;
    const adapter = { requestDevice: vi.fn().mockResolvedValue(device) } as any;
    const gpu = {
      requestAdapter: vi.fn().mockResolvedValue(adapter),
      getPreferredCanvasFormat: vi.fn().mockReturnValue("bgra8unorm"),
    };
    (navigator as any).gpu = gpu;
    const ctxSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((type: string) =>
        type === "webgpu" ? gpuContext : null,
      );

    const audioData = new Float32Array(10);
    render(
      <CanvasWaveformSeekbar
        audioData={audioData}
        currentTime={0}
        duration={1}
        onSeek={() => {}}
      />,
    );
    await Promise.resolve();
    expect(ctxSpy).toHaveBeenCalledWith("webgpu");
    delete (navigator as any).gpu;
  });

  it("falls back to WebGL when WebGPU is unavailable", async () => {
    const gl = {
      createShader: vi.fn().mockReturnValue({}),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      createProgram: vi.fn().mockReturnValue({}),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      useProgram: vi.fn(),
      createBuffer: vi.fn().mockReturnValue({}),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      getAttribLocation: vi.fn().mockReturnValue(0),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      viewport: vi.fn(),
      clearColor: vi.fn(),
      clear: vi.fn(),
      drawArrays: vi.fn(),
    } as any;
    const ctxSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((type: string) =>
        type === "webgl" ? gl : type === "2d" ? mockCtx : null,
      );

    const audioData = new Float32Array(10);
    render(
      <CanvasWaveformSeekbar
        audioData={audioData}
        currentTime={0}
        duration={1}
        onSeek={() => {}}
      />,
    );
    await Promise.resolve();
    expect(ctxSpy).toHaveBeenCalledWith("webgl");
  });

  it("falls back to 2D canvas when no GPU APIs are available", async () => {
    const ctxSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((type: string) => (type === "2d" ? mockCtx : null));
    const audioData = new Float32Array(10);
    render(
      <CanvasWaveformSeekbar
        audioData={audioData}
        currentTime={0}
        duration={1}
        onSeek={() => {}}
      />,
    );
    await Promise.resolve();
    expect(ctxSpy).toHaveBeenCalledWith("2d");
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });
});
