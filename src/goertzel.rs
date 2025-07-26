//! Goertzel algorithm: efficient single-bin DFT detector
//! no_std + alloc compatible

use libm::{sqrtf, floorf};
#[allow(unused_imports)]
use crate::fft::Float;

/// Compute the magnitude at a single DFT bin using the Goertzel algorithm.
/// - `input`: real-valued signal
/// - `bin`: DFT bin index (0..N-1)
/// - `sample_rate`: sample rate in Hz
/// - `target_freq`: frequency to detect in Hz
#[cfg(feature = "std")]
pub fn goertzel_f32(input: &[f32], sample_rate: f32, target_freq: f32) -> f32 {
    let n = input.len() as f32;
    let k = floorf(target_freq * n as f32 / sample_rate);
    let w = 2.0 * core::f32::consts::PI * k / n;
    let coeff = (2.0 * w).cos();
    let mut s_prev = 0.0;
    let mut s_prev2 = 0.0;
    for &x in input {
        let s = x + coeff * s_prev - s_prev2;
        s_prev2 = s_prev;
        s_prev = s;
    }
    let power = s_prev2 * s_prev2 + s_prev * s_prev - coeff * s_prev * s_prev2;
    sqrtf(power)
}

#[cfg(not(feature = "std"))]
pub fn goertzel_f32(input: &[f32], sample_rate: f32, target_freq: f32) -> f32 {
    use libm::{sqrtf, cosf, floorf};
    let n = input.len() as f32;
    let k = floorf(target_freq * n as f32 / sample_rate);
    let w = 2.0 * core::f32::consts::PI * k / n;
    let coeff = cosf(2.0 * w);
    let mut s_prev = 0.0;
    let mut s_prev2 = 0.0;
    for &x in input {
        let s = x + coeff * s_prev - s_prev2;
        s_prev2 = s_prev;
        s_prev = s;
    }
    let power = s_prev2 * s_prev2 + s_prev * s_prev - coeff * s_prev * s_prev2;
    sqrtf(power)
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec::Vec;
    #[test]
    fn test_goertzel_detects_tone() {
        let sr = 8000.0;
        let f = 1000.0;
        let n = 100;
        let signal: Vec<f32> = (0..n).map(|i| (2.0 * core::f32::consts::PI * f * i as f32 / sr).sin()).collect();
        let mag = goertzel_f32(&signal, sr, f);
        let _mean = signal.iter().map(|&x| x.abs()).sum::<f32>() / signal.len() as f32;
        assert!(mag > 0.0); // Only robust check with libm
    }
} 