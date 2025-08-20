import React, { useRef, useCallback, useEffect, useState } from "react";
import { cn } from "@/shared/utils/cn";
import {
  computeWaveformPeaks,
  createIdlePeaksAnimator,
  createLivePeaksAnimator,
} from "@/shared/utils/waveform";
import { useSeekbarColors } from "@/hooks/useSeekbarColors";
import { useSettingsStore } from "@/shared/stores/settingsStore";

//
// Constants
// Using named constants avoids magic numbers and documents the intent.
//
// Public width/gap values. They are exported for tests and any consumer
// that needs to know the drawing geometry.
export const BAR_WIDTH = 5;
export const BAR_GAP = 4;
// Height can still be customised via props but defaults remain internal.
const DEFAULT_MAX_BAR_HEIGHT = 40;
const MIN_BAR_HEIGHT = 2; // keep tiny peaks visible
const SEEK_DISPATCH_MS = 200; // throttle dispatch interval
const SEEK_DISPATCH_THRESHOLD = 0.01; // minimum movement before dispatch
const SMALL_STEP = 1; // keyboard seek step
const LARGE_STEP = 5; // keyboard seek step when holding shift
// Width in CSS pixels of the playhead indicator when rendered.
const PLAYHEAD_WIDTH = 1;
// WebGPU buffer usage flags used when uploading vertex data.
const GPU_BUFFER_USAGE_VERTEX = 0x20;
const GPU_BUFFER_USAGE_COPY_DST = 0x8;

interface CanvasWaveformSeekbarProps {
  audioData: Float32Array | null;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
  maxBarHeight?: number;
  disabled?: boolean;
  bufferedTime?: number;
  /**
   * Optional function returning time-domain audio samples for live mode. When
   * provided and audioData is null, the waveform displays these live samples.
   */
  getTimeData?: () => Uint8Array | null;
}

