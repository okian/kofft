import { computeWaveformPeaksWASM } from "./wasm";

// ----- Constants -----
// Number of audio samples represented by each visualisation bar.  Must mirror
// the constant in the Rust/WASM implementation to keep both paths aligned.
const BAR_SAMPLES = 1024;
// Placeholder waveform parameters used when no audio data is provided.
const PLACEHOLDER_BASE = 0.3;
const PLACEHOLDER_VARIATION = 0.4;
const PLACEHOLDER_FREQ = Math.PI * 4;

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
    // Without audio we synthesise a deterministic placeholder so UI elements
    // still render.  The shape is a simple sine wave for visual appeal.
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

  // Delegate to WASM for heavy lifting.  Any failure is surfaced to the caller
  // as an exception to avoid quietly using a slower, potentially divergent,
  // JavaScript path.
  const peaks = computeWaveformPeaksWASM(audioData, numBars);

  cacheForBuffer.set(numBars, peaks);
  return peaks;
}

/**
 * Pure TypeScript implementation used for testing and as a conceptual
 * reference.  Not used in production because the WASM path is mandatory.
 */
export function computeWaveformPeaksJS(
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

  // Normalise amplitudes so the maximum is 1.0.
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

/** Linear interpolation resampler that guarantees the last sample aligns with
 * the final output index.  This mirrors the Rust implementation and is exposed
 * for test parity only.
 */
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
