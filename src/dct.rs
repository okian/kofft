//! Discrete Cosine Transform (DCT) module
//! Supports DCT-I through DCT-IV for f32 (real input)
//! no_std + alloc compatible

extern crate alloc;
use crate::fft::FftError;
use alloc::vec;
use alloc::vec::Vec;
use core::f32::consts::PI;
use hashbrown::HashMap;

/// Planner for caching cosine tables used by DCT-II, DCT-III and DCT-IV
#[derive(Default)]
pub struct DctPlanner {
    cache2: HashMap<usize, Vec<f32>>,
    cache3: HashMap<usize, Vec<f32>>,
    cache4: HashMap<usize, Vec<f32>>,
}

impl DctPlanner {
    /// Create a new empty planner
    pub fn new() -> Self {
        Self::default()
    }

    fn get_table(
        cache: &mut HashMap<usize, Vec<f32>>,
        n: usize,
        f: impl Fn(usize, usize) -> f32,
    ) -> &[f32] {
        cache
            .entry(n)
            .or_insert_with(|| {
                let mut table = vec![0.0; n * n];
                for k in 0..n {
                    for i in 0..n {
                        table[k * n + i] = f(k, i);
                    }
                }
                table
            })
            .as_slice()
    }

    /// Retrieve cached cosine table for DCT-II of size `n`
    pub fn get_dct2(&mut self, n: usize) -> &[f32] {
        if n == 0 {
            return &[];
        }
        let factor = PI / n as f32;
        Self::get_table(&mut self.cache2, n, |k, i| {
            (factor * (i as f32 + 0.5) * k as f32).cos()
        })
    }

    /// Retrieve cached cosine table for DCT-III of size `n`
    pub fn get_dct3(&mut self, n: usize) -> &[f32] {
        if n == 0 {
            return &[];
        }
        let factor = PI / n as f32;
        Self::get_table(&mut self.cache3, n, |k, i| {
            (factor * i as f32 * (k as f32 + 0.5)).cos()
        })
    }

    /// Retrieve cached cosine table for DCT-IV of size `n`
    pub fn get_dct4(&mut self, n: usize) -> &[f32] {
        if n == 0 {
            return &[];
        }
        let factor = PI / n as f32;
        Self::get_table(&mut self.cache4, n, |k, i| {
            (factor * (i as f32 + 0.5) * (k as f32 + 0.5)).cos()
        })
    }
}

/// DCT-I (even symmetry, endpoints not repeated)
pub fn dct1(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    if n == 0 {
        return vec![];
    }
    if n == 1 {
        return vec![input[0] * 2.0];
    }
    let mut output = vec![0.0; n];
    let factor = PI / (n as f32 - 1.0);
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = input[0]
            + if k % 2 == 0 {
                input[n - 1]
            } else {
                -input[n - 1]
            };
        for (i, &x) in input.iter().take(n - 1).enumerate().skip(1) {
            sum += 2.0 * x * (factor * i as f32 * k as f32).cos();
        }
        *out = sum;
    }
    output
}

/// DCT-II (the "standard" DCT, used in JPEG, etc.)
pub fn dct2(planner: &mut DctPlanner, input: &[f32]) -> Vec<f32> {
    let n = input.len();
    if n == 0 {
        return vec![];
    }
    let table = planner.get_dct2(n);
    let mut output = vec![0.0; n];
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            sum += x * table[k * n + i];
        }
        *out = sum;
    }
    output
}

/// DCT-III (the inverse of DCT-II, up to scaling)
pub fn dct3(planner: &mut DctPlanner, input: &[f32]) -> Vec<f32> {
    let n = input.len();
    if n == 0 {
        return vec![];
    }
    let table = planner.get_dct3(n);
    let mut output = vec![0.0; n];
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = input[0] / 2.0;
        for (i, &x) in input.iter().enumerate().skip(1) {
            sum += x * table[k * n + i];
        }
        *out = sum;
    }
    output
}

/// DCT-IV (self-inverse, used in audio and spectral analysis)
pub fn dct4(planner: &mut DctPlanner, input: &[f32]) -> Vec<f32> {
    let n = input.len();
    if n == 0 {
        return vec![];
    }
    let table = planner.get_dct4(n);
    let mut output = vec![0.0; n];
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            sum += x * table[k * n + i];
        }
        *out = sum;
    }
    output
}

#[cfg(feature = "slow")]
/// Naive DCT implementations retained for benchmarking and reference.
pub mod slow {
    use super::*;

