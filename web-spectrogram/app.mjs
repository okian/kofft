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
let audioCtx;
let processor;
let stream;
/* c8 ignore start */
async function loadWasm() {
  if (!wasm) {
    if (typeof window === "undefined") {
      wasm = await import("./tests/pkg/web_spectrogram.js");
    } else {
      /* c8 ignore next 2 */
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

export async function startMic(canvas = document.getElementById("spec")) {
  const w = await loadWasm();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.error("microphone access denied", err);
    return false;
  }
  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  processor = audioCtx.createScriptProcessor(1024, 1, 1);
  source.connect(processor);
  processor.connect(audioCtx.destination);
  const ctx = canvas.getContext("2d");
  if (!canvas.height) canvas.height = 512;
  if (!canvas.width) canvas.width = 512;
  processor.onaudioprocess = (e) => {
    const samples = e.inputBuffer.getChannelData(0);
    const row = w.compute_frame(samples);
    if (row.length === 0) return;
    const { width, height } = canvas;
    const img = ctx.getImageData(1, 0, width - 1, height);
    ctx.putImageData(img, 0, 0);
    const newImg = new ImageData(new Uint8ClampedArray(row), 1, height);
    ctx.putImageData(newImg, width - 1, 0);
  };
  w.reset_state();
  return true;
}

export function stopMic() {
  if (processor) {
    processor.disconnect();
    processor = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  wasm?.reset_state();
}

/* c8 ignore start */
export async function initApp() {
  console.log("loading wasm");
  const w = await loadWasm();
  console.log("wasm loaded");
  const fileInput = document.getElementById("file");
  const canvas = document.getElementById("spec");
  const startBtn = document.getElementById("start");
  const stopBtn = document.getElementById("stop");
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
  /* c8 ignore start */
  if (startBtn && stopBtn) {
    startBtn.addEventListener("click", async () => {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      const ok = await startMic(canvas);
      if (!ok) {
        startBtn.disabled = false;
        stopBtn.disabled = true;
      }
    });
    stopBtn.addEventListener("click", () => {
      stopMic();
      startBtn.disabled = false;
      stopBtn.disabled = true;
    });
  }
  /* c8 ignore stop */
}
/* c8 ignore stop */

/* c8 ignore next 3 */
if (typeof window !== "undefined") {
  initApp();
}
