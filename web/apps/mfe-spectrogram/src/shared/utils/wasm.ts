import { AudioMetadata, WasmAudioMetadata } from "@/types";
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
    console.log('🔍 [METADATA] Attempting WASM metadata extraction for file:', file.name, 'size:', file.size);
    
    // Note: Metadata parsing is not currently implemented in WASM modules
    // The web_spectrogram module is for DSP operations only
    console.log('🔍 [METADATA] WASM metadata parsing not available, using fallback method...');
    
    // Try to import the WASM module for other operations (optional)
    try {
      const metadataModule: any = await import("@wasm/web_spectrogram");
      console.log('🔍 [METADATA] WASM module imported for DSP operations');
    } catch (error) {
      console.warn('🔍 [METADATA] WASM module not available for DSP operations');
    }
    
    // Skip WASM metadata parsing since it's not implemented
    if (false) { // This will never execute, but keeps the structure
      try {
        console.log('🔍 [METADATA] WASM metadata module found, initializing...');
        
        // Initialize the WASM module if it has a default function
        if (typeof metadataModule.default === "function") {
          console.log('🔍 [METADATA] Initializing WASM module with default function...');
          await metadataModule.default();
          console.log('🔍 [METADATA] WASM module initialization completed');
        }
        
        // Initialize panic hook if available
        if (typeof metadataModule.init_panic_hook === "function") {
          console.log('🔍 [METADATA] Initializing panic hook...');
          metadataModule.init_panic_hook();
          console.log('🔍 [METADATA] Panic hook initialized');
        }
        
        console.log('🔍 [METADATA] Reading file data...');
        const arrayBuffer = await file.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);
        console.log('🔍 [METADATA] File data loaded, size:', fileData.length, 'bytes');
        
        console.log('🔍 [METADATA] Calling parse_metadata...');
        const wasmMetadata = metadataModule.parse_metadata(fileData);
        console.log('🔍 [METADATA] parse_metadata returned:', wasmMetadata);
        
        if (wasmMetadata) {
          console.log('🔍 [METADATA] Processing extracted metadata...');
          
          // Extract all metadata fields with detailed logging
          if (wasmMetadata.title) {
            console.log('🔍 [METADATA] Title found:', wasmMetadata.title);
            metadata.title = wasmMetadata.title;
          }
          
          if (wasmMetadata.artist) {
            console.log('🔍 [METADATA] Artist found:', wasmMetadata.artist);
            metadata.artist = wasmMetadata.artist;
          }
          
          if (wasmMetadata.album) {
            console.log('🔍 [METADATA] Album found:', wasmMetadata.album);
            metadata.album = wasmMetadata.album;
          }
          
          if (wasmMetadata.year) {
            console.log('🔍 [METADATA] Year found:', wasmMetadata.year);
            metadata.year = wasmMetadata.year;
          }
          
          if (wasmMetadata.genre) {
            console.log('🔍 [METADATA] Genre found:', wasmMetadata.genre);
            metadata.genre = wasmMetadata.genre;
          }
          
          if (wasmMetadata.duration) {
            console.log('🔍 [METADATA] Duration found:', wasmMetadata.duration);
            metadata.duration = wasmMetadata.duration;
          }
          
          if (wasmMetadata.sample_rate) {
            console.log('🔍 [METADATA] Sample rate found:', wasmMetadata.sample_rate);
            metadata.sample_rate = wasmMetadata.sample_rate;
          }
          
          if (wasmMetadata.channels) {
            console.log('🔍 [METADATA] Channels found:', wasmMetadata.channels);
            metadata.channels = wasmMetadata.channels;
          }
          
          if (wasmMetadata.bit_depth) {
            console.log('🔍 [METADATA] Bit depth found:', wasmMetadata.bit_depth);
            metadata.bit_depth = wasmMetadata.bit_depth;
          }
          
          if (wasmMetadata.bitrate) {
            console.log('🔍 [METADATA] Bitrate found:', wasmMetadata.bitrate);
            metadata.bitrate = wasmMetadata.bitrate;
          }
          
          // Handle album art with detailed validation
          if (wasmMetadata.album_art) {
            console.log('🔍 [METADATA] Album art found, size:', wasmMetadata.album_art.length, 'bytes');
            console.log('🔍 [METADATA] Album art MIME type:', wasmMetadata.album_art_mime);
            
            // Convert album art data to Uint8Array if it's a regular array
            const art: unknown = wasmMetadata.album_art as unknown;
            if (Array.isArray(art)) {
              console.log('🔍 [METADATA] Converting array to Uint8Array...');
              metadata.album_art = new Uint8Array(art as number[]);
            } else if (art instanceof Uint8Array) {
              console.log('🔍 [METADATA] Album art is already Uint8Array');
              metadata.album_art = art as Uint8Array;
            } else {
              console.warn('🔍 [METADATA] Unknown album art format:', typeof art);
              metadata.album_art = undefined;
            }
            
            // Validate album art data
            if (metadata.album_art && metadata.album_art.length > 0) {
              const header = metadata.album_art.slice(0, 8);
              const headerHex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ');
              console.log('🔍 [METADATA] Album art header bytes:', headerHex);
              
              // Check for valid image format headers
              if (header[0] === 0xff && header[1] === 0xd8) {
                console.log('🔍 [METADATA] ✅ Valid JPEG header detected');
              } else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
                console.log('🔍 [METADATA] ✅ Valid PNG header detected');
              } else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
                console.log('🔍 [METADATA] ✅ Valid GIF header detected');
              } else {
                console.warn('🔍 [METADATA] ⚠️ Unknown image format header');
              }
            }
            
            metadata.album_art_mime = wasmMetadata.album_art_mime || undefined;
          } else {
            console.log('🔍 [METADATA] No album art found in file');
            metadata.album_art = undefined;
            metadata.album_art_mime = undefined;
          }

          console.log('🔍 [METADATA] Successfully extracted rich metadata from WASM');
          console.log('🔍 [METADATA] Final metadata:', metadata);
          return metadata;
        } else {
          console.warn('🔍 [METADATA] parse_metadata returned null or undefined');
        }
              } catch (error) {
          console.error('🔍 [METADATA] WASM metadata extraction failed:', error);
          console.error('🔍 [METADATA] Error details:', {
            name: (error as Error).name,
            message: (error as Error).message,
            stack: (error as Error).stack
          });
        }
      } else {
        console.log('🔍 [METADATA] WASM metadata parsing not implemented, using fallback');
      }
    } catch (error) {
      console.error('🔍 [METADATA] Failed to initialize metadata module:', error);
      console.error('🔍 [METADATA] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
    }

  // Fallback: Use HTML5 audio element for basic metadata
  console.log('🔍 [METADATA] Falling back to HTML5 audio element for basic metadata');
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
      console.warn('🔍 [METADATA] Failed to decode audio for detailed metadata:', decodeError);
    }

    // Estimate bitrate based on file size and duration
    if (metadata.duration) {
      const fileSizeInBits = file.size * 8;
      metadata.bitrate = Math.round(fileSizeInBits / metadata.duration / 1000);
    }

    URL.revokeObjectURL(url);
    console.log('🔍 [METADATA] Fallback metadata extraction completed:', metadata);
  } catch (error) {
    console.error('🔍 [METADATA] Fallback metadata extraction failed:', error);
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
