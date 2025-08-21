import { audioPlayer } from "./audioPlayer";

// WASM module types
interface WASMModule {
  /** Install panic hook for friendlier stack traces. */
  init_panic_hook: () => void;
  /** Generate legacy waveform data for visualisation. */
  generate_waveform: (audioData: Float32Array, numBars: number) => Float32Array;
  /** Compute an amplitude envelope for seek bar rendering. */
  generate_amplitude_envelope: (
    audioData: Float32Array,
    sampleRate: number,
    targetBars: number,
    windowMs: number,
    smoothingSamples: number,
  ) => Float32Array;
  /** Resample input and compute per-bar RMS amplitudes. */
  compute_bar_amplitudes: (
    audioData: Float32Array,
    numBars: number,
  ) => Float32Array;
  /** Optional helper for direct resampling calls. */
  resample_audio?: (
    audioData: Float32Array,
    srcRate: number,
    dstRate: number,
  ) => Float32Array;
}

// Metadata extraction module types
interface MetadataWASMModule {
  init_panic_hook: () => void;
  parse_metadata: (bytes: Uint8Array) => any;
}

let wasmModule: WASMModule | null = null;
let isInitializing = false;
let initPromise: Promise<WASMModule> | null = null;

// Fixed number of samples used for each visualisation bar.  Matching the
// constant used in the WASM implementation keeps the two paths in sync.
const BAR_SAMPLES = 1024;

// Initialize WASM module.  All callers must await this before invoking any
// WASM-backed helpers.  Failure to load results in a descriptive error rather
// than silently falling back to a slower JavaScript implementation.
export async function initWASM(): Promise<WASMModule> {
  if (wasmModule) return wasmModule;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      isInitializing = true;
      // Dynamic import of the WASM glue
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - resolved by Vite at runtime
      const module: any = await import("@wasm/web_spectrogram");

      // Instantiate the module if it exposes a default init function.
      if (typeof module.default === "function") {
        await module.default();
      }

      // Install panic hook for cleaner Rust panics.
      if (typeof module.init_panic_hook === "function") {
        module.init_panic_hook();
      }

      wasmModule = module as unknown as WASMModule;
      return wasmModule;
    } catch (error: any) {
      // Surface a descriptive error to aid debugging.
      throw new Error(
        `Failed to initialise WASM module: ${error?.message ?? error}`,
      );
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

export { extractMetadata } from "./metadata";

// Resample audio data using WASM if available
export async function resampleAudio(
  audioData: Float32Array,
  srcRate: number,
  dstRate: number,
): Promise<Float32Array> {
  const module = await initWASM();
  if (!module.resample_audio) {
    throw new Error("WASM resampler not available");
  }
  try {
    return module.resample_audio(audioData, srcRate, dstRate);
  } catch (error: any) {
    throw new Error(`WASM resampling failed: ${error?.message ?? error}`);
  }
}

// Generate waveform data using WASM
export async function generateWaveform(
  audioData: Float32Array,
  numBars: number,
): Promise<Float32Array> {
  const targetLength = numBars * BAR_SAMPLES;
  const resampled =
    (await resampleAudio(audioData, audioData.length, targetLength)) ??
    linearResample(audioData, targetLength);
  try {
    const module = await initWASM();
    if (module && module.generate_waveform) {
      try {
        return module.generate_waveform(resampled, numBars);
      } catch (error) {
        // WASM waveform generation failed, falling back to JS
      }
    }
  } catch (error) {
    // WASM module not available for waveform generation
  }
  return generateWaveformJS(resampled, numBars);
}

// Generate amplitude envelope using WASM
export async function generateAmplitudeEnvelope(
  audioData: Float32Array,
  sampleRate: number = 44100,
  targetBars: number = 300,
  windowMs: number = 20,
  smoothingSamples: number = 3,
): Promise<Float32Array> {
  try {
    const module = await initWASM();
    if (module && module.generate_amplitude_envelope) {
      try {
        return module.generate_amplitude_envelope(
          audioData,
          sampleRate,
          targetBars,
          windowMs,
          smoothingSamples,
        );
      } catch (error) {
        // WASM amplitude envelope generation failed, falling back to JS
      }
    }
  } catch (error) {
    // WASM module not available for amplitude envelope generation
  }
  return generateAmplitudeEnvelopeJS(
    audioData,
    sampleRate,
    targetBars,
    windowMs,
    smoothingSamples,
  );
}

// Compute waveform peaks using WASM if available
export async function computeWaveformPeaksWASM(
  audioData: Float32Array,
  numBars: number,
): Promise<Float32Array> {
  // Initialize WASM module if not already done
  const module = await initWASM();
  if (!module.compute_bar_amplitudes) {
    throw new Error("WASM compute_bar_amplitudes function not available");
  }
  // The Rust helper internally performs a resample so that the final output bar
  // corresponds to the final input sample.  This ensures visual alignment
  // between the waveform and the original audio without redundant JS work.
  try {
    return module.compute_bar_amplitudes(audioData, numBars);
  } catch (error: any) {
    throw new Error(
      `WASM compute_bar_amplitudes failed: ${error?.message ?? error}`,
    );
  }
}

// JavaScript fallback for waveform generation
function generateWaveformJS(
  audioData: Float32Array,
  numBars: number,
): Float32Array {
  if (audioData.length === 0 || numBars === 0) {
    return new Float32Array(numBars);
  }

  const waveform = new Float32Array(numBars);
  const samplesPerBar = Math.ceil(audioData.length / numBars);

  for (let i = 0; i < numBars; i++) {
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, audioData.length);

    if (start >= audioData.length) {
      waveform[i] = 0;
      continue;
    }

    let sumSquares = 0;
    for (let j = start; j < end; j++) {
      const sample = audioData[j];
      sumSquares += sample * sample;
    }
    const count = Math.max(end - start, 1);
    const rms = Math.sqrt(sumSquares / count);

    const amplitude = Math.min(rms * 2, 1.0); // Scale up and clamp
    waveform[i] = amplitude;
  }

  return waveform;
}

