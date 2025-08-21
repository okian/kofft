//! More window functions: Tukey, Bartlett, Bohman, Nuttall
//! no_std + alloc compatible

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;
use core::f32::consts::PI;
use libm::{cosf, fabsf, floorf, sinf};

/// Unity value used to express amplitude normalization.
const UNITY: f32 = 1.0;
/// Fractional constant representing one half.
const HALF: f32 = 0.5;
/// Constant `2.0` used repeatedly in window equations.
const TWO: f32 = 2.0;
/// Constant `3.0` used in the Nuttall window.
const THREE: f32 = 3.0;
/// Reciprocal of π used in the Bohman window computation.
const INV_PI: f32 = 1.0 / PI;

/// Leading cosine coefficient for the Nuttall window.
const NUTTALL_A0: f32 = 0.355_768;
/// Second cosine coefficient for the Nuttall window.
const NUTTALL_A1: f32 = 0.487_396;
/// Third cosine coefficient for the Nuttall window.
const NUTTALL_A2: f32 = 0.144_232;
/// Fourth cosine coefficient for the Nuttall window.
const NUTTALL_A3: f32 = 0.012_604;

/// Generates a Tukey window of length `len` with taper factor `alpha`.
///
/// The window is amplitude-normalized so that its peak equals one.
///
/// # Panics
/// Panics if `len` is zero.
pub fn tukey(len: usize, alpha: f32) -> Vec<f32> {
    assert!(len > 0, "len must be at least 1");
    if len == 1 {
        return vec![UNITY];
    }
    let alpha = alpha.clamp(0.0, 1.0);
    let mut w = vec![0.0; len];
    // Number of samples in each cosine taper region.
    let edge = floorf(alpha * (len as f32 - UNITY) / TWO) as usize;
    for (n, w_n) in w.iter_mut().enumerate() {
        *w_n = if n < edge {
            // Rising cosine section at the beginning of the window.
            HALF * (UNITY + (PI * (TWO * n as f32 / (alpha * (len as f32 - UNITY)) - UNITY)).cos())
        } else if n < len - edge {
            UNITY
        } else {
            // Falling cosine section at the end of the window.
            HALF * (UNITY
                + (PI * (TWO * n as f32 / (alpha * (len as f32 - UNITY)) - TWO / alpha + UNITY))
                    .cos())
        };
    }
    w
}

/// Generates a Bartlett (triangular) window of length `len`.
///
/// The window is amplitude-normalized with a maximum value of one.
///
/// # Panics
/// Panics if `len` is zero.
pub fn bartlett(len: usize) -> Vec<f32> {
    assert!(len > 0, "len must be at least 1");
    if len == 1 {
        return vec![UNITY];
    }
    let mut w = vec![0.0; len];
    let n = len as f32;
    for (i, w_i) in w.iter_mut().enumerate() {
        // Normalize index to [-1, 1] range.
        let x = (i as f32 - (n - UNITY) / TWO) / ((n - UNITY) / TWO);
        *w_i = UNITY - fabsf(x);
    }
    w
}

/// Generates a Bohman window of length `len`.
///
/// The window is amplitude-normalized such that its peak equals one.
///
/// # Panics
/// Panics if `len` is zero.
pub fn bohman(len: usize) -> Vec<f32> {
    assert!(len > 0, "len must be at least 1");
    if len == 1 {
        return vec![UNITY];
    }
    let mut w = vec![0.0; len];
    let n = len as f32;
    for (i, w_i) in w.iter_mut().enumerate() {
        // Map index into [-0.5, 0.5] interval.
        let x = (i as f32 / (n - UNITY)) - HALF;
        *w_i = (UNITY - fabsf(x)) * cosf(PI * x) + INV_PI * sinf(PI * x);
    }
    w
}

/// Generates a Nuttall window of length `len` using pre-defined cosine
/// coefficients.
///
/// The window is amplitude-normalized so that its peak equals one.
///
/// # Panics
/// Panics if `len` is zero.
pub fn nuttall(len: usize) -> Vec<f32> {
    assert!(len > 0, "len must be at least 1");
    if len == 1 {
        return vec![UNITY];
    }
    let mut w = vec![0.0; len];
    for (n, w_n) in w.iter_mut().enumerate() {
        let x = TWO * PI * n as f32 / (len as f32 - UNITY);
        *w_n = NUTTALL_A0 - NUTTALL_A1 * cosf(x) + NUTTALL_A2 * cosf(TWO * x)
            - NUTTALL_A3 * cosf(THREE * x);
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
    #[should_panic]
    fn test_tukey_len_zero_panics() {
        tukey(0, 0.5);
    }

    #[test]
    #[should_panic]
    fn test_bartlett_len_zero_panics() {
        bartlett(0);
    }

    #[test]
    #[should_panic]
    fn test_bohman_len_zero_panics() {
        bohman(0);
    }

    #[test]
    #[should_panic]
    fn test_nuttall_len_zero_panics() {
        nuttall(0);
    }

    #[test]
    fn test_single_len() {
        assert_eq!(tukey(1, 0.5), vec![UNITY]);
        assert_eq!(bartlett(1), vec![UNITY]);
        assert_eq!(bohman(1), vec![UNITY]);
        assert_eq!(nuttall(1), vec![UNITY]);
    }
}
