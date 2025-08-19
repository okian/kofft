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

    const width = (canvas.width = numBars * (barWidth + barGap) - barGap);
    const height = (canvas.height = maxBarHeight);

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
            numBars,
          },
        );
        return;
      }
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < numBars; i++) {
      const amplitude = peaks[i];
      const barHeight = Math.max(amplitude * maxBarHeight, 2);
      const x = i * (barWidth + barGap);
      const barPosition = i / (numBars - 1);

      let color = "#3f3f46"; // unplayed
      if (disabled) {
        color = "#52525b";
      } else if (barPosition <= progressPosition) {
        color = "#3b82f6"; // played
      } else if (barPosition <= bufferedPosition) {
        color = "#737373"; // buffered
      }

      ctx.fillStyle = color;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
    }

    // Playhead line
    if (!disabled) {
      const playheadX = progressPosition * width;
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(playheadX, 0, 1, height);
    }
  }, [
    peaks,
    numBars,
    barWidth,
    barGap,
    maxBarHeight,
    progressPosition,
    bufferedPosition,
    disabled,
    useWebGL,
  ]);

  const getPositionFromEvent = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const clientX =
        "touches" in event ? event.touches[0].clientX : event.clientX;
      const x = clientX - rect.left;
      return Math.max(0, Math.min(1, x / rect.width));
    },
    [],
  );

  const handleSeekStart = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      setIsSeeking(true);
      const position = getPositionFromEvent(event);
      setSeekPosition(position);
    },
    [disabled, getPositionFromEvent],
  );

  const handleSeekMove = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (!isSeeking || disabled) return;
      const position = getPositionFromEvent(event);
      setSeekPosition(position);
    },
    [isSeeking, disabled, getPositionFromEvent],
  );

  const handleSeekEnd = useCallback(() => {
    if (!isSeeking || disabled) return;
    setIsSeeking(false);
    const seekTime = seekPosition * duration;
    onSeek(seekTime);
  }, [isSeeking, disabled, seekPosition, duration, onSeek]);

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
      onMouseDown={handleSeekStart}
      onMouseMove={handleSeekMove}
      onMouseUp={handleSeekEnd}
      onMouseLeave={() => setIsSeeking(false)}
      onTouchStart={handleSeekStart}
      onTouchMove={handleSeekMove}
      onTouchEnd={handleSeekEnd}
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
  opts: { barWidth: number; barGap: number; numBars: number },
) {
  const { barWidth, barGap, numBars } = opts;

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
  const colors: number[] = [];

  for (let i = 0; i < numBars; i++) {
    const amplitude = peaks[i];
    const barHeight = Math.max(amplitude * height, 2);
    const x = i * (barWidth + barGap);
    const left = (x / width) * 2 - 1;
    const right = ((x + barWidth) / width) * 2 - 1;
    const bottom = -1;
    const top = bottom + (barHeight / height) * 2;
    const barPosition = i / (numBars - 1);

    let color = "#3f3f46";
    if (barPosition <= progress) color = "#3b82f6";
    else if (barPosition <= buffered) color = "#737373";

    const rgb = hexToRgb(color).map((v) => v / 255) as [number, number, number];

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
      colors.push(...rgb);
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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
  const aColor = gl.getAttribLocation(program, "a_color");
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
}
