//! Real FFT (RFFT) utilities built on top of complex FFT routines.
//!
//! This module provides real-to-complex (`rfft`) and complex-to-real (`irfft`)
//! transforms by reusing the existing complex FFT implementations from
//! [`crate::fft`]. It also exposes stack-only helpers analogous to
//! [`crate::fft::fft_inplace_stack`] for embedded/`no_std` environments.

use alloc::vec::Vec;

use crate::fft::{ifft_inplace_stack, fft_inplace_stack, Complex, Complex32, FftError, FftImpl};
use crate::num::Float;

/// Trait providing real-valued FFT transforms built on top of [`FftImpl`].
pub trait RealFftImpl<T: Float>: FftImpl<T> {
    /// Compute the real-input FFT, producing `N/2 + 1` complex samples
    /// representing the positive-frequency spectrum.
    fn rfft(&self, input: &mut [T], output: &mut [Complex<T>]) -> Result<(), FftError> {
        let n = input.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if output.len() != n / 2 + 1 {
            return Err(FftError::MismatchedLengths);
        }
        let mut buf: Vec<Complex<T>> = input
            .iter()
            .map(|&x| Complex::<T>::new(x, T::zero()))
            .collect();
        self.fft(&mut buf)?;
        for k in 0..=n / 2 {
            output[k] = buf[k];
        }
        Ok(())
    }

    /// Compute the inverse real FFT, consuming `N/2 + 1` complex samples and
    /// producing `N` real time-domain values.
    fn irfft(&self, input: &mut [Complex<T>], output: &mut [T]) -> Result<(), FftError> {
        let n = output.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if input.len() != n / 2 + 1 {
            return Err(FftError::MismatchedLengths);
        }
        let mut buf: Vec<Complex<T>> = input.to_vec();
        for k in (1..n / 2).rev() {
            let c = input[k];
            buf.push(Complex::new(c.re, -c.im));
        }
        self.ifft(&mut buf)?;
        for (i, c) in buf.iter().enumerate() {
            output[i] = c.re;
        }
        Ok(())
    }
}

// Blanket implementation for any complex FFT provider.
impl<T: Float, U: FftImpl<T>> RealFftImpl<T> for U {}

/// Perform a real-input FFT using only stack allocation.
///
/// The output buffer must have length `N/2 + 1`.
pub fn rfft_stack<const N: usize, const M: usize>(
    input: &[f32; N],
    output: &mut [Complex32; M],
) -> Result<(), FftError> {
    if N == 0 {
        return Err(FftError::EmptyInput);
    }
    if M != N / 2 + 1 {
        return Err(FftError::MismatchedLengths);
    }
    let mut buf = [Complex32::new(0.0, 0.0); N];
    for i in 0..N {
        buf[i] = Complex32::new(input[i], 0.0);
    }
    fft_inplace_stack(&mut buf)?;
    for k in 0..=N / 2 {
        output[k] = buf[k];
    }
    Ok(())
}

/// Perform an inverse real-input FFT using only stack allocation.
///
/// The input buffer must have length `N/2 + 1`.
pub fn irfft_stack<const N: usize, const M: usize>(
    input: &[Complex32; M],
    output: &mut [f32; N],
) -> Result<(), FftError> {
    if N == 0 {
        return Err(FftError::EmptyInput);
    }
    if M != N / 2 + 1 {
        return Err(FftError::MismatchedLengths);
    }
    let mut buf = [Complex32::new(0.0, 0.0); N];
    for k in 0..=N / 2 {
        buf[k] = input[k];
    }
    for k in 1..N / 2 {
        buf[N - k] = Complex32::new(input[k].re, -input[k].im);
    }
    ifft_inplace_stack(&mut buf)?;
    for i in 0..N {
        output[i] = buf[i].re;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fft::ScalarFftImpl;
    use alloc::vec;

    #[test]
    fn rfft_irfft_roundtrip() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut input = vec![1.0f32, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let mut freq = vec![Complex32::new(0.0, 0.0); input.len() / 2 + 1];
        fft.rfft(&mut input, &mut freq).unwrap();
        let mut out = vec![0.0f32; input.len()];
        fft.irfft(&mut freq, &mut out).unwrap();
        for (a, b) in input.iter().zip(out.iter()) {
            assert!((a - b).abs() < 1e-5);
        }
    }

    #[test]
    fn rfft_stack_roundtrip() {
        let input = [1.0f32, 2.0, 3.0, 4.0];
        let mut freq = [Complex32::new(0.0, 0.0); 3];
        rfft_stack(&input, &mut freq).unwrap();
        let mut out = [0.0f32; 4];
        irfft_stack(&freq, &mut out).unwrap();
        for (a, b) in input.iter().zip(out.iter()) {
            assert!((a - b).abs() < 1e-5);
        }
    }
}
