//! Common window functions for STFT and DSP

use core::f32::consts::PI;

#[cfg(not(feature = "std"))]
use libm::sqrtf;

/// Number of terms used in the truncated series for `bessel0`.
const BESSEL0_TERMS: usize = 20;

/// Tolerance for floating-point comparisons when validating normalization.
const NORMALIZATION_TOLERANCE: f32 = 1e-5;

/// Coefficient \(a_0 = 0.5\) for the Hann window.
/// Derived from the canonical form `0.5 - 0.5 cos(2π n / N)` where both
/// coefficients are equal.
const HANN_A0: f32 = 0.5;

/// Coefficient \(a_1 = 1 - a_0 = 0.5\) for the Hann window.
const HANN_A1: f32 = 1.0 - HANN_A0;

/// Hamming window coefficient `α` ensuring a unity peak.
/// From the original Hamming design: `α = 0.54`.
const HAMMING_ALPHA: f32 = 0.54;

/// Complementary coefficient `β = 1 - α = 0.46` for the Hamming window.
const HAMMING_BETA: f32 = 1.0 - HAMMING_ALPHA;

/// Blackman window shape parameter `α = 0.16`.
const BLACKMAN_ALPHA: f32 = 0.16;

/// First Blackman coefficient `(1-α)/2 = 0.42`.
const BLACKMAN_A0: f32 = (1.0 - BLACKMAN_ALPHA) / 2.0;

/// Second Blackman coefficient `0.5`.
const BLACKMAN_A1: f32 = 0.5;

/// Third Blackman coefficient `α/2 = 0.08`.
const BLACKMAN_A2: f32 = BLACKMAN_ALPHA / 2.0;

/// Approximate the zeroth-order modified Bessel function of the first kind.
///
/// This uses a truncated power series expansion which is accurate for the
/// range of inputs encountered in window calculations.
fn bessel0(x: f32) -> f32 {
    let mut sum = 1.0;
    let y = x * x / 4.0;
    let mut t = y;
    let mut k = 1.0;
    for n in 1..BESSEL0_TERMS {
        k *= n as f32;
        sum += t / (k * k);
        t *= y;
    }
    sum
}

/// Debug-time validation that the maximum value of a window equals one and all
/// samples are finite. The check is skipped for empty windows to avoid spurious
/// failures.
fn debug_assert_normalized(window: &[f32]) {
    if window.is_empty() {
        return;
    }
    debug_assert!(
        window.iter().all(|v| v.is_finite()),
        "window contains non-finite values"
    );
    let max = window.iter().cloned().fold(f32::MIN, f32::max);
    debug_assert!(
        (max - 1.0).abs() < NORMALIZATION_TOLERANCE,
        "window not normalized: max {}",
        max
    );
}

/// Generate a Hann window of length `len`.
///
/// The resulting window has a peak amplitude of one.
pub fn hann(len: usize) -> alloc::vec::Vec<f32> {
    if len == 0 {
        return alloc::vec![];
    }
    if len == 1 {
        return alloc::vec![1.0];
    }
    let out: alloc::vec::Vec<f32> = (0..len)
        .map(|i| HANN_A0 - HANN_A1 * (2.0 * PI * i as f32 / len as f32).cos())
        .collect();
    debug_assert_normalized(&out);
    out
}

/// Generate a Hamming window of length `len`.
///
/// The resulting window has a peak amplitude of one.
pub fn hamming(len: usize) -> alloc::vec::Vec<f32> {
    if len == 0 {
        return alloc::vec![];
    }
    if len == 1 {
        return alloc::vec![1.0];
    }
    let out: alloc::vec::Vec<f32> = (0..len)
        .map(|i| HAMMING_ALPHA - HAMMING_BETA * (2.0 * PI * i as f32 / len as f32).cos())
        .collect();
    debug_assert_normalized(&out);
    out
}

/// Generate a Blackman window of length `len`.
///
/// The resulting window has a peak amplitude of one.
pub fn blackman(len: usize) -> alloc::vec::Vec<f32> {
    if len == 0 {
        return alloc::vec![];
    }
    if len == 1 {
        return alloc::vec![1.0];
    }
    let out: alloc::vec::Vec<f32> = (0..len)
        .map(|i| {
            let x = i as f32 / len as f32;
            BLACKMAN_A0 - BLACKMAN_A1 * (2.0 * PI * x).cos() + BLACKMAN_A2 * (4.0 * PI * x).cos()
        })
        .collect();
    debug_assert_normalized(&out);
    out
}

