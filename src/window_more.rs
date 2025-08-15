//! More window functions: Tukey, Bartlett, Bohman, Nuttall
//! no_std + alloc compatible

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;
use core::f32::consts::PI;
use libm::{cosf, fabsf, floorf, sinf};

/// Tukey window (tapered cosine)
pub fn tukey(len: usize, alpha: f32) -> Vec<f32> {
    let alpha = alpha.clamp(0.0, 1.0);
    let mut w = vec![0.0; len];
    let edge = floorf(alpha * (len as f32 - 1.0) / 2.0) as usize;
    for (n, w_n) in w.iter_mut().enumerate() {
        *w_n = if n < edge {
            0.5 * (1.0 + (PI * (2.0 * n as f32 / (alpha * (len as f32 - 1.0)) - 1.0)).cos())
        } else if n < len - edge {
            1.0
        } else {
            0.5 * (1.0
                + (PI * (2.0 * n as f32 / (alpha * (len as f32 - 1.0)) - 2.0 / alpha + 1.0)).cos())
        };
    }
    w
}

/// Bartlett (triangular) window
pub fn bartlett(len: usize) -> Vec<f32> {
    let mut w = vec![0.0; len];
    let n = len as f32;
    for (i, w_i) in w.iter_mut().enumerate() {
        let x = (i as f32 - (n - 1.0) / 2.0) / ((n - 1.0) / 2.0);
        *w_i = 1.0 - fabsf(x);
    }
    w
}

/// Bohman window
pub fn bohman(len: usize) -> Vec<f32> {
    let mut w = vec![0.0; len];
    let n = len as f32;
    for (i, w_i) in w.iter_mut().enumerate() {
        let x = (i as f32 / (n - 1.0)) - 0.5;
        *w_i = (1.0 - fabsf(x)) * cosf(PI * x) + 1.0 / PI * sinf(PI * x);
    }
    w
}

/// Nuttall window
pub fn nuttall(len: usize) -> Vec<f32> {
    let mut w = vec![0.0; len];
    let a0 = 0.355768;
    let a1 = 0.487396;
    let a2 = 0.144232;
    let a3 = 0.012604;
    for (n, w_n) in w.iter_mut().enumerate() {
        let x = 2.0 * PI * n as f32 / (len as f32 - 1.0);
        *w_n = a0 - a1 * cosf(x) + a2 * cosf(2.0 * x) - a3 * cosf(3.0 * x);
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
}
