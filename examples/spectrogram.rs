//! Generates a spectrogram from a WAV file using kofft.
//!
//! Usage:
//! ```bash
//! cargo run --example spectrogram -- <INPUT_WAV> <OUTPUT_PNG> [--floor dB] [--palette fire|legacy]
//! ```
//!
//! The input should be a 16-bit mono WAV file. The output is a PNG image where
//! STFT magnitudes are mapped onto a configurable color palette (default: black→purple→orange→yellow→white).

use std::env;
use std::error::Error;
use std::io;

use hound::WavReader;
use image::{Rgb, RgbImage};
use kofft::fft::ScalarFftImpl;
use kofft::stft::stft;
use kofft::window::hann;

/// Available color palettes for the spectrogram.
#[derive(Clone, Copy)]
enum Palette {
    /// Black→purple→orange→yellow→white gradient.
    Fire,
    /// Original dark purple→bright yellow/white gradient.
    Legacy,
}

impl Palette {
    fn parse(s: &str) -> Self {
        match s {
            "legacy" => Palette::Legacy,
            _ => Palette::Fire,
        }
    }

    fn color(self, t: f32) -> Rgb<u8> {
        match self {
            Palette::Fire => {
                const STOPS: [(f32, [u8; 3]); 5] = [
                    (0.0, [0, 0, 0]),       // black
                    (0.25, [128, 0, 128]),  // purple
                    (0.5, [255, 165, 0]),   // orange
                    (0.75, [255, 255, 0]),  // yellow
                    (1.0, [255, 255, 255]), // white
                ];
                let t = t.clamp(0.0, 1.0);
                let (start, end) = STOPS
                    .windows(2)
                    .find(|w| t >= w[0].0 && t <= w[1].0)
                    .map(|w| (w[0], w[1]))
                    .unwrap_or((STOPS[3], STOPS[4]));
                let local_t = (t - start.0) / (end.0 - start.0);
                let lerp = |a: u8, b: u8| a as f32 + (b as f32 - a as f32) * local_t;
                Rgb([
                    lerp(start.1[0], end.1[0]) as u8,
                    lerp(start.1[1], end.1[1]) as u8,
                    lerp(start.1[2], end.1[2]) as u8,
                ])
            }
            Palette::Legacy => {
                let r = 64.0 * (1.0 - t) + 255.0 * t;
                let g = 255.0 * t;
                let b = 64.0 * (1.0 - t) + 224.0 * t;
                Rgb([r as u8, g as u8, b as u8])
            }
        }
    }
}

fn magnitude_to_db(mag: f32, max_mag: f32, floor_db: f32) -> f32 {
    if max_mag <= 0.0 || mag <= 0.0 {
        return floor_db;
    }
    let db = 20.0 * (mag / max_mag).log10();
    db.max(floor_db)
}

fn color_from_magnitude(mag: f32, max_mag: f32, floor_db: f32, palette: Palette) -> Rgb<u8> {
    let db = magnitude_to_db(mag, max_mag, floor_db);
    let t = (db - floor_db) / -floor_db;
    palette.color(t)
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut args = env::args().skip(1);
    let mut input = None;
    let mut output = None;
    let mut floor_db = -120.0f32;
    let mut palette = Palette::Fire;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--floor" => {
                if let Some(v) = args.next() {
                    floor_db = v.parse().unwrap_or(floor_db);
                }
            }
            "--palette" => {
                if let Some(v) = args.next() {
                    palette = Palette::parse(&v);
                }
            }
            _ => {
                if input.is_none() {
                    input = Some(arg);
                } else if output.is_none() {
                    output = Some(arg);
                } else {
                    eprintln!("Usage: cargo run --example spectrogram -- <INPUT_WAV> <OUTPUT_PNG> [--floor dB] [--palette fire|legacy]");
                    std::process::exit(1);
                }
            }
        }
    }
    let input = input.unwrap_or_else(|| {
        eprintln!("Usage: cargo run --example spectrogram -- <INPUT_WAV> <OUTPUT_PNG> [--floor dB] [--palette fire|legacy]");
        std::process::exit(1);
    });
    let output = output.unwrap_or_else(|| {
        eprintln!("Usage: cargo run --example spectrogram -- <INPUT_WAV> <OUTPUT_PNG> [--floor dB] [--palette fire|legacy]");
        std::process::exit(1);
    });

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
                color_from_magnitude(mag, max_mag, floor_db, palette),
            );
        }
    }

    img.save(output)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{color_from_magnitude, magnitude_to_db, Palette};
    use hound::{SampleFormat, WavReader, WavSpec, WavWriter};
    use image::Rgb;
    use std::io::Cursor;

    #[test]
    fn db_conversion_works() {
        let floor_db = -120.0;
        let max_mag = 1.0;
        assert!((magnitude_to_db(max_mag, max_mag, floor_db) - 0.0).abs() < 1e-6);
        let mag_floor = max_mag * 10f32.powf(floor_db / 20.0);
        assert!((magnitude_to_db(mag_floor, max_mag, floor_db) - floor_db).abs() < 1e-3);
        let mag_mid = max_mag * 10f32.powf((floor_db / 2.0) / 20.0);
        assert!((magnitude_to_db(mag_mid, max_mag, floor_db) - floor_db / 2.0).abs() < 1e-3);
    }

    #[test]
    fn color_at_floor_is_black() {
        let floor_db = -120.0;
        let max_mag = 1.0;
        let mag_floor = max_mag * 10f32.powf(floor_db / 20.0);
        let Rgb([r, g, b]) = color_from_magnitude(mag_floor, max_mag, floor_db, Palette::Fire);
        assert_eq!((r, g, b), (0, 0, 0));
    }

    #[test]
    fn color_at_midpoint_is_orange() {
        let floor_db = -120.0;
        let max_mag = 1.0;
        let mag_mid = max_mag * 10f32.powf((floor_db / 2.0) / 20.0);
        let Rgb([r, g, b]) = color_from_magnitude(mag_mid, max_mag, floor_db, Palette::Fire);
        assert_eq!((r, g, b), (255, 165, 0));
    }

    #[test]
    fn color_at_max_is_white() {
        let floor_db = -120.0;
        let max_mag = 1.0;
        let Rgb([r, g, b]) = color_from_magnitude(max_mag, max_mag, floor_db, Palette::Fire);
        assert_eq!((r, g, b), (255, 255, 255));
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