/// Generate a Kaiser window of length `len` and shape parameter `beta`.
///
/// The resulting window has a peak amplitude of one.
///
/// # Panics
/// Panics if `len` is zero or `beta` is negative.
pub fn kaiser(len: usize, beta: f32) -> alloc::vec::Vec<f32> {
    assert!(len > 0, "len must be greater than zero");
    assert!(beta >= 0.0, "beta must be non-negative");
    if len == 1 {
        return alloc::vec![1.0];
    }

    let denom = bessel0(beta);
    let m = (len - 1) as f32 / 2.0;
    let out: alloc::vec::Vec<f32> = (0..len)
        .map(|i| {
            let r = (i as f32 - m) / m;
            // Clamp the square-root argument to zero to avoid NaNs from
            // floating-point rounding when `r` is extremely close to ±1.
            let arg = (1.0 - r * r).max(0.0);
            #[cfg(feature = "std")]
            {
                bessel0(beta * arg.sqrt()) / denom
            }
            #[cfg(not(feature = "std"))]
            {
                bessel0(beta * sqrtf(arg)) / denom
            }
        })
        .collect();
    debug_assert_normalized(&out);
    out
}

/// MCU/stack-only, const-generic, in-place Hann window (no heap).
///
/// The buffer is filled with a unity-normalized Hann window.
pub fn hann_inplace_stack<const N: usize>(out: &mut [f32; N]) {
    if N == 0 {
        return;
    }
    if N == 1 {
        out[0] = 1.0;
        return;
    }
    for (i, x) in out.iter_mut().enumerate() {
        *x = HANN_A0 - HANN_A1 * (2.0 * PI * i as f32 / N as f32).cos();
    }
    debug_assert_normalized(out);
}

/// MCU/stack-only, const-generic, in-place Hamming window (no heap).
///
/// The buffer is filled with a unity-normalized Hamming window.
pub fn hamming_inplace_stack<const N: usize>(out: &mut [f32; N]) {
    if N == 0 {
        return;
    }
    if N == 1 {
        out[0] = 1.0;
        return;
    }
    for (i, x) in out.iter_mut().enumerate() {
        *x = HAMMING_ALPHA - HAMMING_BETA * (2.0 * PI * i as f32 / N as f32).cos();
    }
    debug_assert_normalized(out);
}

/// MCU/stack-only, const-generic, in-place Blackman window (no heap).
///
/// The buffer is filled with a unity-normalized Blackman window.
pub fn blackman_inplace_stack<const N: usize>(out: &mut [f32; N]) {
    if N == 0 {
        return;
    }
    if N == 1 {
        out[0] = 1.0;
        return;
    }
    for (i, out_val) in out.iter_mut().enumerate() {
        let x = i as f32 / N as f32;
        *out_val =
            BLACKMAN_A0 - BLACKMAN_A1 * (2.0 * PI * x).cos() + BLACKMAN_A2 * (4.0 * PI * x).cos();
    }
    debug_assert_normalized(out);
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    #[test]
    fn test_hann() {
        let w = hann(8);
        assert_eq!(w.len(), 8);
        assert!((w[0] - 0.0).abs() < NORMALIZATION_TOLERANCE);
        assert!((w[4] - 1.0).abs() < NORMALIZATION_TOLERANCE);
    }
    #[test]
    fn test_hamming() {
        let w = hamming(8);
        assert_eq!(w.len(), 8);
        assert!(w.iter().all(|&x| (0.0..=1.0).contains(&x)));
    }
    #[test]
    fn test_blackman() {
        let w = blackman(8);
        assert_eq!(w.len(), 8);
        assert!(w
            .iter()
            .all(|&x| (-NORMALIZATION_TOLERANCE..=1.0).contains(&x)));
    }
    #[test]
    fn test_kaiser() {
        let w = kaiser(9, 5.0);
        assert_eq!(w.len(), 9);
        // Peak amplitude at center
        assert!((w[4] - 1.0).abs() < NORMALIZATION_TOLERANCE);
        // Symmetry
        for (a, b) in w.iter().zip(w.iter().rev()) {
            assert!((*a - *b).abs() < 1e-6);
        }
        assert!(w.iter().all(|&x| x.is_finite()));
    }

    /// Verifies that a length-one Kaiser window is a single unity value.
    #[test]
    fn test_kaiser_len_one() {
        let w = kaiser(1, 5.0);
        assert_eq!(w, alloc::vec![1.0]);
    }

    /// Ensures the function panics when requested length is zero.
    #[test]
    #[should_panic]
    fn test_kaiser_len_zero() {
        kaiser(0, 5.0);
    }

    #[test]
    fn test_stack_windows() {
        let mut hann_buf = [0.0f32; 8];
        hann_inplace_stack(&mut hann_buf);
        assert!((hann_buf[0] - 0.0).abs() < NORMALIZATION_TOLERANCE);

        let mut hamming_buf = [0.0f32; 8];
        hamming_inplace_stack(&mut hamming_buf);
        assert!(hamming_buf.iter().all(|&x| (0.0..=1.0).contains(&x)));

        let mut blackman_buf = [0.0f32; 8];
        blackman_inplace_stack(&mut blackman_buf);
        assert!(blackman_buf
            .iter()
            .all(|&x| (-NORMALIZATION_TOLERANCE..=1.0).contains(&x)));
    }
}
