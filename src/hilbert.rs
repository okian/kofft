//! Hilbert Transform module
//! Analytic signal construction via FFT (for f32)
//! no_std + alloc compatible

extern crate alloc;
use crate::fft::FftImpl;
use crate::fft::{Complex32, FftError, ScalarFftImpl};
use alloc::vec::Vec;

/// Multiplier applied to positive-frequency components when constructing the
/// analytic signal. Doubling these bins preserves the original signal's
/// amplitude after negative frequencies are nulled.
const POSITIVE_FREQ_SCALE: f32 = 2.0;

/// Compute the analytic signal (Hilbert transform) of a real input
/// Returns a Vec<Complex32> of the analytic signal
pub fn hilbert_analytic(input: &[f32]) -> Result<Vec<Complex32>, FftError> {
    if input.is_empty() {
        return Err(FftError::EmptyInput);
    }
    if !input.len().is_power_of_two() {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    let n = input.len();
    // Preallocate without zero-initialization to avoid needless memory
    // overhead, then push each real sample as a complex value.
    let mut freq: Vec<Complex32> = Vec::with_capacity(n);
    for &x in input {
        freq.push(Complex32::new(x, 0.0));
    }
    let fft = ScalarFftImpl::<f32>::default();
    fft.fft(&mut freq)?;
    if n == 1 {
        // Single-element signals contain only a DC component; no scaling or
        // zeroing is required.
    } else {
        // For power-of-two lengths greater than one, double positive
        // frequencies (excluding DC and Nyquist) and zero out negatives.
        for f in freq.iter_mut().take(n / 2).skip(1) {
            f.re *= POSITIVE_FREQ_SCALE;
            f.im *= POSITIVE_FREQ_SCALE;
        }
        for f in freq.iter_mut().skip(n / 2 + 1) {
            *f = Complex32::zero();
        }
    }
    fft.ifft(&mut freq)?;
    Ok(freq)
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    use alloc::vec;
    /// The transform of a single-sample signal should be that sample with a
    /// zero imaginary component.
    #[test]
    fn hilbert_single_sample() {
        let x = [42.0];
        let analytic = hilbert_analytic(&x).unwrap();
        assert_eq!(analytic, vec![Complex32::new(42.0, 0.0)]);
    }

    /// Even-length inputs should preserve the real part and produce the expected
    /// imaginary response for an impulse.
    #[test]
    fn hilbert_even_impulse() {
        let x = [1.0, 0.0, 0.0, 0.0];
        let analytic = hilbert_analytic(&x).unwrap();
        let expected = [
            Complex32::new(1.0, 0.0),
            Complex32::new(0.0, 0.5),
            Complex32::new(0.0, 0.0),
            Complex32::new(0.0, -0.5),
        ];
        for (a, e) in analytic.iter().zip(expected.iter()) {
            assert!((a.re - e.re).abs() < 1e-6);
            assert!((a.im - e.im).abs() < 1e-6);
        }
    }

    /// Confirm that error conditions are properly reported.
    #[test]
    fn hilbert_errors() {
        assert_eq!(hilbert_analytic(&[]).unwrap_err(), FftError::EmptyInput);
        let x = [1.0, 2.0, 3.0];
        assert_eq!(
            hilbert_analytic(&x).unwrap_err(),
            FftError::NonPowerOfTwoNoStd
        );
    }
}
