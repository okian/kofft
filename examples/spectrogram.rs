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
use kofft::visual::spectrogram::{color_from_magnitude_u8, stft_magnitudes, Colormap};

fn main() -> Result<(), Box<dyn Error>> {
    let mut args = env::args().skip(1);
    let mut input = None;
    let mut output = None;
    let mut floor_db = -120.0f32;
    let mut palette = Colormap::Fire;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--floor" => {
                if let Some(v) = args.next() {
                    floor_db = v.parse().unwrap_or(floor_db);
                }
            }
            "--palette" => {
                if let Some(v) = args.next() {
                    palette = Colormap::parse(&v);
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
    let (mags, max_mag) =
        stft_magnitudes(&samples, win_len, hop).map_err(|e| io::Error::other(format!("{e:?}")))?;
    let height = win_len / 2;
    let width = mags.len();

    let mut img = RgbImage::new(width as u32, height as u32);
    for (x, frame_mag) in mags.iter().enumerate() {
        for (y, &mag) in frame_mag.iter().enumerate() {
            let c = color_from_magnitude_u8(mag, max_mag, floor_db, palette);
            img.put_pixel(x as u32, (height - 1 - y) as u32, Rgb(c));
        }
    }

    img.save(output)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use hound::{SampleFormat, WavReader, WavSpec, WavWriter};
    use kofft::visual::spectrogram::{color_from_magnitude_u8, magnitude_to_db, Colormap};
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
        let [r, g, b] = color_from_magnitude_u8(mag_floor, max_mag, floor_db, Colormap::Fire);
        assert_eq!((r, g, b), (0, 0, 0));
    }

    #[test]
    fn color_at_midpoint_is_orange() {
        let floor_db = -120.0;
        let max_mag = 1.0;
        let mag_mid = max_mag * 10f32.powf((floor_db / 2.0) / 20.0);
        let [r, g, b] = color_from_magnitude_u8(mag_mid, max_mag, floor_db, Colormap::Fire);
        assert_eq!((r, g, b), (255, 165, 0));
    }

    #[test]
    fn color_at_max_is_white() {
        let floor_db = -120.0;
        let max_mag = 1.0;
        let [r, g, b] = color_from_magnitude_u8(max_mag, max_mag, floor_db, Colormap::Fire);
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
