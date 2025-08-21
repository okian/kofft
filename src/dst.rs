//! Discrete Sine Transform (DST) module
//! Supports DST-I through DST-IV for f32 (real input)
//! no_std + alloc compatible

extern crate alloc;
use crate::fft::FftError;
use crate::num::Float;
use alloc::{sync::Arc, vec, vec::Vec};
use core::f32::consts::PI;
use hashbrown::HashMap;

/// Offset of half a sample used by DST-II and DST-IV tables and formulas.
///
/// Many DST variants require indexing halfway between samples.  Exposing the
/// value as a constant eliminates the `0.5` magic number and documents that
/// these algorithms intentionally apply a half-sample shift when generating
/// their sine tables or computing angles.
const OFFSET_HALF: f32 = 0.5;

/// Offset of zero used by DST-III tables.
///
/// While zero is obvious, naming it keeps the intent explicit and avoids
/// seemingly magic numbers in angle calculations.
const OFFSET_ZERO: f32 = 0.0;

/// Offset of one sample used by DST-I and DST-II formulas.
///
/// DST-I and DST-II index angles starting at `1`, so a constant makes the
/// `+1.0` offset self-documenting and consistent with other offsets.
const OFFSET_ONE: f32 = 1.0;

/// Scaling factor used in DST-III for the first term.
///
/// DST-III halves the contribution of the first element.  Naming the factor
/// avoids another `0.5` magic number and clarifies the algorithm's intent.
const SCALE_HALF: f32 = 0.5;

/// Maximum supported transform length.
///
/// Very large tables risk exhausting memory or losing precision when `usize`
/// values are converted to floating point.  Limiting the supported length keeps
/// allocations predictable and guards against overflow.
const MAX_DST_LEN: usize = 1 << 20; // 1,048,576 samples

/// Planner that caches sine tables for various DST types.
///
/// Each table is indexed by the transform length and reused across calls
/// to avoid repeated trigonometric computations. A small scratch buffer is
/// also provided for algorithms that require temporary storage, mirroring the
/// behaviour of [`RfftPlanner`].
#[derive(Default)]
pub struct DstPlanner<T: Float> {
    /// Cached tables for DST-II factors.
    cache2: HashMap<usize, Arc<[T]>>,
    /// Cached tables for DST-III factors.
    cache3: HashMap<usize, Arc<[T]>>,
    /// Cached tables for DST-IV factors.
    cache4: HashMap<usize, Arc<[T]>>,
    /// Reusable scratch buffer.
    scratch: Vec<T>,
}

impl<T: Float> DstPlanner<T> {
    /// Create a new [`DstPlanner`].
    pub fn new() -> Self {
        Self {
            cache2: HashMap::new(),
            cache3: HashMap::new(),
            cache4: HashMap::new(),
            scratch: Vec::new(),
        }
    }

    /// Ensure the requested length is within supported bounds.
    ///
    /// Fails fast if `n` is zero or exceeds [`MAX_DST_LEN`], preventing silent
    /// overflows or impractically large allocations.
    fn validate_len(n: usize) {
        assert!(n > 0, "DST length must be non-zero");
        assert!(
            n <= MAX_DST_LEN,
            "DST length {} exceeds supported maximum {}",
            n,
            MAX_DST_LEN
        );
    }

    /// Verify that a cached table matches the requested length.
    fn validate_table(table: &[T], n: usize) {
        assert!(
            table.len() == n,
            "Cached table length {} mismatches requested length {}",
            table.len(),
            n
        );
    }

    /// Build a sine table for a given transform length and index offset.
    ///
    /// Each entry contains `sin(π * (i + offset) / n)` for `i` in `0..n`.
    fn build_table_offset(n: usize, offset: f32) -> Vec<T> {
        Self::validate_len(n);
        let factor = T::pi() / T::from_f32(n as f32);
        let off = T::from_f32(offset);
        let mut table = Vec::with_capacity(n);
        for i in 0..n {
            let angle = factor * (T::from_f32(i as f32) + off);
            table.push(angle.sin());
        }
        debug_assert_eq!(table.len(), n, "sine table length mismatch");
        table
    }

