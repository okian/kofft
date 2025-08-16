//! Generates a spectrogram from a WAV file using kofft.
//!
//! Usage:
//! ```bash
//! cargo run --example spectrogram -- <INPUT_WAV> <OUTPUT_PNG>
//! ```
//!
//! The input should be a 16-bit mono WAV file. The output is a PNG image where
//! STFT magnitudes are mapped onto a dark purple→bright yellow/white color gradient.

use std::env;
use std::error::Error;
use std::io;

use hound::WavReader;
use image::{Rgb, RgbImage};
use kofft::fft::ScalarFftImpl;
use kofft::stft::stft;
use kofft::window::hann;

fn color_from_magnitude(mag: f32, max_mag: f32) -> Rgb<u8> {
    let t = if max_mag > 0.0 { mag / max_mag } else { 0.0 };
    let r = 64.0 * (1.0 - t) + 255.0 * t;
    let g = 255.0 * t;
    let b = 64.0 * (1.0 - t) + 224.0 * t;
    Rgb([r as u8, g as u8, b as u8])
}

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        eprintln!("Usage: cargo run --example spectrogram -- <INPUT_WAV> <OUTPUT_PNG>");
        std::process::exit(1);
    }
    let input = &args[1];
    let output = &args[2];

    // Read WAV file (16-bit mono expected)
    let mut reader = WavReader::open(input)?;
    let samples: Vec<f32> = reader
        .samples::<i16>()
        .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
        .collect::<Result<_, _>>()?;

    // STFT parameters
    let win_len = 1024;
    let hop = win_len / 2;
    let window = hann(win_len);
    let fft = ScalarFftImpl::<f32>::default();
    let mut frames = vec![vec![]; samples.len().div_ceil(hop)];
    stft(&samples, &window, hop, &mut frames, &fft)
        .map_err(|e| io::Error::other(format!("{e:?}")))?;

    let height = win_len / 2;
    let width = frames.len();
    let mut mags = vec![vec![0.0f32; height]; width];
    let mut max_mag = 0.0f32;
    for (x, frame) in frames.iter().enumerate() {
        for (y, c) in frame.iter().take(height).enumerate() {
            let mag = (c.re * c.re + c.im * c.im).sqrt();
            mags[x][y] = mag;
            if mag > max_mag {
                max_mag = mag;
            }
        }
    }

    let mut img = RgbImage::new(width as u32, height as u32);
    for (x, frame_mag) in mags.iter().enumerate() {
        for (y, &mag) in frame_mag.iter().enumerate() {
            img.put_pixel(
                x as u32,
                (height - 1 - y) as u32,
                color_from_magnitude(mag, max_mag),
            );
        }
    }

    img.save(output)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::color_from_magnitude;
    use hound::{SampleFormat, WavReader, WavSpec, WavWriter};
    use image::Rgb;
    use std::io::Cursor;

    #[test]
    fn low_magnitude_is_dark_purple() {
        let Rgb([r, g, b]) = color_from_magnitude(0.0, 1.0);
        assert_eq!((r, g, b), (64, 0, 64));
    }

    #[test]
    fn high_magnitude_is_light_yellow() {
        let Rgb([r, g, b]) = color_from_magnitude(1.0, 1.0);
        assert_eq!((r, g, b), (255, 255, 224));
    }

    #[test]
    fn midpoint_is_intermediate_color() {
        let Rgb([r, g, b]) = color_from_magnitude(0.5, 1.0);
        assert_eq!((r, g, b), (159, 127, 144));
    }

    #[test]
    fn wav_parsing_failure_returns_error() {
        // Create a minimal valid 16-bit mono WAV then truncate to corrupt it
        let mut cursor = Cursor::new(Vec::new());
        {
            let spec = WavSpec {
                channels: 1,
                sample_rate: 8_000,
                bits_per_sample: 16,
                sample_format: SampleFormat::Int,
            };
            let mut writer = WavWriter::new(&mut cursor, spec).unwrap();
            writer.write_sample(0i16).unwrap();
            writer.finalize().unwrap();
        }
        let mut data = cursor.into_inner();
        data.truncate(data.len() - 1); // Corrupt the WAV data

        let mut reader = WavReader::new(Cursor::new(data)).unwrap();
        let result: Result<Vec<f32>, _> = reader
            .samples::<i16>()
            .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
            .collect();
        assert!(result.is_err());
    }
}