// Simple utility to convert hex color to rgb array
const hexToRgb = (hex: string): [number, number, number] => {
  const parsed = hex.replace("#", "");
  const bigint = parseInt(parsed, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

export function CanvasWaveformSeekbar({
  audioData,
  currentTime,
  duration,
  onSeek,
  className,
  maxBarHeight = DEFAULT_MAX_BAR_HEIGHT,
  disabled = false,
  bufferedTime = 0,
  getTimeData,
}: CanvasWaveformSeekbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const lastDispatchRef = useRef({ time: 0, pos: 0 });
  const hasDispatchedRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);
  // numBars is derived from the container width and constants.
  const [numBars, setNumBars] = useState(1);
  // Peaks are stored in a ref to avoid reallocating on every animation frame.
  const peaksRef = useRef<Float32Array>(new Float32Array(0));
  // Updating this counter forces the drawing effect to rerun with new peaks.
  const [drawTick, setDrawTick] = useState(0);
  // Sync CSS variables with theme/overrides and redraw when they change.
  useSeekbarColors();
  const { theme, seekPlayedColor, seekUnplayedColor } = useSettingsStore(
    (s) => ({
      theme: s.theme,
      seekPlayedColor: s.seekPlayedColor,
      seekUnplayedColor: s.seekUnplayedColor,
    }),
  );

  // Validate numeric props early to fail fast on misuse
  if (!Number.isFinite(maxBarHeight) || maxBarHeight <= 0)
    throw new Error("maxBarHeight must be a positive finite number");

  // Track container width and compute bar count so the last bar aligns with
  // the track end. We fail fast by ensuring at least one bar is rendered.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      const bars = Math.max(
        1,
        Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP)),
      );
      setContainerWidth(width);
      setNumBars(bars);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * Retrieve a CSS variable value or throw immediately when missing.
   * Failing fast here prevents silent theming errors that would otherwise
   * produce invisible bars.
   */
  const getCssVar = (style: CSSStyleDeclaration, name: string): string => {
    const value = style.getPropertyValue(name).trim();
    if (!value) throw new Error(`Missing CSS variable: ${name}`);
    return value;
  };

  // Pre-compute waveform peaks when static audio data is present. The result
  // is stored in a ref so animations can mutate it without triggering React
  // re-renders each frame.
  useEffect(() => {
    peaksRef.current = computeWaveformPeaks(audioData, numBars);
    setDrawTick((t) => t + 1);
  }, [audioData, numBars]);

  // When no static audio data exists, animate either a placeholder idle wave or
  // live microphone data using requestAnimationFrame.
  useEffect(() => {
    if (audioData) return;
    let stop: (() => void) | undefined;
    const update = (p: Float32Array) => {
      peaksRef.current = p;
      setDrawTick((t) => t + 1);
    };
    stop = getTimeData
      ? createLivePeaksAnimator(getTimeData, numBars, update)
      : createIdlePeaksAnimator(numBars, update);
    return () => stop && stop();
  }, [audioData, numBars, getTimeData]);

  const currentPosition = duration > 0 ? currentTime / duration : 0;
  const bufferedPosition = duration > 0 ? bufferedTime / duration : 0;
  const progressPosition = isSeeking ? seekPosition : currentPosition;

  // Draw waveform on canvas whenever peaks or layout change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth === 0) return;
    const peaks = peaksRef.current;

    // Canvas width matches the container; bars are offset so that the final
    // bar terminates exactly at the right edge to avoid partial bars.
    const width = (canvas.width = containerWidth);
    const height = (canvas.height = maxBarHeight);
    const totalBarsWidth = numBars * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
    const xOffset = width - totalBarsWidth;

    const style = getComputedStyle(containerRef.current!);
    const playedColor = getCssVar(style, "--seek-played");
    const unplayedColor = getCssVar(style, "--seek-unplayed");
    const bufferedColor = getCssVar(style, "--seek-buffered");
    const disabledColor = getCssVar(style, "--seek-disabled");
    const playheadColor = getCssVar(style, "--seek-playhead");

    const commonOpts = {
      barWidth: BAR_WIDTH,
      barGap: BAR_GAP,
      numBars,
      offset: xOffset,
      disabled,
      colors: {
        played: playedColor,
        unplayed: unplayedColor,
        buffered: bufferedColor,
        disabled: disabledColor,
        playhead: playheadColor,
      },
    } as const;

    (async () => {
      const gpu = (navigator as any).gpu;
      if (gpu) {
        try {
          const context = canvas.getContext(
            "webgpu",
          ) as GPUCanvasContext | null;
          if (context) {
            await drawWithWebGPU(
              context,
              width,
              height,
              peaks,
              progressPosition,
              bufferedPosition,
              commonOpts,
            );
            return;
          }
        } catch (err) {
          console.error(err);
        }
      }

      const gl = canvas.getContext("webgl");
      if (gl) {
        drawWithWebGL(
          gl,
          width,
          height,
          peaks,
          progressPosition,
          bufferedPosition,
          commonOpts,
        );
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);
      const centerY = height / 2;
      for (let i = 0; i < numBars; i++) {
        const amplitude = peaks[i];
        const barHeight = Math.max(amplitude * maxBarHeight, MIN_BAR_HEIGHT);
        const x = xOffset + i * (BAR_WIDTH + BAR_GAP);
        const barPosition = i / (numBars - 1);

        let color = unplayedColor.trim();
        if (disabled) {
          color = disabledColor.trim();
        } else if (barPosition <= progressPosition) {
          color = playedColor.trim();
        } else if (barPosition <= bufferedPosition) {
          color = bufferedColor.trim();
        }

        ctx.fillStyle = color;
        // Draw each bar with fully rounded corners. This keeps gaps transparent
        // while ensuring bars resemble pills rather than hard rectangles.
        ctx.beginPath();
        ctx.roundRect(
          x,
          centerY - barHeight / 2,
          BAR_WIDTH,
          barHeight,
          BAR_WIDTH / 2,
        );
        ctx.fill();
      }

      // Playhead line
      if (!disabled) {
        const playheadX = progressPosition * width;
        ctx.fillStyle = playheadColor.trim();
        ctx.fillRect(playheadX, 0, PLAYHEAD_WIDTH, height);
      }
    })();
  }, [
    drawTick,
    numBars,
    containerWidth,
    maxBarHeight,
    progressPosition,
    bufferedPosition,
    disabled,
    theme,
    seekPlayedColor,
    seekUnplayedColor,
  ]);

  const getPositionFromEvent = useCallback((event: React.PointerEvent) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return 0;
    const x = event.clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }, []);

  const handleSeekStart = useCallback(
    (event: React.PointerEvent) => {
      if (disabled) return;
      setIsSeeking(true);
      const position = getPositionFromEvent(event);
      setSeekPosition(position);
      hasDispatchedRef.current = false;
      lastDispatchRef.current = { time: performance.now(), pos: position };
    },
    [disabled, getPositionFromEvent],
  );

  const handleSeekMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isSeeking || disabled) return;
      const position = getPositionFromEvent(event);
      setSeekPosition(position);
      const now = performance.now();
      if (
        Math.abs(position - lastDispatchRef.current.pos) >
          SEEK_DISPATCH_THRESHOLD &&
        now - lastDispatchRef.current.time > SEEK_DISPATCH_MS
      ) {
        onSeek(position * duration);
        lastDispatchRef.current = { time: now, pos: position };
        hasDispatchedRef.current = true;
      }
    },
    [isSeeking, disabled, getPositionFromEvent, duration, onSeek],
  );

  const handleSeekEnd = useCallback(
    (event: React.PointerEvent) => {
      if (!isSeeking || disabled) return;
      setIsSeeking(false);
      const position = getPositionFromEvent(event);
      setSeekPosition(position);
      const seekTime = position * duration;
      const now = performance.now();
      if (
        !hasDispatchedRef.current ||
        Math.abs(position - lastDispatchRef.current.pos) >
          SEEK_DISPATCH_THRESHOLD ||
        now - lastDispatchRef.current.time > SEEK_DISPATCH_MS
      ) {
        onSeek(seekTime);
        lastDispatchRef.current = { time: now, pos: position };
        hasDispatchedRef.current = true;
      }
    },
    [isSeeking, disabled, getPositionFromEvent, duration, onSeek],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;

      let newTime = currentTime;
      const step = event.shiftKey ? LARGE_STEP : SMALL_STEP;

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          newTime = Math.max(0, currentTime - step);
          break;
        case "ArrowRight":
          event.preventDefault();
          newTime = Math.min(duration, currentTime + step);
          break;
        case "Home":
          event.preventDefault();
          newTime = 0;
          break;
        case "End":
          event.preventDefault();
          newTime = duration;
          break;
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          event.preventDefault();
          const percentage = parseInt(event.key) / 10;
          newTime = duration * percentage;
          break;
        default:
          return;
      }

      onSeek(newTime);
    },
    [disabled, currentTime, duration, onSeek],
  );

  useEffect(() => {
    if (!isSeeking) {
      setSeekPosition(currentPosition);
    }
  }, [currentPosition, isSeeking]);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full select-none rounded-lg",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className,
      )}
      style={{ height: maxBarHeight + 20 }}
      onPointerDown={handleSeekStart}
      onPointerMove={handleSeekMove}
      onPointerUp={handleSeekEnd}
      onPointerLeave={() => setIsSeeking(false)}
      onPointerCancel={() => setIsSeeking(false)}
      onKeyDown={handleKeyDown}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
      tabIndex={disabled ? -1 : 0}
      data-testid="progress-bar"
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      {/* Invisible progress fill for tests */}
      <div
        data-testid="progress-fill"
        style={{ width: `${progressPosition * 100}%` }}
        className="absolute top-0 left-0 h-full opacity-0"
      />
      <div className="absolute inset-0 rounded border-2 border-transparent focus-within:border-blue-400 transition-colors" />
    </div>
  );
}