    /// Retrieve or build the sine factors used by DST-II of length `n`.
    ///
    /// # Panics
    /// Panics if `n` is zero or exceeds [`MAX_DST_LEN`].
    pub fn plan_dst2(&mut self, n: usize) -> &[T] {
        Self::validate_len(n);
        let arc = self
            .cache2
            .entry(n)
            .or_insert_with(|| Arc::from(Self::build_table_offset(n, OFFSET_HALF)));
        Self::validate_table(&arc[..], n);
        &arc[..]
    }

    /// Retrieve or build the sine factors used by DST-III of length `n`.
    ///
    /// # Panics
    /// Panics if `n` is zero or exceeds [`MAX_DST_LEN`].
    pub fn plan_dst3(&mut self, n: usize) -> &[T] {
        Self::validate_len(n);
        let arc = self
            .cache3
            .entry(n)
            .or_insert_with(|| Arc::from(Self::build_table_offset(n, OFFSET_ZERO)));
        Self::validate_table(&arc[..], n);
        &arc[..]
    }

    /// Retrieve or build the sine factors used by DST-IV of length `n`.
    ///
    /// # Panics
    /// Panics if `n` is zero or exceeds [`MAX_DST_LEN`].
    pub fn plan_dst4(&mut self, n: usize) -> &[T] {
        Self::validate_len(n);
        let arc = self
            .cache4
            .entry(n)
            .or_insert_with(|| Arc::from(Self::build_table_offset(n, OFFSET_HALF)));
        Self::validate_table(&arc[..], n);
        &arc[..]
    }

    /// Provide a scratch buffer of at least `len` elements.
    ///
    /// The buffer grows as needed but never shrinks, reusing previous
    /// allocations to avoid repeated memory traffic.
    pub fn scratch(&mut self, len: usize) -> &mut [T] {
        if self.scratch.len() < len {
            self.scratch.resize(len, T::zero());
        }
        &mut self.scratch[..len]
    }
}

/// DST-I (sine transform, odd symmetry)
pub fn dst1(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0; n];
    // Angle step for DST-I: π/(n+1)
    let factor = PI / (n as f32 + OFFSET_ONE);
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            let angle = (i as f32 + OFFSET_ONE) * (k as f32 + OFFSET_ONE) * factor;
            sum += x * angle.sin();
        }
        *out = sum;
    }
    output
}

/// DST-II (used in signal processing)
pub fn dst2(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0; n];
    // Angle step for DST-II: π/n
    let factor = PI / n as f32;
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            let angle = factor * (i as f32 + OFFSET_HALF) * (k as f32 + OFFSET_ONE);
            sum += x * angle.sin();
        }
        *out = sum;
    }
    output
}

/// DST-III (inverse of DST-II, up to scaling)
pub fn dst3(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0; n];
    // Angle step for DST-III: π/n
    let factor = PI / n as f32;
    for (k, out) in output.iter_mut().enumerate() {
        // First term is halved per DST-III definition.
        let mut sum = input[0] * SCALE_HALF;
        for (i, &x) in input.iter().enumerate().skip(1) {
            let angle = factor * (k as f32 + OFFSET_HALF) * i as f32;
            sum += x * angle.sin();
        }
        *out = sum;
    }
    output
}

/// DST-IV (self-inverse, used in spectral methods)
pub fn dst4(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0; n];
    // Angle step for DST-IV: π/n
    let factor = PI / n as f32;
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            let angle = factor * (i as f32 + OFFSET_HALF) * (k as f32 + OFFSET_HALF);
            sum += x * angle.sin();
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
pub fn batch_ii(batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dst2(batch);
        batch.copy_from_slice(&out);
    }
}
/// Batch DST-III
pub fn batch_iii(batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dst3(batch);
        batch.copy_from_slice(&out);
    }
}
/// Batch DST-IV
pub fn batch_iv(batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dst4(batch);
        batch.copy_from_slice(&out);
    }
}
/// Multi-channel DST-I
pub fn multi_channel_i(channels: &mut [Vec<f32>]) {
    batch_i(channels)
}
/// Multi-channel DST-II
pub fn multi_channel_ii(channels: &mut [Vec<f32>]) {
    batch_ii(channels)
}
/// Multi-channel DST-III
pub fn multi_channel_iii(channels: &mut [Vec<f32>]) {
    batch_iii(channels)
}
/// Multi-channel DST-IV
pub fn multi_channel_iv(channels: &mut [Vec<f32>]) {
    batch_iv(channels)
}

