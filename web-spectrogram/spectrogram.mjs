import { color_from_magnitude_u8, Colormap } from "./pkg/web_spectrogram.js";

export function mapMagnitudesToImage(mags, width, height, maxMag, colormap = Colormap.Rainbow) {
    if (mags.length !== width * height) {
        throw new Error("mismatch");
    }
    const img = new Uint8ClampedArray(width * height * 4);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const mag = mags[x * height + y];
            const color = color_from_magnitude_u8(mag, maxMag, -80, colormap);
            const idx = 4 * (y * width + x);
            img[idx] = color[0];
            img[idx + 1] = color[1];
            img[idx + 2] = color[2];
            img[idx + 3] = 255;
        }
    }
    return img;
}

export { Colormap };
