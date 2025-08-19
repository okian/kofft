export async function initWasmWithThreadPool(initFn, threadPoolFn) {
  if (
    typeof SharedArrayBuffer === "undefined" ||
    !globalThis.crossOriginIsolated
  ) {
    console.error("SharedArrayBuffer or cross-origin isolation not available");
    return false;
  }
  await initFn();
  const threads = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;
  await threadPoolFn(threads);
  return true;
}

export async function initSpectrogram() {
  const module = await import("./wasm/react_spectrogram_wasm.js");
  return initWasmWithThreadPool(module.default, module.initThreadPool);
}

if (typeof window !== "undefined") {
  initSpectrogram();
export class SpectrogramApp {
  constructor({ canvas, computeFrame, audioContext, navigator }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.computeFrame = computeFrame;
    const Ctor = audioContext
      ? null
      : globalThis.AudioContext || globalThis.webkitAudioContext;
    this.audioContext = audioContext || (Ctor ? new Ctor() : null);
    this.navigator = navigator || globalThis.navigator;
    this.source = null;
    this.processor = null;
    this.stream = null;
    this.onError = (e) => console.error(e);
  }

  async start() {
    if (this.stream) return;
    try {
      this.stream = await this.navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (e) => {
      await this._ensureWorkletModule();
      this.processor = new AudioWorkletNode(this.audioContext, 'spectrogram-processor', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1 });
      this.processor.port.onmessage = (event) => {
        const input = event.data;
        const frame = this.computeFrame(input);
        if (!frame || frame.length === 0) return;
        const width = frame.length / BYTES_PER_PIXEL;
        if (this.canvas.width !== width) {
          this.canvas.width = width;
        }
        const imageData = new ImageData(new Uint8ClampedArray(frame), width, 1);
        this.ctx.drawImage(
          this.canvas,
          0,
          0,
          this.canvas.width,
          this.canvas.height - 1,
          0,
          0,
          this.canvas.width,
          this.canvas.height - 1,
        // Preserve current canvas content before resizing
        const prevWidth = this.canvas.width;
        const prevHeight = this.canvas.height;
        let prevImage = null;
        if (prevWidth > 0 && prevHeight > 0) {
          // Create an offscreen canvas to store the previous image
          const offscreen = document.createElement('canvas');
          offscreen.width = prevWidth;
          offscreen.height = prevHeight;
          offscreen.getContext('2d').drawImage(this.canvas, 0, 0);
          prevImage = offscreen;
        }
        this.canvas.width = width;
        // Optionally, set canvas.height if it can change (not shown here)
        const imageData = new ImageData(new Uint8ClampedArray(frame), width, 1);
        if (prevImage) {
          // Draw the previous image shifted up by one row
          this.ctx.drawImage(
            prevImage,
            0,
            1,
            width,
            this.canvas.height - 1,
            0,
            0,
            width,
            this.canvas.height - 1,
          );
        }
        this.ctx.putImageData(imageData, 0, this.canvas.height - 1);
      };
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (err) {
      this.onError(err);
    }
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}