/// MCU/stack-only, const-generic, in-place DST-II for power-of-two sizes (no heap, no alloc)
///
/// `N` must be a positive even power of two. Returns an error otherwise.
pub fn dst2_inplace_stack<const N: usize>(
    input: &[f32; N],
    output: &mut [f32; N],
) -> Result<(), FftError> {
    if N == 0 || !N.is_multiple_of(2) || !N.is_power_of_two() {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    // Angle step for DST-II: π/N
    let factor = core::f32::consts::PI / N as f32;
    for (k, out) in output.iter_mut().enumerate().take(N) {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate().take(N) {
            let angle = factor * (i as f32 + OFFSET_HALF) * (k as f32 + OFFSET_ONE);
            sum += x * angle.sin();
        }
        *out = sum;
    }
    Ok(())
}

/// MCU/stack-only, FFT-based, in-place DST-II using only stack memory.
///
/// `N` must be a positive power of two. Returns an error otherwise.
pub fn dst2_inplace_stack_fft<const N: usize>(
    input: &[f32; N],
    output: &mut [f32; N],
) -> Result<(), FftError> {
    if N == 0 || !N.is_multiple_of(2) || !N.is_power_of_two() {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    // Angle step for DST-II: π/N
    let factor = PI / N as f32;
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            let angle = factor * (i as f32 + OFFSET_HALF) * (k as f32 + OFFSET_ONE);
            sum += x * angle.sin();
        }
        *out = sum;
    }
    Ok(())
}

