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
  compute_waveform_peaks: (
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
  try {
    const module = await initWASM();
    if (module && module.generate_waveform) {
      try {
        return module.generate_waveform(audioData, numBars);
      } catch (error) {
        // WASM waveform generation failed, falling back to JS
      }
    }
  } catch (error) {
    // WASM module not available for waveform generation
  }
  return generateWaveformJS(audioData, numBars);
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
  if (!wasmModule || !wasmModule.compute_waveform_peaks) {
    return null;
  }
  try {
    return wasmModule.compute_waveform_peaks(audioData, numBars);
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

    const chunk = audioData.slice(start, end);
    if (chunk.length === 0) {
      waveform[i] = 0;
      continue;
    }

    // Calculate RMS (Root Mean Square) for amplitude
    const sumSquares = chunk.reduce((sum, sample) => sum + sample * sample, 0);
    const rms = Math.sqrt(sumSquares / chunk.length);

    // Normalize to 0.0-1.0 range and apply some smoothing
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
  const windowSize = Math.round((sampleRate * windowMs) / 1000);
  const smoothingWindow = Math.round((sampleRate * smoothingSamples) / 1000);

  for (let i = 0; i < targetBars; i++) {
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, audioData.length);

    if (start >= audioData.length) {
      envelope[i] = 0;
      continue;
    }

    const chunk = audioData.slice(start, end);
    if (chunk.length === 0) {
      envelope[i] = 0;
      continue;
    }

    // Calculate RMS (Root Mean Square) for amplitude
    const sumSquares = chunk.reduce((sum, sample) => sum + sample * sample, 0);
    const rms = Math.sqrt(sumSquares / chunk.length);

    // Apply windowing and smoothing
    const windowedRms = rms * (1 - Math.exp(-(i + 1) / smoothingWindow)); // Exponential smoothing
    envelope[i] = windowedRms;
  }

  return envelope;
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
