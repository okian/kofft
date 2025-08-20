import { audioPlayer } from "./audioPlayer";

// WASM module types
interface WASMModule {
  init_panic_hook: () => void;
  generate_waveform: (audioData: Float32Array, numBars: number) => Float32Array;
  generate_amplitude_envelope: (
    audioData: Float32Array,
    sampleRate: number,
    targetBars: number,
    windowMs: number,
    smoothingSamples: number,
  ) => Float32Array;
  compute_bar_amplitudes: (
    audioData: Float32Array,
    numBars: number,
  ) => Float32Array;
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
let initPromise: Promise<WASMModule | null> | null = null;

// Fixed number of samples used for each visualisation bar.  Matching the
// constant used in the WASM implementation keeps the two paths in sync.
const BAR_SAMPLES = 1024;

// Initialize WASM module
export async function initWASM(): Promise<WASMModule | null> {
  if (wasmModule) return wasmModule;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      isInitializing = true;
      // Dynamic import of the WASM glue
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - resolved by Vite at runtime
      const module: any = await import("@wasm/react_spectrogram_wasm");

      // Initialize the wasm instance by calling the default init
      if (typeof module.default === "function") {
        await module.default();
      }

      // Initialize panic hook
      if (typeof module.init_panic_hook === "function") {
        module.init_panic_hook();
      }

      wasmModule = module as unknown as WASMModule;

      return wasmModule;
    } catch (error) {
      return null;
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
): Promise<Float32Array | null> {
  try {
    const module = await initWASM();
    if (module && module.resample_audio) {
      try {
        return module.resample_audio(audioData, srcRate, dstRate);
      } catch (error) {
        console.warn("WASM resampling failed, using fallback", error);
      }
    }
  } catch (error) {
    console.warn("WASM module not available for resampling", error);
  }
  return null;
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
export function computeWaveformPeaksWASM(
  audioData: Float32Array,
  numBars: number,
): Float32Array | null {
  if (!wasmModule || !wasmModule.compute_bar_amplitudes) {
    return null;
  }
  try {
    const targetLength = numBars * BAR_SAMPLES;
    let buffer: Float32Array;
    if (wasmModule.resample_audio) {
      buffer = wasmModule.resample_audio(
        audioData,
        audioData.length,
        targetLength,
      );
    } else {
      buffer = linearResample(audioData, targetLength);
    }
    return wasmModule.compute_bar_amplitudes(buffer, numBars);
  } catch (error) {
    return null;
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
    const windowedRms =
      rms * (1 - Math.exp(-(i + 1) / smoothingWindow)); // Exponential smoothing
    envelope[i] = windowedRms;
  }

  return envelope;
}

// Linear resampler used when the WASM helper is unavailable.  Resamples to a
// specific target length while ensuring the final sample of the output matches
// the final input sample.
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
