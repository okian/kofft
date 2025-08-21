//! More window functions: Tukey, Bartlett, Bohman, Nuttall
//! no_std + alloc compatible

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;
use core::f32::consts::PI;
use libm::{cosf, fabsf, floorf, sinf};

/// Leading cosine coefficient for the Nuttall window.
const NUTTALL_A0: f32 = 0.355_768;
/// Second cosine coefficient for the Nuttall window.
const NUTTALL_A1: f32 = 0.487_396;
/// Third cosine coefficient for the Nuttall window.
const NUTTALL_A2: f32 = 0.144_232;
/// Fourth cosine coefficient for the Nuttall window.
const NUTTALL_A3: f32 = 0.012_604;

/// Generates a Tukey window of length `len` with taper factor `alpha`.
/// Returns an empty vector when `len` is zero and a single unity sample
/// when `len` equals one to avoid division by zero in later computations.
pub fn tukey(len: usize, alpha: f32) -> Vec<f32> {
    if len == 0 {
        return Vec::new();
    }
    if len == 1 {
        return vec![1.0];
    }
    let alpha = alpha.clamp(0.0, 1.0);
    let mut w = vec![0.0; len];
    // Number of samples in each cosine taper region.
    let edge = floorf(alpha * (len as f32 - 1.0) / 2.0) as usize;
    for (n, w_n) in w.iter_mut().enumerate() {
        *w_n = if n < edge {
            // Rising cosine section at the beginning of the window.
            0.5 * (1.0 + (PI * (2.0 * n as f32 / (alpha * (len as f32 - 1.0)) - 1.0)).cos())
        } else if n < len - edge {
            1.0
        } else {
            // Falling cosine section at the end of the window.
            0.5 * (1.0
                + (PI * (2.0 * n as f32 / (alpha * (len as f32 - 1.0)) - 2.0 / alpha + 1.0)).cos())
        };
    }
    w
}

/// Generates a Bartlett (triangular) window of length `len`.
/// Handles zero and single-length inputs by returning a vector of ones or
/// an empty vector accordingly to prevent divide-by-zero errors.
pub fn bartlett(len: usize) -> Vec<f32> {
    if len == 0 {
        return Vec::new();
    }
    if len == 1 {
        return vec![1.0];
    }
    let mut w = vec![0.0; len];
    let n = len as f32;
    for (i, w_i) in w.iter_mut().enumerate() {
        // Normalize index to [-1, 1] range.
        let x = (i as f32 - (n - 1.0) / 2.0) / ((n - 1.0) / 2.0);
        *w_i = 1.0 - fabsf(x);
    }
    w
}

/// Generates a Bohman window of length `len`.
/// Zero and single-length inputs are handled gracefully to avoid
/// invalid arithmetic operations.
pub fn bohman(len: usize) -> Vec<f32> {
    if len == 0 {
        return Vec::new();
    }
    if len == 1 {
        return vec![1.0];
    }
    let mut w = vec![0.0; len];
    let n = len as f32;
    for (i, w_i) in w.iter_mut().enumerate() {
        // Map index into [-0.5, 0.5] interval.
        let x = (i as f32 / (n - 1.0)) - 0.5;
        *w_i = (1.0 - fabsf(x)) * cosf(PI * x) + 1.0 / PI * sinf(PI * x);
    }
    w
}

/// Generates a Nuttall window of length `len` using pre-defined cosine
/// coefficients. Zero or single-length inputs are treated specially to
/// avoid divisions by zero.
pub fn nuttall(len: usize) -> Vec<f32> {
    if len == 0 {
        return Vec::new();
    }
    if len == 1 {
        return vec![1.0];
    }
    let mut w = vec![0.0; len];
    for (n, w_n) in w.iter_mut().enumerate() {
        let x = 2.0 * PI * n as f32 / (len as f32 - 1.0);
        *w_n = NUTTALL_A0 - NUTTALL_A1 * cosf(x) + NUTTALL_A2 * cosf(2.0 * x)
            - NUTTALL_A3 * cosf(3.0 * x);
    }
    w
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    #[test]
    fn test_windows() {
        let w1 = tukey(8, 0.5);
        let w2 = bartlett(8);
        let w3 = bohman(8);
        let w4 = nuttall(8);
        assert_eq!(w1.len(), 8);
        assert_eq!(w2.len(), 8);
        assert_eq!(w3.len(), 8);
        assert_eq!(w4.len(), 8);
    }

    #[test]
    fn test_tukey_alpha_clamp() {
        let w_neg = tukey(8, -0.5);
        let w_zero = tukey(8, 0.0);
        assert_eq!(w_neg, w_zero);
        let w_gt = tukey(8, 1.5);
        let w_one = tukey(8, 1.0);
        assert_eq!(w_gt, w_one);
    }

    #[test]
    fn test_zero_len() {
        assert!(tukey(0, 0.5).is_empty());
        assert!(bartlett(0).is_empty());
        assert!(bohman(0).is_empty());
        assert!(nuttall(0).is_empty());
    }

    #[test]
    fn test_single_len() {
        assert_eq!(tukey(1, 0.5), vec![1.0]);
        assert_eq!(bartlett(1), vec![1.0]);
        assert_eq!(bohman(1), vec![1.0]);
        assert_eq!(nuttall(1), vec![1.0]);
    }
}
