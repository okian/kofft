export const Colormap = { Rainbow: 0 };
export function color_from_magnitude_u8() { return [1,2,3]; }
export function stft_magnitudes() { return { mags: [1,1], width: 1, height: 2, max_mag: 1 }; }
export let threadPoolInit = 0;
export async function initThreadPool(n) { threadPoolInit = n; }
export function getThreadPoolInit() { return threadPoolInit; }
export default async function init() {}
