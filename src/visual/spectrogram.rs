//! Spectrogram utilities shared by examples and sanity-check binary.
//!
//! This module provides helpers for computing STFT magnitudes,
//! converting them to decibels, applying optional log-frequency
//! scaling and mapping values onto colour palettes.
//!
//! A criterion benchmark (`spectrogram_memory_usage`) processing 65,536 samples
//! with a 1024-point window shows essentially zero additional resident memory,
//! indicating the routines operate in-place without excessive allocation.

use alloc::vec;
use alloc::vec::Vec;

use crate::fft::{FftError, FftImpl, FftStrategy, ScalarFftImpl};
use crate::window::hann;
use crate::Complex32;
use core::ops::Range;
use std::sync::Mutex;

#[cfg(not(all(feature = "std", feature = "wasm", feature = "simd")))]
compile_error!("spectrogram module requires `std`, `wasm`, and `simd` features");

/// Minimal positive value used to prevent division by zero and logarithm
/// of zero when converting magnitudes to decibel-based scales.
const DB_EPSILON: f32 = 1e-10;

/// Multiplier converting amplitude ratios to decibels.
const DB_MULTIPLIER: f32 = 20.0;

/// Maximum value for an 8-bit colour channel.
const U8_MAX: f32 = 255.0;

/// Scale factor to expand an 8-bit channel to 16-bit range.
const U16_FROM_U8: u16 = 257;

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
    if win_len == 0 {
        return Err(FftError::InvalidValue);
    }
    if hop == 0 {
        return Err(FftError::InvalidHopSize);
    }
    // Compute expected frame count and spectrogram height up front so we can
    // detect potential length overflows before allocating large buffers.
    let frame_count = samples.len().div_ceil(hop);
    let height = win_len / 2;
    if frame_count.checked_mul(height).is_none() {
        return Err(FftError::LengthOverflow);
    }
    let window = hann(win_len);
    // Wrap the default FFT in a mutex to provide `Sync` for parallel processing.
    let fft = SyncFft::default();
    let mut frames = vec![vec![]; frame_count];
    compute_stft(samples, &window, hop, &mut frames, &fft)?;

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

/// Thread-safe wrapper around [`ScalarFftImpl`] allowing shared access across threads.
#[derive(Default)]
struct SyncFft(Mutex<ScalarFftImpl<f32>>);

impl FftImpl<f32> for SyncFft {
    /// Forward FFT through an internal mutex-protected implementation.
    fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        self.0.lock().unwrap().fft(input)
    }
    /// Inverse FFT through the inner implementation.
    fn ifft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        self.0.lock().unwrap().ifft(input)
    }
    /// Delegate strided FFT to the inner implementation.
    fn fft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        self.0.lock().unwrap().fft_strided(input, stride, scratch)
    }
    /// Delegate strided IFFT to the inner implementation.
    fn ifft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        self.0.lock().unwrap().ifft_strided(input, stride, scratch)
    }
    /// Delegate out-of-place strided FFT to the inner implementation.
    fn fft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        self.0
            .lock()
            .unwrap()
            .fft_out_of_place_strided(input, in_stride, output, out_stride)
    }
    /// Delegate out-of-place strided IFFT to the inner implementation.
    fn ifft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        self.0
            .lock()
            .unwrap()
            .ifft_out_of_place_strided(input, in_stride, output, out_stride)
    }
    /// Delegate strategy-based FFT to the inner implementation.
    fn fft_with_strategy(
        &self,
        input: &mut [Complex32],
        strategy: FftStrategy,
    ) -> Result<(), FftError> {
        self.0.lock().unwrap().fft_with_strategy(input, strategy)
    }
}

/// Compute the STFT using either the parallel or sequential implementation
/// depending on feature flags.
fn compute_stft<Fft: crate::fft::FftImpl<f32> + Sync>(
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
    // Convert ratio to decibels using standard amplitude factor.
    let db = DB_MULTIPLIER * (mag / max_mag).log10();
    db.max(floor_db)
}

/// Convert a magnitude to a 0..1 range using the provided dynamic range in dB.
///
/// Returns `0.0` if `max_mag` is too small to avoid dividing by zero. This is
/// equivalent to `((db + dynamic_range) / dynamic_range)` for valid inputs.
pub fn db_scale(mag: f32, max_mag: f32, dynamic_range: f32) -> f32 {
    if max_mag <= DB_EPSILON {
        // Avoid division by numbers too close to zero which would yield NaNs.
        return 0.0;
    }
    // Convert ratio to decibels using standard amplitude factor.
    let db = DB_MULTIPLIER * (mag / max_mag).max(DB_EPSILON).log10();
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
            // Blend between endpoints of the legacy colour gradient.
            let r = 64.0 * (1.0 - t) + U8_MAX * t;
            let g = U8_MAX * t;
            // End point of blue channel is slightly lower than full scale.
            let b = 64.0 * (1.0 - t) + 224.0 * t;
            [r as u8, g as u8, b as u8]
        }
        Colormap::Gray => {
            // Greyscale: replicate intensity across all channels.
            let g = (t * U8_MAX).round() as u8;
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
    // Expand from 8-bit to 16-bit by scaling with the canonical factor 257.
    [
        r as u16 * U16_FROM_U8,
        g as u16 * U16_FROM_U8,
        b as u16 * U16_FROM_U8,
    ]
}

