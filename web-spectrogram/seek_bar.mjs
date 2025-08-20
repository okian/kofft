// Render a seek bar using WebGL when available, falling back to Canvas2D.
// Bars are 5px wide with 4px gaps and fully rounded ends.
export function drawSeekBar(canvas, bars, progress, theme) {
  const BAR_WIDTH = 5;
  const GAP = 4;
  const count = bars.length;
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const width = count * BAR_WIDTH + (count ? (count - 1) * GAP : 0);
  canvas.width = width;
  const height = canvas.height;

  if (gl) {
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, `attribute vec2 p; void main(){gl_Position=vec4(p,0.0,1.0);}`);
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, `precision mediump float; uniform vec4 color; void main(){gl_FragColor=color;}`);
    gl.compileShader(fs);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);
    const pos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const colorLoc = gl.getUniformLocation(program, 'color');

    for (let i = 0; i < count; i++) {
      const x = -1 + (2 * i * (BAR_WIDTH + GAP)) / width;
      const w = (2 * BAR_WIDTH) / width;
      const h = (2 * bars[i] * height) / height;
      const y = -1 + (2 * (height - bars[i] * height)) / height;
      const vertices = new Float32Array([
        x, y + h,
        x + w, y + h,
        x, y,
        x + w, y,
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
      const color = i < progress * count ? theme.accent : theme.primary;
      const rgba = parseColor(color);
      gl.uniform4f(colorLoc, rgba[0], rgba[1], rgba[2], rgba[3]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    return;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  for (let i = 0; i < count; i++) {
    const x = i * (BAR_WIDTH + GAP);
    const h = bars[i] * height;
    const y = height - h;
    const color = i < progress * count ? theme.accent : theme.primary;
    ctx.fillStyle = color;
    drawRoundedRect(ctx, x, y, BAR_WIDTH, h, BAR_WIDTH / 2);
  }
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function parseColor(css) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = css;
  const rgb = ctx.fillStyle.match(/^#(?:[0-9a-fA-F]{3}){1,2}$/) ? hexToRgb(ctx.fillStyle) : [0, 0, 0];
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1];
}

function hexToRgb(hex) {
  let c = hex.substring(1);
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
