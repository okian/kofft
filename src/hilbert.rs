//! Hilbert Transform module
//! Analytic signal construction via FFT (for f32)
//! no_std + alloc compatible

extern crate alloc;
use crate::fft::FftImpl;
use crate::fft::{Complex32, FftError, ScalarFftImpl};
use alloc::vec;
use alloc::vec::Vec;

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
    let mut freq = vec![Complex32::zero(); n];
    for (i, &x) in input.iter().enumerate() {
        freq[i] = Complex32::new(x, 0.0);
    }
    let fft = ScalarFftImpl::<f32>::default();
    fft.fft(&mut freq)?;
    if n.is_multiple_of(2) {
        for f in freq.iter_mut().take(n / 2).skip(1) {
            f.re *= 2.0;
            f.im *= 2.0;
        }
        for f in freq.iter_mut().take(n).skip(n / 2 + 1) {
            *f = Complex32::zero();
        }
    } else {
        for f in freq.iter_mut().take((n - 1) / 2 + 1).skip(1) {
            f.re *= 2.0;
            f.im *= 2.0;
        }
        let start = n.div_ceil(2);
        for f in freq.iter_mut().take(n).skip(start) {
            *f = Complex32::zero();
        }
    }
    fft.ifft(&mut freq)?;
    Ok(freq)
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    #[test]
    fn test_hilbert_analytic() {
        let x = [1.0, 0.0, -1.0, 0.0];
        let analytic = hilbert_analytic(&x).unwrap();
        assert_eq!(analytic.len(), x.len());
    }

    #[test]
    fn test_hilbert_errors() {
        assert_eq!(hilbert_analytic(&[]).unwrap_err(), FftError::EmptyInput);
        let x = [1.0, 2.0, 3.0];
        assert_eq!(
            hilbert_analytic(&x).unwrap_err(),
            FftError::NonPowerOfTwoNoStd
        );
    }
}
