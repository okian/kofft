import { SeekBar } from "./seekbar.js";

export const palettes = {
  rainbow: (v) => {
    const ratio = v / 255;
    const r = Math.round(255 * ratio);
    const g = Math.round(255 * (1 - Math.abs(ratio * 2 - 1)));
    const b = Math.round(255 * (1 - ratio));
    return `rgb(${r},${g},${b})`;
  },
  fire: (v) => {
    const ratio = v / 255;
    const r = Math.round(255 * ratio);
    const g = Math.round(255 * Math.min(1, ratio * 1.5));
    const b = Math.round(255 * Math.max(0, ratio - 0.5) * 2);
    return `rgb(${r},${g},${b})`;
  },
};

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

export function startRenderLoop(
  canvas,
  analyser,
  scale = { value: "linear" },
  paletteRef = { current: (v) => `rgb(${v},${v},${v})` },
) {
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
    const mode =
      typeof scale === "string" ? scale : (scale && scale.value) || "linear";
    for (let y = 0; y < Math.min(canvas.height, data.length); y++) {
      const idx =
        mode === "logarithmic"
          ? Math.min(
              data.length - 1,
              Math.floor(
                Math.pow(data.length, y / Math.max(canvas.height - 1, 1)) - 1,
              ),
            )
          : y;
      const v = data[idx] || 0;
      ctx.fillStyle = paletteRef.current(v);
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
  const controls = doc.getElementById("controls");
  const fileInput = controls.querySelector("input[type=file]");
  const audio = controls.querySelector("audio");
  const seekCanvas = controls.querySelector("#seekbar");
  const seek = seekCanvas ? new SeekBar(seekCanvas) : null;
  const canvas = doc.getElementById("spectrogram");
  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
  };
  resize();
  window.addEventListener("resize", resize);
  const scaleSelect = controls.querySelector("#scale");
  canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
  canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);

  if (seek) {
    deps.setupPlayback(audio, seek);
  }

  const paletteRef = { current: palettes.rainbow };
  const themeButtons = controls.querySelectorAll("#themes button");
  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      paletteRef.current = palettes[btn.dataset.theme] || palettes.rainbow;
      themeButtons.forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  let ctx;

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (ctx) {
      await ctx.close();
    }
    let amplitudes;
    ({ ctx, amplitudes } = await deps.decodeAndProcess(file, audio));
    if (seek) {
      seek.setAmplitudes(amplitudes);
    }
    const analyser = ctx.createAnalyser();
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    deps.startRenderLoop(canvas, analyser, scaleSelect, paletteRef);
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => init());
}
