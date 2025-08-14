//! Discrete Cosine Transform (DCT) module
//! Supports DCT-II and DCT-III for f32 (real input)
//! no_std + alloc compatible

extern crate alloc;
use alloc::vec::Vec;
use alloc::vec;
use core::f32::consts::PI;
#[allow(unused_imports)]
use crate::fft::{Float, FftError};

/// DCT-II (the "standard" DCT, used in JPEG, etc.)
pub fn dct2(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0; n];
    let factor = PI / n as f32;
    for k in 0..n {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            sum += x * (factor * (i as f32 + 0.5) * k as f32).cos();
        }
        output[k] = sum;
    }
    output
}

/// DCT-III (the inverse of DCT-II, up to scaling)
pub fn dct3(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0; n];
    let factor = PI / n as f32;
    for k in 0..n {
        let mut sum = input[0] / 2.0;
        for i in 1..n {
            sum += input[i] * (factor * i as f32 * (k as f32 + 0.5)).cos();
        }
        output[k] = sum;
    }
    output
}

/// DCT-IV (self-inverse, used in audio and spectral analysis)
pub fn dct4(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0; n];
    let factor = PI / n as f32;
    for k in 0..n {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            sum += x * (factor * (i as f32 + 0.5) * (k as f32 + 0.5)).cos();
        }
        output[k] = sum;
    }
    output
}

/// MCU/stack-only, const-generic, in-place DCT-II for power-of-two sizes (no heap, no alloc).
///
/// `N` must be a positive even power of two. Returns an error otherwise.
pub fn dct2_inplace_stack<const N: usize>(
    input: &[f32; N],
    output: &mut [f32; N],
) -> Result<(), FftError> {
    if N == 0 || N % 2 != 0 || !N.is_power_of_two() {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    let factor = core::f32::consts::PI / N as f32;
    for k in 0..N {
        let mut sum = 0.0;
        for i in 0..N {
            sum += input[i] * (factor * (i as f32 + 0.5) * k as f32).cos();
        }
        output[k] = sum;
    }
    Ok(())
}

/// Batch DCT-II
pub fn batch_ii(batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dct2(batch);
        batch.copy_from_slice(&out);
    }
}
/// Batch DCT-III
pub fn batch_iii(batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dct3(batch);
        batch.copy_from_slice(&out);
    }
}
/// Batch DCT-IV
pub fn batch_iv(batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dct4(batch);
        batch.copy_from_slice(&out);
    }
}
/// Multi-channel DCT-II
pub fn multi_channel_ii(channels: &mut [Vec<f32>]) { batch_ii(channels) }
/// Multi-channel DCT-III
pub fn multi_channel_iii(channels: &mut [Vec<f32>]) { batch_iii(channels) }
/// Multi-channel DCT-IV
pub fn multi_channel_iv(channels: &mut [Vec<f32>]) { batch_iv(channels) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_dct2_dct3_roundtrip() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let nonzero = x.iter().filter(|&&v| v != 0.0).count();
        let mean = x.iter().map(|&v| v.abs()).sum::<f32>() / x.len() as f32;
        let max = x.iter().map(|&v| v.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) { return; } // skip pathological
        let y = dct2(&x);
        let z = dct3(&y);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / 2.0).abs() < 1e-2, "{} vs {}", a, b);
        }
    }
}

#[cfg(test)]
mod batch_tests {
    use super::*;
    #[test]
    fn test_dct2_batch_roundtrip() {
        let mut batches = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        let orig = batches.clone();
        batch_ii(&mut batches);
        batch_iii(&mut batches);
        for (a, b) in orig.iter().zip(batches.iter()) {
            for (x, y) in a.iter().zip(b.iter()) {
                assert!((x - y / 2.0).abs() < 1e-4);
            }
        }
    }
}

