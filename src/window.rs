//! Common window functions for STFT and DSP

use core::f32::consts::PI;
use core::simd::{LaneCount, Simd, SupportedLaneCount};

use libm::sqrtf;

#[cfg(not(feature = "std"))]
use libm::{cosf, fabsf, floorf, log10f, logf, powf, sinf};

const LANES: usize = 8;

#[allow(unused_imports)]
use crate::fft::Float;

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

#[inline]
fn cos_simd<const N: usize>(x: Simd<f32, N>) -> Simd<f32, N>
where
    LaneCount<N>: SupportedLaneCount,
{
    #[cfg(feature = "std")]
    {
        use std::simd::StdFloat;
        x.cos()
    }
    #[cfg(not(feature = "std"))]
    {
        let arr = x.to_array();
        let mut out = [0.0f32; N];
        let mut i = 0;
        while i < N {
            out[i] = cosf(arr[i]);
            i += 1;
        }
        Simd::from_array(out)
    }
}

/// Generate a Hann window of length `len`.
pub fn hann(len: usize) -> alloc::vec::Vec<f32> {
    let mut out = alloc::vec![0.0f32; len];
    hann_simd(&mut out);
    out
}

fn hann_simd(out: &mut [f32]) {
    let n = out.len();
    let step = Simd::<f32, LANES>::splat(2.0 * PI / n as f32);
    let mut idx = Simd::<f32, LANES>::from_array(core::array::from_fn(|i| i as f32));
    let mut i = 0;
    while i + LANES <= n {
        let angle = step * idx;
        let cos_val = cos_simd(angle);
        let vals = Simd::<f32, LANES>::splat(0.5) - Simd::<f32, LANES>::splat(0.5) * cos_val;
        out[i..i + LANES].copy_from_slice(vals.as_array());
        i += LANES;
        idx += Simd::<f32, LANES>::splat(LANES as f32);
    }
    while i < n {
        out[i] = 0.5 - 0.5 * (2.0 * PI * i as f32 / n as f32).cos();
        i += 1;
    }
}

/// Generate a Hamming window of length `len`.
pub fn hamming(len: usize) -> alloc::vec::Vec<f32> {
    let mut out = alloc::vec![0.0f32; len];
    hamming_simd(&mut out);
    out
}

fn hamming_simd(out: &mut [f32]) {
    let n = out.len();
    let step = Simd::<f32, LANES>::splat(2.0 * PI / n as f32);
    let mut idx = Simd::<f32, LANES>::from_array(core::array::from_fn(|i| i as f32));
    let mut i = 0;
    while i + LANES <= n {
        let angle = step * idx;
        let cos_val = cos_simd(angle);
        let vals = Simd::<f32, LANES>::splat(0.54) - Simd::<f32, LANES>::splat(0.46) * cos_val;
        out[i..i + LANES].copy_from_slice(vals.as_array());
        i += LANES;
        idx += Simd::<f32, LANES>::splat(LANES as f32);
    }
    while i < n {
        out[i] = 0.54 - 0.46 * (2.0 * PI * i as f32 / n as f32).cos();
        i += 1;
    }
}

/// Generate a Blackman window of length `len`.
pub fn blackman(len: usize) -> alloc::vec::Vec<f32> {
    let mut out = alloc::vec![0.0f32; len];
    blackman_simd(&mut out);
    out
}

fn blackman_simd(out: &mut [f32]) {
    let n = out.len();
    let step = Simd::<f32, LANES>::splat(1.0 / n as f32);
    let mut idx = Simd::<f32, LANES>::from_array(core::array::from_fn(|i| i as f32));
    let mut i = 0;
    let two_pi = Simd::<f32, LANES>::splat(2.0 * PI);
    let four_pi = Simd::<f32, LANES>::splat(4.0 * PI);
    let a0 = Simd::<f32, LANES>::splat(0.42);
    let a1 = Simd::<f32, LANES>::splat(0.5);
    let a2 = Simd::<f32, LANES>::splat(0.08);
    while i + LANES <= n {
        let x = idx * step;
        let term1 = cos_simd(two_pi * x);
        let term2 = cos_simd(four_pi * x);
        let vals = a0 - a1 * term1 + a2 * term2;
        out[i..i + LANES].copy_from_slice(vals.as_array());
        i += LANES;
        idx += Simd::<f32, LANES>::splat(LANES as f32);
    }
    while i < n {
        let x = i as f32 / n as f32;
        out[i] = 0.42 - 0.5 * (2.0 * PI * x).cos() + 0.08 * (4.0 * PI * x).cos();
        i += 1;
    }
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
    hann_simd(out);
}

/// MCU/stack-only, const-generic, in-place Hamming window (no heap)
pub fn hamming_inplace_stack<const N: usize>(out: &mut [f32; N]) {
    hamming_simd(out);
}

/// MCU/stack-only, const-generic, in-place Blackman window (no heap)
pub fn blackman_inplace_stack<const N: usize>(out: &mut [f32; N]) {
    blackman_simd(out);
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
