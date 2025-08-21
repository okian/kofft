//! Hilbert Transform module
//! Analytic signal construction via FFT (for f32)
//! no_std + alloc compatible

extern crate alloc;
use crate::fft::FftImpl;
use crate::fft::{Complex32, FftError, ScalarFftImpl};
use alloc::vec;
use alloc::vec::Vec;

/// Scaling factor applied to positive frequency components when constructing
/// the analytic signal. Doubling these components removes negative frequencies
/// after the inverse transform.
const POS_FREQ_SCALE: f32 = 2.0;

/// Starting index of positive frequency components in the FFT output. Index 0
/// holds the DC component, so iteration begins at 1.
const POS_FREQ_START: usize = 1;

/// Compute the analytic signal (Hilbert transform) of a real input using an
/// FFT-based approach.
///
/// # Parameters
/// - `input`: Real-valued samples whose length must be a power of two.
///
/// # Returns
/// A vector of complex values representing the analytic signal. The real part
/// matches the original input while the imaginary part is the Hilbert transform.
pub fn hilbert_analytic(input: &[f32]) -> Result<Vec<Complex32>, FftError> {
    if input.is_empty() {
        return Err(FftError::EmptyInput);
    }
    if !input.len().is_power_of_two() {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    let n = input.len();
    let mut freq = vec![Complex32::zero(); n];
    for (i, &x) in input.iter().enumerate() {
        freq[i] = Complex32::new(x, 0.0);
    }
    let fft = ScalarFftImpl::<f32>::default();
    fft.fft(&mut freq)?;
    if n.is_multiple_of(2) {
        for f in freq[POS_FREQ_START..n / 2].iter_mut() {
            f.re *= POS_FREQ_SCALE;
            f.im *= POS_FREQ_SCALE;
        }
        for f in freq[n / 2 + POS_FREQ_START..].iter_mut() {
            *f = Complex32::zero();
        }
    } else {
        for f in freq[POS_FREQ_START..(n / 2 + POS_FREQ_START)].iter_mut() {
            f.re *= POS_FREQ_SCALE;
            f.im *= POS_FREQ_SCALE;
        }
        let start = n.div_ceil(2);
        for f in freq[start..].iter_mut() {
            *f = Complex32::zero();
        }
    }
    fft.ifft(&mut freq)?;
    Ok(freq)
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    /// Acceptable tolerance for floating-point comparisons in tests.
    const EPSILON: f32 = 1e-6;

    // Ensures the Hilbert transform returns an analytic signal with matching length.
    #[test]
    fn test_hilbert_analytic() {
        let x = [1.0, 0.0, -1.0, 0.0];
        let analytic = hilbert_analytic(&x).unwrap();
        assert_eq!(analytic.len(), x.len());
    }

    // Verifies that invalid inputs produce the expected error types.
    #[test]
    fn test_hilbert_errors() {
        assert_eq!(hilbert_analytic(&[]).unwrap_err(), FftError::EmptyInput);
        let x = [1.0, 2.0, 3.0];
        assert_eq!(
            hilbert_analytic(&x).unwrap_err(),
            FftError::NonPowerOfTwoNoStd
        );
    }

    // Confirms correct behavior for an even-length cosine input.
    #[test]
    fn test_hilbert_even_length_regression() {
        let x = [1.0, 0.0, -1.0, 0.0];
        let expected = [
            Complex32::new(1.0, 0.0),
            Complex32::new(0.0, 1.0),
            Complex32::new(-1.0, 0.0),
            Complex32::new(0.0, -1.0),
        ];
        let analytic = hilbert_analytic(&x).unwrap();
        for (res, exp) in analytic.iter().zip(expected.iter()) {
            assert!((res.re - exp.re).abs() < EPSILON);
            assert!((res.im - exp.im).abs() < EPSILON);
        }
    }

    // Confirms correct behavior for the smallest odd-length input.
    #[test]
    fn test_hilbert_odd_length_regression() {
        let x = [1.0];
        let analytic = hilbert_analytic(&x).unwrap();
        assert!((analytic[0].re - 1.0).abs() < EPSILON);
        assert!(analytic[0].im.abs() < EPSILON);
    }
}
