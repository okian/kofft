//! Real FFT (RFFT) utilities built on top of complex FFT routines.
//!
//! This module provides real-to-complex (`rfft`) and complex-to-real (`irfft`)
//! transforms by reusing the existing complex FFT implementations from
//! [`crate::fft`]. It also exposes stack-only helpers analogous to
//! [`crate::fft::fft_inplace_stack`] for embedded/`no_std` environments.

use alloc::{sync::Arc, vec};

use core::any::TypeId;

use crate::fft::{fft_inplace_stack, ifft_inplace_stack, Complex, Complex32, FftError, FftImpl};
use crate::num::Float;
use hashbrown::HashMap;

fn build_twiddle_table<T: Float>(m: usize) -> alloc::vec::Vec<Complex<T>> {
    let angle = -T::pi() / T::from_f32(m as f32);
    let (sin_step, cos_step) = angle.sin_cos();
    let w = Complex::new(cos_step, sin_step);
    let mut table = alloc::vec::Vec::with_capacity(m);
    let mut current = Complex::new(T::one(), T::zero());
    for _ in 0..m {
        table.push(current);
        current = current.mul(w);
    }
    table
}

/// Planner that caches RFFT twiddle tables by transform length.
pub struct RfftPlanner<T: Float> {
    cache: HashMap<usize, Arc<[Complex<T>]>>,
}

impl<T: Float> Default for RfftPlanner<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Float> RfftPlanner<T> {
    /// Create a new [`RfftPlanner`].
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    /// Retrieve or build the twiddle table for length `m`.
    pub fn get_twiddles(&mut self, m: usize) -> &[Complex<T>] {
        if !self.cache.contains_key(&m) {
            let vec = build_twiddle_table::<T>(m);
            self.cache.insert(m, Arc::<[Complex<T>]>::from(vec));
        }
        self.cache.get(&m).unwrap().as_ref()
    }

    /// Compute a real-input FFT using cached twiddle tables.
    pub fn rfft_with_scratch<F: FftImpl<T> + ?Sized>(
        &mut self,
        fft: &F,
        input: &mut [T],
        output: &mut [Complex<T>],
        _scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let m = input.len() / 2;
        let twiddles = self.get_twiddles(m);
        #[cfg(all(target_arch = "x86_64", any(feature = "sse", target_feature = "sse2")))]
        {
            if TypeId::of::<T>() == TypeId::of::<f32>() {
                unsafe {
                    let input32 = &mut *(input as *mut [T] as *mut [f32]);
                    let output32 = &mut *(output as *mut [Complex<T>] as *mut [Complex32]);
                    let twiddles32 = &*(twiddles as *const [Complex<T>] as *const [Complex32]);
                    return rfft_direct_f32_simd(
                        |d: &mut [Complex32]| {
                            fft.fft(&mut *(d as *mut [Complex32] as *mut [Complex<T>]))
                        },
                        input32,
                        output32,
                        twiddles32,
                    );
                }
            }
        }
        rfft_direct(fft, input, output, twiddles)
    }

    /// Convenience wrapper that allocates a scratch buffer internally.
    pub fn rfft<F: FftImpl<T> + ?Sized>(
        &mut self,
        fft: &F,
        input: &mut [T],
        output: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let mut scratch = vec![Complex::zero(); input.len() / 2];
        self.rfft_with_scratch(fft, input, output, &mut scratch)
    }

    /// Compute the inverse real FFT using cached twiddle tables.
    pub fn irfft_with_scratch<F: FftImpl<T> + ?Sized>(
        &mut self,
        fft: &F,
        input: &mut [Complex<T>],
        output: &mut [T],
        _scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let m = output.len() / 2;
        let twiddles = self.get_twiddles(m);
        #[cfg(all(target_arch = "x86_64", any(feature = "sse", target_feature = "sse2")))]
        {
            if TypeId::of::<T>() == TypeId::of::<f32>() {
                unsafe {
                    let input32 = &mut *(input as *mut [Complex<T>] as *mut [Complex32]);
                    let output32 = &mut *(output as *mut [T] as *mut [f32]);
                    let twiddles32 = &*(twiddles as *const [Complex<T>] as *const [Complex32]);
                    return irfft_direct_f32_simd(
                        |d: &mut [Complex32]| {
                            fft.ifft(&mut *(d as *mut [Complex32] as *mut [Complex<T>]))
                        },
                        input32,
                        output32,
                        twiddles32,
                    );
                }
            }
        }
        irfft_direct(fft, input, output, twiddles)
    }

