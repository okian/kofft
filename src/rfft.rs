//! Real FFT (RFFT) utilities built on top of complex FFT routines.
//!
//! This module provides real-to-complex (`rfft`) and complex-to-real (`irfft`)
//! transforms by reusing the existing complex FFT implementations from
//! [`crate::fft`]. It also exposes stack-only helpers analogous to
//! [`crate::fft::fft_inplace_stack`] for embedded/`no_std` environments.

use alloc::vec;

use crate::fft::{fft_inplace_stack, ifft_inplace_stack, Complex, Complex32, FftError, FftImpl};
use crate::num::Float;

/// Trait providing real-valued FFT transforms built on top of [`FftImpl`].
pub trait RealFftImpl<T: Float>: FftImpl<T> {
    /// Compute the real-input FFT, producing `N/2 + 1` complex samples.
    /// A scratch buffer of length `N/2` is used to avoid heap allocations
    /// and can be reused across calls.
    fn rfft_with_scratch(
        &self,
        input: &mut [T],
        output: &mut [Complex<T>],
        scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let n = input.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n % 2 != 0 {
            return Err(FftError::InvalidValue);
        }
        let m = n / 2;
        if output.len() != m + 1 || scratch.len() < m {
            return Err(FftError::MismatchedLengths);
        }
        // Pack even/odd samples into complex buffer
        for i in 0..m {
            scratch[i] = Complex::new(input[2 * i], input[2 * i + 1]);
        }
        // Compute half-size complex FFT
        self.fft(&mut scratch[..m])?;
        // DC and Nyquist components
        let y0 = scratch[0];
        output[0] = Complex::new(y0.re + y0.im, T::zero());
        output[m] = Complex::new(y0.re - y0.im, T::zero());
        let half = T::from_f32(0.5);
        // Remaining frequencies
        for k in 1..m {
            let a = scratch[k];
            let b = Complex::new(scratch[m - k].re, -scratch[m - k].im);
            let sum = a.add(b);
            let diff = a.sub(b);
            let angle = -T::pi() * T::from_f32(k as f32) / T::from_f32(m as f32);
            let w = Complex::expi(angle);
            let t = w.mul(diff);
            let temp = sum.add(Complex::new(t.im, -t.re));
            output[k] = Complex::new(temp.re * half, temp.im * half);
        }
        Ok(())
    }

    /// Convenience wrapper that allocates a scratch buffer internally.
    fn rfft(&self, input: &mut [T], output: &mut [Complex<T>]) -> Result<(), FftError> {
        let mut scratch = vec![Complex::zero(); input.len() / 2];
        self.rfft_with_scratch(input, output, &mut scratch)
    }

    /// Compute the inverse real FFT, consuming `N/2 + 1` complex samples and
    /// producing `N` real time-domain values. A scratch buffer of length `N/2`
    /// is used to avoid allocations.
    fn irfft_with_scratch(
        &self,
        input: &mut [Complex<T>],
        output: &mut [T],
        scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let n = output.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n % 2 != 0 {
            return Err(FftError::InvalidValue);
        }
        let m = n / 2;
        if input.len() != m + 1 || scratch.len() < m {
            return Err(FftError::MismatchedLengths);
        }
        let half = T::from_f32(0.5);
        // Reconstruct the half-size spectrum
        scratch[0] = Complex::new(
            (input[0].re + input[m].re) * half,
            (input[0].re - input[m].re) * half,
        );
        for k in 1..m {
            let a = input[k];
            let b = Complex::new(input[m - k].re, -input[m - k].im);
            let sum = a.add(b);
            let diff = a.sub(b);
            let angle = T::pi() * T::from_f32(k as f32) / T::from_f32(m as f32);
            let w = Complex::expi(angle);
            let t = w.mul(diff);
            let temp = sum.sub(Complex::new(t.im, -t.re));
            scratch[k] = Complex::new(temp.re * half, temp.im * half);
        }
        // Perform inverse complex FFT of half-size
        self.ifft(&mut scratch[..m])?;
        // Unpack into real output
        for i in 0..m {
            output[2 * i] = scratch[i].re;
            output[2 * i + 1] = scratch[i].im;
        }
        Ok(())
    }

    /// Convenience wrapper that allocates scratch internally.
    fn irfft(&self, input: &mut [Complex<T>], output: &mut [T]) -> Result<(), FftError> {
        let mut scratch = vec![Complex::zero(); output.len() / 2];
        self.irfft_with_scratch(input, output, &mut scratch)
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
    for (b, &x) in buf.iter_mut().zip(input.iter()) {
        *b = Complex32::new(x, 0.0);
    }
    fft_inplace_stack(&mut buf)?;
    output[..(N / 2 + 1)].copy_from_slice(&buf[..(N / 2 + 1)]);
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
    buf[..(N / 2 + 1)].copy_from_slice(&input[..(N / 2 + 1)]);
    for k in 1..N / 2 {
        buf[N - k] = Complex32::new(input[k].re, -input[k].im);
    }
    ifft_inplace_stack(&mut buf)?;
    for (o, &b) in output.iter_mut().zip(buf.iter()) {
        *o = b.re;
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
        let mut scratch = vec![Complex32::new(0.0, 0.0); input.len() / 2];
        fft.rfft_with_scratch(&mut input, &mut freq, &mut scratch)
            .unwrap();
        let mut out = vec![0.0f32; input.len()];
        fft.irfft_with_scratch(&mut freq, &mut out, &mut scratch)
            .unwrap();
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
