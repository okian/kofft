import { SeekBar } from "./seekbar.js";

export async function decodeAndProcess(file, audioEl, wasm = globalThis) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const buf = await file.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(buf);
  const pcm = audioBuffer.getChannelData(0);
  let amplitudes = [];
  if (typeof wasm.process_pcm === "function") {
    const res = wasm.process_pcm(pcm);
    if (Array.isArray(res) || res instanceof Float32Array) {
      amplitudes = Array.from(res);
    }
  }
  if (!amplitudes.length) {
    amplitudes = Array.from(pcm, (v) => Math.abs(v));
  }
  audioEl.src = URL.createObjectURL(file);
  return { ctx, audioBuffer, amplitudes };
}

export function setupPlayback(audioEl, seek) {
  audioEl.addEventListener("timeupdate", () => {
    seek.setProgress(audioEl.currentTime, audioEl.duration || 0);
  });
  seek.onSeek((t) => {
    audioEl.currentTime = t;
  });
}

export function startRenderLoop(canvas, analyser) {
  const ctx = canvas.getContext("2d");
  const data = new Uint8Array(analyser.frequencyBinCount);
  // Ensure the canvas height matches the frequency bin count while
  // preserving the original aspect ratio.
  const aspect = canvas.width / canvas.height;
  if (canvas.height !== data.length) {
    canvas.height = data.length;
    canvas.width = Math.round(canvas.height * aspect);
  }
  function render() {
    analyser.getByteFrequencyData(data);
    const img = ctx.getImageData(1, 0, canvas.width - 1, canvas.height);
    ctx.putImageData(img, 0, 0);
    for (let y = 0; y < Math.min(canvas.height, data.length); y++) {
      const v = data[y];
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(canvas.width - 1, y, 1, 1);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

export function init(
  doc = document,
  deps = { decodeAndProcess, setupPlayback, startRenderLoop },
) {
  const fileInput = doc.querySelector("input[type=file]");
  const audio = doc.querySelector("audio");
  const seekCanvas = doc.getElementById("seekbar");
  const seek = new SeekBar(seekCanvas);
  const canvas = doc.getElementById("spectrogram");
  const themeSelect = doc.getElementById("theme");
  canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
  canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);

  deps.setupPlayback(audio, seek);

  let ctx;
  if (themeSelect) {
    doc.body.dataset.theme = themeSelect.value;
    themeSelect.addEventListener("change", () => {
      doc.body.dataset.theme = themeSelect.value;
    });
  }

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (ctx) {
      await ctx.close();
    }
    let amplitudes;
    ({ ctx, amplitudes } = await deps.decodeAndProcess(file, audio));
    seek.setAmplitudes(amplitudes);
    const analyser = ctx.createAnalyser();
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    deps.startRenderLoop(canvas, analyser);
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => init());
}