    /// Convenience wrapper that allocates scratch internally.
    pub fn irfft<F: FftImpl<T> + ?Sized>(
        &mut self,
        fft: &F,
        input: &mut [Complex<T>],
        output: &mut [T],
    ) -> Result<(), FftError> {
        let mut scratch = vec![Complex::zero(); output.len() / 2];
        self.irfft_with_scratch(fft, input, output, &mut scratch)
    }
}

/// Old packed real FFT kernel used for comparison and fallback.
pub fn rfft_packed<T: Float, F: FftImpl<T>>(
    planner: &mut RfftPlanner<T>,
    fft: &F,
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
    // SAFETY: `m <= input.len()/2` and `scratch` has length at least `m`.
    // The loop indexes remain in bounds.
    for i in 0..m {
        unsafe {
            let re = *input.get_unchecked(2 * i);
            let im = *input.get_unchecked(2 * i + 1);
            *scratch.get_unchecked_mut(i) = Complex::new(re, im);
        }
    }
    fft.fft(&mut scratch[..m])?;
    let y0 = scratch[0];
    output[0] = Complex::new(y0.re + y0.im, T::zero());
    output[m] = Complex::new(y0.re - y0.im, T::zero());
    let half = T::from_f32(0.5);
    let twiddles = planner.get_twiddles(m);
    for k in 1..m {
        unsafe {
            let a = *scratch.get_unchecked(k);
            let tmp = scratch.get_unchecked(m - k);
            let b = Complex::new(tmp.re, -tmp.im);
            let sum = a.add(b);
            let diff = a.sub(b);
            let w = *twiddles.get_unchecked(k);
            let t = w.mul(diff);
            let temp = sum.add(Complex::new(t.im, -t.re));
            *output.get_unchecked_mut(k) = Complex::new(temp.re * half, temp.im * half);
        }
    }
    Ok(())
}

/// Packed inverse real FFT kernel used for comparison and fallback.
pub fn irfft_packed<T: Float, F: FftImpl<T>>(
    planner: &mut RfftPlanner<T>,
    fft: &F,
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
    scratch[0] = Complex::new(
        (input[0].re + input[m].re) * half,
        (input[0].re - input[m].re) * half,
    );
    let twiddles = planner.get_twiddles(m);
    for k in 1..m {
        unsafe {
            let a = *input.get_unchecked(k);
            let tmp = input.get_unchecked(m - k);
            let b = Complex::new(tmp.re, -tmp.im);
            let sum = a.add(b);
            let diff = a.sub(b);
            let tw = twiddles.get_unchecked(k);
            let w = Complex::new(tw.re, -tw.im);
            let t = w.mul(diff);
            let temp = sum.sub(Complex::new(t.im, -t.re));
            *scratch.get_unchecked_mut(k) = Complex::new(temp.re * half, temp.im * half);
        }
    }
    fft.ifft(&mut scratch[..m])?;
    for i in 0..m {
        unsafe {
            let s = *scratch.get_unchecked(i);
            *output.get_unchecked_mut(2 * i) = s.re;
            *output.get_unchecked_mut(2 * i + 1) = s.im;
        }
    }
    Ok(())
}

/// Direct real FFT kernel operating in-place on the real buffer.
fn rfft_direct<T: Float, F: FftImpl<T> + ?Sized>(
    fft: &F,
    input: &mut [T],
    output: &mut [Complex<T>],
    twiddles: &[Complex<T>],
) -> Result<(), FftError> {
    let n = input.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n % 2 != 0 {
        return Err(FftError::InvalidValue);
    }
    let m = n / 2;
    if output.len() != m + 1 {
        return Err(FftError::MismatchedLengths);
    }
    let data: &mut [Complex<T>] =
        unsafe { core::slice::from_raw_parts_mut(input.as_mut_ptr() as *mut Complex<T>, m) };
    fft.fft(data)?;
    let y0 = data[0];
    output[0] = Complex::new(y0.re + y0.im, T::zero());
    output[m] = Complex::new(y0.re - y0.im, T::zero());
    let half = T::from_f32(0.5);
    for k in 1..m {
        unsafe {
            let a = *data.get_unchecked(k);
            let tmp = data.get_unchecked(m - k);
            let b = Complex::new(tmp.re, -tmp.im);
            let sum = a.add(b);
            let diff = a.sub(b);
            let w = *twiddles.get_unchecked(k);
            let t = w.mul(diff);
            let temp = sum.add(Complex::new(t.im, -t.re));
            *output.get_unchecked_mut(k) = Complex::new(temp.re * half, temp.im * half);
        }
    }
    Ok(())
}

