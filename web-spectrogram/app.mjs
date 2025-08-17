export function ensureBuffer() {
  if (typeof globalThis.Buffer === "undefined") {
    globalThis.Buffer = class Buffer extends Uint8Array {
      static from(data) {
        if (data instanceof ArrayBuffer) {
          return new Uint8Array(data);
        }
        return new Uint8Array(data);
      }
    };
  }
}

ensureBuffer();

let wasm;
/* c8 ignore start */
async function loadWasm() {
  if (!wasm) {
    if (typeof window === "undefined") {
      wasm = await import("./tests/pkg/web_spectrogram.js");
    } else {
      wasm = await import("./pkg/web_spectrogram.js");
      await wasm.default();
    }
  }
  return wasm;
}
/* c8 ignore stop */

export function magnitudeToDb(mag, maxMag) {
  const ratio = mag / maxMag;
  return 20 * Math.log10(Math.max(ratio, 1e-12));
}

export function drawSpectrogram(
  canvas,
  res,
  colorFn,
  colormap = wasm?.Colormap.Rainbow,
) {
  const ctx = canvas.getContext("2d");
  const { mags, width, height, max_mag } = res;
  canvas.width = width;
  canvas.height = height;
  const img = ctx.createImageData(width, height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const mag = mags[x * height + y];
      const [r, g, b] = colorFn(mag, max_mag, -80, colormap);
      const idx = 4 * (y * width + x);
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* c8 ignore start */
export async function initApp() {
  console.log("loading wasm");
  const w = await loadWasm();
  console.log("wasm loaded");
  const fileInput = document.getElementById("file");
  const canvas = document.getElementById("spec");
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    console.log("file selected", file.name);
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const samples = audioBuffer.getChannelData(0);
    console.log("samples", samples.length);
    const res = w.stft_magnitudes(samples, 1024, 512);
    drawSpectrogram(canvas, res, w.color_from_magnitude_u8);
  });
}
/* c8 ignore stop */

/* c8 ignore start */
if (typeof window !== "undefined") {
  initApp();
}
/* c8 ignore stop */
