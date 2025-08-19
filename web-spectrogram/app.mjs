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
        const input = e.inputBuffer.getChannelData(0);
        const frame = this.computeFrame(input);
        if (!frame || frame.length === 0) return;
        const width = frame.length / 4;
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
        );
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
