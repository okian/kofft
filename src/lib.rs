#![no_std]
extern crate alloc;
pub mod fft;
pub mod ndfft;
pub mod window;
pub mod dct;
pub mod dst;
pub mod hartley;
pub mod wavelet;
pub mod goertzel;
pub mod czt;
pub mod hilbert;
pub mod cepstrum;
pub mod window_more;

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fft::{ScalarFftImpl, Complex32, FftImpl, FftError};
    use alloc::vec::Vec;
    use alloc::vec;
    use core::f32::consts;
    use rand::{Rng, SeedableRng};
    use rand::rngs::StdRng;

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
        let mut mags: Vec<f32> = data.iter().map(|c| (c.re * c.re + c.im * c.im).sqrt()).collect();
        mags[1] = 0.0; // ignore DC
        let max_idx = mags.iter().enumerate().max_by(|a, b| a.1.partial_cmp(b.1).unwrap()).unwrap().0;
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
        assert!((data[0].re - 8.0).abs() < 1e-6);
        for c in &data[1..] {
            assert!(c.re.abs() < 1e-6);
            assert!(c.im.abs() < 1e-6);
        }
    }

    #[test]
    fn test_fft_ifft_nonpow2_f32() {
        let sizes = [3, 5, 6, 7, 9, 10];
        let mut rng = StdRng::seed_from_u64(123);
        let fft = ScalarFftImpl::<f32>::default();
        for &n in &sizes {
            let mut data: Vec<Complex32> = (0..n)
                .map(|_| Complex32::new(rng.gen_range(-10.0..10.0), rng.gen_range(-10.0..10.0)))
                .collect();
            let orig = data.clone();
            fft.fft(&mut data).unwrap();
            fft.ifft(&mut data).unwrap();
            for (a, b) in data.iter().zip(orig.iter()) {
                assert!((a.re - b.re).abs() < 1e-4, "n={}, re: {} vs {}", n, a.re, b.re);
                assert!((a.im - b.im).abs() < 1e-4, "n={}, im: {} vs {}", n, a.im, b.im);
            }
        }
    }

    #[test]
    fn test_fft_out_of_place_buffer_f32() {
        let fft = ScalarFftImpl::<f32>::default();
        let input = [Complex32::new(1.0, 0.0), Complex32::new(0.0, 0.0), Complex32::new(0.0, 0.0), Complex32::new(0.0, 0.0)];
        let mut output = [Complex32::zero(); 4];
        fft.fft_out_of_place(&input, &mut output).unwrap();
        for c in &output {
            assert!((c.re - 1.0).abs() < 1e-6);
            assert!(c.im.abs() < 1e-6);
        }
        // IFFT round-trip
        let mut recovered = [Complex32::zero(); 4];
        fft.ifft_out_of_place(&output, &mut recovered).unwrap();
        assert!((recovered[0].re - 1.0).abs() < 1e-6);
        for c in &recovered[1..] {
            assert!(c.re.abs() < 1e-6);
            assert!(c.im.abs() < 1e-6);
        }
    }

    #[cfg(feature = "std")]
    #[test]
    fn test_fft_out_of_place_vec_f32() {
        let fft = ScalarFftImpl::<f32>::default();
        let input = vec![Complex32::new(1.0, 0.0), Complex32::new(0.0, 0.0), Complex32::new(0.0, 0.0), Complex32::new(0.0, 0.0)];
        let output = fft.fft_vec(&input).unwrap();
        for c in &output {
            assert!((c.re - 1.0).abs() < 1e-6);
            assert!(c.im.abs() < 1e-6);
        }
        let recovered = fft.ifft_vec(&output).unwrap();
        assert!((recovered[0].re - 1.0).abs() < 1e-6);
        for c in &recovered[1..] {
            assert!(c.re.abs() < 1e-6);
            assert!(c.im.abs() < 1e-6);
        }
    }

    #[test]
    fn test_fft_empty() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data: [Complex32; 0] = [];
        let res = fft.fft(&mut data);
        assert_eq!(res, Err(FftError::EmptyInput));
        let res = fft.ifft(&mut data);
        assert_eq!(res, Err(FftError::EmptyInput));
    }

    #[test]
    fn test_fft_out_of_place_mismatched_lengths() {
        let fft = ScalarFftImpl::<f32>::default();
        let input = [Complex32::new(1.0, 0.0), Complex32::new(0.0, 0.0)];
        let mut output = [Complex32::zero(); 3];
        let res = fft.fft_out_of_place(&input, &mut output);
        assert_eq!(res, Err(FftError::MismatchedLengths));
    }

    #[cfg(not(feature = "std"))]
    #[test]
    fn test_fft_nonpow2_no_std_error() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = [Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0), Complex32::new(3.0, 0.0)];
        let res = fft.fft(&mut data);
        assert_eq!(res, Err(FftError::NonPowerOfTwoNoStd));
    }

    #[test]
    fn test_fft_single_element() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = [Complex32::new(42.0, -7.0)];
        let orig = data[0];
        fft.fft(&mut data).unwrap();
        assert!((data[0].re - orig.re).abs() < 1e-6);
        assert!((data[0].im - orig.im).abs() < 1e-6);
        fft.ifft(&mut data).unwrap();
        assert!((data[0].re - orig.re).abs() < 1e-6);
        assert!((data[0].im - orig.im).abs() < 1e-6);
    }

    #[test]
    fn test_fft_all_real() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = [Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0), Complex32::new(3.0, 0.0), Complex32::new(4.0, 0.0)];
        let orig = data.clone();
        fft.fft(&mut data).unwrap();
        fft.ifft(&mut data).unwrap();
        for (a, b) in data.iter().zip(orig.iter()) {
            assert!((a.re - b.re).abs() < 1e-5);
            assert!((a.im - b.im).abs() < 1e-5);
        }
    }

    #[test]
    fn test_fft_all_imag() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = [Complex32::new(0.0, 1.0), Complex32::new(0.0, 2.0), Complex32::new(0.0, 3.0), Complex32::new(0.0, 4.0)];
        let orig = data.clone();
        fft.fft(&mut data).unwrap();
        fft.ifft(&mut data).unwrap();
        for (a, b) in data.iter().zip(orig.iter()) {
            assert!((a.re - b.re).abs() < 1e-5);
            assert!((a.im - b.im).abs() < 1e-5);
        }
    }

    #[test]
    fn test_fft_large_values() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = [Complex32::new(1e20, -1e20), Complex32::new(-1e20, 1e20), Complex32::new(1e20, 1e20), Complex32::new(-1e20, -1e20)];
        let orig = data.clone();
        fft.fft(&mut data).unwrap();
        fft.ifft(&mut data).unwrap();
        for (a, b) in data.iter().zip(orig.iter()) {
            assert!((a.re - b.re).abs() < 1e10);
            assert!((a.im - b.im).abs() < 1e10);
        }
    }

    #[test]
    fn test_fft_roundtrip_repeated() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = [Complex32::new(1.0, 2.0), Complex32::new(3.0, 4.0), Complex32::new(5.0, 6.0), Complex32::new(7.0, 8.0)];
        let orig = data.clone();
        for _ in 0..10 {
            fft.fft(&mut data).unwrap();
            fft.ifft(&mut data).unwrap();
        }
        for (a, b) in data.iter().zip(orig.iter()) {
            assert!((a.re - b.re).abs() < 1e-5);
            assert!((a.im - b.im).abs() < 1e-5);
        }
    }

    #[test]
    fn test_fft_real_input_hermitian_symmetry() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = [Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0), Complex32::new(3.0, 0.0), Complex32::new(4.0, 0.0)];
        fft.fft(&mut data).unwrap();
        // Hermitian symmetry: X[k] = conj(X[N-k])
        let n = data.len();
        for k in 1..n {
            let a = &data[k];
            let b = &data[n - k];
            assert!((a.re - b.re).abs() < 1e-5);
            assert!((a.im + b.im).abs() < 1e-5);
        }
    }

    #[cfg(feature = "std")]
    #[test]
    fn test_rfft_irfft_roundtrip() {
        let fft = ScalarFftImpl::<f32>::default();
        let n = 8;
        let mut real = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let mut freq = vec![Complex32::zero(); n / 2 + 1];
        let mut recovered = [0.0f32; 8];
        fft.rfft(&mut real, &mut freq).unwrap();
        fft.irfft(&mut freq, &mut recovered).unwrap();
        for (a, b) in real.iter().zip(recovered.iter()) {
            assert!((a - b).abs() < 1e-5, "{} vs {}", a, b);
        }
    }

    #[cfg(feature = "std")]
    #[test]
    fn test_rfft_hermitian_symmetry() {
        let fft = ScalarFftImpl::<f32>::default();
        let n = 8;
        let mut real = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let mut freq = vec![Complex32::zero(); n / 2 + 1];
        fft.rfft(&mut real, &mut freq).unwrap();
        // Only guaranteed: freq[0] and freq[n/2] are real
        assert!(freq[0].im.abs() < 1e-5);
        assert!(freq[n / 2].im.abs() < 1e-5);
    }

    #[cfg(feature = "std")]
    #[test]
    fn test_rfft_irfft_mismatched_lengths() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut real = [1.0, 2.0, 3.0, 4.0];
        let mut freq = vec![Complex32::zero(); 3]; // should be 4/2+1=3, so this is correct
        let mut bad_freq = vec![Complex32::zero(); 2];
        let mut recovered = [0.0f32; 4];
        // Good case
        assert!(fft.rfft(&mut real, &mut freq).is_ok());
        assert!(fft.irfft(&mut freq, &mut recovered).is_ok());
        // Bad case
        assert_eq!(fft.rfft(&mut real, &mut bad_freq), Err(FftError::MismatchedLengths));
        let mut bad_recovered = [0.0f32; 3];
        assert_eq!(fft.irfft(&mut freq, &mut bad_recovered), Err(FftError::MismatchedLengths));
    }
}
