//! Common window functions for STFT and DSP

use core::f32::consts::PI;

use libm::sqrtf;

fn bessel0(x: f32) -> f32 {
    // Approximate I0(x) using a series expansion
    let mut sum = 1.0;
    let y = x * x / 4.0;
    let mut t = y;
    let mut k = 1.0;
    for n in 1..20 {
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
#[cfg(feature = "std")]
pub fn kaiser(len: usize, beta: f32) -> alloc::vec::Vec<f32> {
    let denom = bessel0(beta);
    let m = (len - 1) as f32 / 2.0;
    (0..len)
        .map(|i| {
            let r = (i as f32 - m) / m;
            bessel0(beta * sqrtf(1.0 - r * r)) / denom
        })
        .collect()
}

#[cfg(not(feature = "std"))]
pub fn kaiser(len: usize, beta: f32) -> alloc::vec::Vec<f32> {
    let denom = bessel0(beta);
    let m = (len - 1) as f32 / 2.0;
    (0..len)
        .map(|i| {
            let r = (i as f32 - m) / m;
            bessel0(beta * sqrtf(1.0 - r * r)) / denom
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