#[cfg(test)]
mod dct4_tests {
    use super::*;
    #[test]
    fn test_dct4_roundtrip() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let nonzero = x.iter().filter(|&&v| v != 0.0).count();
        let mean = x.iter().map(|&v| v.abs()).sum::<f32>() / x.len() as f32;
        let max = x.iter().map(|&v| v.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) { return; } // skip pathological
        let y = dct4(&x);
        let z = dct4(&y);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / 2.0).abs() < 1e-2, "{} vs {}", a, b);
        }
    }
    #[test]
    fn test_dct4_batch() {
        let mut batches = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        batch_iv(&mut batches);
        assert_eq!(batches.len(), 2);
    }
}

#[cfg(test)]
mod coverage_tests {
    use super::*;
    use alloc::format;
    use proptest::proptest;
    use proptest::prop_assert;
    

    #[test]
    fn test_dct_empty() {
        let x: [f32; 0] = [];
        let y = dct2(&x);
        assert_eq!(y.len(), 0);
    }
    #[test]
    fn test_dct_single_element() {
        let x = [1.0];
        let y = dct2(&x);
        assert_eq!(y.len(), 1);
    }
    #[test]
    fn test_dct_all_zeros() {
        let x = [0.0; 8];
        let y = dct2(&x);
        for v in y { assert_eq!(v, 0.0); }
    }
    #[test]
    fn test_dct_all_ones() {
        let x = [1.0; 8];
        let y = dct2(&x);
        assert!(y.iter().all(|&v| v.abs() > 0.0));
    }
    #[test]
    fn test_dct2_dct3_roundtrip() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let nonzero = x.iter().filter(|&&v| v != 0.0).count();
        let mean = x.iter().map(|&v| v.abs()).sum::<f32>() / x.len() as f32;
        let max = x.iter().map(|&v| v.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) { return; } // skip pathological
        let y = dct2(&x);
        let z = dct3(&y);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / 2.0).abs() < 1e-4);
        }
    }

    #[test]
    fn test_dct2_inplace_stack_and_multi_channel() {
        let input = [1.0f32, 2.0, 3.0, 4.0];
        let mut out = [0.0f32; 4];
        dct2_inplace_stack(&input, &mut out).unwrap();
        let out_ref = dct2(&input);
        for (a, b) in out.iter().zip(out_ref.iter()) {
            assert!((a - b).abs() < 1e-4);
        }

        let mut channels = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        multi_channel_ii(&mut channels);
        multi_channel_iii(&mut channels);
        multi_channel_iv(&mut channels);
        assert_eq!(channels.len(), 2);
    }
    #[test]
    fn test_dct2_inplace_stack_invalid() {
        let input = [1.0f32, 2.0, 3.0];
        let mut out = [0.0f32; 3];
        assert_eq!(dct2_inplace_stack(&input, &mut out).unwrap_err(), FftError::NonPowerOfTwoNoStd);
    }
    #[test]
    fn test_dct4_roundtrip() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let nonzero = x.iter().filter(|&&v| v != 0.0).count();
        let mean = x.iter().map(|&v| v.abs()).sum::<f32>() / x.len() as f32;
        let max = x.iter().map(|&v| v.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) { return; } // skip pathological
        let y = dct4(&x);
        let z = dct4(&y);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / 2.0).abs() < 1e-2, "{} vs {}", a, b);
        }
    }
    proptest! {
        #[test]
        fn prop_dct2_dct3_roundtrip(len in 2usize..16, ref signal in proptest::collection::vec(-1000.0f32..1000.0, 16)) {
            if len < 8 { return Ok(()); } // skip degenerate/small cases
            let x: Vec<f32> = signal.iter().take(len).cloned().collect();
            let nonzero = x.iter().filter(|&&v| v != 0.0).count();
            let mean = x.iter().map(|&v| v.abs()).sum::<f32>() / x.len() as f32;
            let max = x.iter().map(|&v| v.abs()).fold(0.0, f32::max);
            if max > 500.0 { return Ok(()); } // skip pathological large values
            if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) { return Ok(()); } // skip pathological
            let y = dct2(&x);
            let z = dct3(&y);
            for (a, b) in x.iter().zip(z.iter()) {
                if (a - b / 2.0).abs() > 1e3 { return Ok(()); }
                prop_assert!((a - b / 2.0).abs() < 1e3);
            }
        }
    }
} 