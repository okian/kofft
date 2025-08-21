import React, { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/shared/utils/cn";
import {
  computeWaveformPeaks,
  createIdlePeaksAnimator,
  createLivePeaksAnimator,
} from "@/shared/utils/waveform";
import { useSeekbarColors } from "@/hooks/useSeekbarColors";
import { useSettingsStore } from "@/shared/stores/settingsStore";
import { THEME_COLORS } from "@/shared/theme";

/** Debug flag used to silence verbose logging in production builds. */
const DEBUG = process.env.NODE_ENV !== "production";

/**
 * Width of each visualisation bar in CSS pixels. Kept small to minimise GPU
 * workload while preserving sufficient detail for short clips.
 */
export const BAR_WIDTH = 3;
/** Gap between bars in CSS pixels. A narrow gap keeps the waveform compact. */
export const BAR_GAP = 6;
/** Minimum drawn bar height so silent segments remain visible. */
const MIN_BAR_HEIGHT = 4; // Increased minimum height for better visibility
/** Default maximum bar height used when no explicit value is supplied. */
const DEFAULT_MAX_BAR_HEIGHT = 40;
/** Delay between seek callbacks during pointer drags in milliseconds. */
const SEEK_THROTTLE_MS = 200;
/** Minimum normalised movement required before dispatching a seek. */
const SEEK_THRESHOLD = 0.03;
/** Keyboard seek step in seconds for arrow keys. */
const SMALL_STEP = 1;
/** Keyboard seek step when holding the Shift modifier. */
const LARGE_STEP = 5;
/** Width of the playhead indicator in CSS pixels. */
const PLAYHEAD_WIDTH = 3;
/**
 * Weight used for the linear component of frequency bin mapping.
 * The three weights sum to 1 to form a convex combination.
 */
const LINEAR_WEIGHT = 0.4;
/** Weight applied to the logarithmic component of the mapping blend. */
const LOG_WEIGHT = 0.3;
/** Weight applied to the power component of the mapping blend. */
const POWER_WEIGHT = 0.3;
/** Multiplier used before taking the logarithm when mapping bins. */
const LOG_MULTIPLIER = 9;
/** Base of the logarithm used during mapping. */
const LOG_BASE = 10;
/** Exponent used for the power curve in the mapping blend. */
const POWER_EXPONENT = 0.7;
/** Overlap factor between adjacent frequency ranges. */
const OVERLAP_FACTOR = 0.9;
/** Reciprocal used to normalise 0-255 byte values to 0-1 floats. */
const INV_255 = 1 / 255;
/** Exponent for the adjustPeak power curve (0.5 = square root). */
const ADJUST_EXPONENT = 0.5;

interface CanvasWaveformSeekbarProps {
  /** Raw PCM audio used for fixed waveform mode. */
  audioData: Float32Array | null;
  /** Current playback time in seconds. */
  currentTime: number;
  /** Total track duration in seconds. */
  duration: number;
  /** Callback invoked when the user seeks to a new position. */
  onSeek: (time: number) => void;
  /** Optional classname for styling. */
  className?: string;
  /** Maximum height of a bar. */
  maxBarHeight?: number;
  /** When true the seekbar becomes read-only and greyed out. */
  disabled?: boolean;
  /** Amount of audio buffered in seconds. */
  bufferedTime?: number;
  /**
   * Optional provider for live time-domain samples. Required for live mode.
   */
  getTimeData?: () => Uint8Array | null;
  /**
   * Optional provider for live frequency-domain samples. Required for frequency mode.
   */
  getFrequencyData?: () => Uint8Array | null;
}

/**
 * Generate a proper frequency-domain animation from real FFT data.
 * This creates a frequency band visualizer using actual frequency analysis.
 */
export function createFrequencyAnimator(
  getFrequencyData: () => Uint8Array | null,
  numBars: number,
  cb: (peaks: Float32Array) => void,
): () => void {
  if (!Number.isFinite(numBars) || numBars <= 0)
    throw new Error("numBars must be a positive finite number");

  // Fail fast for a degenerate single-bar visualisation to prevent
  // division-by-zero errors in the mapping logic. The single bar simply
  // represents the average magnitude across all frequency bins.
  if (numBars < 2) {
    const single = new Float32Array(1);
    let raf = 0;
    const animateSingle = () => {
      const data = getFrequencyData();
      if (data && data.length > 0) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        single[0] = (sum / data.length) * INV_255;
      } else {
        single[0] = 0;
      }
      cb(single);
      raf = requestAnimationFrame(animateSingle);
    };
    raf = requestAnimationFrame(animateSingle);
    return () => cancelAnimationFrame(raf);
  }

  const peaks = new Float32Array(numBars);
  let raf = 0;

  // Precompute mapping from bars to frequency bin ranges. These mappings are
  // recalculated only when the FFT size changes to minimise per-frame work.
  let binRanges: Array<{ start: number; end: number }> = [];
  let lastLength = 0;
  const computeRanges = (length: number) => {
    binRanges = new Array(numBars);
    const logBase = Math.log(LOG_BASE);
    for (let i = 0; i < numBars; i++) {
      const normalized = i / (numBars - 1);
      const linearMap = normalized;
      const logMap = Math.log(normalized * LOG_MULTIPLIER + 1) / logBase;
      const powerMap = Math.pow(normalized, POWER_EXPONENT);
      const blended =
        LINEAR_WEIGHT * linearMap +
        LOG_WEIGHT * logMap +
        POWER_WEIGHT * powerMap;
      const start = Math.floor(blended * length * OVERLAP_FACTOR);
      const end = Math.floor(((i + 1) / numBars) * length);
      binRanges[i] = { start, end };
    }
    lastLength = length;
  };

  const animate = () => {
    const frequencyData = getFrequencyData();
    if (frequencyData && frequencyData.length > 0) {
      if (frequencyData.length !== lastLength)
        computeRanges(frequencyData.length);
      if (DEBUG) {
        console.debug("Frequency data:", {
          length: frequencyData.length,
          firstFew: Array.from(frequencyData.slice(0, 10)),
          lastFew: Array.from(frequencyData.slice(-10)),
        });
      }
      for (let i = 0; i < numBars; i++) {
        const range = binRanges[i];
        let sum = 0;
        let count = 0;
        for (
          let bin = range.start;
          bin < range.end && bin < frequencyData.length;
          bin++
        ) {
          sum += frequencyData[bin] * INV_255;
          count++;
        }
        peaks[i] = count > 0 ? sum / count : 0;
      }
    } else {
      peaks.fill(0);
    }
    cb(peaks);
    raf = requestAnimationFrame(animate);
  };

  raf = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(raf);
}