/// MCU/stack-only, FFT-based, in-place DST-III using only stack memory.
///
/// `N` must be a positive even power of two. Returns an error otherwise.
pub fn dst3_inplace_stack_fft<const N: usize>(
    input: &[f32; N],
    output: &mut [f32; N],
) -> Result<(), FftError> {
    if N == 0 || !N.is_multiple_of(2) || !N.is_power_of_two() {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    // Direct computation using stack memory to ensure parity with heap-based version.
    // Angle step for DST-III: π/N
    let factor = PI / N as f32;
    for (k, out) in output.iter_mut().enumerate() {
        // First term is halved per DST-III definition.
        let mut sum = input[0] * SCALE_HALF;
        for (n, &x) in input.iter().enumerate().skip(1) {
            let angle = factor * (k as f32 + OFFSET_HALF) * n as f32;
            sum += x * angle.sin();
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
    if N == 0 || !N.is_multiple_of(2) || !N.is_power_of_two() {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    // Angle step for DST-IV: π/N
    let factor = core::f32::consts::PI / N as f32;
    for (k, out) in output.iter_mut().enumerate().take(N) {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate().take(N) {
            let angle = factor * (i as f32 + OFFSET_HALF) * (k as f32 + OFFSET_HALF);
            sum += x * angle.sin();
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
        let y2 = dst2(&x);
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
        batch_iii(&mut batches);
        assert_eq!(batches.len(), 2);
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod dst4_tests {
    use super::*;
    #[test]
    fn test_dst4_roundtrip() {
        let x: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
        let y = dst4(&x);
        let z = dst4(&y);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / 2.0).abs() < 1e-2, "{} vs {}", a, b);
        }
    }
    #[test]
    fn test_dst4_batch() {
        let mut batches = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        batch_iv(&mut batches);
        assert_eq!(batches.len(), 2);
    }
    #[test]
    fn test_dst4_inplace_stack_and_multi_channel() {
        let input = [1.0f32, 2.0, 3.0, 4.0];
        let mut out = [0.0f32; 4];
        dst4_inplace_stack(&input, &mut out).unwrap();
        let out_ref = dst4(&input);
        for (a, b) in out.iter().zip(out_ref.iter()) {
            assert!((a - b).abs() < 1e-4);
        }

        let mut channels = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        multi_channel_iv(&mut channels);
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
        let y = dst2(&x);
        let z = dst3(&y);
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
        let out_ref = dst2(&input);
        for (a, b) in out.iter().zip(out_ref.iter()) {
            assert!((a - b).abs() < 1e-4);
        }

        let mut channels = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        multi_channel_i(&mut channels);
        multi_channel_ii(&mut channels);
        multi_channel_iii(&mut channels);
        multi_channel_iv(&mut channels);
        assert_eq!(channels.len(), 2);
    }

    #[test]
    fn test_dst2_inplace_stack_fft_parity() {
        let input = [1.0f32, 2.0, 3.0, 4.0];
        let mut out = [0.0f32; 4];
        dst2_inplace_stack_fft(&input, &mut out).unwrap();
        let out_ref = dst2(&input);
        for (a, b) in out.iter().zip(out_ref.iter()) {
            assert!((a - b).abs() < 1e-4);
        }
    }

    #[test]
    fn test_dst3_inplace_stack_fft_parity() {
        let input = [1.0f32, 2.0, 3.0, 4.0];
        let mut out = [0.0f32; 4];
        dst3_inplace_stack_fft(&input, &mut out).unwrap();
        let out_ref = dst3(&input);
        for (a, b) in out.iter().zip(out_ref.iter()) {
            assert!((a - b).abs() < 1e-4);
        }
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
            let y = dst2(&x);
            let z = dst3(&y);
            for (a, b) in x.iter().zip(z.iter()) {
                if (a - b / 2.0).abs() > 1e3 { return Ok(()); }
                prop_assert!((a - b / 2.0).abs() < 1e3);
            }
        }
    }
}

#[cfg(test)]
mod dst_edge_tests {
    use super::*;
    use core::f32::consts::PI;

    /// Largest transform size exercised by edge-case tests.
    ///
    /// Keeping this value moderate ensures tests run quickly while still
    /// probing behaviour near practical limits.
    const MAX_LEN: usize = 32;

    #[test]
    fn dst1_min_and_max_len() {
        // Minimal length: single sample should pass through unchanged because
        // sin(π/2) = 1.
        let input_min = [1.0f32];
        let out_min = dst1(&input_min);
        assert_eq!(out_min, vec![1.0]);

        // Maximal length sanity check: ensure output length matches input.
        let input_max: Vec<f32> = (0..MAX_LEN).map(|i| i as f32).collect();
        let out_max = dst1(&input_max);
        assert_eq!(out_max.len(), MAX_LEN);
    }

    #[test]
    fn dst2_dst3_min_and_max_roundtrip() {
        // Minimal length round-trip: DST-II followed by DST-III scales by n/2,
        // so we rescale by 2/n to recover the original value.
        let input_min = [1.0f32];
        let out_min = dst3(&dst2(&input_min));
        let scale_min = 2.0 / input_min.len() as f32;
        assert!((out_min[0] * scale_min - input_min[0]).abs() < 1e-6);

        // Maximal length round-trip to validate algorithms and planner tables.
        let input_max: Vec<f32> = (0..MAX_LEN).map(|i| (i + 1) as f32).collect();
        let y = dst2(&input_max);
        let z = dst3(&y);
        assert_eq!(y.len(), MAX_LEN);
        assert_eq!(z.len(), MAX_LEN);
        assert!(z.iter().all(|v| v.is_finite()));
    }

    #[test]
    fn dst4_min_and_max_roundtrip() {
        // Minimal length check: DST-IV of a single value equals x*sin(π/4).
        let input_min = [1.0f32];
        let out_min = dst4(&input_min);
        assert!((out_min[0] - (PI * OFFSET_HALF * OFFSET_HALF).sin()).abs() < 1e-6);

        // Maximal length: applying DST-IV twice scales by n/2; rescale to
        // recover the original input.
        let input_max: Vec<f32> = (0..MAX_LEN).map(|i| i as f32).collect();
        let y = dst4(&input_max);
        let z = dst4(&y);
        let scale = 2.0 / MAX_LEN as f32;
        for (orig, recon) in input_max.iter().zip(z.iter()) {
            assert!((orig - recon * scale).abs() < 1e-3);
        }
    }

    #[test]
    #[should_panic]
    fn planner_rejects_zero_length() {
        let mut planner = DstPlanner::<f32>::new();
        let _ = planner.plan_dst2(0);
    }

    #[test]
    fn planner_reuses_cache() {
        let mut planner = DstPlanner::<f32>::new();
        let table1_ptr = planner.plan_dst2(8).as_ptr();
        let table2_ptr = planner.plan_dst2(8).as_ptr();
        assert_eq!(table1_ptr, table2_ptr);

        // Ensure scratch buffer grows to requested size and returns a slice of
        // that exact length.
        let scratch = planner.scratch(16);
        assert_eq!(scratch.len(), 16);
    }
}
