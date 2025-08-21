//! Test intent: verifies spectrogram parity behavior including edge cases.
use hound::{SampleFormat, WavReader, WavSpec, WavWriter};
use image::{Rgb, RgbImage};
use kofft::visual::spectrogram::{
    color_from_magnitude_u16, color_from_magnitude_u8, stft_magnitudes, Colormap,
};
use std::error::Error;
use std::f32::consts::PI;
use std::io;
use std::path::Path;
use tempfile::tempdir;

/// Sample rate in Hz for the generated test tone.
const SAMPLE_RATE: u32 = 8_000;
/// Frequency in Hz of the sinusoidal input.
const FREQ_HZ: f32 = 440.0;
/// Number of samples representing one second of audio.
const NUM_SAMPLES: usize = SAMPLE_RATE as usize;
/// STFT window length used for the spectrogram.
const WINDOW_LEN: usize = 1024;
/// Hop length between consecutive STFT windows.
const HOP_LEN: usize = WINDOW_LEN / 2;
/// Dynamic range in decibels for the spectrogram floor.
const DYNAMIC_RANGE_DB: f32 = 120.0;
/// Floor in decibels for color mapping.
const FLOOR_DB: f32 = -DYNAMIC_RANGE_DB;

/// Read a mono 16-bit WAV file, compute its STFT magnitudes, and render an
/// RGB image by applying the supplied color function to each magnitude.
///
/// The function also returns the raw magnitudes and the maximum magnitude so
/// callers can reuse them without recomputing the STFT.
fn spectrogram_from_wav<F>(
    path: &Path,
    map_color: F,
) -> Result<(RgbImage, Vec<Vec<f32>>, f32), Box<dyn Error>>
where
    F: Fn(f32, f32) -> [u8; 3],
{
    let mut reader = WavReader::open(path)?;
    let samples: Vec<f32> = reader
        .samples::<i16>()
        .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
        .collect::<Result<_, _>>()?;
    if samples.is_empty() {
        return Err(Box::new(io::Error::new(
            io::ErrorKind::InvalidData,
            "input WAV contains no samples",
        )));
    }
    let (mags, max_mag) = stft_magnitudes(&samples, WINDOW_LEN, HOP_LEN)
        .map_err(|e| io::Error::other(format!("{e:?}")))?;
    let img = render_magnitudes(&mags, max_mag, map_color);
    Ok((img, mags, max_mag))
}

/// Render a spectrogram image from precomputed magnitudes using `map_color` to
/// convert each magnitude to an RGB value.
fn render_magnitudes<F>(mags: &[Vec<f32>], max_mag: f32, map_color: F) -> RgbImage
where
    F: Fn(f32, f32) -> [u8; 3],
{
    let height = WINDOW_LEN / 2;
    let width = mags.len();
    let mut img = RgbImage::new(width as u32, height as u32);
    for (x, frame) in mags.iter().enumerate() {
        for (y, &mag) in frame.iter().enumerate() {
            let rgb = map_color(mag, max_mag);
            img.put_pixel(x as u32, (height - 1 - y) as u32, Rgb(rgb));
        }
    }
    img
}

#[test]
fn spectrograms_match() -> Result<(), Box<dyn Error>> {
    let tmp = tempdir()?;
    let wav_path = tmp.path().join("input.wav");

    // Create a one-second 440 Hz sine wave.
    let spec = WavSpec {
        channels: 1,
        sample_rate: SAMPLE_RATE,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };
    let mut writer = WavWriter::create(&wav_path, spec)?;
    for i in 0..NUM_SAMPLES {
        let sample = (2.0 * PI * FREQ_HZ * i as f32 / SAMPLE_RATE as f32).sin();
        writer.write_sample((sample * i16::MAX as f32) as i16)?;
    }
    writer.finalize()?;

    // Generate spectrogram using the example's 8-bit color mapping.
    let (img_example, mags, max_mag) = spectrogram_from_wav(&wav_path, |mag, max| {
        color_from_magnitude_u8(mag, max, FLOOR_DB, Colormap::Fire)
    })?;

    // Generate spectrogram using the sanity-check 16-bit path and downscale.
    let img_sanity = render_magnitudes(&mags, max_mag, |mag, max| {
        let c16 = color_from_magnitude_u16(mag, max, FLOOR_DB, Colormap::Fire);
        [
            (c16[0] >> 8) as u8,
            (c16[1] >> 8) as u8,
            (c16[2] >> 8) as u8,
        ]
    });

    assert_eq!(img_example.as_raw(), img_sanity.as_raw());
    Ok(())
}
