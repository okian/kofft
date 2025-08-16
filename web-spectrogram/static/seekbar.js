export class SeekBar {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.window = canvas.ownerDocument?.defaultView || globalThis;
    this.amplitudes = [];
    this.progress = 0;
    this.duration = 0;
    this.seekHandlers = [];
    this.dragging = false;
    this._bind();
    this.resize();
  }

  _bind() {
    this.canvas.addEventListener("mousedown", (e) => {
      this.dragging = true;
      this._seekEvent(e);
    });
    this.canvas.addEventListener("mousemove", (e) => {
      const time = this._eventTime(e);
      if (!Number.isNaN(time)) {
        this.canvas.title = `${time.toFixed(2)}s`;
        if (this.dragging) {
          this._emitSeek(time);
        }
      }
    });
    this.window.addEventListener("mouseup", () => {
      this.dragging = false;
    });
    this.canvas.addEventListener("click", (e) => {
      this._seekEvent(e);
    });
    this.window.addEventListener("resize", () => this.resize());
  }

  _eventTime(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.offsetX ?? e.clientX - rect.left;
    return (x / this.canvas.width) * this.duration;
  }

  _seekEvent(e) {
    const time = this._eventTime(e);
    if (!Number.isNaN(time)) {
      this._emitSeek(time);
    }
  }

  _emitSeek(time) {
    for (const fn of this.seekHandlers) {
      fn(time);
    }
  }

  onSeek(fn) {
    this.seekHandlers.push(fn);
  }

  setAmplitudes(arr) {
    this.amplitudes = arr;
    this.draw();
  }

  setProgress(time, duration) {
    this.progress = duration ? time / duration : 0;
    this.duration = duration;
    this.draw();
  }

  resize() {
    const ratio = this.window?.devicePixelRatio || 1;
    const width = this.canvas.clientWidth || this.canvas.width;
    const height = this.canvas.clientHeight || this.canvas.height;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.draw();
  }

  draw() {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const mid = height / 2;
    const amps = this.amplitudes;
    if (amps.length) {
      const step = amps.length / width;
      for (let x = 0; x < width; x++) {
        const amp = amps[Math.min(amps.length - 1, Math.floor(x * step))];
        const h = amp * mid;
        ctx.strokeStyle = "#888";
        ctx.beginPath();
        ctx.moveTo(x, mid - h);
        ctx.lineTo(x, mid + h);
        ctx.stroke();
      }
      const progressX = this.progress * width;
      for (let x = 0; x < progressX; x++) {
        const amp = amps[Math.min(amps.length - 1, Math.floor(x * step))];
        const h = amp * mid;
        ctx.strokeStyle = "#0af";
        ctx.beginPath();
        ctx.moveTo(x, mid - h);
        ctx.lineTo(x, mid + h);
        ctx.stroke();
      }
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();
    }
  }
}
