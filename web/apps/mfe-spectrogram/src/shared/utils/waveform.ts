import { computeWaveformPeaksWASM } from "./wasm";

//
// Constants
// Keeping numeric values named prevents magic numbers and clarifies intent.
// BAR_SAMPLES must mirror the Rust implementation so peak calculations match.
export const BAR_SAMPLES = 1024;
// Baseline amplitude for placeholder waveforms.
export const PLACEHOLDER_BASE = 0.3;
// Amplitude variation applied to the placeholder baseline.
export const PLACEHOLDER_VARIATION = 0.4;
// Spatial frequency of the placeholder sine wave; chosen to show a few
// oscillations across the control for visual interest.
export const PLACEHOLDER_FREQ = Math.PI * 4;
// Temporal frequency controlling idle animation speed in radians per ms.
// A small value keeps movement subtle and low impact on CPU usage.
export const IDLE_TIME_FREQ = 0.002;

export type PeaksCacheKey = { numBars: number };

let peaksCache = new WeakMap<Float32Array, Map<number, Float32Array>>();

/**
 * Compute simplified waveform peaks for a given audio buffer.
 * Results are cached per audioData reference and number of bars
 * to avoid repeating expensive calculations.
 */
export function computeWaveformPeaks(
  audioData: Float32Array | null,
  numBars: number,
): Float32Array {
  if (!audioData || audioData.length === 0) {
    // Synthesize a deterministic placeholder so UI elements still render.
    const placeholder = new Float32Array(numBars);
    for (let i = 0; i < numBars; i++) {
      const progress = i / numBars;
      placeholder[i] =
        PLACEHOLDER_BASE +
        PLACEHOLDER_VARIATION * Math.sin(progress * PLACEHOLDER_FREQ);
    }
    return placeholder;
  }

  let cacheForBuffer = peaksCache.get(audioData);
  if (!cacheForBuffer) {
    cacheForBuffer = new Map();
    peaksCache.set(audioData, cacheForBuffer);
  }

  const cached = cacheForBuffer.get(numBars);
  if (cached) return cached;

  let peaks = computeWaveformPeaksWASM(audioData, numBars);
  if (!peaks) {
    peaks = computeWaveformPeaksJS(audioData, numBars);
  }

  cacheForBuffer.set(numBars, peaks);
  return peaks;
}

function computeWaveformPeaksJS(
  audioData: Float32Array,
  numBars: number,
): Float32Array {
  const targetLength = numBars * BAR_SAMPLES;
  const data = linearResample(audioData, targetLength);
  const peaks = new Float32Array(numBars);

  for (let i = 0; i < numBars; i++) {
    const start = i * BAR_SAMPLES;
    let sumSquares = 0;
    for (let j = 0; j < BAR_SAMPLES; j++) {
      const sample = data[start + j];
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / BAR_SAMPLES);
    peaks[i] = rms;
  }

  let max = 0;
  for (let i = 0; i < numBars; i++) {
    if (peaks[i] > max) max = peaks[i];
  }
  if (max > 0) {
    for (let i = 0; i < numBars; i++) {
      peaks[i] /= max;
    }
  }

  return peaks;
}

function linearResample(
  input: Float32Array,
  targetLength: number,
): Float32Array {
  if (targetLength <= 0 || input.length === 0) {
    return new Float32Array(targetLength);
  }
  const output = new Float32Array(targetLength);
  if (targetLength === 1) {
    output[0] = input[input.length - 1];
    return output;
  }
  const ratio = (input.length - 1) / (targetLength - 1);
  for (let i = 0; i < targetLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = input[idx];
    const s1 = input[idx + 1 < input.length ? idx + 1 : idx];
    output[i] = s0 + (s1 - s0) * frac;
  }
  return output;
}

export function clearWaveformPeaksCache() {
  peaksCache = new WeakMap();
}

//
// Animators
// These helpers drive placeholder and live waveforms via requestAnimationFrame.
// Both return a cleanup function to halt the animation when no longer needed.

/**
 * Create an animator that generates a slowly moving sine wave when no audio
 * data is available. The provided callback receives the reused peaks array on
 * each frame. Returns a function that cancels the animation.
 */
export function createIdlePeaksAnimator(
  numBars: number,
  cb: (peaks: Float32Array) => void,
): () => void {
  if (!Number.isFinite(numBars) || numBars <= 0)
    throw new Error("numBars must be a positive finite number");

  const peaks = new Float32Array(numBars);
  let raf = 0;

  const animate = (time: number) => {
    const phase = time * IDLE_TIME_FREQ;
    for (let i = 0; i < numBars; i++) {
      const progress = i / numBars;
      peaks[i] =
        PLACEHOLDER_BASE +
        PLACEHOLDER_VARIATION * Math.sin(progress * PLACEHOLDER_FREQ + phase);
    }
    cb(peaks);
    raf = requestAnimationFrame(animate);
  };

  raf = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(raf);
}

/**
 * Create an animator that samples live audio via the supplied function and
 * converts it into RMS peaks. The callback receives the reused peaks array on
 * each frame. Returns a function that cancels the animation.
 */
export function createLivePeaksAnimator(
  getTimeData: () => Uint8Array | null,
  numBars: number,
  cb: (peaks: Float32Array) => void,
): () => void {
  if (!Number.isFinite(numBars) || numBars <= 0)
    throw new Error("numBars must be a positive finite number");

  const peaks = new Float32Array(numBars);
  let raf = 0;

  const animate = () => {
    const data = getTimeData();
    if (data && data.length > 0) {
      const step = data.length / numBars;
      for (let i = 0; i < numBars; i++) {
        const start = Math.floor(i * step);
        const end = Math.floor((i + 1) * step);
        let sum = 0;
        for (let j = start; j < end; j++) {
          const sample = (data[j] - 128) / 128;
          sum += sample * sample;
        }
        const count = Math.max(1, end - start);
        peaks[i] = Math.sqrt(sum / count);
      }
    }
    cb(peaks);
    raf = requestAnimationFrame(animate);
  };

  raf = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(raf);
}
