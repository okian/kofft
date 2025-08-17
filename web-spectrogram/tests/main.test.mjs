import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import init from '../pkg/web_spectrogram.js';
import { mapMagnitudesToImage, Colormap } from '../spectrogram.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dirname, '../pkg/web_spectrogram_bg.wasm');
const wasmBytes = readFileSync(wasmPath);
await init(wasmBytes);

test('mapMagnitudesToImage produces RGBA data', () => {
  const mags = Float32Array.from([0, 0.5, 1, 0.25]);
  const img = mapMagnitudesToImage(mags, 2, 2, 1, Colormap.Gray);
  assert.strictEqual(img.length, 16);
  for (let i = 0; i < img.length; i += 4) {
    assert.strictEqual(img[i + 3], 255);
  }
});

test('mapMagnitudesToImage throws on mismatched dimensions', () => {
  assert.throws(() => mapMagnitudesToImage(new Float32Array(3), 2, 2, 1), /mismatch/);
});
