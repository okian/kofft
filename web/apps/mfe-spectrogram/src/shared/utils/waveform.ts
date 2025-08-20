import { computeWaveformPeaksWASM } from "./wasm";

const BAR_SAMPLES = 1024;

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
    const placeholder = new Float32Array(numBars);
    for (let i = 0; i < numBars; i++) {
      const progress = i / numBars;
      placeholder[i] = 0.3 + 0.4 * Math.sin(progress * Math.PI * 4);
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

function linearResample(input: Float32Array, targetLength: number): Float32Array {
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
