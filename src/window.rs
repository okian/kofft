//! Common window functions for STFT and DSP

use core::f32::consts::PI;

#[cfg(not(feature = "std"))]
use libm::sqrtf;

/// Number of terms used in the truncated series for `bessel0`.
const BESSEL0_TERMS: usize = 20;

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

/// Generate a Hann window of length `len`.
pub fn hann(len: usize) -> alloc::vec::Vec<f32> {
    (0..len)
        .map(|i| 0.5 - 0.5 * (2.0 * PI * i as f32 / len as f32).cos())
        .collect()
}

/// Generate a Hamming window of length `len`.
pub fn hamming(len: usize) -> alloc::vec::Vec<f32> {
    (0..len)
        .map(|i| 0.54 - 0.46 * (2.0 * PI * i as f32 / len as f32).cos())
        .collect()
}

/// Generate a Blackman window of length `len`.
pub fn blackman(len: usize) -> alloc::vec::Vec<f32> {
    (0..len)
        .map(|i| {
            let a0 = 0.42;
            let a1 = 0.5;
            let a2 = 0.08;
            let x = i as f32 / len as f32;
            a0 - a1 * (2.0 * PI * x).cos() + a2 * (4.0 * PI * x).cos()
        })
        .collect()
}

/// Generate a Kaiser window of length `len` and shape parameter `beta`.
///
/// # Panics
/// Panics if `len` is zero.
pub fn kaiser(len: usize, beta: f32) -> alloc::vec::Vec<f32> {
    assert!(len > 0, "len must be greater than zero");
    if len == 1 {
        return alloc::vec![1.0];
    }

    let denom = bessel0(beta);
    let m = (len - 1) as f32 / 2.0;
    (0..len)
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
        .collect()
}

/// MCU/stack-only, const-generic, in-place Hann window (no heap)
pub fn hann_inplace_stack<const N: usize>(out: &mut [f32; N]) {
    for (i, x) in out.iter_mut().enumerate() {
        *x = 0.5 - 0.5 * (2.0 * PI * i as f32 / N as f32).cos();
    }
}

/// MCU/stack-only, const-generic, in-place Hamming window (no heap)
pub fn hamming_inplace_stack<const N: usize>(out: &mut [f32; N]) {
    for (i, x) in out.iter_mut().enumerate() {
        *x = 0.54 - 0.46 * (2.0 * PI * i as f32 / N as f32).cos();
    }
}

/// MCU/stack-only, const-generic, in-place Blackman window (no heap)
pub fn blackman_inplace_stack<const N: usize>(out: &mut [f32; N]) {
    let a0 = 0.42;
    let a1 = 0.5;
    let a2 = 0.08;
    for (i, out_val) in out.iter_mut().enumerate() {
        let x = i as f32 / N as f32;
        *out_val = a0 - a1 * (2.0 * PI * x).cos() + a2 * (4.0 * PI * x).cos();
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    #[test]
    fn test_hann() {
        let w = hann(8);
        assert_eq!(w.len(), 8);
        assert!((w[0] - 0.0).abs() < 1e-6);
        assert!((w[4] - 1.0).abs() < 1e-6);
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
        assert!(w.iter().all(|&x| (-1e-6..=1.0).contains(&x)));
    }
    #[test]
    fn test_kaiser() {
        let w = kaiser(9, 5.0);
        assert_eq!(w.len(), 9);
        // Peak amplitude at center
        assert!((w[4] - 1.0).abs() < 1e-6);
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
        assert!((hann_buf[0] - 0.0).abs() < 1e-6);

        let mut hamming_buf = [0.0f32; 8];
        hamming_inplace_stack(&mut hamming_buf);
        assert!(hamming_buf.iter().all(|&x| (0.0..=1.0).contains(&x)));

        let mut blackman_buf = [0.0f32; 8];
        blackman_inplace_stack(&mut blackman_buf);
        assert!(blackman_buf.iter().all(|&x| (-1e-6..=1.0).contains(&x)));
    }
}
