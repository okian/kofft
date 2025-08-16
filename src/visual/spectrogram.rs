//! Spectrogram utilities shared by examples and sanity-check binary.
//!
//! This module provides helpers for computing STFT magnitudes,
//! converting them to decibels, applying optional log-frequency
//! scaling and mapping values onto colour palettes.

use alloc::vec;
use alloc::vec::Vec;

use crate::fft::{FftError, ScalarFftImpl};
use crate::window::hann;
use crate::Complex32;

/// Supported colour palettes for spectrogram rendering.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Colormap {
    /// Black→purple→orange→yellow→white gradient.
    Fire,
    /// Original dark purple→bright yellow/white gradient.
    Legacy,
    /// Greyscale gradient.
    Gray,
    /// Viridis perceptually uniform map.
    Viridis,
    /// Plasma perceptually uniform map.
    Plasma,
    /// Inferno perceptually uniform map.
    Inferno,
    /// Rainbow map used by sanity-check.
    Rainbow,
}

impl Colormap {
    /// Parse a palette name used on the command line.
    pub fn parse(s: &str) -> Self {
        match s.to_ascii_lowercase().as_str() {
            "legacy" => Colormap::Legacy,
            "gray" => Colormap::Gray,
            "viridis" => Colormap::Viridis,
            "plasma" => Colormap::Plasma,
            "inferno" => Colormap::Inferno,
            "rainbow" => Colormap::Rainbow,
            _ => Colormap::Fire,
        }
    }
}

/// Compute STFT magnitudes for a signal using a Hann window.
///
/// Returns a matrix of shape `(frames, win_len/2)` and the maximum magnitude
/// encountered which is useful for normalisation.
pub fn stft_magnitudes(
    samples: &[f32],
    win_len: usize,
    hop: usize,
) -> Result<(Vec<Vec<f32>>, f32), FftError> {
    let window = hann(win_len);
    let fft = ScalarFftImpl::<f32>::default();
    let mut frames = vec![vec![]; samples.len().div_ceil(hop)];
    compute_stft(samples, &window, hop, &mut frames, &fft)?;

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
    Ok((mags, max_mag))
}

fn compute_stft<Fft: crate::fft::FftImpl<f32>>(
    signal: &[f32],
    window: &[f32],
    hop: usize,
    frames: &mut [Vec<Complex32>],
    fft: &Fft,
) -> Result<(), FftError> {
    #[cfg(feature = "parallel")]
    {
        crate::stft::parallel(signal, window, hop, frames, fft)
    }
    #[cfg(not(feature = "parallel"))]
    {
        crate::stft::stft(signal, window, hop, frames, fft)
    }
}

/// Convert a magnitude to decibels relative to `max_mag` with the given floor.
pub fn magnitude_to_db(mag: f32, max_mag: f32, floor_db: f32) -> f32 {
    if max_mag <= 0.0 || mag <= 0.0 {
        return floor_db;
    }
    let db = 20.0 * (mag / max_mag).log10();
    db.max(floor_db)
}

/// Convert a magnitude to a 0..1 range using the provided dynamic range in dB.
///
/// This is equivalent to `((db + dynamic_range) / dynamic_range)`.
pub fn db_scale(mag: f32, max_mag: f32, dynamic_range: f32) -> f32 {
    let db = 20.0 * (mag / max_mag).max(1e-10).log10();
    ((db + dynamic_range) / dynamic_range).clamp(0.0, 1.0)
}

/// Map a value in `[0, 1]` onto an RGB8 colour for the given palette.
pub fn map_color_u8(t: f32, cmap: Colormap) -> [u8; 3] {
    let t = t.clamp(0.0, 1.0);
    match cmap {
        Colormap::Fire => {
            const STOPS: [(f32, [u8; 3]); 5] = [
                (0.0, [0, 0, 0]),
                (0.25, [128, 0, 128]),
                (0.5, [255, 165, 0]),
                (0.75, [255, 255, 0]),
                (1.0, [255, 255, 255]),
            ];
            let (start, end) = STOPS
                .windows(2)
                .find(|w| t >= w[0].0 && t <= w[1].0)
                .map(|w| (w[0], w[1]))
                .unwrap_or((STOPS[3], STOPS[4]));
            let local = (t - start.0) / (end.0 - start.0);
            [
                lerp_u8(start.1[0], end.1[0], local),
                lerp_u8(start.1[1], end.1[1], local),
                lerp_u8(start.1[2], end.1[2], local),
            ]
        }
        Colormap::Legacy => {
            let r = 64.0 * (1.0 - t) + 255.0 * t;
            let g = 255.0 * t;
            let b = 64.0 * (1.0 - t) + 224.0 * t;
            [r as u8, g as u8, b as u8]
        }
        Colormap::Gray => {
            let g = (t * 255.0).round() as u8;
            [g, g, g]
        }
        Colormap::Viridis => {
            let c = colorous::VIRIDIS.eval_continuous(t as f64);
            [c.r, c.g, c.b]
        }
        Colormap::Plasma => {
            let c = colorous::PLASMA.eval_continuous(t as f64);
            [c.r, c.g, c.b]
        }
        Colormap::Inferno => {
            let c = colorous::INFERNO.eval_continuous(t as f64);
            [c.r, c.g, c.b]
        }
        Colormap::Rainbow => rainbow_color_u8(t),
    }
}