/// Direct inverse real FFT kernel operating on the real buffer.
fn irfft_direct<T: Float, F: FftImpl<T> + ?Sized>(
    fft: &F,
    input: &mut [Complex<T>],
    output: &mut [T],
    twiddles: &[Complex<T>],
) -> Result<(), FftError> {
    let n = output.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n % 2 != 0 {
        return Err(FftError::InvalidValue);
    }
    let m = n / 2;
    if input.len() != m + 1 {
        return Err(FftError::MismatchedLengths);
    }
    let data: &mut [Complex<T>] =
        unsafe { core::slice::from_raw_parts_mut(output.as_mut_ptr() as *mut Complex<T>, m) };
    let half = T::from_f32(0.5);
    data[0] = Complex::new(
        (input[0].re + input[m].re) * half,
        (input[0].re - input[m].re) * half,
    );
    for k in 1..m {
        unsafe {
            let a = *input.get_unchecked(k);
            let tmp = input.get_unchecked(m - k);
            let b = Complex::new(tmp.re, -tmp.im);
            let sum = a.add(b);
            let diff = a.sub(b);
            let tw = twiddles.get_unchecked(k);
            let w = Complex::new(tw.re, -tw.im);
            let t = w.mul(diff);
            let temp = sum.sub(Complex::new(t.im, -t.re));
            *data.get_unchecked_mut(k) = Complex::new(temp.re * half, temp.im * half);
        }
    }
    fft.ifft(data)?;
    for i in 0..m {
        unsafe {
            let val = *data.get_unchecked(i);
            *output.get_unchecked_mut(2 * i) = val.re;
            *output.get_unchecked_mut(2 * i + 1) = val.im;
        }
    }
    Ok(())
}

#[cfg(all(target_arch = "x86_64", any(feature = "sse", target_feature = "sse2")))]
use core::arch::x86_64::*;

#[cfg(all(target_arch = "x86_64", any(feature = "sse", target_feature = "sse2")))]
fn rfft_direct_f32_simd<F>(
    mut fft: F,
    input: &mut [f32],
    output: &mut [Complex32],
    twiddles: &[Complex32],
) -> Result<(), FftError>
where
    F: FnMut(&mut [Complex32]) -> Result<(), FftError>,
{
    let n = input.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n % 2 != 0 {
        return Err(FftError::InvalidValue);
    }
    let m = n / 2;
    if output.len() != m + 1 {
        return Err(FftError::MismatchedLengths);
    }
    let data: &mut [Complex32] =
        unsafe { core::slice::from_raw_parts_mut(input.as_mut_ptr() as *mut Complex32, m) };
    fft(data)?;
    let y0 = data[0];
    output[0] = Complex32::new(y0.re + y0.im, 0.0);
    output[m] = Complex32::new(y0.re - y0.im, 0.0);
    let half = unsafe { _mm_set1_ps(0.5) };
    for k in 1..m {
        unsafe {
            let a = *data.get_unchecked(k);
            let tmp = data.get_unchecked(m - k);
            let b = Complex32::new(tmp.re, -tmp.im);
            let sum_re = a.re + b.re;
            let sum_im = a.im + b.im;
            let diff_re = a.re - b.re;
            let diff_im = a.im - b.im;
            let w = *twiddles.get_unchecked(k);
            let v_re = _mm_set1_ps(diff_re);
            let v_im = _mm_set1_ps(diff_im);
            let w_re = _mm_set1_ps(w.re);
            let w_im = _mm_set1_ps(w.im);
            let t1 = _mm_mul_ps(v_re, w_re);
            let t2 = _mm_mul_ps(v_im, w_im);
            let t3 = _mm_mul_ps(v_re, w_im);
            let t4 = _mm_mul_ps(v_im, w_re);
            let vw_re = _mm_sub_ps(t1, t2);
            let vw_im = _mm_add_ps(t3, t4);
            let t_re = _mm_cvtss_f32(vw_re);
            let t_im = _mm_cvtss_f32(vw_im);
            let temp_re = sum_re + t_im;
            let temp_im = sum_im - t_re;
            let res_re = _mm_mul_ss(_mm_set_ss(temp_re), half);
            let res_im = _mm_mul_ss(_mm_set_ss(temp_im), half);
            let out = output.get_unchecked_mut(k);
            (*out).re = _mm_cvtss_f32(res_re);
            (*out).im = _mm_cvtss_f32(res_im);
        }
    }
    Ok(())
}

