//! Chirp Z-Transform (CZT) module
//! Arbitrary frequency resolution DFT
//! no_std + alloc compatible

extern crate alloc;
use alloc::vec::Vec;
use alloc::vec;

// no additional libm functions needed

/// Compute the CZT of a real signal at M output bins
/// - `input`: real-valued signal
/// - `m`: number of output bins
/// - `w`: complex ratio between bins (e.g., exp(-j*2pi/M))
/// - `a`: complex starting point (e.g., 1.0)
pub fn czt_f32(input: &[f32], m: usize, w: (f32, f32), a: (f32, f32)) -> Vec<(f32, f32)> {
    let (wr, wi) = w;
    let (ar, ai) = a;
    let denom = ar * ar + ai * ai;
    let a_inv_r = if denom == 0.0 { 0.0 } else { ar / denom };
    let a_inv_i = if denom == 0.0 { 0.0 } else { -ai / denom };
    let mut output = vec![(0.0, 0.0); m];
    for k in 0..m {
        // compute w^k
        let mut w_k_r = 1.0;
        let mut w_k_i = 0.0;
        for _ in 0..k {
            let tr = w_k_r * wr - w_k_i * wi;
            let ti = w_k_r * wi + w_k_i * wr;
            w_k_r = tr;
            w_k_i = ti;
        }
        let mut wnk_r = 1.0;
        let mut wnk_i = 0.0;
        let mut a_pow_r = 1.0;
        let mut a_pow_i = 0.0;
        for &x in input {
            let tr = a_pow_r * wnk_r - a_pow_i * wnk_i;
            let ti = a_pow_r * wnk_i + a_pow_i * wnk_r;
            output[k].0 += x * tr;
            output[k].1 += x * ti;
            // update powers
            let wtr = wnk_r * w_k_r - wnk_i * w_k_i;
            let wti = wnk_r * w_k_i + wnk_i * w_k_r;
            wnk_r = wtr;
            wnk_i = wti;
            let atr = a_pow_r * a_inv_r - a_pow_i * a_inv_i;
            let ati = a_pow_r * a_inv_i + a_pow_i * a_inv_r;
            a_pow_r = atr;
            a_pow_i = ati;
        }
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

    #[test]
    fn test_czt_non_unit_params() {
        let x = [0.0, 1.0];
        let w = (0.0, 1.0); // j
        let a = (0.5, 0.0);
        let y = czt_f32(&x, 2, w, a);
        assert!((y[0].0 - 2.0).abs() < 1e-5 && y[0].1.abs() < 1e-5);
        assert!((y[1].0).abs() < 1e-5 && (y[1].1 - 2.0).abs() < 1e-5);
    }
}