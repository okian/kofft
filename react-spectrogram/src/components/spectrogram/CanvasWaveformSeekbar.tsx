import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import { cn } from "@/utils/cn";
import { computeWaveformPeaks } from "@/utils/waveform";

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
  useWebGL?: boolean;
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
  numBars = 300,
  barWidth = 2,
  barGap = 1,
  maxBarHeight = 40,
  disabled = false,
  bufferedTime = 0,
  useWebGL = false,
}: CanvasWaveformSeekbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [barCount, setBarCount] = useState(numBars);
  const lastDispatchRef = useRef({ time: 0, pos: 0 });
  const hasDispatchedRef = useRef(false);

  useEffect(() => {
    if (numBars) setBarCount(numBars);
  }, [numBars]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry.contentRect.width;
      const calculated = Math.max(1, Math.floor(width / (barWidth + barGap)));
      setBarCount(calculated);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [barWidth, barGap]);

  const peaks = useMemo(
    () => computeWaveformPeaks(audioData, barCount),
    [audioData, barCount],
  );

  const currentPosition = duration > 0 ? currentTime / duration : 0;
  const bufferedPosition = duration > 0 ? bufferedTime / duration : 0;
  const progressPosition = isSeeking ? seekPosition : currentPosition;

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = (canvas.width = barCount * (barWidth + barGap) - barGap);
    const height = (canvas.height = maxBarHeight);

    const style = getComputedStyle(containerRef.current!);
    const playedColor = style.getPropertyValue("--seek-played") || "#3b82f6";
    const unplayedColor =
      style.getPropertyValue("--seek-unplayed") || "#3f3f46";
    const bufferedColor =
      style.getPropertyValue("--seek-buffered") || "#737373";
    const disabledColor =
      style.getPropertyValue("--seek-disabled") || "#52525b";
    const playheadColor =
      style.getPropertyValue("--seek-playhead") || "#60a5fa";

    if (useWebGL) {
      const gl = canvas.getContext("webgl");
      if (gl) {
        drawWithWebGL(
          gl,
          width,
          height,
          peaks,
          progressPosition,
          bufferedPosition,
          {
            barWidth,
            barGap,
            numBars: barCount,
            colors: {
              played: playedColor,
              unplayed: unplayedColor,
              buffered: bufferedColor,
              disabled: disabledColor,
              playhead: playheadColor,
            },
          },
        );
        return;
      }
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;
    for (let i = 0; i < barCount; i++) {
      const amplitude = peaks[i];
      const barHeight = Math.max(amplitude * maxBarHeight, 2);
      const x = i * (barWidth + barGap);
      const barPosition = i / (barCount - 1);

      let color = unplayedColor.trim();
      if (disabled) {
        color = disabledColor.trim();
      } else if (barPosition <= progressPosition) {
        color = playedColor.trim();
      } else if (barPosition <= bufferedPosition) {
        color = bufferedColor.trim();
      }

      ctx.fillStyle = color;
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    }

    // Playhead line
    if (!disabled) {
      const playheadX = progressPosition * width;
      ctx.fillStyle = playheadColor.trim();
      ctx.fillRect(playheadX, 0, 1, height);
    }
  }, [
    peaks,
    barCount,
    barWidth,
    barGap,
    maxBarHeight,
    progressPosition,
    bufferedPosition,
    disabled,
    useWebGL,
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
        Math.abs(position - lastDispatchRef.current.pos) > 0.01 &&
        now - lastDispatchRef.current.time > 200
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
        Math.abs(position - lastDispatchRef.current.pos) > 0.01 ||
        now - lastDispatchRef.current.time > 200
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
      const step = event.shiftKey ? 5 : 1;

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
    colors: {
      played: string;
      unplayed: string;
      buffered: string;
      disabled: string;
      playhead: string;
    };
  },
) {
  const { barWidth, barGap, numBars, colors } = opts;

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

  const vertices: number[] = [];
  const colorValues: number[] = [];

  for (let i = 0; i < numBars; i++) {
    const amplitude = peaks[i];
    const barHeight = Math.max(amplitude * height, 2);
    const x = i * (barWidth + barGap);
    const left = (x / width) * 2 - 1;
    const right = ((x + barWidth) / width) * 2 - 1;
    const barPosition = i / (numBars - 1);
    const top = barHeight / height;
    const bottom = -top;

    let color = colors.unplayed;
    if (barPosition <= progress) color = colors.played;
    else if (barPosition <= buffered) color = colors.buffered;

    const rgb = hexToRgb(color.trim()).map((v) => v / 255) as [
      number,
      number,
      number,
    ];

    // two triangles per bar
    vertices.push(
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
    );
    for (let j = 0; j < 6; j++) {
      colorValues.push(...rgb);
    }
  }

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorValues), gl.STATIC_DRAW);
  const aColor = gl.getAttribLocation(program, "a_color");
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
}
