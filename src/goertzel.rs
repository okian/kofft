//! Goertzel algorithm: efficient single-bin DFT detector
//! no_std + alloc compatible

use crate::fft::FftError;
#[cfg(not(feature = "std"))]
use libm::{cosf, floorf, sqrtf};
#[cfg(feature = "std")]
use libm::{floorf, sqrtf};

/// Minimum acceptable sample rate in hertz.
const MIN_SAMPLE_RATE_HZ: f32 = 1.0;
/// Minimum number of samples required for a stable Goertzel computation.
const MIN_DATA_LEN: usize = 2;
/// Minimum allowed target frequency in hertz.
const MIN_TARGET_FREQ_HZ: f32 = 0.0;

/// Compute the magnitude at a single DFT bin using the Goertzel algorithm.
///
/// # Parameters
/// * `input` - Real-valued signal buffer. Must contain at least
///   [`MIN_DATA_LEN`] samples for numerical stability.
/// * `sample_rate` - Signal sample rate in hertz. Must be at least
///   [`MIN_SAMPLE_RATE_HZ`].
/// * `target_freq` - Frequency to detect in hertz. Valid range is
///   [`MIN_TARGET_FREQ_HZ`]..=`sample_rate / 2.0` (Nyquist).
///
/// # Errors
/// Returns [`FftError::InvalidValue`] when any parameter is outside its
/// documented range, or [`FftError::EmptyInput`] when `input` has zero length.
#[cfg(feature = "std")]
pub fn goertzel_f32(input: &[f32], sample_rate: f32, target_freq: f32) -> Result<f32, FftError> {
    if input.is_empty() {
        return Err(FftError::EmptyInput);
    }
    if input.len() < MIN_DATA_LEN {
        return Err(FftError::InvalidValue);
    }
    if sample_rate < MIN_SAMPLE_RATE_HZ {
        return Err(FftError::InvalidValue);
    }
    if target_freq < MIN_TARGET_FREQ_HZ || target_freq > sample_rate * 0.5 {
        return Err(FftError::InvalidValue);
    }

    let n = input.len() as f32;
    let k = floorf(target_freq * n / sample_rate);
    let omega = 2.0 * core::f32::consts::PI * k / n;
    let coeff = 2.0 * omega.cos();
    let mut s_prev = 0.0;
    let mut s_prev2 = 0.0;
    for &x in input {
        let s = x + coeff * s_prev - s_prev2;
        s_prev2 = s_prev;
        s_prev = s;
    }
    let power = s_prev2 * s_prev2 + s_prev * s_prev - coeff * s_prev * s_prev2;
    Ok(sqrtf(power))
}

#[cfg(not(feature = "std"))]
pub fn goertzel_f32(input: &[f32], sample_rate: f32, target_freq: f32) -> Result<f32, FftError> {
    if input.is_empty() {
        return Err(FftError::EmptyInput);
    }
    if input.len() < MIN_DATA_LEN {
        return Err(FftError::InvalidValue);
    }
    if sample_rate < MIN_SAMPLE_RATE_HZ {
        return Err(FftError::InvalidValue);
    }
    if target_freq < MIN_TARGET_FREQ_HZ || target_freq > sample_rate * 0.5 {
        return Err(FftError::InvalidValue);
    }

    let n = input.len() as f32;
    let k = floorf(target_freq * n / sample_rate);
    let omega = 2.0 * core::f32::consts::PI * k / n;
    let coeff = 2.0 * cosf(omega);
    let mut s_prev = 0.0;
    let mut s_prev2 = 0.0;
    for &x in input {
        let s = x + coeff * s_prev - s_prev2;
        s_prev2 = s_prev;
        s_prev = s;
    }
    let power = s_prev2 * s_prev2 + s_prev * s_prev - coeff * s_prev * s_prev2;
    Ok(sqrtf(power))
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;
    use alloc::vec::Vec;

    #[test]
    fn detects_tone() {
        let sr = 8_000.0;
        let f = 1_000.0;
        let n = 100;
        let signal: Vec<f32> = (0..n)
            .map(|i| (2.0 * core::f32::consts::PI * f * i as f32 / sr).sin())
            .collect();
        let mag = goertzel_f32(&signal, sr, f).unwrap();
        assert!(mag > 0.0);
    }

    #[test]
    fn rejects_short_input() {
        let data = [1.0f32];
        assert_eq!(
            goertzel_f32(&data, 8_000.0, 1_000.0).unwrap_err(),
            FftError::InvalidValue
        );
    }

    #[test]
    fn rejects_bad_rate() {
        let data = [1.0f32, 2.0];
        assert_eq!(
            goertzel_f32(&data, 0.0, 1_000.0).unwrap_err(),
            FftError::InvalidValue
        );
    }

    #[test]
    fn rejects_bad_freq() {
        let data = [1.0f32, 2.0];
        assert_eq!(
            goertzel_f32(&data, 8_000.0, -1.0).unwrap_err(),
            FftError::InvalidValue
        );
        assert_eq!(
            goertzel_f32(&data, 8_000.0, 5_000.0).unwrap_err(),
            FftError::InvalidValue
        );
    }

    #[test]
    fn handles_dc_and_nyquist() {
        let sr = 8_000.0;
        let n = 8;
        let dc = vec![1.0f32; n];
        let mag_dc = goertzel_f32(&dc, sr, 0.0).unwrap();
        assert!((mag_dc - n as f32).abs() < 1e-3);

        let nyquist: Vec<f32> = (0..n)
            .map(|i| if i % 2 == 0 { 1.0 } else { -1.0 })
            .collect();
        let mag_nyq = goertzel_f32(&nyquist, sr, sr / 2.0).unwrap();
        assert!((mag_nyq - n as f32).abs() < 1e-3);
    }

    #[test]
    fn handles_large_magnitude() {
        let sr = 8_000.0;
        let n = 10;
        let amp = 1_000_000.0f32;
        let data = vec![amp; n];
        let mag = goertzel_f32(&data, sr, 0.0).unwrap();
        assert!((mag - amp * n as f32).abs() / (amp * n as f32) < 1e-5);
    }
}
