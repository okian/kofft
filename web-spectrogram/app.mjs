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

function drawSpectrogramCanvas(canvas, res, colorFn, colormap) {
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

function drawSpectrogramWebGL(gl, canvas, res) {
  const { mags, width, height, max_mag } = res;
  canvas.width = width;
  canvas.height = height;

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(
    vs,
    "attribute vec2 p; varying vec2 v; void main(){v=(p+1.0)/2.0; gl_Position=vec4(p,0.0,1.0);}",
  );
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(
    fs,
  const fragmentShaderSource = `
    precision highp float;
    varying vec2 v;
    uniform sampler2D m;
    uniform float maxMag;
    const float FLOOR_DB = -80.0;
    vec3 rainbow(float t) {
      if (t < 0.25) {
        float local = t / 0.25;
        return mix(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), local);
      } else if (t < 0.5) {
        float local = (t - 0.25) / 0.25;
        return mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), local);
      } else if (t < 0.75) {
        float local = (t - 0.5) / 0.25;
        return mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 1.0, 0.0), local);
      } else if (t < 0.9) {
        float local = (t - 0.75) / 0.15;
        return mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), local);
      }
      float local = (t - 0.9) / 0.1;
      return mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0), local);
    }
    void main() {
      float mag = texture2D(m, v).r;
      float ratio = mag / maxMag;
      float db = 20.0 * log(max(ratio, 1e-12));
      float t = (db - FLOOR_DB) / (-FLOOR_DB);
      gl_FragColor = vec4(rainbow(clamp(t, 0.0, 1.0)), 1.0);
    }
  `;
  gl.shaderSource(
    fs,
    fragmentShaderSource,
  );
  gl.compileShader(fs);

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const pos = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pos);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RED,
    width,
    height,
    0,
    gl.RED,
    gl.FLOAT,
    new Float32Array(mags),
  );

  const maxLoc = gl.getUniformLocation(program, "maxMag");
  gl.uniform1f(maxLoc, max_mag);
  const texLoc = gl.getUniformLocation(program, "m");
  gl.uniform1i(texLoc, 0);

  gl.viewport(0, 0, width, height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export function drawSpectrogram(
  canvas,
  res,
  colorFn,
  colormap = wasm?.Colormap.Rainbow,
) {
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || null;
  if (gl) {
    drawSpectrogramWebGL(gl, canvas, res);
    return;
  }
  if (typeof navigator !== "undefined" && navigator.gpu) {
    const ctx = canvas.getContext("webgpu");
    if (ctx) {
      // WebGPU not implemented, fall back for now
      drawSpectrogramCanvas(canvas, res, colorFn, colormap);
      return;
    }
  }
  drawSpectrogramCanvas(canvas, res, colorFn, colormap);
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
