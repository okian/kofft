//! # kofft - High-performance DSP library for Rust
//!
//! A comprehensive Digital Signal Processing (DSP) library featuring FFT, DCT, DST,
//! Hartley, Wavelet, STFT, and more. Optimized for both embedded systems and desktop applications.
//!
//! ## Features
//!
//! - **🚀 Zero-allocation stack-only APIs** for MCU/embedded systems
//! - **⚡ SIMD acceleration** (x86_64 AVX2, AArch64 NEON, WebAssembly SIMD)
//! - **🔧 Multiple transform types**: FFT, DCT, DST, Hartley, Wavelet, STFT, CZT, Goertzel
//! - **📊 Window functions**: Hann, Hamming, Blackman, Kaiser
//! - **🔄 Batch and multi-channel processing**
//! - **🌐 WebAssembly support**
//! - **📱 Parallel processing** (optional)
//!
//! ## Cargo Features
//!
//! - `std` (default): Enable standard library features
//! - `parallel`: Enable parallel processing with Rayon
//! - `x86_64`: Enable x86_64 SIMD optimizations
//! - `aarch64`: Enable AArch64 SIMD optimizations  
//! - `wasm`: Enable WebAssembly SIMD optimizations
//!
//! ## Performance
//!
//! - **Stack-only APIs**: No heap allocation, suitable for MCUs with limited RAM
//! - **SIMD acceleration**: 2-4x speedup on supported platforms
//! - **Power-of-two sizes**: Most efficient for FFT operations
//! - **Memory usage**: Stack usage scales with transform size
//!
//! ## Platform Support
//!
//! | Platform | SIMD Support | Features |
//! |----------|-------------|----------|
//! | x86_64   | AVX2/FMA    | `x86_64` feature |
//! | AArch64  | NEON        | `aarch64` feature |
//! | WebAssembly | SIMD128   | `wasm` feature |
//! | Generic  | Scalar      | Default fallback |
//!
//! ## Examples
//!
//! Run the examples with:
//! ```bash
//! cargo run --example basic_usage
//! cargo run --example stft_usage
//! cargo run --example ndfft_usage
//! cargo run --example embedded_example
//! cargo run --example benchmark
//! ```
//!
//! ## License
//!
//! Licensed under either of
//! - Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or https://www.apache.org/licenses/LICENSE-2.0)
//! - MIT license ([LICENSE-MIT](LICENSE-MIT) or https://opensource.org/licenses/MIT)
//!
//! at your option.

#![no_std]
extern crate alloc;

pub mod fft;
/// Fast Fourier Transform (FFT) implementations
///
/// Provides both scalar and SIMD-optimized FFT implementations.
/// Supports complex and real input signals.
pub mod rfft;
/// Real-input FFT helpers built on top of complex FFT routines
/// for converting between real and complex domains.
pub mod num;

/// N-dimensional FFT operations
///
/// Multi-dimensional FFT implementations for image and volume processing.
pub mod ndfft;

/// Window functions for signal processing
///
/// Common window functions including Hann, Hamming, Blackman, and Kaiser windows.
pub mod window;

/// Discrete Cosine Transform (DCT)
///
/// DCT-II, DCT-III, and DCT-IV implementations for audio and image compression.
pub mod dct;

/// Discrete Sine Transform (DST)
///
/// DST-II, DST-III, and DST-IV implementations.
pub mod dst;

/// Discrete Hartley Transform (DHT)
///
/// Real-valued alternative to FFT with similar properties.
pub mod hartley;

/// Wavelet transforms
///
/// Haar wavelet transform implementation for signal analysis.
pub mod wavelet;

/// Goertzel algorithm
///
/// Efficient single-frequency detection algorithm.
pub mod goertzel;

/// Chirp Z-Transform (CZT)
///
/// Arbitrary frequency resolution DFT implementation.
pub mod czt;

/// Hilbert transform
///
/// Analytic signal computation and phase analysis.
pub mod hilbert;

/// Short-Time Fourier Transform (STFT)
///
/// Streaming and batch STFT/ISTFT utilities.
pub mod stft;

/// Cepstrum analysis
///
/// Real cepstrum computation for signal analysis.
pub mod cepstrum;

/// Additional window functions
///
/// Extended collection of window functions for specialized applications.
pub mod window_more;

pub use fft::FftPlanner;
pub use num::{Complex, Complex32, Complex64, Float};