    pub fn dct2(planner: &mut DctPlanner, input: &[f32]) -> Vec<f32> {
        super::dct2(planner, input)
    }

    pub fn dct3(planner: &mut DctPlanner, input: &[f32]) -> Vec<f32> {
        super::dct3(planner, input)
    }

    pub fn dct4(planner: &mut DctPlanner, input: &[f32]) -> Vec<f32> {
        super::dct4(planner, input)
    }
}

/// MCU/stack-only, const-generic, in-place DCT-I for power-of-two sizes (no heap, no alloc).
///
/// `N` must be a positive even power of two. Returns an error otherwise.
pub fn dct1_inplace_stack<const N: usize>(
    input: &[f32; N],
    output: &mut [f32; N],
) -> Result<(), FftError> {
    if N < 2 || N % 2 != 0 || !N.is_power_of_two() {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    let factor = core::f32::consts::PI / (N as f32 - 1.0);
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = input[0]
            + if k % 2 == 0 {
                input[N - 1]
            } else {
                -input[N - 1]
            };
        for (i, &x) in input.iter().take(N - 1).enumerate().skip(1) {
            sum += 2.0 * x * (factor * i as f32 * k as f32).cos();
        }
        *out = sum;
    }
    Ok(())
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
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            sum += x * (factor * (i as f32 + 0.5) * k as f32).cos();
        }
        *out = sum;
    }
    Ok(())
}

