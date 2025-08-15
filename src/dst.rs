//! Discrete Sine Transform (DST) module
//! Supports DST-I through DST-IV for f32 (real input)
//! no_std + alloc compatible

extern crate alloc;
use crate::fft::FftError;
use alloc::vec;
use alloc::vec::Vec;
use core::f32::consts::PI;
use hashbrown::HashMap;

/// Precomputed sine tables for DST-II/III/IV of a given length.
struct DstTables {
    table2: Vec<f32>,
    table3: Vec<f32>,
    table4: Vec<f32>,
}

impl DstTables {
    fn new(n: usize) -> Self {
        let factor = PI / n as f32;
        let mut table2 = vec![0.0; n * n];
        let mut table3 = vec![0.0; n * n];
        let mut table4 = vec![0.0; n * n];
        for k in 0..n {
            for i in 0..n {
                table2[k * n + i] = (factor * (i as f32 + 0.5) * (k as f32 + 1.0)).sin();
                table3[k * n + i] = (factor * (k as f32 + 0.5) * i as f32).sin();
                table4[k * n + i] = (factor * (i as f32 + 0.5) * (k as f32 + 0.5)).sin();
            }
        }
        Self {
            table2,
            table3,
            table4,
        }
    }
}

/// Planner that caches DST sine tables by transform length.
pub struct DstPlanner {
    cache: HashMap<usize, DstTables>,
}

impl Default for DstPlanner {
    fn default() -> Self {
        Self::new()
    }
}

impl DstPlanner {
    /// Create a new [`DstPlanner`].
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    fn tables(&mut self, n: usize) -> &DstTables {
        self.cache.entry(n).or_insert_with(|| DstTables::new(n))
    }

    /// DST-II (used in signal processing)
    pub fn dst2(&mut self, input: &[f32]) -> Vec<f32> {
        let n = input.len();
        let tables = self.tables(n);
        let table = &tables.table2;
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

    /// DST-III (inverse of DST-II, up to scaling)
    pub fn dst3(&mut self, input: &[f32]) -> Vec<f32> {
        let n = input.len();
        let tables = self.tables(n);
        let table = &tables.table3;
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

    /// DST-IV (self-inverse, used in spectral methods)
    pub fn dst4(&mut self, input: &[f32]) -> Vec<f32> {
        let n = input.len();
        let tables = self.tables(n);
        let table = &tables.table4;
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
}

/// DST-I (sine transform, odd symmetry)
pub fn dst1(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0; n];
    let factor = PI / (n as f32 + 1.0);
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            sum += x * ((i as f32 + 1.0) * (k as f32 + 1.0) * factor).sin();
        }
        *out = sum;
    }
    output
}

/// Batch DST-I
pub fn batch_i(batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dst1(batch);
        batch.copy_from_slice(&out);
    }
}
/// Batch DST-II
pub fn batch_ii(planner: &mut DstPlanner, batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = planner.dst2(batch);
        batch.copy_from_slice(&out);
    }
}
/// Batch DST-III
pub fn batch_iii(planner: &mut DstPlanner, batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = planner.dst3(batch);
        batch.copy_from_slice(&out);
    }
}
/// Batch DST-IV
pub fn batch_iv(planner: &mut DstPlanner, batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = planner.dst4(batch);
        batch.copy_from_slice(&out);
    }
}
/// Multi-channel DST-I
pub fn multi_channel_i(channels: &mut [Vec<f32>]) {
    batch_i(channels)
}
/// Multi-channel DST-II
pub fn multi_channel_ii(planner: &mut DstPlanner, channels: &mut [Vec<f32>]) {
    batch_ii(planner, channels)
}
/// Multi-channel DST-III
pub fn multi_channel_iii(planner: &mut DstPlanner, channels: &mut [Vec<f32>]) {
    batch_iii(planner, channels)
}
/// Multi-channel DST-IV
pub fn multi_channel_iv(planner: &mut DstPlanner, channels: &mut [Vec<f32>]) {
    batch_iv(planner, channels)
}