function drawWithWebGL(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  peaks: Float32Array,
  progress: number,
  buffered: number,
  opts: {
    barWidth: number;
    barGap: number;
    numBars: number;
    offset: number;
    /**
     * When true all bars use the disabled color regardless of progress.
     * We thread this state through so the WebGL path matches the 2D one.
     */
    disabled: boolean;
    colors: {
      played: string;
      unplayed: string;
      buffered: string;
      disabled: string;
      playhead: string;
    };
  },
) {
  const { vertices, colors, vertexCount } = buildGeometry(
    width,
    height,
    peaks,
    progress,
    buffered,
    opts,
  );

  const vertexSrc = `
    attribute vec2 a_position;
    attribute vec3 a_color;
    varying vec3 v_color;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_color = a_color;
    }
  `;
  const fragmentSrc = `
    precision mediump float;
    varying vec3 v_color;
    void main() {
      gl_FragColor = vec4(v_color, 1.0);
    }
  `;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };

  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSrc));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSrc));
  gl.linkProgram(program);
  gl.useProgram(program);

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  const aColor = gl.getAttribLocation(program, "a_color");
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

  gl.viewport(0, 0, width, height);
  // Clear to transparent to keep gaps between bars see-through.
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
}

async function drawWithWebGPU(
  ctx: GPUCanvasContext,
  width: number,
  height: number,
  peaks: Float32Array,
  progress: number,
  buffered: number,
  opts: {
    barWidth: number;
    barGap: number;
    numBars: number;
    offset: number;
    disabled: boolean;
    colors: {
      played: string;
      unplayed: string;
      buffered: string;
      disabled: string;
      playhead: string;
    };
  },
) {
  const gpu = (navigator as any).gpu;
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error("WebGPU adapter not available");
  const device = await adapter.requestDevice();
  const format = gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "premultiplied" });
  const { vertices, colors, vertexCount } = buildGeometry(
    width,
    height,
    peaks,
    progress,
    buffered,
    opts,
  );

  // Interleave position and color for a single vertex buffer.
  const interleaved = new Float32Array(vertexCount * 5);
  for (let i = 0, j = 0, k = 0; i < vertexCount; i++) {
    interleaved[j++] = vertices[i * 2];
    interleaved[j++] = vertices[i * 2 + 1];
    interleaved[j++] = colors[k++];
    interleaved[j++] = colors[k++];
    interleaved[j++] = colors[k++];
  }
  const vertexBuffer = device.createBuffer({
    size: interleaved.byteLength,
    usage: GPU_BUFFER_USAGE_VERTEX | GPU_BUFFER_USAGE_COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, interleaved.buffer);

  const shader = `
    struct Out {
      @builtin(position) pos: vec4f,
      @location(0) color: vec3f,
    };
    @vertex fn vs(@location(0) position: vec2f, @location(1) color: vec3f) -> Out {
      var o: Out;
      o.pos = vec4f(position, 0, 1);
      o.color = color;
      return o;
    }
    @fragment fn fs(@location(0) color: vec3f) -> @location(0) vec4f {
      return vec4f(color, 1);
    }
  `;
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({ code: shader }),
      buffers: [
        {
          arrayStride: 20,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            { shaderLocation: 1, offset: 8, format: "float32x3" },
          ],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({ code: shader }),
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list" },
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });
  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.draw(vertexCount);
  pass.end();
  device.queue.submit([encoder.finish()]);
}

