//! Hilbert Transform module
//! Analytic signal construction via FFT (for f32)
//! no_std + alloc compatible

extern crate alloc;
use alloc::vec::Vec;
use alloc::vec;
use crate::fft::{ScalarFftImpl, Complex32};
use crate::fft::FftImpl;

/// Compute the analytic signal (Hilbert transform) of a real input
/// Returns a Vec<Complex32> of the analytic signal
pub fn hilbert_analytic(input: &[f32]) -> Vec<Complex32> {
    let n = input.len();
    let mut freq = vec![Complex32::zero(); n];
    // Copy real input to complex
    for (i, &x) in input.iter().enumerate() {
        freq[i] = Complex32::new(x, 0.0);
    }
    ScalarFftImpl::<f32>::default().fft(&mut freq).unwrap();
    // Zero negative frequencies
    for i in (n / 2 + 1)..n {
        freq[i] = Complex32::zero();
    }
    ScalarFftImpl::<f32>::default().ifft(&mut freq).unwrap();
    freq
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_hilbert_analytic() {
        let x = [1.0, 0.0, -1.0, 0.0];
        let analytic = hilbert_analytic(&x);
        assert_eq!(analytic.len(), x.len());
    }
} 