import { AudioMetadata, WasmAudioMetadata } from "@/types";
import { audioPlayer } from "./audioPlayer";

// WASM module types
interface WasmMetadataExtractor {
  extract_metadata: (
    data: Uint8Array,
    filename: string,
  ) => WasmAudioMetadata | null;
  free: () => void;
}

interface WASMModule {
  init_panic_hook: () => void;
  MetadataExtractor?: new () => WasmMetadataExtractor;
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

// Extract metadata from audio file
export async function extractMetadata(file: File): Promise<AudioMetadata> {
  const metadata: AudioMetadata = {
    title: file.name.replace(/\.[^/.]+$/, ""),
    artist: "Unknown Artist",
    album: "Unknown Album",
    year: undefined,
    genre: "",
    duration: 0,
    bitrate: 0,
    sample_rate: 0,
    channels: 0,
    bit_depth: 0,
    album_art: undefined,
    album_art_mime: undefined,
  };

  try {
    // Try to extract metadata using WASM
    const module = await initWASM();

    if (module && module.MetadataExtractor) {
      let extractor: WasmMetadataExtractor | null = null;
      try {
        const arrayBuffer = await file.arrayBuffer();
        extractor = new module.MetadataExtractor();
        const wasmMetadata = extractor.extract_metadata(
          new Uint8Array(arrayBuffer),
          file.name,
        );
        console.debug(
          "[wasm] metadata extraction succeeded",
          wasmMetadata && wasmMetadata.album_art
            ? `album art bytes: ${wasmMetadata.album_art.length}`
            : "no album art",
        );

        if (wasmMetadata) {
          console.debug(
            "[wasm] metadata extraction succeeded",
            wasmMetadata.album_art
              ? `album art bytes: ${wasmMetadata.album_art.length}`
              : "no album art",
          );
          metadata.title = wasmMetadata.title || metadata.title;
          metadata.artist = wasmMetadata.artist || metadata.artist;
          metadata.album = wasmMetadata.album || metadata.album;
          metadata.year = wasmMetadata.year;
          metadata.genre = wasmMetadata.genre || metadata.genre;
          metadata.duration = wasmMetadata.duration || metadata.duration;
          metadata.sample_rate =
            wasmMetadata.sample_rate || metadata.sample_rate;
          metadata.channels = wasmMetadata.channels || metadata.channels;
          metadata.bit_depth = wasmMetadata.bit_depth || metadata.bit_depth;
          metadata.bitrate = wasmMetadata.bitrate || metadata.bitrate;
          // Convert album art data to Uint8Array if it's a regular array
          if (wasmMetadata.album_art) {
            const art: unknown = wasmMetadata.album_art as unknown;
            metadata.album_art = Array.isArray(art)
              ? new Uint8Array(art as number[])
              : (art as Uint8Array);
          } else {
            metadata.album_art = undefined;
          }
          metadata.album_art_mime = wasmMetadata.album_art_mime || undefined;

          return metadata;
        } else {
          console.debug("[wasm] metadata extraction returned null");
        }
      } catch (error) {
        console.error("[wasm] metadata extraction failed", error);
      } finally {
        try {
          extractor?.free();
        } catch {
          /* ignore */
        }
      }
    } else {
      console.warn("[wasm] MetadataExtractor not available; using fallback");
    }
  } catch (error) {
    console.error("[wasm] failed to initialize module", error);
  }

  // Fallback: Use HTML5 audio element for basic metadata
  try {
    const url = URL.createObjectURL(file);
    const audio = new Audio();

    await new Promise((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("error", onError);
      };
      const onLoaded = () => {
        cleanup();
        resolve(null);
      };
      const onError = (e: Event) => {
        cleanup();
        reject(e);
      };
      audio.addEventListener("loadedmetadata", onLoaded);
      audio.addEventListener("error", onError);
      audio.src = url;
    });
    audio.src = "";

    metadata.duration = audio.duration;
    metadata.sample_rate = 44100; // Most common sample rate

    // Try to get more detailed info using shared audio context
    try {
      const context = await audioPlayer.initAudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);

      metadata.sample_rate = audioBuffer.sampleRate;
      metadata.channels = audioBuffer.numberOfChannels;

      // Estimate bit depth based on file format and size
      if (file.type.includes("flac") || file.type.includes("wav")) {
        metadata.bit_depth = 16;
      } else if (file.type.includes("mp3")) {
        metadata.bit_depth = 16;
      } else {
        metadata.bit_depth = 16;
      }
    } catch (decodeError) {
      // Failed to decode audio for detailed metadata
    }

    // Estimate bitrate based on file size and duration
    if (metadata.duration) {
      const fileSizeInBits = file.size * 8;
      metadata.bitrate = Math.round(fileSizeInBits / metadata.duration / 1000);
    }

    URL.revokeObjectURL(url);
  } catch (error) {
    // Failed to parse audio metadata
  }

  return metadata;
}

// Basic metadata extraction (current implementation)
async function extractBasicMetadata(file: File): Promise<AudioMetadata> {
  const metadata: AudioMetadata = {
    title: file.name.replace(/\.[^/.]+$/, ""),
    artist: "Unknown Artist",
    album: "Unknown Album",
    format: file.type || "unknown",
  };

  try {
    // Create audio element to get basic info
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    await new Promise((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("error", onError);
      };
      const onLoaded = () => {
        cleanup();
        resolve(null);
      };
      const onError = (e: Event) => {
        cleanup();
        reject(e);
      };
      audio.addEventListener("loadedmetadata", onLoaded);
      audio.addEventListener("error", onError);
      audio.src = url;
    });
    audio.src = "";

    metadata.duration = audio.duration;
    metadata.sample_rate = 44100; // Most common sample rate

    // Try to get more detailed info using shared audio context
    try {
      const context = await audioPlayer.initAudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);

      metadata.sample_rate = audioBuffer.sampleRate;
      metadata.channels = audioBuffer.numberOfChannels;

      // Estimate bit depth based on file format and size
      if (file.type.includes("flac") || file.type.includes("wav")) {
        metadata.bit_depth = 16;
      } else if (file.type.includes("mp3")) {
        metadata.bit_depth = 16;
      } else {
        metadata.bit_depth = 16;
      }
    } catch (decodeError) {
      // Failed to decode audio for detailed metadata
    }

    // Estimate bitrate based on file size and duration
    if (metadata.duration) {
      const fileSizeInBits = file.size * 8;
      metadata.bitrate = Math.round(fileSizeInBits / metadata.duration / 1000);
    }

    URL.revokeObjectURL(url);
  } catch (error) {
    // Failed to parse audio metadata
  }

  return metadata;
}

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
