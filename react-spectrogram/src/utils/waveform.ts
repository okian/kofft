export type PeaksCacheKey = { numBars: number };

const peaksCache = new WeakMap<Float32Array, Map<number, Float32Array>>();

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
    // Fallback simple waveform pattern for visibility
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
  if (cached) {
    return cached;
  }

  const peaks = new Float32Array(numBars);
  const samplesPerBar = Math.ceil(audioData.length / numBars);

  for (let i = 0; i < numBars; i++) {
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, audioData.length);
    let min = 1.0;
    let max = -1.0;

    for (let j = start; j < end; j++) {
      const sample = audioData[j];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    peaks[i] = Math.max(Math.abs(min), Math.abs(max));
  }

  cacheForBuffer.set(numBars, peaks);
  return peaks;
}

export function clearWaveformPeaksCache() {
  peaksCache.clear();
}