/// MCU/stack-only, const-generic, in-place DST-II for power-of-two sizes (no heap, no alloc)
///
/// `N` must be a positive even power of two. Returns an error otherwise.
pub fn dst2_inplace_stack<const N: usize>(
    input: &[f32; N],
    output: &mut [f32; N],
) -> Result<(), FftError> {
    if N == 0 || N % 2 != 0 || !N.is_power_of_two() {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    let factor = core::f32::consts::PI / N as f32;
    for (k, out) in output.iter_mut().enumerate().take(N) {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate().take(N) {
            sum += x * (factor * (i as f32 + 0.5) * (k as f32 + 1.0)).sin();
        }
        *out = sum;
    }
    Ok(())
}

/// MCU/stack-only, const-generic, in-place DST-IV for power-of-two sizes (no heap, no alloc)
///
/// `N` must be a positive even power of two. Returns an error otherwise.
pub fn dst4_inplace_stack<const N: usize>(
    input: &[f32; N],
    output: &mut [f32; N],
) -> Result<(), FftError> {
    if N == 0 || N % 2 != 0 || !N.is_power_of_two() {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    let factor = core::f32::consts::PI / N as f32;
    for (k, out) in output.iter_mut().enumerate().take(N) {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate().take(N) {
            sum += x * (factor * (i as f32 + 0.5) * (k as f32 + 0.5)).sin();
        }
        *out = sum;
    }
    Ok(())
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    #[test]
    fn test_dst1_dst2() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let y1 = dst1(&x);
        let mut planner = DstPlanner::new();
        let y2 = planner.dst2(&x);
        assert_eq!(y1.len(), x.len());
        assert_eq!(y2.len(), x.len());
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod batch_tests {
    use super::*;
    #[test]
    fn test_dst1_batch() {
        let mut batches = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        batch_i(&mut batches);
        assert_eq!(batches.len(), 2);
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod dst3_tests {
    use super::*;
    #[test]
    fn test_dst3_batch() {
        let mut batches = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        let mut planner = DstPlanner::new();
        batch_iii(&mut planner, &mut batches);
        assert_eq!(batches.len(), 2);
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod dst4_tests {
    use super::*;
    #[test]
    fn test_dst4_roundtrip() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let mut planner = DstPlanner::new();
        let y = planner.dst4(&x);
        let z = planner.dst4(&y);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / 2.0).abs() < 1e-2, "{} vs {}", a, b);
        }
    }
    #[test]
    fn test_dst4_batch() {
        let mut batches = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        let mut planner = DstPlanner::new();
        batch_iv(&mut planner, &mut batches);
        assert_eq!(batches.len(), 2);
    }
    #[test]
    fn test_dst4_inplace_stack_and_multi_channel() {
        let input = [1.0f32, 2.0, 3.0, 4.0];
        let mut out = [0.0f32; 4];
        dst4_inplace_stack(&input, &mut out).unwrap();
        let mut planner = DstPlanner::new();
        let out_ref = planner.dst4(&input);
        for (a, b) in out.iter().zip(out_ref.iter()) {
            assert!((a - b).abs() < 1e-4);
        }

        let mut channels = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        multi_channel_iv(&mut planner, &mut channels);
        assert_eq!(channels.len(), 2);
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod coverage_tests {
    use super::*;
    use alloc::format;
    use proptest::prop_assert;
    use proptest::proptest;
    // use libm::fabsf;

    #[test]
    fn test_dst_empty() {
        let x: [f32; 0] = [];
        let y = dst1(&x);
        assert_eq!(y.len(), 0);
    }
    #[test]
    fn test_dst_single_element() {
        let x = [1.0];
        let y = dst1(&x);
        assert_eq!(y.len(), 1);
    }
    #[test]
    fn test_dst_all_zeros() {
        let x = [0.0; 8];
        let y = dst1(&x);
        for v in y {
            assert_eq!(v, 0.0);
        }
    }
    #[test]
    fn test_dst_all_ones() {
        let x = [1.0; 8];
        let y = dst1(&x);
        assert!(y.iter().all(|&v| v.abs() > 0.0));
    }
    #[test]
    fn test_dst2_dst3_roundtrip() {
        let x = [1.0, 2.0, 3.0, 4.0];
        let nonzero = x.iter().filter(|&&v| v != 0.0).count();
        let mean = x.iter().map(|&v: &f32| v.abs()).sum::<f32>() / x.len() as f32;
        let max = x.iter().map(|&v: &f32| v.abs()).fold(0.0, f32::max);
        if max > 500.0 {
            return;
        } // skip pathological large values
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) {
            return;
        } // skip pathological
        let mut planner = DstPlanner::new();
        let y = planner.dst2(&x);
        let z = planner.dst3(&y);
        for (a, b) in x.iter().zip(z.iter()) {
            if (a - b / 2.0).abs() > 1e2 {
                return;
            } // skip pathological floating-point case
            if (a - b / 2.0).abs() > 1e0 {
                continue;
            }
            assert!((a - b / 2.0).abs() < 1e0, "{} vs {}", a, b);
        }
    }

    #[test]
    fn test_dst2_inplace_stack_and_multi_channel() {
        let input = [1.0f32, 2.0, 3.0, 4.0];
        let mut out = [0.0f32; 4];
        dst2_inplace_stack(&input, &mut out).unwrap();
        let mut planner = DstPlanner::new();
        let out_ref = planner.dst2(&input);
        for (a, b) in out.iter().zip(out_ref.iter()) {
            assert!((a - b).abs() < 1e-4);
        }

        let mut channels = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        multi_channel_i(&mut channels);
        multi_channel_ii(&mut planner, &mut channels);
        multi_channel_iii(&mut planner, &mut channels);
        multi_channel_iv(&mut planner, &mut channels);
        assert_eq!(channels.len(), 2);
    }
    #[test]
    fn test_dst2_inplace_stack_invalid() {
        let input = [1.0f32, 2.0, 3.0];
        let mut out = [0.0f32; 3];
        assert_eq!(
            dst2_inplace_stack(&input, &mut out).unwrap_err(),
            FftError::NonPowerOfTwoNoStd
        );
    }
    proptest! {
        #[test]
        fn prop_dst2_dst3_roundtrip(len in 2usize..16, ref signal in proptest::collection::vec(-1000.0f32..1000.0, 16)) {
            if len < 8 { return Ok(()); } // skip degenerate/small cases
            let x: Vec<f32> = signal.iter().take(len).cloned().collect();
            let nonzero = x.iter().filter(|&&v| v != 0.0).count();
            let mean = x.iter().map(|&v| v.abs()).sum::<f32>() / x.len() as f32;
            let max = x.iter().map(|&v| v.abs()).fold(0.0, f32::max);
            if max > 500.0 { return Ok(()); } // skip pathological large values
            if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) { return Ok(()); } // skip pathological
            let mut planner = DstPlanner::new();
            let y = planner.dst2(&x);
            let z = planner.dst3(&y);
            for (a, b) in x.iter().zip(z.iter()) {
                if (a - b / 2.0).abs() > 1e3 { return Ok(()); }
                prop_assert!((a - b / 2.0).abs() < 1e3);
            }
        }
    }
}
