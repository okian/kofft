import init, {
  stft_magnitudes,
  color_from_magnitude_u8,
  Colormap,
} from "@wasm";

const WIN_LEN = 1024;
const HOP = WIN_LEN / 2;
const FLOOR_DB = -80;

export interface SpectrogramData {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

export async function generateSpectrogram(
  file: File,
): Promise<SpectrogramData> {
  await init();
  const audioCtx = new AudioContext();
  const buf = await file.arrayBuffer();
  const audioBuf = await audioCtx.decodeAudioData(buf);
  const samples = audioBuf.getChannelData(0);
  const res = stft_magnitudes(samples, WIN_LEN, HOP);
  const mags: number[] = res.mags;
  const width = res.width;
  const height = res.height;
  const maxMag = res.max_mag;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const mag = mags[x * height + y];
      const color = color_from_magnitude_u8(
        mag,
        maxMag,
        FLOOR_DB,
        Colormap.Rainbow,
      );
      pixels.set(color, 4 * (y * width + x));
    }
  }
  return { pixels, width, height };
}