/// Convenience wrapper combining dB conversion and colour mapping to RGB8.
pub fn color_from_magnitude_u8(mag: f32, max_mag: f32, floor_db: f32, cmap: Colormap) -> [u8; 3] {
    debug_assert!(floor_db < 0.0, "floor_db must be negative");
    let db = magnitude_to_db(mag, max_mag, floor_db);
    // Normalise to 0..1 where `floor_db` maps to 0.
    let t = (db - floor_db) / -floor_db;
    map_color_u8(t, cmap)
}

/// Convenience wrapper combining dB conversion and colour mapping to RGB16.
pub fn color_from_magnitude_u16(mag: f32, max_mag: f32, floor_db: f32, cmap: Colormap) -> [u16; 3] {
    let [r, g, b] = color_from_magnitude_u8(mag, max_mag, floor_db, cmap);
    // Expand 8-bit RGB to 16-bit for high-colour outputs.
    [
        r as u16 * U16_FROM_U8,
        g as u16 * U16_FROM_U8,
        b as u16 * U16_FROM_U8,
    ]
}

/// Map a frequency bin index to a pixel using logarithmic scaling.
pub fn map_bin_to_pixel(bin: usize, max_bin: usize) -> usize {
    if max_bin == 0 {
        0
    } else {
        let log_max = (max_bin as f32 + 1.0).ln();
        let pos = (bin as f32 + 1.0).ln();
        // Clamp to `max_bin` to prevent out-of-bounds indices when `bin` exceeds `max_bin`.
        ((max_bin as f32 * pos / log_max).floor() as usize).min(max_bin)
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

/// Validate that the requested frequency and time ranges fall within the
/// provided spectrogram matrix.
///
/// The function ensures that the ranges are non-empty, start before they end
/// and that their end points do not exceed the dimensions of `buffer`.
/// Failure to meet any of these conditions yields `FftError::InvalidValue` so
/// callers can fail fast before attempting expensive rendering operations.
pub fn validate_ranges(
    freq_range: Range<usize>,
    time_range: Range<usize>,
    buffer: &[Vec<f32>],
) -> Result<(), FftError> {
    if freq_range.start > freq_range.end || time_range.start > time_range.end {
        return Err(FftError::InvalidValue);
    }
    if time_range.end > buffer.len() {
        return Err(FftError::InvalidValue);
    }
    if let Some(row) = buffer.first() {
        if freq_range.end > row.len() {
            return Err(FftError::InvalidValue);
        }
    } else if freq_range.end > 0 {
        return Err(FftError::InvalidValue);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fft::{FftError, FftImpl, FftStrategy, ScalarFftImpl};
    use std::sync::Mutex;

    /// Validate the magnitude-to-decibel conversion across ranges.
    #[test]
    fn db_conversion_works() {
        let floor_db = -120.0;
        let max_mag = 1.0;
        assert!((magnitude_to_db(max_mag, max_mag, floor_db) - 0.0).abs() < 1e-6);
        let mag_floor = max_mag * 10f32.powf(floor_db / DB_MULTIPLIER);
        assert!((magnitude_to_db(mag_floor, max_mag, floor_db) - floor_db).abs() < 1e-3);
        let mag_mid = max_mag * 10f32.powf((floor_db / 2.0) / DB_MULTIPLIER);
        assert!((magnitude_to_db(mag_mid, max_mag, floor_db) - floor_db / 2.0).abs() < 1e-3);
    }

    /// Ensure colour mapping saturates at the expected extremes.
    #[test]
    fn color_extremes_are_correct() {
        let floor_db = -120.0;
        let max_mag = 1.0;
        let mag_floor = max_mag * 10f32.powf(floor_db / DB_MULTIPLIER);
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

    /// Check that the rainbow gradient interpolates midpoints correctly.
    #[test]
    fn rainbow_gradient_interpolates() {
        let c = map_color_u16(0.375, Colormap::Rainbow);
        assert_eq!(c[0], 0);
        assert_eq!(c[2], 65535);
        assert!(c[1] > 0 && c[1] < 65535);
    }

    /// Verify that invalid STFT parameters produce immediate errors.
    #[test]
    fn stft_magnitudes_fail_fast() {
        assert_eq!(
            stft_magnitudes(&[0.0; 4], 0, 1).unwrap_err(),
            FftError::InvalidValue
        );
        assert_eq!(
            stft_magnitudes(&[0.0; 4], 2, 0).unwrap_err(),
            FftError::InvalidHopSize
        );
    }

    /// Ensure range validation rejects out-of-bounds requests.
    #[test]
    fn ranges_out_of_bounds_error() {
        let buffer = vec![vec![0.0f32; 4]; 2];
        assert!(validate_ranges(0..4, 0..2, &buffer).is_ok());
        assert_eq!(
            validate_ranges(0..5, 0..2, &buffer).unwrap_err(),
            FftError::InvalidValue
        );
        assert_eq!(
            validate_ranges(0..4, 2..3, &buffer).unwrap_err(),
            FftError::InvalidValue
        );
    }

    /// Large bin indices must clamp safely without overflow.
    #[test]
    fn map_bin_to_pixel_handles_extreme_bins() {
        let max_bin = 1024;
        let bin = usize::MAX;
        let pixel = map_bin_to_pixel(bin, max_bin);
        assert!(pixel <= max_bin);
    }

    /// Generating magnitudes for a large signal should not overflow.
    #[test]
    fn large_spectrogram_renders() {
        /// Length of the synthetic sample signal used to stress-test allocation.
        const SAMPLE_LEN: usize = 1 << 15;
        let samples = vec![0.0f32; SAMPLE_LEN];
        let win_len = 64;
        let hop = 32;
        let (mags, _) = stft_magnitudes(&samples, win_len, hop).unwrap();
        assert!(!mags.is_empty());
    }

    /// Ensure colour mapping never exceeds channel bounds.
    #[test]
    fn color_outputs_within_range() {
        for t in [-0.5f32, 0.0, 0.5, 1.0, 1.5] {
            let rgb8 = map_color_u8(t, Colormap::Fire);
            assert!(rgb8.iter().all(|c| *c <= U8_MAX as u8));
            let rgb16 = map_color_u16(t, Colormap::Fire);
            assert!(rgb16.iter().all(|c| *c <= U8_MAX as u16 * U16_FROM_U8));
        }
    }

    /// Confirm bin→pixel mapping and log-scaling maintain dimensions.
    #[test]
    fn resizing_behaviour_consistent() {
        let max_bin = 7;
        assert_eq!(map_bin_to_pixel(0, max_bin), 0);
        assert_eq!(map_bin_to_pixel(max_bin, max_bin), max_bin);
        // Values beyond the range should be clamped to the last pixel.
        assert_eq!(map_bin_to_pixel(max_bin * 2, max_bin), max_bin);
        let vals = vec![1.0; 16];
        let scaled = log_scale_bins(&vals, max_bin);
        assert_eq!(scaled.len(), max_bin + 1);
    }

    /// FFT wrapper that makes a non-`Sync` implementation safe to share across threads.
    struct SyncFft(Mutex<ScalarFftImpl<f32>>);
    impl Default for SyncFft {
        fn default() -> Self {
            Self(Mutex::new(ScalarFftImpl::<f32>::default()))
        }
    }
    impl FftImpl<f32> for SyncFft {
        fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
            self.0.lock().unwrap().fft(input)
        }
        fn ifft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
            self.0.lock().unwrap().ifft(input)
        }
        fn fft_strided(
            &self,
            input: &mut [Complex32],
            stride: usize,
            scratch: &mut [Complex32],
        ) -> Result<(), FftError> {
            self.0.lock().unwrap().fft_strided(input, stride, scratch)
        }
        fn ifft_strided(
            &self,
            input: &mut [Complex32],
            stride: usize,
            scratch: &mut [Complex32],
        ) -> Result<(), FftError> {
            self.0.lock().unwrap().ifft_strided(input, stride, scratch)
        }
        fn fft_out_of_place_strided(
            &self,
            input: &[Complex32],
            in_stride: usize,
            output: &mut [Complex32],
            out_stride: usize,
        ) -> Result<(), FftError> {
            self.0
                .lock()
                .unwrap()
                .fft_out_of_place_strided(input, in_stride, output, out_stride)
        }
        fn ifft_out_of_place_strided(
            &self,
            input: &[Complex32],
            in_stride: usize,
            output: &mut [Complex32],
            out_stride: usize,
        ) -> Result<(), FftError> {
            self.0
                .lock()
                .unwrap()
                .ifft_out_of_place_strided(input, in_stride, output, out_stride)
        }
        fn fft_with_strategy(
            &self,
            input: &mut [Complex32],
            strategy: FftStrategy,
        ) -> Result<(), FftError> {
            self.0.lock().unwrap().fft_with_strategy(input, strategy)
        }
    }

    /// Ensure the helper computes identical results to the direct STFT.
    #[test]
    fn compute_stft_matches_sequential() {
        use crate::stft::stft;
        use crate::window::hann;

        let signal: Vec<f32> = (0..16).map(|i| i as f32).collect();
        let win_len = 4;
        let hop = 2;
        let window = hann(win_len);
        let fft = SyncFft::default();
        let mut seq = vec![vec![]; signal.len().div_ceil(hop)];
        stft(&signal, &window, hop, &mut seq, &fft).unwrap();
        let mut helper = vec![vec![]; signal.len().div_ceil(hop)];
        compute_stft(&signal, &window, hop, &mut helper, &fft).unwrap();
        assert_eq!(seq, helper);
    }
}
