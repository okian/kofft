export default async function init() {}
export function stft_magnitudes() {
  return { mags: [], width: 0, height: 0, max_mag: 0 };
}
export function color_from_magnitude_u8() {
  return new Uint8Array();
}
export const Colormap = { Rainbow: 0 };