fn lerp_u8(a: u8, b: u8, t: f32) -> u8 {
    (a as f32 + (b as f32 - a as f32) * t) as u8
}

fn rainbow_color_u8(t: f32) -> [u8; 3] {
    const STOPS: [(f32, [u8; 3]); 6] = [
        (0.0, [0, 0, 0]),
        (0.25, [0, 0, 255]),
        (0.5, [0, 255, 255]),
        (0.75, [255, 255, 0]),
        (0.9, [255, 0, 0]),
        (1.0, [255, 255, 255]),
    ];
    let mut i = 0;
    while i + 1 < STOPS.len() && t > STOPS[i + 1].0 {
        i += 1;
    }
    let (t0, c0) = STOPS[i];
    let (t1, c1) = STOPS[(i + 1).min(STOPS.len() - 1)];
    let local = if t1 > t0 { (t - t0) / (t1 - t0) } else { 0.0 };
    [
        lerp_u8(c0[0], c1[0], local),
        lerp_u8(c0[1], c1[1], local),
        lerp_u8(c0[2], c1[2], local),
    ]
}

/// Map a value in `[0,1]` onto an RGB16 colour for the given palette.
pub fn map_color_u16(t: f32, cmap: Colormap) -> [u16; 3] {
    let [r, g, b] = map_color_u8(t, cmap);
    [r as u16 * 257, g as u16 * 257, b as u16 * 257]
}

/// Convenience wrapper combining dB conversion and colour mapping to RGB8.
pub fn color_from_magnitude_u8(mag: f32, max_mag: f32, floor_db: f32, cmap: Colormap) -> [u8; 3] {
    let db = magnitude_to_db(mag, max_mag, floor_db);
    let t = (db - floor_db) / -floor_db;
    map_color_u8(t, cmap)
}

/// Convenience wrapper combining dB conversion and colour mapping to RGB16.
pub fn color_from_magnitude_u16(mag: f32, max_mag: f32, floor_db: f32, cmap: Colormap) -> [u16; 3] {
    let [r, g, b] = color_from_magnitude_u8(mag, max_mag, floor_db, cmap);
    [r as u16 * 257, g as u16 * 257, b as u16 * 257]
}

/// Map a frequency bin index to a pixel using logarithmic scaling.
pub fn map_bin_to_pixel(bin: usize, max_bin: usize) -> usize {
    if max_bin == 0 {
        0
    } else {
        let log_max = (max_bin as f32 + 1.0).ln();
        let pos = (bin as f32 + 1.0).ln();
        (max_bin as f32 * pos / log_max).floor() as usize
    }
}

/// Apply logarithmic averaging to frequency bins.
pub fn log_scale_bins(values: &[f32], max_bin: usize) -> Vec<f32> {
    let mut accum = vec![0.0f32; max_bin + 1];
    let mut counts = vec![0u32; max_bin + 1];
    for (bin, &v) in values.iter().enumerate() {
        let y = map_bin_to_pixel(bin, max_bin);
        accum[y] += v;
        counts[y] += 1;
    }
    for (a, c) in accum.iter_mut().zip(counts.iter()) {
        if *c > 0 {
            *a /= *c as f32;
        }
    }
    accum
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn color_extremes_are_correct() {
        let floor_db = -120.0;
        let max_mag = 1.0;
        let mag_floor = max_mag * 10f32.powf(floor_db / 20.0);
        assert_eq!(
            color_from_magnitude_u8(mag_floor, max_mag, floor_db, Colormap::Fire),
            [0, 0, 0]
        );
        assert_eq!(
            color_from_magnitude_u8(max_mag, max_mag, floor_db, Colormap::Fire),
            [255, 255, 255]
        );
    }

    #[test]
    fn log_scale_bins_average_correctly() {
        let frame: Vec<f32> = (1..=8).map(|x| x as f32).collect();
        let scaled = log_scale_bins(&frame, 7);
        assert!((scaled[6] - (6.0 + 7.0) / 2.0).abs() < 1e-6);
    }

    #[test]
    fn rainbow_gradient_interpolates() {
        let c = map_color_u16(0.375, Colormap::Rainbow);
        assert_eq!(c[0], 0);
        assert_eq!(c[2], 65535);
        assert!(c[1] > 0 && c[1] < 65535);
    }

    #[test]
    fn compute_stft_matches_sequential() {
        use crate::fft::ScalarFftImpl;
        use crate::stft::stft;
        use crate::window::hann;

        let signal: Vec<f32> = (0..16).map(|i| i as f32).collect();
        let win_len = 4;
        let hop = 2;
        let window = hann(win_len);
        let fft = ScalarFftImpl::<f32>::default();
        let mut seq = vec![vec![]; signal.len().div_ceil(hop)];
        stft(&signal, &window, hop, &mut seq, &fft).unwrap();
        let mut helper = vec![vec![]; signal.len().div_ceil(hop)];
        compute_stft(&signal, &window, hop, &mut helper, &fft).unwrap();
        assert_eq!(seq, helper);
    }
}