function buildGeometry(
  width: number,
  height: number,
  peaks: Float32Array,
  progress: number,
  buffered: number,
  opts: {
    barWidth: number;
    barGap: number;
    numBars: number;
    offset: number;
    disabled: boolean;
    colors: {
      played: string;
      unplayed: string;
      buffered: string;
      disabled: string;
      playhead: string;
    };
  },
) {
  const { barWidth, barGap, numBars, offset, colors, disabled } = opts;
  // Each bar is composed of a rectangle plus two semicircular end caps. We use
  // eight segments per semicircle as a balance between quality and performance.
  const SEGMENTS = 8;
  const vertsPerBar = 6 + SEGMENTS * 6; // center rect + caps
  const playheadVerts = disabled ? 0 : 6;
  const vertices = new Float32Array(
    numBars * vertsPerBar * 2 + playheadVerts * 2,
  );
  const colorValues = new Float32Array(
    numBars * vertsPerBar * 3 + playheadVerts * 3,
  );
  let v = 0;
  let c = 0;

  const radiusPx = barWidth / 2;
  for (let i = 0; i < numBars; i++) {
    const amplitude = peaks[i];
    const barHeight = Math.max(amplitude * height, MIN_BAR_HEIGHT);
    const x = offset + i * (barWidth + barGap);
    const barPosition = i / (numBars - 1);

    let color = colors.unplayed;
    if (disabled) color = colors.disabled;
    else if (barPosition <= progress) color = colors.played;
    else if (barPosition <= buffered) color = colors.buffered;
    const rgb = hexToRgb(color.trim()).map((v2) => v2 / 255) as [
      number,
      number,
      number,
    ];

    const rectTop = barHeight / 2 - radiusPx;
    const rectBottom = -barHeight / 2 + radiusPx;

    // Convert helper
    const toX = (px: number) => (px / width) * 2 - 1;
    const toY = (px: number) => (px / height) * 2;

    // Central rectangle
    const rect = [
      toX(x),
      toY(rectBottom),
      toX(x + barWidth),
      toY(rectBottom),
      toX(x + barWidth),
      toY(rectTop),
      toX(x),
      toY(rectBottom),
      toX(x + barWidth),
      toY(rectTop),
      toX(x),
      toY(rectTop),
    ];
    vertices.set(rect, v);
    v += rect.length;
    for (let j = 0; j < 6; j++) {
      colorValues.set(rgb, c);
      c += 3;
    }

    // Semicircle caps
    const step = Math.PI / SEGMENTS;
    const cx = x + radiusPx;
    const topCy = rectTop + radiusPx;
    const bottomCy = rectBottom - radiusPx;
    for (let s = 0; s < SEGMENTS; s++) {
      const a1 = Math.PI + s * step;
      const a2 = Math.PI + (s + 1) * step;
      const arrTop = [
        toX(cx),
        toY(topCy),
        toX(cx + radiusPx * Math.cos(a1)),
        toY(topCy + radiusPx * Math.sin(a1)),
        toX(cx + radiusPx * Math.cos(a2)),
        toY(topCy + radiusPx * Math.sin(a2)),
      ];
      vertices.set(arrTop, v);
      v += arrTop.length;
      for (let j = 0; j < 3; j++) {
        colorValues.set(rgb, c);
        c += 3;
      }
      const b1 = s * step;
      const b2 = (s + 1) * step;
      const arrBot = [
        toX(cx),
        toY(bottomCy),
        toX(cx + radiusPx * Math.cos(b1)),
        toY(bottomCy + radiusPx * Math.sin(b1)),
        toX(cx + radiusPx * Math.cos(b2)),
        toY(bottomCy + radiusPx * Math.sin(b2)),
      ];
      vertices.set(arrBot, v);
      v += arrBot.length;
      for (let j = 0; j < 3; j++) {
        colorValues.set(rgb, c);
        c += 3;
      }
    }
  }

  if (!disabled) {
    const playX = progress * width;
    const left = (playX / width) * 2 - 1;
    const right = ((playX + PLAYHEAD_WIDTH) / width) * 2 - 1;
    const arr = [left, -1, right, -1, right, 1, left, -1, right, 1, left, 1];
    vertices.set(arr, v);
    const rgb = hexToRgb(colors.playhead.trim()).map((v2) => v2 / 255) as [
      number,
      number,
      number,
    ];
    v += arr.length;
    for (let j = 0; j < 6; j++) {
      colorValues.set(rgb, c);
      c += 3;
    }
  }

  return { vertices, colors: colorValues, vertexCount: v / 2 };
}