// JavaScript fallback for amplitude envelope generation
function generateAmplitudeEnvelopeJS(
  audioData: Float32Array,
  sampleRate: number = 44100,
  targetBars: number = 300,
  windowMs: number = 20,
  smoothingSamples: number = 3,
): Float32Array {
  if (audioData.length === 0 || targetBars === 0) {
    return new Float32Array(targetBars);
  }

  const envelope = new Float32Array(targetBars);
  const samplesPerBar = Math.ceil(audioData.length / targetBars);
  const smoothingWindow = Math.round((sampleRate * smoothingSamples) / 1000);

  for (let i = 0; i < targetBars; i++) {
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, audioData.length);

    if (start >= audioData.length) {
      envelope[i] = 0;
      continue;
    }

    let sumSquares = 0;
    for (let j = start; j < end; j++) {
      const sample = audioData[j];
      sumSquares += sample * sample;
    }
    const count = Math.max(end - start, 1);
    const rms = Math.sqrt(sumSquares / count);

    // Apply windowing and smoothing
    const windowedRms = rms * (1 - Math.exp(-(i + 1) / smoothingWindow)); // Exponential smoothing
    envelope[i] = windowedRms;
  }

  return envelope;
}

// Minimum allowable output length; prevents negative-length array allocation.
const MIN_TARGET_LENGTH = 0;
// Output length representing a single interpolated sample.
const SINGLE_SAMPLE_LENGTH = 1;

/**
 * Fallback linear resampler used when WASM helpers are unavailable.
 * Performs a linear interpolation across `targetLength` samples while ensuring
 * the final output sample mirrors the final input sample.
 * Exported for direct unit testing; external callers should prefer WASM APIs.
 */
export function linearResample(
  input: Float32Array,
  targetLength: number,
): Float32Array {
  if (targetLength <= MIN_TARGET_LENGTH || input.length === MIN_TARGET_LENGTH) {
    return new Float32Array(Math.max(MIN_TARGET_LENGTH, targetLength));
  }
  const output = new Float32Array(targetLength);
  if (targetLength === SINGLE_SAMPLE_LENGTH) {
    output[MIN_TARGET_LENGTH] = input[input.length - SINGLE_SAMPLE_LENGTH];
    return output;
  }
  const ratio =
    (input.length - SINGLE_SAMPLE_LENGTH) /
    (targetLength - SINGLE_SAMPLE_LENGTH);
  for (let i = 0; i < targetLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = input[idx];
    const nextIdx =
      idx + SINGLE_SAMPLE_LENGTH < input.length
        ? idx + SINGLE_SAMPLE_LENGTH
        : idx;
    const s1 = input[nextIdx];
    output[i] = s0 + (s1 - s0) * frac;
  }
  return output;
}

// Check if WASM is available
export function isWASMAvailable(): boolean {
  return wasmModule !== null;
}

// Get WASM module status
export function getWASMStatus(): { available: boolean; initializing: boolean } {
  return {
    available: wasmModule !== null,
    initializing: isInitializing,
  };
}