/** Apply significance threshold and global scaling to a peak value. */
function adjustPeak(
  value: number,
  significance: number,
  scale: number,
): number {
  let v = value * scale;
  if (v <= significance) return 0;
  const range = 1 - significance;
  const adjusted = (v - significance) / range;

  // Apply power curve to make differences more dramatic
  // This will make small values smaller and large values larger
  return Math.min(1, Math.pow(adjusted, ADJUST_EXPONENT));
}

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
  getFrequencyData,
}: CanvasWaveformSeekbarProps) {
  // Defensive programming: validate numeric props immediately.
  if (!Number.isFinite(maxBarHeight) || maxBarHeight <= 0) {
    throw new Error("maxBarHeight must be a positive finite number");
  }

  // References and state used for layout and rendering.
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numBars, setNumBars] = useState(1);
  const peaksRef = useRef<Float32Array>(new Float32Array(0));
  const targetPeaksRef = useRef<Float32Array>(new Float32Array(0));
  const [drawTick, setDrawTick] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekProgress, setSeekProgress] = useState(0);
  const lastDispatch = useRef({ time: 0, pos: 0 });
  const dispatched = useRef(false);
  const transitionRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // Theme-driven colours and seek bar settings from the global store.
  useSeekbarColors();
  const {
    theme,
    seekPlayedColor,
    seekUnplayedColor,
    seekPlayheadColor,
    showSeekbarPlayhead,
    seekbarMode,
    seekbarSignificance,
    seekbarAmplitudeScale,
  } = useSettingsStore((s) => ({
    theme: s.theme,
    seekPlayedColor: s.seekPlayedColor,
    seekUnplayedColor: s.seekUnplayedColor,
    seekPlayheadColor: s.seekPlayheadColor,
    showSeekbarPlayhead: s.showSeekbarPlayhead,
    seekbarMode: s.seekbarMode,
    seekbarSignificance: s.seekbarSignificance,
    seekbarAmplitudeScale: s.seekbarAmplitudeScale,
  }));

  // Track container width and compute the maximum number of full bars that fit.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    // Get initial width immediately
    const initialWidth = el.clientWidth;
    const initialBars = Math.max(
      1,
      Math.floor((initialWidth + BAR_GAP) / (BAR_WIDTH + BAR_GAP)),
    );
    setContainerWidth(initialWidth);
    setNumBars(initialBars);

    const ro = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      const bars = Math.max(
        1,
        Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP)),
      );
      setContainerWidth(width);
      setNumBars(bars);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Helper for reading a CSS variable value with fallback defaults.
  const readCss = useCallback(
    (name: string): string => {
      const style = getComputedStyle(containerRef.current!);
      const value = style.getPropertyValue(name).trim();
      if (!value) {
        // Fall back to theme colours when CSS variables are missing. Using
        // THEME_COLORS keeps components free from magic hex strings.
        const { accent, primary } = THEME_COLORS[theme];
        const fallbacks: Record<string, string> = {
          "--seek-played": accent,
          "--seek-unplayed": primary,
          "--seek-buffered": accent,
          "--seek-disabled": primary,
          "--seek-playhead": accent,
          "--seek-focus": accent,
          "--seek-hover-played": accent,
          "--seek-hover-unplayed": primary,
          "--seek-time-label": primary,
        };
        return fallbacks[name] || accent;
      }
      return value;
    },
    [theme],
  );

  // Smooth transition function for peak values
  const smoothTransition = useCallback((newPeaks: Float32Array) => {
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Store the current peaks as starting point
    const currentPeaks = peaksRef.current;
    targetPeaksRef.current = newPeaks;

    // Reset transition progress
    transitionRef.current = 0;

    // Create a temporary array for interpolation
    const tempPeaks = new Float32Array(
      Math.max(currentPeaks.length, newPeaks.length),
    );

    const animate = () => {
      transitionRef.current += 0.05; // Adjust speed here (0.05 = 20 frames for full transition)

      if (transitionRef.current >= 1) {
        // Transition complete
        peaksRef.current = newPeaks;
        setDrawTick((t) => t + 1);
        return;
      }

      // Interpolate between current and target peaks
      const t = transitionRef.current;
      const easeT = 1 - Math.pow(1 - t, 3); // Ease-out cubic function

      for (let i = 0; i < tempPeaks.length; i++) {
        const current = i < currentPeaks.length ? currentPeaks[i] : 0;
        const target = i < newPeaks.length ? newPeaks[i] : 0;
        tempPeaks[i] = current + (target - current) * easeT;
      }

      peaksRef.current = tempPeaks;
      setDrawTick((t) => t + 1);

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Precompute peaks for static waveform mode.
  useEffect(() => {
    if (seekbarMode !== "waveform") return;

    const computePeaks = async () => {
      try {
        const newPeaks = await computeWaveformPeaks(audioData, numBars);
        smoothTransition(newPeaks);
      } catch (error) {
        console.warn("Failed to compute waveform peaks:", error);
        // Fall back to empty peaks if computation fails
        const emptyPeaks = new Float32Array(numBars);
        smoothTransition(emptyPeaks);
      }
    };

    computePeaks();
  }, [audioData, numBars, seekbarMode, smoothTransition]);

  // Drive animations for live and frequency modes.
  useEffect(() => {
    if (seekbarMode === "waveform") return;
    let stop: (() => void) | undefined;
    const update = (p: Float32Array) => {
      smoothTransition(p);
    };

    if (seekbarMode === "live") {
      stop = getTimeData
        ? createLivePeaksAnimator(getTimeData, numBars, update)
        : createIdlePeaksAnimator(numBars, update);
    } else if (seekbarMode === "frequency") {
      stop = getFrequencyData
        ? createFrequencyAnimator(getFrequencyData, numBars, update)
        : createIdlePeaksAnimator(numBars, update);
    }
    return () => {
      stop?.();
      // Cancel any ongoing transition animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
    };
  }, [seekbarMode, numBars, getTimeData, getFrequencyData, smoothTransition]);

  // Current playback positions normalised to [0,1].
  const playedPos = duration > 0 ? currentTime / duration : 0;
  const bufferedPos = duration > 0 ? bufferedTime / duration : 0;
  const progress = isSeeking ? seekProgress : playedPos;

  // Redraw whenever peaks, colours or layout change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth === 0) {
      if (DEBUG)
        console.debug("Canvas not ready:", {
          canvas: !!canvas,
          containerWidth,
        });
      return;
    }
    if (DEBUG)
      console.debug("Rendering seekbar - containerWidth:", containerWidth);

    // Set up high DPI canvas
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = containerWidth;
    const height = maxBarHeight;

    // Set the canvas size in CSS pixels
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    // Set the canvas size in device pixels
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    const totalWidth = numBars * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
    const xOffset = (width - totalWidth) / 2; // Center the seekbar

    // Temporarily disable GPU paths to use 2D canvas
    if (DEBUG) console.debug("Using 2D canvas path");
    /*
    // Attempt GPU paths first for better performance when available.
    const gpu = (navigator as any).gpu;
    if (gpu) {
      const gpuCtx = canvas.getContext("webgpu") as GPUCanvasContext | null;
      if (gpuCtx) {
        // Minimal WebGPU setup; the heavy lifting happens in WASM which feeds
        // us the peaks. Tests only verify the context is requested.
        if (DEBUG) console.debug("WebGPU path taken - returning early");
        return;
      }
    }

    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    if (gl) {
      // No-op: presence of context indicates WebGL path would be used.
      if (DEBUG) console.debug("WebGL path taken - returning early");
      return;
    }
    */

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // Scale the context to match the device pixel ratio
    ctx.scale(devicePixelRatio, devicePixelRatio);

    ctx.clearRect(0, 0, width, height);

    const played = readCss("--seek-played");
    const unplayed = readCss("--seek-unplayed");
    const buffered = readCss("--seek-buffered");
    const disabledCol = readCss("--seek-disabled");
    const playheadCol = readCss("--seek-playhead");

    const peaks = peaksRef.current;

    for (let i = 0; i < numBars; i++) {
      const ratio = i / numBars;
      const raw = peaks[i] ?? 0;
      const adjusted = adjustPeak(
        raw,
        seekbarSignificance ?? 0.05,
        seekbarAmplitudeScale ?? 8,
      );
      const h = Math.max(MIN_BAR_HEIGHT, adjusted * maxBarHeight);

      // Debug: Log some bar heights to see the range
      if (DEBUG && i < 5) {
        console.debug(
          `Bar ${i}: raw=${raw.toFixed(3)}, adjusted=${adjusted.toFixed(3)}, height=${h.toFixed(1)}`,
        );
      }
      const y = (maxBarHeight - h) / 2;
      const x = xOffset + i * (BAR_WIDTH + BAR_GAP);
      const color = disabled
        ? disabledCol
        : ratio < progress
          ? played
          : ratio < bufferedPos
            ? buffered
            : unplayed;

      ctx.fillStyle = color;
      ctx.beginPath();
      // Use roundRect if available, otherwise fall back to regular rect
      if (ctx.roundRect) {
        ctx.roundRect(x, y, BAR_WIDTH, h, BAR_WIDTH / 2);
      } else {
        ctx.rect(x, y, BAR_WIDTH, h);
      }
      ctx.fill();
    }

    // Draw playhead.
    if (showSeekbarPlayhead) {
      const headX = xOffset + progress * (totalWidth - BAR_WIDTH);
      const playheadColor = seekPlayheadColor || playheadCol;
      ctx.fillStyle = disabled ? disabledCol : playheadColor;
      ctx.fillRect(headX, 0, PLAYHEAD_WIDTH, height);
    }
  }, [
    drawTick,
    containerWidth,
    maxBarHeight,
    numBars,
    progress,
    bufferedPos,
    disabled,
    theme,
    seekPlayedColor,
    seekUnplayedColor,
    seekbarSignificance,
    seekbarAmplitudeScale,
    readCss,
  ]);

  /**
   * Convert a pointer X-coordinate into a normalised [0,1] position.
   * Returns `null` when the canvas is unavailable so callers can bail out.
   */
  const normalise = useCallback((clientX: number): number | null => {
    if (!Number.isFinite(clientX)) {
      throw new Error("clientX must be a finite number");
    }
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const dispatchSeek = useCallback(
    (pos: number) => {
      const now = Date.now();
      if (
        now - lastDispatch.current.time > SEEK_THROTTLE_MS &&
        Math.abs(pos - lastDispatch.current.pos) > SEEK_THRESHOLD
      ) {
        lastDispatch.current = { time: now, pos };
        dispatched.current = true;
        onSeek(pos * duration);
      }
    },
    [duration, onSeek],
  );

  /** Begin tracking a seek gesture if the bar is interactive and ready. */
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const pos = normalise(e.clientX);
    if (pos === null) return;
    setIsSeeking(true);
    setSeekProgress(pos);
    dispatched.current = false;
  };
  /** Update the seek position as the pointer moves during a drag. */
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isSeeking) return;
    const pos = normalise(e.clientX);
    if (pos === null) return;
    setSeekProgress(pos);
    dispatchSeek(pos);
  };
  /** Finish a seek gesture, dispatching a final seek if necessary. */
  const endSeek = (e: React.PointerEvent) => {
    if (!isSeeking) return;
    const pos = normalise(e.clientX);
    if (pos === null) return;
    setIsSeeking(false);
    setSeekProgress(0);
    if (!dispatched.current) onSeek(pos * duration);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let step = e.shiftKey ? LARGE_STEP : SMALL_STEP;
    if (e.key === "ArrowRight") {
      onSeek(Math.min(duration, currentTime + step));
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      onSeek(Math.max(0, currentTime - step));
      e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full select-none", // Removed debug background
        disabled ? "opacity-50" : "cursor-pointer",
        className,
      )}
      data-testid="progress-bar"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endSeek}
      onPointerLeave={endSeek}
      tabIndex={0}
      onKeyDown={handleKey}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

export default CanvasWaveformSeekbar;
