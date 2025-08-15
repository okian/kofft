//! Generates a spectrogram from a WAV file using kofft.
//!
//! Usage:
//! ```bash
//! cargo run --example spectrogram -- <INPUT_WAV> <OUTPUT_PNG>
//! ```
//!
//! The input should be a 16-bit mono WAV file. The output is a PNG image where
//! STFT magnitudes are mapped onto a yellow→purple color gradient.

use std::env;
use std::error::Error;
use std::io;

use hound::WavReader;
use image::{Rgb, RgbImage};
use kofft::fft::ScalarFftImpl;
use kofft::stft::stft;
use kofft::window::hann;

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
        .map(|s| s.unwrap() as f32 / i16::MAX as f32)
        .collect();

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
            let t = if max_mag > 0.0 { mag / max_mag } else { 0.0 };
            let r = 255.0 - 127.0 * t;
            let g = 255.0 * (1.0 - t);
            let b = 128.0 * t;
            img.put_pixel(
                x as u32,
                (height - 1 - y) as u32,
                Rgb([r as u8, g as u8, b as u8]),
            );
        }
    }

    img.save(output)?;
    Ok(())
}
