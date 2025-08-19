/* tslint:disable */
/* eslint-disable */
export function amplitude_to_db(amplitude: number): number;
export function db_to_amplitude(db: number): number;
export function normalize_audio(audio_data: Float32Array): Float32Array;
export function start(): void;
export class AudioAnalyzer {
  private constructor();
  free(): void;
  static new(sample_rate: number): AudioAnalyzer;
  get_frequency_bins(): Float32Array;
}
export class MetadataExtractor {
  private constructor();
  free(): void;
  static new(): MetadataExtractor;
  extract_metadata(file_data: Uint8Array, filename: string): any;
}
export class SeekBarProcessor {
  private constructor();
  free(): void;
  static new(sample_rate: number, window_size: number): SeekBarProcessor;
  generate_waveform(audio_data: Float32Array): Float32Array;
}
export class SpectrogramProcessor {
  private constructor();
  free(): void;
  static new(fft_size: number, hop_size: number): SpectrogramProcessor;
  get_frequency_bins(sample_rate: number): Float32Array;
}

export type InitInput =
  | RequestInfo
  | URL
  | Response
  | BufferSource
  | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_metadataextractor_free: (a: number, b: number) => void;
  readonly metadataextractor_new: () => number;
  readonly metadataextractor_extract_metadata: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
  ) => any;
  readonly __wbg_audioanalyzer_free: (a: number, b: number) => void;
  readonly audioanalyzer_new: (a: number) => number;
  readonly audioanalyzer_get_frequency_bins: (a: number) => [number, number];
  readonly __wbg_spectrogramprocessor_free: (a: number, b: number) => void;
  readonly spectrogramprocessor_get_frequency_bins: (
    a: number,
    b: number,
  ) => [number, number];
  readonly __wbg_seekbarprocessor_free: (a: number, b: number) => void;
  readonly seekbarprocessor_new: (a: number, b: number) => number;
  readonly seekbarprocessor_generate_waveform: (
    a: number,
    b: number,
    c: number,
  ) => [number, number];
  readonly amplitude_to_db: (a: number) => number;
  readonly db_to_amplitude: (a: number) => number;
  readonly normalize_audio: (a: number, b: number) => [number, number];
  readonly start: () => void;
  readonly spectrogramprocessor_new: (a: number, b: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(
  module: { module: SyncInitInput } | SyncInitInput,
): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;