#[cfg(all(target_arch = "x86_64", any(feature = "sse", target_feature = "sse2")))]
fn irfft_direct_f32_simd<F>(
    mut ifft: F,
    input: &mut [Complex32],
    output: &mut [f32],
    twiddles: &[Complex32],
) -> Result<(), FftError>
where
    F: FnMut(&mut [Complex32]) -> Result<(), FftError>,
{
    let n = output.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n % 2 != 0 {
        return Err(FftError::InvalidValue);
    }
    let m = n / 2;
    if input.len() != m + 1 {
        return Err(FftError::MismatchedLengths);
    }
    let data: &mut [Complex32] =
        unsafe { core::slice::from_raw_parts_mut(output.as_mut_ptr() as *mut Complex32, m) };
    let half = unsafe { _mm_set1_ps(0.5) };
    unsafe {
        let a0 = _mm_set_ss(input[0].re + input[m].re);
        let b0 = _mm_set_ss(input[0].re - input[m].re);
        data[0] = Complex32::new(
            _mm_cvtss_f32(_mm_mul_ss(a0, half)),
            _mm_cvtss_f32(_mm_mul_ss(b0, half)),
        );
    }
    for k in 1..m {
        unsafe {
            let a = *input.get_unchecked(k);
            let tmp = input.get_unchecked(m - k);
            let b = Complex32::new(tmp.re, -tmp.im);
            let sum_re = a.re + b.re;
            let sum_im = a.im + b.im;
            let diff_re = a.re - b.re;
            let diff_im = a.im - b.im;
            let tw = twiddles.get_unchecked(k);
            let w = Complex32::new(tw.re, -tw.im);
            let v_re = _mm_set1_ps(diff_re);
            let v_im = _mm_set1_ps(diff_im);
            let w_re = _mm_set1_ps(w.re);
            let w_im = _mm_set1_ps(w.im);
            let t1 = _mm_mul_ps(v_re, w_re);
            let t2 = _mm_mul_ps(v_im, w_im);
            let t3 = _mm_mul_ps(v_re, w_im);
            let t4 = _mm_mul_ps(v_im, w_re);
            let vw_re = _mm_sub_ps(t1, t2);
            let vw_im = _mm_add_ps(t3, t4);
            let t_re = _mm_cvtss_f32(vw_re);
            let t_im = _mm_cvtss_f32(vw_im);
            let temp_re = sum_re - t_im;
            let temp_im = sum_im + t_re;
            let res_re = _mm_mul_ss(_mm_set_ss(temp_re), half);
            let res_im = _mm_mul_ss(_mm_set_ss(temp_im), half);
            let out = data.get_unchecked_mut(k);
            (*out).re = _mm_cvtss_f32(res_re);
            (*out).im = _mm_cvtss_f32(res_im);
        }
    }
    ifft(data)?;
    for i in 0..m {
        unsafe {
            let val = *data.get_unchecked(i);
            *output.get_unchecked_mut(2 * i) = val.re;
            *output.get_unchecked_mut(2 * i + 1) = val.im;
        }
    }
    Ok(())
}

/// Trait providing real-valued FFT transforms built on top of [`FftImpl`].
pub trait RealFftImpl<T: Float>: FftImpl<T> {
    /// Compute the real-input FFT, producing `N/2 + 1` complex samples.
    /// Scratch storage is ignored for the specialized kernels but kept for
    /// API compatibility. When SIMD features are enabled this routine
    /// dispatches to SIMD-accelerated variants.
    fn rfft_with_scratch(
        &self,
        input: &mut [T],
        output: &mut [Complex<T>],
        _scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let mut planner = RfftPlanner::new();
        planner.rfft_with_scratch(self, input, output, _scratch)
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
        _scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let mut planner = RfftPlanner::new();
        planner.irfft_with_scratch(self, input, output, _scratch)
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

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    use crate::fft::{Complex64, ScalarFftImpl};
    use alloc::vec;

    #[test]
    fn rfft_irfft_roundtrip() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut input = vec![1.0f32, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let orig = input.clone();
        let mut freq = vec![Complex32::new(0.0, 0.0); input.len() / 2 + 1];
        let mut scratch = vec![Complex32::new(0.0, 0.0); input.len() / 2];
        fft.rfft_with_scratch(&mut input, &mut freq, &mut scratch)
            .unwrap();
        let mut out = vec![0.0f32; orig.len()];
        fft.irfft_with_scratch(&mut freq, &mut out, &mut scratch)
            .unwrap();
        for (a, b) in orig.iter().zip(out.iter()) {
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

    #[test]
    fn rfft_irfft_roundtrip_f64() {
        let fft = ScalarFftImpl::<f64>::default();
        let mut input = vec![1.0f64, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let orig = input.clone();
        let mut freq = vec![Complex64::new(0.0, 0.0); input.len() / 2 + 1];
        let mut scratch = vec![Complex64::new(0.0, 0.0); input.len() / 2];
        fft.rfft_with_scratch(&mut input, &mut freq, &mut scratch)
            .unwrap();
        let mut out = vec![0.0f64; orig.len()];
        fft.irfft_with_scratch(&mut freq, &mut out, &mut scratch)
            .unwrap();
        for (a, b) in orig.iter().zip(out.iter()) {
            assert!((a - b).abs() < 1e-10);
        }
    }
}
