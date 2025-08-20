import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import { cn } from "@/shared/utils/cn";
import { computeWaveformPeaks } from "@/shared/utils/waveform";

//
// Constants
// Using named constants avoids magic numbers and documents the intent.
// The values mirror previous defaults but are centralized for clarity.
//
const DEFAULT_NUM_BARS = 300;
const DEFAULT_BAR_WIDTH = 2;
const DEFAULT_BAR_GAP = 1;
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
  numBars?: number;
  barWidth?: number;
  barGap?: number;
  maxBarHeight?: number;
  disabled?: boolean;
  bufferedTime?: number;
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
  numBars = DEFAULT_NUM_BARS,
  barWidth = DEFAULT_BAR_WIDTH,
  barGap = DEFAULT_BAR_GAP,
  maxBarHeight = DEFAULT_MAX_BAR_HEIGHT,
  disabled = false,
  bufferedTime = 0,
}: CanvasWaveformSeekbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const lastDispatchRef = useRef({ time: 0, pos: 0 });
  const hasDispatchedRef = useRef(false);
  const [effectiveBarWidth, setEffectiveBarWidth] = useState(barWidth);
  const [themeVersion, setThemeVersion] = useState(0);

  // Validate numeric props early to fail fast on misuse
  if (!Number.isFinite(numBars) || numBars <= 0)
    throw new Error("numBars must be a positive finite number");
  if (!Number.isFinite(barGap) || barGap < 0)
    throw new Error("barGap must be a non-negative finite number");
  if (!Number.isFinite(maxBarHeight) || maxBarHeight <= 0)
    throw new Error("maxBarHeight must be a positive finite number");

  // Track container width to scale bar width while keeping bar count constant
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      const available = width - (numBars - 1) * barGap;
      setEffectiveBarWidth(Math.max(1, available / numBars));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [numBars, barGap]);

  // React to theme changes by watching for class changes on <html>
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "class") {
          setThemeVersion((v) => v + 1);
          break;
        }
      }
    });
    observer.observe(root, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // Pre-compute waveform peaks, caching by the audio buffer reference
  // and the configured bar count.
  const peaks = useMemo(
    () => computeWaveformPeaks(audioData, numBars),
    [audioData, numBars],
  );

  const currentPosition = duration > 0 ? currentTime / duration : 0;
  const bufferedPosition = duration > 0 ? bufferedTime / duration : 0;
  const progressPosition = isSeeking ? seekPosition : currentPosition;

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = (canvas.width =
      numBars * (effectiveBarWidth + barGap) - barGap);
    const height = (canvas.height = maxBarHeight);

    const style = getComputedStyle(containerRef.current!);
    const playedColor = style.getPropertyValue("--seek-played") || "#3b82f6";
    const unplayedColor =
      style.getPropertyValue("--seek-unplayed") || "#3f3f46";
    const backgroundColor =
      style.getPropertyValue("--seek-background") || "#000000";
    const bufferedColor =
      style.getPropertyValue("--seek-buffered") || "#737373";
    const disabledColor =
      style.getPropertyValue("--seek-disabled") || "#52525b";
    const playheadColor =
      style.getPropertyValue("--seek-playhead") || "#60a5fa";

    const commonOpts = {
      barWidth: effectiveBarWidth,
      barGap,
      numBars,
      disabled,
      background: backgroundColor,
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
      // Fill background so gaps between bars are not transparent/white.
      ctx.fillStyle = backgroundColor.trim();
      ctx.fillRect(0, 0, width, height);

      const centerY = height / 2;
      for (let i = 0; i < numBars; i++) {
        const amplitude = peaks[i];
        const barHeight = Math.max(amplitude * maxBarHeight, MIN_BAR_HEIGHT);
        const x = i * (effectiveBarWidth + barGap);
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
        ctx.fillRect(x, centerY - barHeight / 2, effectiveBarWidth, barHeight);
      }

      // Playhead line
      if (!disabled) {
        const playheadX = progressPosition * width;
        ctx.fillStyle = playheadColor.trim();
        ctx.fillRect(playheadX, 0, PLAYHEAD_WIDTH, height);
      }
    })();
  }, [
    peaks,
    numBars,
    effectiveBarWidth,
    barGap,
    maxBarHeight,
    progressPosition,
    bufferedPosition,
    disabled,
    themeVersion,
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
        "relative w-full select-none border border-neutral-700/50 rounded-lg",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className,
      )}
      // Background color uses CSS variable so theme changes propagate
      style={{
        height: maxBarHeight + 20,
        backgroundColor: "var(--seek-background)",
      }}
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
    /**
     * When true all bars use the disabled color regardless of progress.
     * We thread this state through so the WebGL path matches the 2D one.
     */
    disabled: boolean;
    /** Background color used to clear the canvas. */
    background: string;
    colors: {
      played: string;
      unplayed: string;
      buffered: string;
      disabled: string;
      playhead: string;
    };
  },
) {
  const { background } = opts;
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
  const bg = hexToRgb(background.trim());
  gl.clearColor(bg[0] / 255, bg[1] / 255, bg[2] / 255, 1);
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
    disabled: boolean;
    background: string;
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
  ctx.configure({ device, format, alphaMode: "opaque" });

  const { background } = opts;
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
  const bg = hexToRgb(background.trim());
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: ctx.getCurrentTexture().createView(),
        clearValue: {
          r: bg[0] / 255,
          g: bg[1] / 255,
          b: bg[2] / 255,
          a: 1,
        },
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
  const { barWidth, barGap, numBars, colors, disabled } = opts;
  const rects = numBars + (disabled ? 0 : 1);
  const vertices = new Float32Array(rects * 6 * 2);
  const colorValues = new Float32Array(rects * 6 * 3);
  let v = 0;
  let c = 0;

  for (let i = 0; i < numBars; i++) {
    const amplitude = peaks[i];
    const barHeight = Math.max(amplitude * height, MIN_BAR_HEIGHT);
    const x = i * (barWidth + barGap);
    const left = (x / width) * 2 - 1;
    const right = ((x + barWidth) / width) * 2 - 1;
    const barPosition = i / (numBars - 1);
    const top = barHeight / height;
    const bottom = -top;

    let color = colors.unplayed;
    if (disabled) color = colors.disabled;
    else if (barPosition <= progress) color = colors.played;
    else if (barPosition <= buffered) color = colors.buffered;

    const rgb = hexToRgb(color.trim()).map((v2) => v2 / 255) as [
      number,
      number,
      number,
    ];

    const arr = [
      left,
      bottom,
      right,
      bottom,
      right,
      top,
      left,
      bottom,
      right,
      top,
      left,
      top,
    ];
    vertices.set(arr, v);
    v += arr.length;
    for (let j = 0; j < 6; j++) {
      colorValues.set(rgb, c);
      c += 3;
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
