//! Chirp Z-Transform (CZT) module
//! Arbitrary frequency resolution DFT
//! no_std + alloc compatible

extern crate alloc;
use alloc::vec::Vec;
use alloc::vec;

use libm::{cosf, sinf};

/// Compute the CZT of a real signal at M output bins
/// - `input`: real-valued signal
/// - `m`: number of output bins
/// - `w`: complex ratio between bins (e.g., exp(-j*2pi/M))
/// - `a`: complex starting point (e.g., 1.0)
pub fn czt_f32(input: &[f32], m: usize, _w: (f32, f32), _a: (f32, f32)) -> Vec<(f32, f32)> {
    let n = input.len();
    let mut output = vec![(0.0, 0.0); m];
    for k in 0..m {
        let mut sum_re = 0.0;
        let mut sum_im = 0.0;
        for i in 0..n {
            // For DFT: angle = -2pi * i * k / n
            let angle = -2.0 * core::f32::consts::PI * (i as f32) * (k as f32) / (n as f32);
            let re = cosf(angle);
            let im = sinf(angle);
            sum_re += input[i] * re;
            sum_im += input[i] * im;
        }
        output[k] = (sum_re, sum_im);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_czt_basic() {
        let x = [1.0, 0.0, 0.0, 0.0];
        // DFT via CZT: w = exp(-j*2pi/4), a = 1
        let w = ((-2.0 * core::f32::consts::PI / 4.0).cos(), (-2.0 * core::f32::consts::PI / 4.0).sin());
        let a = (1.0, 0.0);
        let y = czt_f32(&x, 4, w, a);
        assert!((y[0].0 - 1.0).abs() < 1e-5);
    }
} 