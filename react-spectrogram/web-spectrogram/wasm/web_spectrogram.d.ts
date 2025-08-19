/* tslint:disable */
/* eslint-disable */
export function init_panic_hook(): void;
export function stft_magnitudes(samples: Float32Array, win_len: number, hop: number): StftResult;
export function magnitude_to_db(mag: number, max_mag: number, floor_db: number): number;
export function db_scale(mag: number, max_mag: number, dynamic_range: number): number;
export function map_color_u8(t: number, cmap: Colormap): Uint8Array;
export function color_from_magnitude_u8(mag: number, max_mag: number, floor_db: number, cmap: Colormap): Uint8Array;
export function fft_split(re: Float32Array, im: Float32Array): FftResult;
export function dct2(input: Float32Array): Float32Array;
export function haar_forward(input: Float32Array): HaarResult;
export function haar_inverse(avg: Float32Array, diff: Float32Array): Float32Array;
export function reset_state(): void;
export function set_colormap(cmap: string): void;
export function compute_frame(samples: Float32Array): Uint8Array;
export function parse_metadata(bytes: Uint8Array): any;
/**
 * Generate amplitude envelope for seekbar visualization
 * Returns an array of amplitude values (0.0 to 1.0) representing the audio envelope
 */
export function generate_amplitude_envelope(audio_data: Float32Array, sample_rate: number, target_bars: number, window_ms: number, smoothing_samples: number): Float32Array;
/**
 * Generate waveform data for visualization (legacy function for compatibility)
 * Returns an array of amplitude values (0.0 to 1.0) representing the audio waveform
 */
export function generate_waveform(audio_data: Float32Array, num_bars: number): Float32Array;
export enum Colormap {
  Rainbow = 0,
  Fire = 1,
  Grayscale = 2,
}
export class FftResult {
  private constructor();
  free(): void;
  readonly re: Float32Array;
  readonly im: Float32Array;
}
export class HaarResult {
  private constructor();
  free(): void;
  readonly avg: Float32Array;
  readonly diff: Float32Array;
}
export class StftResult {
  private constructor();
  free(): void;
  readonly mags: Float32Array;
  readonly width: number;
  readonly height: number;
  readonly max_mag: number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly init_panic_hook: () => void;
  readonly __wbg_stftresult_free: (a: number, b: number) => void;
  readonly stftresult_mags: (a: number) => [number, number];
  readonly stftresult_width: (a: number) => number;
  readonly stftresult_height: (a: number) => number;
  readonly stftresult_max_mag: (a: number) => number;
  readonly stft_magnitudes: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly magnitude_to_db: (a: number, b: number, c: number) => number;
  readonly db_scale: (a: number, b: number, c: number) => number;
  readonly map_color_u8: (a: number, b: number) => [number, number];
  readonly color_from_magnitude_u8: (a: number, b: number, c: number, d: number) => [number, number];
  readonly __wbg_fftresult_free: (a: number, b: number) => void;
  readonly fftresult_re: (a: number) => [number, number];
  readonly fftresult_im: (a: number) => [number, number];
  readonly fft_split: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly dct2: (a: number, b: number) => [number, number];
  readonly __wbg_haarresult_free: (a: number, b: number) => void;
  readonly haarresult_avg: (a: number) => [number, number];
  readonly haarresult_diff: (a: number) => [number, number];
  readonly haar_forward: (a: number, b: number) => number;
  readonly haar_inverse: (a: number, b: number, c: number, d: number) => [number, number];
  readonly reset_state: () => void;
  readonly set_colormap: (a: number, b: number) => void;
  readonly compute_frame: (a: number, b: number) => [number, number];
  readonly parse_metadata: (a: number, b: number) => [number, number, number];
  readonly generate_amplitude_envelope: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly generate_waveform: (a: number, b: number, c: number) => [number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
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
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