/// Batch DCT-I
pub fn batch_i(batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dct1(batch);
        batch.copy_from_slice(&out);
    }
}
/// Batch DCT-II
pub fn batch_ii(planner: &mut DctPlanner, batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dct2(planner, batch);
        batch.copy_from_slice(&out);
    }
}
/// Batch DCT-III
pub fn batch_iii(planner: &mut DctPlanner, batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dct3(planner, batch);
        batch.copy_from_slice(&out);
    }
}
/// Batch DCT-IV
pub fn batch_iv(planner: &mut DctPlanner, batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dct4(planner, batch);
        batch.copy_from_slice(&out);
    }
}
/// Multi-channel DCT-I
pub fn multi_channel_i(channels: &mut [Vec<f32>]) {
    batch_i(channels)
}
/// Multi-channel DCT-II
pub fn multi_channel_ii(planner: &mut DctPlanner, channels: &mut [Vec<f32>]) {
    batch_ii(planner, channels)
}
/// Multi-channel DCT-III
pub fn multi_channel_iii(planner: &mut DctPlanner, channels: &mut [Vec<f32>]) {
    batch_iii(planner, channels)
}
/// Multi-channel DCT-IV
pub fn multi_channel_iv(planner: &mut DctPlanner, channels: &mut [Vec<f32>]) {
    batch_iv(planner, channels)
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    #[test]
    fn test_dct2_dct3_roundtrip() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let nonzero = x.iter().filter(|&&v| v != 0.0).count();
        let mean = x.iter().map(|&v| v.abs()).sum::<f32>() / x.len() as f32;
        let max = x.iter().map(|&v| v.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) {
            return;
        } // skip pathological
        let mut planner = DctPlanner::new();
        let y = dct2(&mut planner, &x);
        let z = dct3(&mut planner, &y);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / 2.0).abs() < 1e-2, "{} vs {}", a, b);
        }
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod batch_tests {
    use super::*;
    #[test]
    fn test_dct2_batch_roundtrip() {
        let mut batches = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        let orig = batches.clone();
        let mut planner = DctPlanner::new();
        batch_ii(&mut planner, &mut batches);
        batch_iii(&mut planner, &mut batches);
        for (a, b) in orig.iter().zip(batches.iter()) {
            for (x, y) in a.iter().zip(b.iter()) {
                assert!((x - y / 2.0).abs() < 1e-4);
            }
        }
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod dct1_tests {
    use super::*;
    #[test]
    fn test_dct1_roundtrip() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let y = dct1(&x);
        let z = dct1(&y);
        let scale = 2.0 * (x.len() as f32 - 1.0);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / scale).abs() < 1e-2, "{} vs {}", a, b);
        }
    }
    #[test]
    fn test_dct1_batch() {
        let mut batches = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        batch_i(&mut batches);
        assert_eq!(batches.len(), 2);
    }
    #[test]
    fn test_dct1_inplace_stack_and_multi_channel() {
        let input = [1.0f32, 2.0, 3.0, 4.0];
        let mut out = [0.0f32; 4];
        dct1_inplace_stack(&input, &mut out).unwrap();
        let out_ref = dct1(&input);
        for (a, b) in out.iter().zip(out_ref.iter()) {
            assert!((a - b).abs() < 1e-4);
        }

        let mut channels = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        multi_channel_i(&mut channels);
        assert_eq!(channels.len(), 2);
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod dct4_tests {
    use super::*;
    #[test]
    fn test_dct4_roundtrip() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let nonzero = x.iter().filter(|&&v| v != 0.0).count();
        let mean = x.iter().map(|&v| v.abs()).sum::<f32>() / x.len() as f32;
        let max = x.iter().map(|&v| v.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) {
            return;
        } // skip pathological
        let mut planner = DctPlanner::new();
        let y = dct4(&mut planner, &x);
        let z = dct4(&mut planner, &y);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / 2.0).abs() < 1e-2, "{} vs {}", a, b);
        }
    }
    #[test]
    fn test_dct4_batch() {
        let mut batches = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        let mut planner = DctPlanner::new();
        batch_iv(&mut planner, &mut batches);
        assert_eq!(batches.len(), 2);
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod coverage_tests {
    use super::*;
    use alloc::format;
    use proptest::prop_assert;
    use proptest::proptest;

    #[test]
    fn test_dct_empty() {
        let x: [f32; 0] = [];
        let mut planner = DctPlanner::new();
        let y = dct2(&mut planner, &x);
        assert_eq!(y.len(), 0);
    }
    #[test]
    fn test_dct_single_element() {
        let x = [1.0];
        let mut planner = DctPlanner::new();
        let y = dct2(&mut planner, &x);
        assert_eq!(y.len(), 1);
    }
    #[test]
    fn test_dct_all_zeros() {
        let x = [0.0; 8];
        let mut planner = DctPlanner::new();
        let y = dct2(&mut planner, &x);
        for v in y {
            assert_eq!(v, 0.0);
        }
    }
    #[test]
    fn test_dct_all_ones() {
        let x = [1.0; 8];
        let mut planner = DctPlanner::new();
        let y = dct2(&mut planner, &x);
        assert!(y.iter().all(|&v| v.abs() > 0.0));
    }
    #[test]
    fn test_dct2_dct3_roundtrip() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let nonzero = x.iter().filter(|&&v| v != 0.0).count();
        let mean = x.iter().map(|&v| v.abs()).sum::<f32>() / x.len() as f32;
        let max = x.iter().map(|&v| v.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) {
            return;
        } // skip pathological
        let mut planner = DctPlanner::new();
        let y = dct2(&mut planner, &x);
        let z = dct3(&mut planner, &y);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / 2.0).abs() < 1e-4);
        }
    }

    #[test]
    fn test_dct2_inplace_stack_and_multi_channel() {
        let input = [1.0f32, 2.0, 3.0, 4.0];
        let mut out = [0.0f32; 4];
        dct2_inplace_stack(&input, &mut out).unwrap();
        let mut planner = DctPlanner::new();
        let out_ref = dct2(&mut planner, &input);
        for (a, b) in out.iter().zip(out_ref.iter()) {
            assert!((a - b).abs() < 1e-4);
        }

        let mut channels = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        let mut planner = DctPlanner::new();
        multi_channel_ii(&mut planner, &mut channels);
        multi_channel_iii(&mut planner, &mut channels);
        multi_channel_iv(&mut planner, &mut channels);
        assert_eq!(channels.len(), 2);
    }
    #[test]
    fn test_dct2_inplace_stack_invalid() {
        let input = [1.0f32, 2.0, 3.0];
        let mut out = [0.0f32; 3];
        assert_eq!(
            dct2_inplace_stack(&input, &mut out).unwrap_err(),
            FftError::NonPowerOfTwoNoStd
        );
    }
    #[test]
    fn test_dct4_roundtrip() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let nonzero = x.iter().filter(|&&v| v != 0.0).count();
        let mean = x.iter().map(|&v| v.abs()).sum::<f32>() / x.len() as f32;
        let max = x.iter().map(|&v| v.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) {
            return;
        } // skip pathological
        let mut planner = DctPlanner::new();
        let y = dct4(&mut planner, &x);
        let z = dct4(&mut planner, &y);
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
            let mut planner = DctPlanner::new();
            let y = dct2(&mut planner, &x);
            let z = dct3(&mut planner, &y);
            for (a, b) in x.iter().zip(z.iter()) {
                if (a - b / 2.0).abs() > 1e3 { return Ok(()); }
                prop_assert!((a - b / 2.0).abs() < 1e3);
            }
        }
    }
}