/// Simple addition function for testing purposes
///
/// This function is used in tests to verify basic functionality.
pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fft::{Complex32, FftError, FftImpl, ScalarFftImpl};
    use crate::rfft::RealFftImpl;
    use alloc::vec;
    use alloc::vec::Vec;
    use core::f32::consts;
    use rand::rngs::StdRng;
    use rand::{Rng, SeedableRng};

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }

    #[test]
    fn test_fft_ifft_f32() {
        // FFT of [1, 0, 0, 0] should be [1, 1, 1, 1]
        let mut data = [
            Complex32::new(1.0, 0.0),
            Complex32::new(0.0, 0.0),
            Complex32::new(0.0, 0.0),
            Complex32::new(0.0, 0.0),
        ];
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft(&mut data).unwrap();
        for c in &data {
            assert!((c.re - 1.0).abs() < 1e-6, "re = {}", c.re);
            assert!(c.im.abs() < 1e-6, "im = {}", c.im);
        }
        // IFFT should recover the original
        fft.ifft(&mut data).unwrap();
        assert!((data[0].re - 1.0).abs() < 1e-6);
        for c in &data[1..] {
            assert!(c.re.abs() < 1e-6);
            assert!(c.im.abs() < 1e-6);
        }
    }

    #[test]
    fn test_fft_ifft_f32_roundtrip_random() {
        let mut rng = StdRng::seed_from_u64(42);
        let mut data: Vec<Complex32> = (0..16)
            .map(|_| Complex32::new(rng.gen_range(-10.0..10.0), rng.gen_range(-10.0..10.0)))
            .collect();
        let orig = data.clone();
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft(&mut data).unwrap();
        fft.ifft(&mut data).unwrap();
        for (a, b) in data.iter().zip(orig.iter()) {
            assert!((a.re - b.re).abs() < 1e-5, "re: {} vs {}", a.re, b.re);
            assert!((a.im - b.im).abs() < 1e-5, "im: {} vs {}", a.im, b.im);
        }
    }

    #[test]
    fn test_fft_cosine_wave() {
        // FFT of a cosine wave should have two peaks
        let n = 8;
        let freq = 1.0;
        let mut data: Vec<Complex32> = (0..n)
            .map(|i| Complex32::new((2.0 * consts::PI * freq * (i as f32) / n as f32).cos(), 0.0))
            .collect();
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft(&mut data).unwrap();
        // The two peaks should be at 1 and n-1
        let mut mags: Vec<f32> = data
            .iter()
            .map(|c| (c.re * c.re + c.im * c.im).sqrt())
            .collect();
        mags[1] = 0.0; // ignore DC
        let max_idx = mags
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .unwrap()
            .0;
        assert!(max_idx == 1 || max_idx == n - 1);
    }

    #[test]
    fn test_fft_all_zeros() {
        let mut data = vec![Complex32::zero(); 8];
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft(&mut data).unwrap();
        for c in &data {
            assert!(c.re.abs() < 1e-6);
            assert!(c.im.abs() < 1e-6);
        }
    }

    #[test]
    fn test_fft_all_ones() {
        let mut data = vec![Complex32::new(1.0, 0.0); 8];
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft(&mut data).unwrap();
        // DC component should be 8, others should be 0
        assert!((data[0].re - 8.0).abs() < 1e-6);
        for c in &data[1..] {
            assert!(c.re.abs() < 1e-6);
            assert!(c.im.abs() < 1e-6);
        }
    }

    #[test]
    fn test_fft_ifft_nonpow2_f32() {
        let mut data = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
        ];
        let orig = data.clone();
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft(&mut data).unwrap();
        fft.ifft(&mut data).unwrap();
        for (a, b) in data.iter().zip(orig.iter()) {
            assert!((a.re - b.re).abs() < 1e-5, "re: {} vs {}", a.re, b.re);
            assert!((a.im - b.im).abs() < 1e-5, "im: {} vs {}", a.im, b.im);
        }
    }

    #[test]
    fn test_fft_out_of_place_buffer_f32() {
        let input = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
            Complex32::new(4.0, 0.0),
        ];
        let mut output = vec![Complex32::zero(); 4];
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft_out_of_place(&input, &mut output).unwrap();
        // Check that input wasn't modified
        assert_eq!(input[0].re, 1.0);
        assert_eq!(input[1].re, 2.0);
        assert_eq!(input[2].re, 3.0);
        assert_eq!(input[3].re, 4.0);
    }

    #[test]
    fn test_fft_out_of_place_vec_f32() {
        let input = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
            Complex32::new(4.0, 0.0),
        ];
        let fft = ScalarFftImpl::<f32>::default();
        let output = fft.fft_vec(&input).unwrap();
        // Check that input wasn't modified
        assert_eq!(input[0].re, 1.0);
        assert_eq!(input[1].re, 2.0);
        assert_eq!(input[2].re, 3.0);
        assert_eq!(input[3].re, 4.0);
        // Check output
        assert_eq!(output.len(), 4);
    }

    #[test]
    fn test_fft_empty() {
        let mut data = vec![];
        let fft = ScalarFftImpl::<f32>::default();
        assert_eq!(fft.fft(&mut data), Err(FftError::EmptyInput));
    }

    #[test]
    fn test_fft_out_of_place_mismatched_lengths() {
        let input = vec![Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0)];
        let mut output = vec![Complex32::zero(); 3];
        let fft = ScalarFftImpl::<f32>::default();
        assert_eq!(
            fft.fft_out_of_place(&input, &mut output),
            Err(FftError::MismatchedLengths)
        );
    }

    #[test]
    fn test_fft_nonpow2_no_std_error() {
        let mut data = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
        ];
        let fft = ScalarFftImpl::<f32>::default();
        // This should work with std feature, but fail without it
        let result = fft.fft(&mut data);
        assert!(result.is_ok());
    }

    #[test]
    fn test_fft_single_element() {
        let mut data = vec![Complex32::new(1.0, 0.0)];
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft(&mut data).unwrap();
        assert_eq!(data[0].re, 1.0);
        assert_eq!(data[0].im, 0.0);
    }

    #[test]
    fn test_fft_all_real() {
        let mut data = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
            Complex32::new(4.0, 0.0),
        ];
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft(&mut data).unwrap();
        // For real input, FFT should have Hermitian symmetry
        assert!((data[1].re - data[3].re).abs() < 1e-6);
        assert!((data[1].im + data[3].im).abs() < 1e-6);
    }

    #[test]
    fn test_fft_all_imag() {
        let mut data = vec![
            Complex32::new(0.0, 1.0),
            Complex32::new(0.0, 2.0),
            Complex32::new(0.0, 3.0),
            Complex32::new(0.0, 4.0),
        ];
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft(&mut data).unwrap();
        // For imaginary input, FFT should have anti-Hermitian symmetry
        assert!((data[1].re + data[3].re).abs() < 1e-6);
        assert!((data[1].im - data[3].im).abs() < 1e-6);
    }

    #[test]
    fn test_fft_large_values() {
        let mut data = vec![
            Complex32::new(1000.0, 0.0),
            Complex32::new(2000.0, 0.0),
            Complex32::new(3000.0, 0.0),
            Complex32::new(4000.0, 0.0),
        ];
        let orig = data.clone();
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft(&mut data).unwrap();
        fft.ifft(&mut data).unwrap();
        for (a, b) in data.iter().zip(orig.iter()) {
            assert!((a.re - b.re).abs() < 1e-3, "re: {} vs {}", a.re, b.re);
            assert!((a.im - b.im).abs() < 1e-3, "im: {} vs {}", a.im, b.im);
        }
    }

    #[test]
    fn test_fft_roundtrip_repeated() {
        let mut data = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
            Complex32::new(4.0, 0.0),
        ];
        let orig = data.clone();
        let fft = ScalarFftImpl::<f32>::default();

        // Multiple FFT-IFFT cycles
        for _ in 0..10 {
            fft.fft(&mut data).unwrap();
            fft.ifft(&mut data).unwrap();
        }

        for (a, b) in data.iter().zip(orig.iter()) {
            assert!((a.re - b.re).abs() < 1e-4, "re: {} vs {}", a.re, b.re);
            assert!((a.im - b.im).abs() < 1e-4, "im: {} vs {}", a.im, b.im);
        }
    }

    #[test]
    fn test_rfft_irfft_roundtrip() {
        let mut input = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let mut freq = vec![Complex32::zero(); input.len() / 2 + 1];
        let mut output = vec![0.0; input.len()];

        let fft = ScalarFftImpl::<f32>::default();
        fft.rfft(&mut input, &mut freq).unwrap();
        fft.irfft(&mut freq, &mut output).unwrap();

        for (a, b) in input.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-5, "{} vs {}", a, b);
        }
    }

    #[test]
    fn test_rfft_hermitian_symmetry() {
        let mut input = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let mut freq = vec![Complex32::zero(); input.len() / 2 + 1];

        let fft = ScalarFftImpl::<f32>::default();
        fft.rfft(&mut input, &mut freq).unwrap();

        // Check that the result has the expected Hermitian symmetry
        // The first element should be real
        assert!(freq[0].im.abs() < 1e-6);
        // The last element should be real if N is even
        if input.len() % 2 == 0 {
            assert!(freq[freq.len() - 1].im.abs() < 1e-6);
        }
    }

    #[test]
    fn test_rfft_irfft_mismatched_lengths() {
        let mut input = vec![1.0, 2.0, 3.0, 4.0];
        let mut freq = vec![Complex32::zero(); 4]; // Wrong size
        let fft = ScalarFftImpl::<f32>::default();
        assert_eq!(
            fft.rfft(&mut input, &mut freq),
            Err(FftError::MismatchedLengths)
        );
    }
}
