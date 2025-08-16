export async function decodeAndProcess(file, audioEl, wasm = globalThis) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const buf = await file.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(buf);
  const pcm = audioBuffer.getChannelData(0);
  if (typeof wasm.process_pcm === "function") {
    wasm.process_pcm(pcm);
  }
  audioEl.src = URL.createObjectURL(file);
  return { ctx, audioBuffer };
}

export function setupPlayback(audioEl, seekInput) {
  audioEl.addEventListener("timeupdate", () => {
    seekInput.max = audioEl.duration || 0;
    seekInput.value = audioEl.currentTime;
  });
  seekInput.addEventListener("input", () => {
    audioEl.currentTime = Number(seekInput.value);
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
  const seek = doc.querySelector("input[type=range]");
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
    ({ ctx } = await deps.decodeAndProcess(file, audio));
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
