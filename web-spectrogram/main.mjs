import init, { stft_magnitudes } from "./pkg/web_spectrogram.js";
import { mapMagnitudesToImage } from "./spectrogram.mjs";

// c8 ignore start
async function renderFile(file) {
    console.log("renderFile", file.name);
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const samples = audioBuffer.getChannelData(0);
    const win = 1024;
    const hop = win / 2;
    const res = stft_magnitudes(samples, win, hop);
    const image = mapMagnitudesToImage(res.mags, res.width, res.height, res.max_mag);
    const canvas = document.getElementById("spectrogram");
    canvas.width = res.width;
    canvas.height = res.height;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(new ImageData(image, res.width, res.height), 0, 0);
}

async function initApp() {
    console.log("Initializing spectrogram PWA");
    await init();
    console.log("WASM initialized");
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker
            .register("./sw.js")
            .then(() => console.log("Service worker registered"))
            .catch((e) => console.log("SW registration failed", e));
    }
    document
        .getElementById("fileInput")
        .addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                renderFile(file).catch((err) => console.error("render error", err));
            }
        });
}

if (typeof window !== "undefined") {
    window.addEventListener("load", initApp);
}
// c8 ignore stop
