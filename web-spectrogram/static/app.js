import { SeekBar } from "./seekbar.js";

export function parseID3v1(buf) {
  if (buf.byteLength < 128) return {};
  const view = new Uint8Array(buf.slice(-128));
  const dec = new TextDecoder("latin1");
  if (dec.decode(view.slice(0, 3)) !== "TAG") return {};
  const clean = (arr) => dec.decode(arr).replace(/\0/g, "").trim();
  return {
    title: clean(view.slice(3, 33)),
    artist: clean(view.slice(33, 63)),
    album: clean(view.slice(63, 93)),
    year: clean(view.slice(93, 97)),
  };
}

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

export async function decodeAndProcess(file, audioEl, wasm = globalThis, ctx) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  ctx = ctx || new AudioCtx();
  const buf = await file.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(buf);
  const metadata = parseID3v1(buf);
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
  metadata.duration = audioBuffer.duration;
  return { ctx, audioBuffer, amplitudes, metadata };
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

export function renderLegend(canvas, palette) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const h = canvas.height;
  for (let y = 0; y < h; y++) {
    const v = Math.round(((h - 1 - y) / Math.max(h - 1, 1)) * 255);
    ctx.fillStyle = palette(v);
    ctx.fillRect(0, y, canvas.width, 1);
  }
}

export function init(
  doc = document,
  deps = { decodeAndProcess, setupPlayback, startRenderLoop },
) {
  const controls = doc.getElementById("controls");
  const fileInput = controls.querySelector("input[type=file]");
  const audio = controls.querySelector("audio");
  const playBtn = controls.querySelector("#play");
  const muteBtn = controls.querySelector("#mute");
  const volume = controls.querySelector("#volume");
  const micBtn = controls.querySelector("#mic");
  const micSelect = controls.querySelector("#mic-select");
  const seekCanvas = controls.querySelector("#seekbar");
  const seek = seekCanvas ? new SeekBar(seekCanvas) : null;
  const canvas = doc.getElementById("spectrogram");
  const legend = doc.getElementById("legend");
  const metadataEl = doc.getElementById("metadata");
  const paletteRef = { current: palettes.rainbow };
  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    if (legend) {
      legend.height = canvas.height;
      legend.width = 20 * ratio;
      renderLegend(legend, paletteRef.current);
    }
    if (seek) seek.resize();
  };
  resize();
  window.addEventListener("resize", resize);
  const scaleSelect = controls.querySelector("#scale");

  if (seek) {
    deps.setupPlayback(audio, seek);
  }
  if (volume) {
    volume.addEventListener("input", () => {
      audio.volume = parseFloat(volume.value);
    });
  }
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (audio.paused) audio.play();
      else audio.pause();
    });
    audio.addEventListener("play", () => (playBtn.textContent = "Pause"));
    audio.addEventListener("pause", () => (playBtn.textContent = "Play"));
  }
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      audio.muted = !audio.muted;
      muteBtn.textContent = audio.muted ? "Unmute" : "Mute";
    });
  }
  const themeButtons = controls.querySelectorAll("#themes button");
  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      paletteRef.current = palettes[btn.dataset.theme] || palettes.rainbow;
      themeButtons.forEach((b) => b.classList.toggle("active", b === btn));
      renderLegend(legend, paletteRef.current);
    });
  });

  let ctx;
  let analyser;
  let renderStarted = false;
  let micStream;

  async function ensureAnalyser() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
    }
    if (!analyser) {
      analyser = ctx.createAnalyser();
    }
    if (!renderStarted) {
      deps.startRenderLoop(canvas, analyser, scaleSelect, paletteRef);
      renderStarted = true;
    }
  }

  async function populateMics() {
    if (
      !micSelect ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.enumerateDevices
    )
      return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    micSelect.innerHTML = "";
    devices
      .filter((d) => d.kind === "audioinput")
      .forEach((d, i) => {
        const opt = doc.createElement("option");
        opt.value = d.deviceId;
        opt.textContent = d.label || `Mic ${i + 1}`;
        micSelect.appendChild(opt);
      });
  }

  if (micSelect) {
    populateMics();
  }

  if (micBtn && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    micBtn.addEventListener("click", async () => {
      if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
        micStream = null;
        micBtn.textContent = "Mic";
        return;
      }
      await ensureAnalyser();
      await populateMics();
      const deviceId =
        micSelect && micSelect.value ? micSelect.value : undefined;
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      const src = ctx.createMediaStreamSource(micStream);
      src.connect(analyser);
      micBtn.textContent = "Stop Mic";
    });
  }

  doc.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" && e.target.type !== "range") return;
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        if (audio.paused) audio.play();
        else audio.pause();
        break;
      case "ArrowUp":
        audio.volume = Math.min(1, audio.volume + 0.05);
        if (volume) volume.value = audio.volume.toString();
        break;
      case "ArrowDown":
        audio.volume = Math.max(0, audio.volume - 0.05);
        if (volume) volume.value = audio.volume.toString();
        break;
      case "ArrowLeft":
        audio.currentTime = Math.max(0, audio.currentTime - 10);
        break;
      case "ArrowRight":
        audio.currentTime = Math.min(
          audio.duration || audio.currentTime + 10,
          audio.currentTime + 10,
        );
        break;
      case "m":
        audio.muted = !audio.muted;
        if (muteBtn) {
          muteBtn.textContent = audio.muted ? "Unmute" : "Mute";
        }
        break;
    }
  });

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let amplitudes, metadata;
    ({ ctx, amplitudes, metadata } = await deps.decodeAndProcess(
      file,
      audio,
      undefined,
      ctx,
    ));
    await ensureAnalyser();
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    source.connect(ctx.destination);
    if (seek) {
      seek.setAmplitudes(amplitudes);
    }
    if (metadataEl) {
      metadataEl.textContent = `${metadata.title || ""} ${
        metadata.artist || ""
      } ${metadata.album || ""} ${metadata.year || ""} ${
        metadata.duration ? metadata.duration.toFixed(2) + "s" : ""
      }`.trim();
    }
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => init());
}
