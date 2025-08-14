//! Fast Fourier Transform (FFT) algorithms.
//!
//! This module implements real and complex FFT routines based on the
//! [Cooley–Tukey algorithm](https://en.wikipedia.org/wiki/Cooley%E2%80%93Tukey_FFT_algorithm).
//! A [`FftPlanner`] caches twiddle factors for reuse. Optional SIMD features
//! (`x86_64`, `sse`, `aarch64`, `wasm`) accelerate computation, and both in-place and
//! out-of-place APIs are provided for single or batched transforms.

use core::f32::consts::PI;

#[cfg(feature = "std")]
use alloc::boxed::Box;
use alloc::collections::BTreeMap;
use alloc::rc::Rc;
use alloc::vec::Vec;
use core::cell::RefCell;

#[cfg(feature = "parallel")]
use rayon::prelude::*;

#[cfg(feature = "parallel")]
const PARALLEL_FFT_THRESHOLD: usize = 4096;

pub use crate::num::{Complex, Complex32, Complex64, Float};

pub struct FftPlanner<T: Float> {
    cache: BTreeMap<usize, Rc<Vec<Complex<T>>>>,
    stage_cache: BTreeMap<(usize, usize), Rc<Vec<Complex<T>>>>,
}

impl<T: Float> Default for FftPlanner<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Float> FftPlanner<T> {
    pub fn new() -> Self {
        Self {
            cache: BTreeMap::new(),
            stage_cache: BTreeMap::new(),
        }
    }
    pub fn get_twiddles(&mut self, n: usize) -> Rc<Vec<Complex<T>>> {
        self.cache
            .entry(n)
            .or_insert_with(|| {
                Rc::new(
                    (0..n)
                        .map(|k| {
                            let angle = -T::from_f32(2.0) * T::pi() * T::from_f32(k as f32)
                                / T::from_f32(n as f32);
                            Complex::expi(angle)
                        })
                        .collect(),
                )
            })
            .clone()
    }

    pub fn get_stage_twiddles(&mut self, n: usize, len: usize) -> Rc<Vec<Complex<T>>> {
        if let Some(twiddles) = self.stage_cache.get(&(n, len)) {
            return twiddles.clone();
        }
        let base = self.get_twiddles(n);
        let stride = n / len;
        let stage: Vec<Complex<T>> = (0..len).map(|i| base[i * stride]).collect();
        let rc = Rc::new(stage);
        self.stage_cache.insert((n, len), rc.clone());
        rc
    }

    /// Determine an FFT strategy based on the factorization of `n`.
    ///
    /// Returns `Radix4` for sizes that are pure powers of four, `Radix2` for
    /// other powers of two, and `Auto` when both twos and other factors are
    /// present.
    pub fn plan_strategy(&mut self, n: usize) -> FftStrategy {
        if n < 2 {
            return FftStrategy::Auto;
        }
        let factors = factorize(n);
        let count_two = factors.iter().filter(|&&f| f == 2).count();
        let has_two = count_two > 0;
        let has_other = factors.iter().any(|&f| f != 2);

        if has_two && !has_other {
            if count_two % 2 == 0 {
                FftStrategy::Radix4
            } else {
                FftStrategy::Radix2
            }
        } else {
            FftStrategy::Auto
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FftError {
    EmptyInput,
    NonPowerOfTwoNoStd,
    MismatchedLengths,
    InvalidStride,
    InvalidHopSize,
    InvalidValue,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum FftStrategy {
    Radix2,
    Radix4,
    #[default]
    Auto,
}

// Refactor FftImpl and ScalarFftImpl to be generic over T: Float
pub trait FftImpl<T: Float> {
    fn fft(&self, input: &mut [Complex<T>]) -> Result<(), FftError>;
    fn ifft(&self, input: &mut [Complex<T>]) -> Result<(), FftError>;
    fn fft_out_of_place(
        &self,
        input: &[Complex<T>],
        output: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        if input.len() != output.len() {
            return Err(FftError::MismatchedLengths);
        }
        output.copy_from_slice(input);
        self.fft(output)
    }
    fn ifft_out_of_place(
        &self,
        input: &[Complex<T>],
        output: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        if input.len() != output.len() {
            return Err(FftError::MismatchedLengths);
        }
        output.copy_from_slice(input);
        self.ifft(output)
    }
    /// In-place strided FFT: input is a strided mutable slice (stride in elements, not bytes)
    fn fft_strided(&self, input: &mut [Complex<T>], stride: usize) -> Result<(), FftError>;
    /// In-place strided IFFT
    fn ifft_strided(&self, input: &mut [Complex<T>], stride: usize) -> Result<(), FftError>;
    /// Out-of-place strided FFT: input/output can have different strides
    fn fft_out_of_place_strided(
        &self,
        input: &[Complex<T>],
        in_stride: usize,
        output: &mut [Complex<T>],
        out_stride: usize,
    ) -> Result<(), FftError>;
    /// Out-of-place strided IFFT
    fn ifft_out_of_place_strided(
        &self,
        input: &[Complex<T>],
        in_stride: usize,
        output: &mut [Complex<T>],
        out_stride: usize,
    ) -> Result<(), FftError>;
    /// Plan-based strategy selection (Radix2, Radix4, Auto)
    fn fft_with_strategy(
        &self,
        input: &mut [Complex<T>],
        strategy: FftStrategy,
    ) -> Result<(), FftError>;
}

pub struct ScalarFftImpl<T: Float> {
    planner: RefCell<FftPlanner<T>>,
}

impl<T: Float> Default for ScalarFftImpl<T> {
    fn default() -> Self {
        Self {
            planner: RefCell::new(FftPlanner::new()),
        }
    }
}

impl<T: Float> ScalarFftImpl<T> {
    pub fn with_planner(planner: FftPlanner<T>) -> Self {
        Self {
            planner: RefCell::new(planner),
        }
    }
}

impl<T: Float> FftImpl<T> for ScalarFftImpl<T> {
    fn fft(&self, input: &mut [Complex<T>]) -> Result<(), FftError> {
        let n = input.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n == 1 {
            return Ok(());
        }
        if (n & (n - 1)) == 0 {
            // Power of two: radix-2 FFT
            let mut j = 0;
            for i in 1..n {
                let mut bit = n >> 1;
                while j & bit != 0 {
                    j ^= bit;
                    bit >>= 1;
                }
                j ^= bit;
                if i < j {
                    input.swap(i, j);
                }
            }
            let mut len = 2;
            while len <= n {
                let stage = self.planner.borrow_mut().get_stage_twiddles(n, len);
                #[cfg(feature = "parallel")]
                {
                    if n >= PARALLEL_FFT_THRESHOLD
                        && core::any::TypeId::of::<T>() == core::any::TypeId::of::<f32>()
                    {
                        let input32 =
                            unsafe { &mut *(input as *mut [Complex<T>] as *mut [Complex32]) };
                        let stage_vec = stage.as_ref().clone();
                        let stage_vec: Vec<Complex32> = unsafe { core::mem::transmute(stage_vec) };
                        let half = len / 2;
                        input32.par_chunks_mut(len).for_each(move |chunk| {
                            for j in 0..half {
                                let w = stage_vec[j];
                                let u = chunk[j];
                                let v = chunk[j + half].mul(w);
                                chunk[j] = u.add(v);
                                chunk[j + half] = u.sub(v);
                            }
                        });
                    } else {
                        let mut i = 0;
                        while i < n {
                            for j in 0..(len / 2) {
                                let w = stage[j];
                                let u = input[i + j];
                                let v = input[i + j + len / 2].mul(w);
                                input[i + j] = u.add(v);
                                input[i + j + len / 2] = u.sub(v);
                            }
                            i += len;
                        }
                    }
                }
                #[cfg(not(feature = "parallel"))]
                {
                    let mut i = 0;
                    while i < n {
                        for j in 0..(len / 2) {
                            let w = stage[j];
                            let u = input[i + j];
                            let v = input[i + j + len / 2].mul(w);
                            input[i + j] = u.add(v);
                            input[i + j + len / 2] = u.sub(v);
                        }
                        i += len;
                    }
                }
                len <<= 1;
            }
            return Ok(());
        }
        // Bluestein's algorithm for non-power-of-two
        #[cfg(not(feature = "std"))]
        {
            return Err(FftError::NonPowerOfTwoNoStd);
        }
        #[cfg(feature = "std")]
        {
            use alloc::vec::Vec;
            let m = (2 * n - 1).next_power_of_two();
            let mut a = Vec::with_capacity(m);
            let mut b = Vec::with_capacity(m);
            for (i, &val) in input.iter().take(n).enumerate() {
                let angle = T::pi() * T::from_f32((i * i) as f32) / T::from_f32(n as f32);
                let w = Complex::expi(-angle);
                a.push(val.mul(w));
            }
            a.resize(m, Complex::zero());
            for i in 0..n {
                let angle = T::pi() * T::from_f32((i * i) as f32) / T::from_f32(n as f32);
                b.push(Complex::expi(angle));
            }
            b.resize(m, Complex::zero());
            for i in 1..n {
                b[m - i] = b[i];
            }
            let fft = ScalarFftImpl::<T>::default();
            fft.fft(&mut a)?;
            fft.fft(&mut b)?;
            for (ai, &bi) in a.iter_mut().zip(&b) {
                *ai = ai.mul(bi);
            }
            for c in a.iter_mut() {
                c.im = -c.im;
            }
            fft.fft(&mut a)?;
            for c in a.iter_mut() {
                c.im = -c.im;
            }
            let scale = T::one() / T::from_f32(m as f32);
            for c in a.iter_mut() {
                c.re = c.re * scale;
                c.im = c.im * scale;
            }
            for (i, out) in input.iter_mut().take(n).enumerate() {
                let angle = T::pi() * T::from_f32((i * i) as f32) / T::from_f32(n as f32);
                let w = Complex::expi(-angle);
                *out = a[i].mul(w);
            }
            Ok(())
        }
    }
    fn ifft(&self, input: &mut [Complex<T>]) -> Result<(), FftError> {
        let n = input.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n == 1 {
            return Ok(());
        }
        #[cfg(feature = "parallel")]
        {
            if n >= PARALLEL_FFT_THRESHOLD
                && core::any::TypeId::of::<T>() == core::any::TypeId::of::<f32>()
            {
                let input32 = unsafe { &mut *(input as *mut [Complex<T>] as *mut [Complex32]) };
                input32.par_iter_mut().for_each(|c| c.im = -c.im);
                self.fft(input)?;
                let scale = 1.0 / n as f32;
                input32.par_iter_mut().for_each(|c| {
                    c.im = -c.im;
                    c.re *= scale;
                    c.im *= scale;
                });
                return Ok(());
            }
        }
        for c in input.iter_mut() {
            c.im = -c.im;
        }
        self.fft(input)?;
        let scale = T::one() / T::from_f32(n as f32);
        for c in input.iter_mut() {
            c.im = -c.im;
            c.re = c.re * scale;
            c.im = c.im * scale;
        }
        Ok(())
    }
    fn fft_strided(&self, input: &mut [Complex<T>], stride: usize) -> Result<(), FftError> {
        if stride == 0 || input.len() % stride != 0 {
            return Err(FftError::InvalidStride);
        }
        let n = input.len() / stride;
        let mut buf = alloc::vec::Vec::with_capacity(n);
        for i in 0..n {
            buf.push(input[i * stride]);
        }
        self.fft(&mut buf)?;
        for i in 0..n {
            input[i * stride] = buf[i];
        }
        Ok(())
    }
    fn ifft_strided(&self, input: &mut [Complex<T>], stride: usize) -> Result<(), FftError> {
        if stride == 0 || input.len() % stride != 0 {
            return Err(FftError::InvalidStride);
        }
        let n = input.len() / stride;
        let mut buf = alloc::vec::Vec::with_capacity(n);
        for i in 0..n {
            buf.push(input[i * stride]);
        }
        self.ifft(&mut buf)?;
        for i in 0..n {
            input[i * stride] = buf[i];
        }
        Ok(())
    }
    fn fft_out_of_place_strided(
        &self,
        input: &[Complex<T>],
        in_stride: usize,
        output: &mut [Complex<T>],
        out_stride: usize,
    ) -> Result<(), FftError> {
        if in_stride == 0 || out_stride == 0 {
            return Err(FftError::InvalidStride);
        }
        if input.len() % in_stride != 0 || output.len() % out_stride != 0 {
            return Err(FftError::InvalidStride);
        }
        let n = input.len() / in_stride;
        if output.len() / out_stride != n {
            return Err(FftError::MismatchedLengths);
        }
        let mut buf = alloc::vec::Vec::with_capacity(n);
        for i in 0..n {
            buf.push(input[i * in_stride]);
        }
        self.fft(&mut buf)?;
        for i in 0..n {
            output[i * out_stride] = buf[i];
        }
        Ok(())
    }
    fn ifft_out_of_place_strided(
        &self,
        input: &[Complex<T>],
        in_stride: usize,
        output: &mut [Complex<T>],
        out_stride: usize,
    ) -> Result<(), FftError> {
        if in_stride == 0 || out_stride == 0 {
            return Err(FftError::InvalidStride);
        }
        if input.len() % in_stride != 0 || output.len() % out_stride != 0 {
            return Err(FftError::InvalidStride);
        }
        let n = input.len() / in_stride;
        if output.len() / out_stride != n {
            return Err(FftError::MismatchedLengths);
        }
        let mut buf = alloc::vec::Vec::with_capacity(n);
        for i in 0..n {
            buf.push(input[i * in_stride]);
        }
        self.ifft(&mut buf)?;
        for i in 0..n {
            output[i * out_stride] = buf[i];
        }
        Ok(())
    }
    fn fft_with_strategy(
        &self,
        input: &mut [Complex<T>],
        strategy: FftStrategy,
    ) -> Result<(), FftError> {
        let n = input.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n == 1 {
            return Ok(());
        }
        let chosen = if strategy == FftStrategy::Auto {
            self.planner.borrow_mut().plan_strategy(n)
        } else {
            strategy
        };
        match chosen {
            FftStrategy::Radix2 => self.fft(input),
            FftStrategy::Radix4 => self.fft_radix4(input),
            FftStrategy::Auto => self.fft(input),
        }
    }
}

#[cfg(feature = "std")]
impl<T: Float> ScalarFftImpl<T> {
    pub fn fft_vec(&self, input: &[Complex<T>]) -> Result<alloc::vec::Vec<Complex<T>>, FftError> {
        let mut out = alloc::vec::Vec::from(input);
        self.fft(&mut out)?;
        Ok(out)
    }
    pub fn ifft_vec(&self, input: &[Complex<T>]) -> Result<alloc::vec::Vec<Complex<T>>, FftError> {
        let mut out = alloc::vec::Vec::from(input);
        self.ifft(&mut out)?;
        Ok(out)
    }

    pub fn fft_radix4(&self, input: &mut [Complex<T>]) -> Result<(), FftError> {
        // Fallback to general FFT implementation for correctness
        self.fft(input)
    }
}

#[cfg(feature = "std")]
pub struct TwiddleFactorBuffer {
    pub n: usize,
    pub twiddles: alloc::vec::Vec<Complex32>,
}

#[cfg(feature = "std")]
impl TwiddleFactorBuffer {
    pub fn new(n: usize) -> Self {
        let mut twiddles = alloc::vec::Vec::with_capacity(n / 2);
        for k in 0..(n / 2) {
            let ang = -2.0 * PI * (k as f32) / (n as f32);
            twiddles.push(Complex32::expi(ang));
        }
        Self { n, twiddles }
    }
    pub fn get(&self, k: usize) -> Complex32 {
        let half = self.n / 2;
        let base = self.twiddles[k % half];
        if k >= half {
            Complex32::new(-base.re, -base.im)
        } else {
            base
        }
    }
}

fn factorize(mut n: usize) -> alloc::vec::Vec<usize> {
    let mut factors = alloc::vec::Vec::new();
    for &p in &[2, 3, 5] {
        while n % p == 0 {
            factors.push(p);
            n /= p;
        }
    }
    let mut f = 7;
    while f * f <= n {
        while n % f == 0 {
            factors.push(f);
            n /= f;
        }
        f += 2;
    }
    if n > 1 {
        factors.push(n);
    }
    factors
}

#[inline(always)]
fn butterfly4<T: Float>(
    a: Complex<T>,
    b: Complex<T>,
    c: Complex<T>,
    d: Complex<T>,
) -> (Complex<T>, Complex<T>, Complex<T>, Complex<T>) {
    let t0 = a.add(c);
    let t1 = a.sub(c);
    let t2 = b.add(d);
    let t3 = (b.sub(d)).mul(Complex::new(T::zero(), -T::one()));
    (t0.add(t2), t1.add(t3), t0.sub(t2), t1.sub(t3))
}

#[inline(always)]
#[allow(dead_code, clippy::too_many_arguments)]
fn butterfly8<T: Float>(
    x0: Complex<T>,
    x1: Complex<T>,
    x2: Complex<T>,
    x3: Complex<T>,
    x4: Complex<T>,
    x5: Complex<T>,
    x6: Complex<T>,
    x7: Complex<T>,
) -> [Complex<T>; 8] {
    let (e0, e1, e2, e3) = butterfly4(x0, x2, x4, x6);
    let (o0, mut o1, mut o2, mut o3) = butterfly4(x1, x3, x5, x7);
    let sqrt1_2 = T::from_f32(core::f32::consts::FRAC_1_SQRT_2);
    let w1 = Complex::new(sqrt1_2, -sqrt1_2);
    let w2 = Complex::new(T::zero(), -T::one());
    let w3 = Complex::new(-sqrt1_2, -sqrt1_2);
    o1 = o1.mul(w1);
    o2 = o2.mul(w2);
    o3 = o3.mul(w3);
    [
        e0.add(o0),
        e1.add(o1),
        e2.add(o2),
        e3.add(o3),
        e0.sub(o0),
        e1.sub(o1),
        e2.sub(o2),
        e3.sub(o3),
    ]
}

impl ScalarFftImpl<f32> {
    #[cfg(feature = "std")]
    pub fn fft_radix2_with_twiddles(
        &self,
        input: &mut [Complex32],
        twiddles: &TwiddleFactorBuffer,
    ) -> Result<(), FftError> {
        let n = input.len();
        let mut j = 0;
        for i in 1..n {
            let mut bit = n >> 1;
            while j & bit != 0 {
                j ^= bit;
                bit >>= 1;
            }
            j ^= bit;
            if i < j {
                input.swap(i, j);
            }
        }
        let mut len = 2;
        while len <= n {
            let mut i = 0;
            while i < n {
                for (w_idx, j) in (0..(len / 2)).enumerate() {
                    let w = twiddles.get(w_idx * n / len);
                    let u = input[i + j];
                    let v = input[i + j + len / 2].mul(w);
                    input[i + j] = u.add(v);
                    input[i + j + len / 2] = u.sub(v);
                }
                i += len;
            }
            len <<= 1;
        }
        Ok(())
    }
    #[cfg(feature = "std")]
    pub fn fft_radix4_with_twiddles(
        &self,
        input: &mut [Complex32],
        twiddles: &TwiddleFactorBuffer,
    ) -> Result<(), FftError> {
        let n = input.len();
        if !n.is_power_of_two() || n.trailing_zeros() % 2 != 0 {
            // Not a power of 4, fallback to radix-2
            return self.fft_radix2_with_twiddles(input, twiddles);
        }
        // Bit-reversal for radix-4
        let mut j = 0;
        for i in 1..n {
            let mut bit = n >> 2;
            while j & bit != 0 {
                j ^= bit;
                bit >>= 2;
            }
            j ^= bit;
            if i < j {
                input.swap(i, j);
            }
        }
        let mut len = 4;
        while len <= n {
            let mut i = 0;
            while i < n {
                for (w_idx, j) in (0..(len / 4)).enumerate() {
                    let w1 = twiddles.get(w_idx * n / len);
                    let w2 = twiddles.get(w_idx * 2 * n / len);
                    let w3 = twiddles.get(w_idx * 3 * n / len);
                    let a = input[i + j];
                    let b = input[i + j + len / 4].mul(w1);
                    let c = input[i + j + len / 2].mul(w2);
                    let d = input[i + j + 3 * len / 4].mul(w3);
                    let (x0, x1, x2, x3) = butterfly4(a, b, c, d);
                    input[i + j] = x0;
                    input[i + j + len / 4] = x1;
                    input[i + j + len / 2] = x2;
                    input[i + j + 3 * len / 4] = x3;
                }
                i += len;
            }
            len <<= 2;
        }
        Ok(())
    }
    #[cfg(feature = "std")]
    pub fn fft_mixed_radix_with_twiddles(
        &self,
        input: &mut [Complex32],
        twiddles: &TwiddleFactorBuffer,
    ) -> Result<(), FftError> {
        let n = input.len();
        let factors = factorize(n);
        if factors.iter().all(|&f| f == 2 || f == 4) {
            if factors.iter().all(|&f| f == 4) {
                self.fft_radix4_with_twiddles(input, twiddles)
            } else {
                self.fft_radix2_with_twiddles(input, twiddles)
            }
        } else {
            self.fft(input)
        }
    }
    pub fn fft_mixed_radix(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        let n = input.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n == 1 {
            return Ok(());
        }
        let factors = factorize(n);
        if factors.iter().all(|&f| f == 2 || f == 4) {
            // Use radix-2/radix-4 as appropriate
            if factors.iter().all(|&f| f == 4) {
                self.fft_radix4(input)
            } else {
                self.fft_radix2(input)
            }
        } else {
            // Fallback to Bluestein's for unsupported factors
            self.fft(input)
        }
    }
    fn fft_radix2(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        let n = input.len();
        let mut j = 0;
        for i in 1..n {
            let mut bit = n >> 1;
            while j & bit != 0 {
                j ^= bit;
                bit >>= 1;
            }
            j ^= bit;
            if i < j {
                input.swap(i, j);
            }
        }
        let mut len = 2;
        while len <= n {
            let mut i = 0;
            if len == 2 {
                while i < n {
                    // Unrolled butterfly for len=2
                    let u = input[i];
                    let v = input[i + 1];
                    input[i] = u.add(v);
                    input[i + 1] = u.sub(v);
                    i += len;
                }
            } else if len == 4 {
                while i < n {
                    // Unrolled butterfly for len=4
                    let (x0, x1, x2, x3) =
                        butterfly4(input[i], input[i + 1], input[i + 2], input[i + 3]);
                    input[i] = x0;
                    input[i + 1] = x1;
                    input[i + 2] = x2;
                    input[i + 3] = x3;
                    i += len;
                }
            } else {
                let stage = self.planner.borrow_mut().get_stage_twiddles(n, len);
                while i < n {
                    for j in 0..(len / 2) {
                        let w = stage[j];
                        let u = input[i + j];
                        let v = input[i + j + len / 2].mul(w);
                        input[i + j] = u.add(v);
                        input[i + j + len / 2] = u.sub(v);
                    }
                    i += len;
                }
            }
            len <<= 1;
        }
        // For very large n, consider block/tiled FFTs for cache locality (future optimization)
        Ok(())
    }
}

// SIMD FFT implementations (feature-gated)

// x86_64 SIMD implementations
#[cfg(all(
    target_arch = "x86_64",
    any(
        feature = "x86_64",
        feature = "sse",
        target_feature = "avx2",
        target_feature = "sse2"
    )
))]
use core::arch::x86_64::*;

// x86_64 AVX2/FMA
#[cfg(all(
    target_arch = "x86_64",
    any(feature = "x86_64", target_feature = "avx2")
))]
pub struct SimdFftX86_64Impl;
#[cfg(all(
    target_arch = "x86_64",
    any(feature = "x86_64", target_feature = "avx2")
))]
impl FftImpl<f32> for SimdFftX86_64Impl {
    fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        let n = input.len();
        if n <= 1 {
            return Ok(());
        }
        // SIMD-accelerated bit-reversal permutation for n >= 8
        let aligned = (input.as_ptr() as usize) % 32 == 0;
        if n >= 8 {
            unsafe {
                let mut j = 0;
                let mut i = 1;
                while i + 7 < n {
                    let mut bit = n >> 1;
                    while j & bit != 0 {
                        j ^= bit;
                        bit >>= 1;
                    }
                    j ^= bit;
                    if i < j {
                        let ptr_i = input.as_mut_ptr().add(i);
                        let ptr_j = input.as_mut_ptr().add(j);
                        if aligned {
                            let re_i = _mm256_load_ps(ptr_i as *const f32);
                            let im_i = _mm256_load_ps(ptr_i.add(1) as *const f32);
                            let re_j = _mm256_load_ps(ptr_j as *const f32);
                            let im_j = _mm256_load_ps(ptr_j.add(1) as *const f32);
                            _mm256_store_ps(ptr_i as *mut f32, re_j);
                            _mm256_store_ps(ptr_i.add(1) as *mut f32, im_j);
                            _mm256_store_ps(ptr_j as *mut f32, re_i);
                            _mm256_store_ps(ptr_j.add(1) as *mut f32, im_i);
                        } else {
                            let re_i = _mm256_loadu_ps(ptr_i as *const f32);
                            let im_i = _mm256_loadu_ps(ptr_i.add(1) as *const f32);
                            let re_j = _mm256_loadu_ps(ptr_j as *const f32);
                            let im_j = _mm256_loadu_ps(ptr_j.add(1) as *const f32);
                            _mm256_storeu_ps(ptr_i as *mut f32, re_j);
                            _mm256_storeu_ps(ptr_i.add(1) as *mut f32, im_j);
                            _mm256_storeu_ps(ptr_j as *mut f32, re_i);
                            _mm256_storeu_ps(ptr_j.add(1) as *mut f32, im_i);
                        }
                    }
                    i += 8;
                }
                for k in i..n {
                    let mut bit = n >> 1;
                    while j & bit != 0 {
                        j ^= bit;
                        bit >>= 1;
                    }
                    j ^= bit;
                    if k < j {
                        input.swap(k, j);
                    }
                }
            }
        } else {
            // Scalar bit-reversal
            let mut j = 0;
            for i in 1..n {
                let mut bit = n >> 1;
                while j & bit != 0 {
                    j ^= bit;
                    bit >>= 1;
                }
                j ^= bit;
                if i < j {
                    input.swap(i, j);
                }
            }
        }
        // Only use SIMD for lengths that are multiples of 4
        if n % 4 != 0 {
            let scalar = ScalarFftImpl::<f32>::default();
            scalar.fft(input)?;
            return Ok(());
        }
        unsafe {
            let mut len = 2;
            while len <= n {
                let ang = -2.0 * PI / (len as f32);
                let wlen = Complex32::expi(ang);
                let mut i = 0;
                while i < n {
                    let mut w = Complex32::new(1.0, 0.0);
                    let half = len / 2;
                    let simd_width = 4;
                    let simd_iters = half / simd_width;
                    for s in 0..simd_iters {
                        let j = s * simd_width;
                        let mut w_re = [0.0f32; 4];
                        let mut w_im = [0.0f32; 4];
                        let mut wj = w;
                        for k in 0..simd_width {
                            w_re[k] = wj.re;
                            w_im[k] = wj.im;
                            wj = wj.mul(wlen);
                        }
                        let w_re_v = if aligned {
                            _mm_load_ps(w_re.as_ptr())
                        } else {
                            _mm_loadu_ps(w_re.as_ptr())
                        };
                        let w_im_v = if aligned {
                            _mm_load_ps(w_im.as_ptr())
                        } else {
                            _mm_loadu_ps(w_im.as_ptr())
                        };
                        let u_re = if aligned {
                            _mm_load_ps(&input[i + j].re as *const f32)
                        } else {
                            _mm_loadu_ps(&input[i + j].re as *const f32)
                        };
                        let u_im = if aligned {
                            _mm_load_ps(&input[i + j].im as *const f32)
                        } else {
                            _mm_loadu_ps(&input[i + j].im as *const f32)
                        };
                        let v_re = if aligned {
                            _mm_load_ps(&input[i + j + half].re as *const f32)
                        } else {
                            _mm_loadu_ps(&input[i + j + half].re as *const f32)
                        };
                        let v_im = if aligned {
                            _mm_load_ps(&input[i + j + half].im as *const f32)
                        } else {
                            _mm_loadu_ps(&input[i + j + half].im as *const f32)
                        };
                        let t1 = _mm_mul_ps(v_re, w_re_v);
                        let t2 = _mm_mul_ps(v_im, w_im_v);
                        let t3 = _mm_mul_ps(v_re, w_im_v);
                        let t4 = _mm_mul_ps(v_im, w_re_v);
                        let vw_re = _mm_sub_ps(t1, t2);
                        let vw_im = _mm_add_ps(t3, t4);
                        let out_re = _mm_add_ps(u_re, vw_re);
                        let out_im = _mm_add_ps(u_im, vw_im);
                        let out2_re = _mm_sub_ps(u_re, vw_re);
                        let out2_im = _mm_sub_ps(u_im, vw_im);
                        if aligned {
                            _mm_store_ps(&mut input[i + j].re as *mut f32, out_re);
                            _mm_store_ps(&mut input[i + j].im as *mut f32, out_im);
                            _mm_store_ps(&mut input[i + j + half].re as *mut f32, out2_re);
                            _mm_store_ps(&mut input[i + j + half].im as *mut f32, out2_im);
                        } else {
                            _mm_storeu_ps(&mut input[i + j].re as *mut f32, out_re);
                            _mm_storeu_ps(&mut input[i + j].im as *mut f32, out_im);
                            _mm_storeu_ps(&mut input[i + j + half].re as *mut f32, out2_re);
                            _mm_storeu_ps(&mut input[i + j + half].im as *mut f32, out2_im);
                        }
                        for _ in 0..simd_width {
                            w = w.mul(wlen);
                        }
                    }
                    for j in (simd_iters * simd_width)..half {
                        let u = input[i + j];
                        let v = input[i + j + half].mul(w);
                        input[i + j] = u.add(v);
                        input[i + j + half] = u.sub(v);
                        w = w.mul(wlen);
                    }
                    i += len;
                }
                len <<= 1;
            }
        }
        Ok(())
    }
    fn ifft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        // Fallback to scalar for now
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft(input)?;
        Ok(())
    }

    fn fft_strided(&self, input: &mut [Complex32], stride: usize) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_strided(input, stride)
    }

    fn ifft_strided(&self, input: &mut [Complex32], stride: usize) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_strided(input, stride)
    }

    fn fft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_out_of_place_strided(input, in_stride, output, out_stride)
    }

    fn ifft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_out_of_place_strided(input, in_stride, output, out_stride)
    }

    fn fft_with_strategy(
        &self,
        input: &mut [Complex32],
        strategy: FftStrategy,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_with_strategy(input, strategy)
    }
}

// x86_64 SSE SIMD implementation
#[cfg(all(target_arch = "x86_64", any(feature = "sse", target_feature = "sse2")))]
pub struct SimdFftSseImpl;
#[cfg(all(target_arch = "x86_64", any(feature = "sse", target_feature = "sse2")))]
impl FftImpl<f32> for SimdFftSseImpl {
    fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        let n = input.len();
        if n <= 1 {
            return Ok(());
        }
        let aligned = (input.as_ptr() as usize) % 16 == 0;
        if n >= 4 {
            unsafe {
                let mut j = 0;
                let mut i = 1;
                while i + 3 < n {
                    let mut bit = n >> 1;
                    while j & bit != 0 {
                        j ^= bit;
                        bit >>= 1;
                    }
                    j ^= bit;
                    if i < j {
                        let ptr_i = input.as_mut_ptr().add(i);
                        let ptr_j = input.as_mut_ptr().add(j);
                        if aligned {
                            let re_i = _mm_load_ps(ptr_i as *const f32);
                            let im_i = _mm_load_ps(ptr_i.add(1) as *const f32);
                            let re_j = _mm_load_ps(ptr_j as *const f32);
                            let im_j = _mm_load_ps(ptr_j.add(1) as *const f32);
                            _mm_store_ps(ptr_i as *mut f32, re_j);
                            _mm_store_ps(ptr_i.add(1) as *mut f32, im_j);
                            _mm_store_ps(ptr_j as *mut f32, re_i);
                            _mm_store_ps(ptr_j.add(1) as *mut f32, im_i);
                        } else {
                            let re_i = _mm_loadu_ps(ptr_i as *const f32);
                            let im_i = _mm_loadu_ps(ptr_i.add(1) as *const f32);
                            let re_j = _mm_loadu_ps(ptr_j as *const f32);
                            let im_j = _mm_loadu_ps(ptr_j.add(1) as *const f32);
                            _mm_storeu_ps(ptr_i as *mut f32, re_j);
                            _mm_storeu_ps(ptr_i.add(1) as *mut f32, im_j);
                            _mm_storeu_ps(ptr_j as *mut f32, re_i);
                            _mm_storeu_ps(ptr_j.add(1) as *mut f32, im_i);
                        }
                    }
                    i += 4;
                }
                for k in i..n {
                    let mut bit = n >> 1;
                    while j & bit != 0 {
                        j ^= bit;
                        bit >>= 1;
                    }
                    j ^= bit;
                    if k < j {
                        input.swap(k, j);
                    }
                }
            }
        } else {
            let mut j = 0;
            for i in 1..n {
                let mut bit = n >> 1;
                while j & bit != 0 {
                    j ^= bit;
                    bit >>= 1;
                }
                j ^= bit;
                if i < j {
                    input.swap(i, j);
                }
            }
        }
        if n % 4 != 0 {
            let scalar = ScalarFftImpl::<f32>::default();
            scalar.fft(input)?;
            return Ok(());
        }
        unsafe {
            let mut len = 2;
            while len <= n {
                let ang = -2.0 * PI / (len as f32);
                let wlen = Complex32::expi(ang);
                let mut i = 0;
                while i < n {
                    let mut w = Complex32::new(1.0, 0.0);
                    let half = len / 2;
                    let simd_width = 4;
                    let simd_iters = half / simd_width;
                    for s in 0..simd_iters {
                        let j = s * simd_width;
                        let mut w_re = [0.0f32; 4];
                        let mut w_im = [0.0f32; 4];
                        let mut wj = w;
                        for k in 0..simd_width {
                            w_re[k] = wj.re;
                            w_im[k] = wj.im;
                            wj = wj.mul(wlen);
                        }
                        let w_re_v = _mm_loadu_ps(w_re.as_ptr());
                        let w_im_v = _mm_loadu_ps(w_im.as_ptr());
                        let u_re = if aligned {
                            _mm_load_ps(&input[i + j].re as *const f32)
                        } else {
                            _mm_loadu_ps(&input[i + j].re as *const f32)
                        };
                        let u_im = if aligned {
                            _mm_load_ps(&input[i + j].im as *const f32)
                        } else {
                            _mm_loadu_ps(&input[i + j].im as *const f32)
                        };
                        let v_re = if aligned {
                            _mm_load_ps(&input[i + j + half].re as *const f32)
                        } else {
                            _mm_loadu_ps(&input[i + j + half].re as *const f32)
                        };
                        let v_im = if aligned {
                            _mm_load_ps(&input[i + j + half].im as *const f32)
                        } else {
                            _mm_loadu_ps(&input[i + j + half].im as *const f32)
                        };
                        let t1 = _mm_mul_ps(v_re, w_re_v);
                        let t2 = _mm_mul_ps(v_im, w_im_v);
                        let t3 = _mm_mul_ps(v_re, w_im_v);
                        let t4 = _mm_mul_ps(v_im, w_re_v);
                        let vw_re = _mm_sub_ps(t1, t2);
                        let vw_im = _mm_add_ps(t3, t4);
                        let out_re = _mm_add_ps(u_re, vw_re);
                        let out_im = _mm_add_ps(u_im, vw_im);
                        let out2_re = _mm_sub_ps(u_re, vw_re);
                        let out2_im = _mm_sub_ps(u_im, vw_im);
                        if aligned {
                            _mm_store_ps(&mut input[i + j].re as *mut f32, out_re);
                            _mm_store_ps(&mut input[i + j].im as *mut f32, out_im);
                            _mm_store_ps(&mut input[i + j + half].re as *mut f32, out2_re);
                            _mm_store_ps(&mut input[i + j + half].im as *mut f32, out2_im);
                        } else {
                            _mm_storeu_ps(&mut input[i + j].re as *mut f32, out_re);
                            _mm_storeu_ps(&mut input[i + j].im as *mut f32, out_im);
                            _mm_storeu_ps(&mut input[i + j + half].re as *mut f32, out2_re);
                            _mm_storeu_ps(&mut input[i + j + half].im as *mut f32, out2_im);
                        }
                        for _ in 0..simd_width {
                            w = w.mul(wlen);
                        }
                    }
                    for j in (simd_iters * simd_width)..half {
                        let u = input[i + j];
                        let v = input[i + j + half].mul(w);
                        input[i + j] = u.add(v);
                        input[i + j + half] = u.sub(v);
                        w = w.mul(wlen);
                    }
                    i += len;
                }
                len <<= 1;
            }
        }
        Ok(())
    }

    fn ifft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft(input)?;
        Ok(())
    }

    fn fft_strided(&self, input: &mut [Complex32], stride: usize) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_strided(input, stride)
    }

    fn ifft_strided(&self, input: &mut [Complex32], stride: usize) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_strided(input, stride)
    }

    fn fft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_out_of_place_strided(input, in_stride, output, out_stride)
    }

    fn ifft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_out_of_place_strided(input, in_stride, output, out_stride)
    }

    fn fft_with_strategy(
        &self,
        input: &mut [Complex32],
        strategy: FftStrategy,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_with_strategy(input, strategy)
    }
}

// AArch64 NEON SIMD implementation
#[cfg(all(
    target_arch = "aarch64",
    any(feature = "aarch64", target_feature = "neon")
))]
use core::arch::aarch64::*;

// AArch64 NEON
#[cfg(all(
    target_arch = "aarch64",
    any(feature = "aarch64", target_feature = "neon")
))]
pub struct SimdFftAArch64Impl;
#[cfg(all(
    target_arch = "aarch64",
    any(feature = "aarch64", target_feature = "neon")
))]
impl FftImpl<f32> for SimdFftAArch64Impl {
    fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        let n = input.len();
        if n <= 1 {
            return Ok(());
        }
        let aligned = (input.as_ptr() as usize) % 16 == 0;
        if n >= 4 {
            unsafe {
                let mut j = 0;
                let mut i = 1;
                while i + 3 < n {
                    let mut bit = n >> 1;
                    while j & bit != 0 {
                        j ^= bit;
                        bit >>= 1;
                    }
                    j ^= bit;
                    if i < j {
                        let ptr_i = input.as_mut_ptr().add(i);
                        let ptr_j = input.as_mut_ptr().add(j);
                        if aligned {
                            let re_i = vld1q_f32(ptr_i as *const f32);
                            let im_i = vld1q_f32(ptr_i.add(1) as *const f32);
                            let re_j = vld1q_f32(ptr_j as *const f32);
                            let im_j = vld1q_f32(ptr_j.add(1) as *const f32);
                            vst1q_f32(ptr_i as *mut f32, re_j);
                            vst1q_f32(ptr_i.add(1) as *mut f32, im_j);
                            vst1q_f32(ptr_j as *mut f32, re_i);
                            vst1q_f32(ptr_j.add(1) as *mut f32, im_i);
                        } else {
                            let re_i = vld1q_f32(ptr_i as *const f32);
                            let im_i = vld1q_f32(ptr_i.add(1) as *const f32);
                            let re_j = vld1q_f32(ptr_j as *const f32);
                            let im_j = vld1q_f32(ptr_j.add(1) as *const f32);
                            vst1q_f32(ptr_i as *mut f32, re_j);
                            vst1q_f32(ptr_i.add(1) as *mut f32, im_j);
                            vst1q_f32(ptr_j as *mut f32, re_i);
                            vst1q_f32(ptr_j.add(1) as *mut f32, im_i);
                        }
                    }
                    i += 4;
                }
                for k in i..n {
                    let mut bit = n >> 1;
                    while j & bit != 0 {
                        j ^= bit;
                        bit >>= 1;
                    }
                    j ^= bit;
                    if k < j {
                        input.swap(k, j);
                    }
                }
            }
        } else {
            let mut j = 0;
            for i in 1..n {
                let mut bit = n >> 1;
                while j & bit != 0 {
                    j ^= bit;
                    bit >>= 1;
                }
                j ^= bit;
                if i < j {
                    input.swap(i, j);
                }
            }
        }
        if n % 4 != 0 {
            let scalar = ScalarFftImpl::<f32>::default();
            scalar.fft(input)?;
            return Ok(());
        }
        unsafe {
            let mut len = 2;
            while len <= n {
                let ang = -2.0 * PI / (len as f32);
                let wlen = Complex32::expi(ang);
                let mut i = 0;
                while i < n {
                    let mut w = Complex32::new(1.0, 0.0);
                    let half = len / 2;
                    let simd_width = 4;
                    let simd_iters = half / simd_width;
                    for s in 0..simd_iters {
                        let j = s * simd_width;
                        let mut w_re = [0.0f32; 4];
                        let mut w_im = [0.0f32; 4];
                        let mut wj = w;
                        for k in 0..simd_width {
                            w_re[k] = wj.re;
                            w_im[k] = wj.im;
                            wj = wj.mul(wlen);
                        }
                        let w_re_v = vld1q_f32(w_re.as_ptr());
                        let w_im_v = vld1q_f32(w_im.as_ptr());
                        let u_re = vld1q_f32(&input[i + j].re as *const f32);
                        let u_im = vld1q_f32(&input[i + j].im as *const f32);
                        let v_re = vld1q_f32(&input[i + j + half].re as *const f32);
                        let v_im = vld1q_f32(&input[i + j + half].im as *const f32);
                        let t1 = vmulq_f32(v_re, w_re_v);
                        let t2 = vmulq_f32(v_im, w_im_v);
                        let t3 = vmulq_f32(v_re, w_im_v);
                        let t4 = vmulq_f32(v_im, w_re_v);
                        let vw_re = vsubq_f32(t1, t2);
                        let vw_im = vaddq_f32(t3, t4);
                        let out_re = vaddq_f32(u_re, vw_re);
                        let out_im = vaddq_f32(u_im, vw_im);
                        let out2_re = vsubq_f32(u_re, vw_re);
                        let out2_im = vsubq_f32(u_im, vw_im);
                        vst1q_f32(&mut input[i + j].re as *mut f32, out_re);
                        vst1q_f32(&mut input[i + j].im as *mut f32, out_im);
                        vst1q_f32(&mut input[i + j + half].re as *mut f32, out2_re);
                        vst1q_f32(&mut input[i + j + half].im as *mut f32, out2_im);
                        for _ in 0..simd_width {
                            w = w.mul(wlen);
                        }
                    }
                    for j in (simd_iters * simd_width)..half {
                        let u = input[i + j];
                        let v = input[i + j + half].mul(w);
                        input[i + j] = u.add(v);
                        input[i + j + half] = u.sub(v);
                        w = w.mul(wlen);
                    }
                    i += len;
                }
                len <<= 1;
            }
        }
        Ok(())
    }
    fn ifft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft(input)?;
        Ok(())
    }

    fn fft_strided(&self, input: &mut [Complex32], stride: usize) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_strided(input, stride)
    }

    fn ifft_strided(&self, input: &mut [Complex32], stride: usize) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_strided(input, stride)
    }

    fn fft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_out_of_place_strided(input, in_stride, output, out_stride)
    }

    fn ifft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_out_of_place_strided(input, in_stride, output, out_stride)
    }

    fn fft_with_strategy(
        &self,
        input: &mut [Complex32],
        strategy: FftStrategy,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_with_strategy(input, strategy)
    }
}

// WebAssembly SIMD implementation
#[cfg(all(
    target_arch = "wasm32",
    any(feature = "wasm", target_feature = "simd128")
))]
use core::arch::wasm32::*;

#[cfg(all(
    target_arch = "wasm32",
    any(feature = "wasm", target_feature = "simd128")
))]
pub struct SimdFftWasmImpl;
#[cfg(all(
    target_arch = "wasm32",
    any(feature = "wasm", target_feature = "simd128")
))]
impl FftImpl<f32> for SimdFftWasmImpl {
    fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        let n = input.len();
        if n <= 1 {
            return Ok(());
        }
        let aligned = (input.as_ptr() as usize) % 16 == 0;
        if n >= 4 {
            unsafe {
                let mut j = 0;
                let mut i = 1;
                while i + 3 < n {
                    let mut bit = n >> 1;
                    while j & bit != 0 {
                        j ^= bit;
                        bit >>= 1;
                    }
                    j ^= bit;
                    if i < j {
                        let ptr_i = input.as_mut_ptr().add(i);
                        let ptr_j = input.as_mut_ptr().add(j);
                        let re_i = v128_load(ptr_i as *const v128);
                        let im_i = v128_load(ptr_i.add(1) as *const v128);
                        let re_j = v128_load(ptr_j as *const v128);
                        let im_j = v128_load(ptr_j.add(1) as *const v128);
                        v128_store(ptr_i as *mut v128, re_j);
                        v128_store(ptr_i.add(1) as *mut v128, im_j);
                        v128_store(ptr_j as *mut v128, re_i);
                        v128_store(ptr_j.add(1) as *mut v128, im_i);
                    }
                    i += 4;
                }
                for k in i..n {
                    let mut bit = n >> 1;
                    while j & bit != 0 {
                        j ^= bit;
                        bit >>= 1;
                    }
                    j ^= bit;
                    if k < j {
                        input.swap(k, j);
                    }
                }
            }
        } else {
            let mut j = 0;
            for i in 1..n {
                let mut bit = n >> 1;
                while j & bit != 0 {
                    j ^= bit;
                    bit >>= 1;
                }
                j ^= bit;
                if i < j {
                    input.swap(i, j);
                }
            }
        }
        if n % 4 != 0 {
            let scalar = ScalarFftImpl::<f32>::default();
            scalar.fft(input)?;
            return Ok(());
        }
        unsafe {
            let mut len = 2;
            while len <= n {
                let ang = -2.0 * PI / (len as f32);
                let wlen = Complex32::expi(ang);
                let mut i = 0;
                while i < n {
                    let mut w = Complex32::new(1.0, 0.0);
                    let half = len / 2;
                    let simd_width = 4;
                    let simd_iters = half / simd_width;
                    for s in 0..simd_iters {
                        let j = s * simd_width;
                        let mut w_re = [0.0f32; 4];
                        let mut w_im = [0.0f32; 4];
                        let mut wj = w;
                        for k in 0..simd_width {
                            w_re[k] = wj.re;
                            w_im[k] = wj.im;
                            wj = wj.mul(wlen);
                        }
                        let w_re_v = v128_load(w_re.as_ptr() as *const v128);
                        let w_im_v = v128_load(w_im.as_ptr() as *const v128);
                        let u_re = v128_load(&input[i + j].re as *const f32 as *const v128);
                        let u_im = v128_load(&input[i + j].im as *const f32 as *const v128);
                        let v_re = v128_load(&input[i + j + half].re as *const f32 as *const v128);
                        let v_im = v128_load(&input[i + j + half].im as *const f32 as *const v128);
                        let t1 = f32x4_mul(v_re, w_re_v);
                        let t2 = f32x4_mul(v_im, w_im_v);
                        let t3 = f32x4_mul(v_re, w_im_v);
                        let t4 = f32x4_mul(v_im, w_re_v);
                        let vw_re = f32x4_sub(t1, t2);
                        let vw_im = f32x4_add(t3, t4);
                        let out_re = f32x4_add(u_re, vw_re);
                        let out_im = f32x4_add(u_im, vw_im);
                        let out2_re = f32x4_sub(u_re, vw_re);
                        let out2_im = f32x4_sub(u_im, vw_im);
                        v128_store(&mut input[i + j].re as *mut f32 as *mut v128, out_re);
                        v128_store(&mut input[i + j].im as *mut f32 as *mut v128, out_im);
                        v128_store(
                            &mut input[i + j + half].re as *mut f32 as *mut v128,
                            out2_re,
                        );
                        v128_store(
                            &mut input[i + j + half].im as *mut f32 as *mut v128,
                            out2_im,
                        );
                        for _ in 0..simd_width {
                            w = w.mul(wlen);
                        }
                    }
                    for j in (simd_iters * simd_width)..half {
                        let u = input[i + j];
                        let v = input[i + j + half].mul(w);
                        input[i + j] = u.add(v);
                        input[i + j + half] = u.sub(v);
                        w = w.mul(wlen);
                    }
                    i += len;
                }
                len <<= 1;
            }
        }
        Ok(())
    }
    fn ifft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft(input)?;
        Ok(())
    }

    fn fft_strided(&self, input: &mut [Complex32], stride: usize) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_strided(input, stride)
    }

    fn ifft_strided(&self, input: &mut [Complex32], stride: usize) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_strided(input, stride)
    }

    fn fft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_out_of_place_strided(input, in_stride, output, out_stride)
    }

    fn ifft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_out_of_place_strided(input, in_stride, output, out_stride)
    }

    fn fft_with_strategy(
        &self,
        input: &mut [Complex32],
        strategy: FftStrategy,
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_with_strategy(input, strategy)
    }
}

/// Returns the best available FFT implementation for the current platform and enabled features.
pub fn new_fft_impl() -> Box<dyn FftImpl<f32>> {
    #[cfg(all(
        target_arch = "x86_64",
        any(feature = "x86_64", target_feature = "avx2")
    ))]
    {
        return Box::new(SimdFftX86_64Impl);
    }
    #[cfg(all(target_arch = "x86_64", any(feature = "sse", target_feature = "sse2")))]
    {
        Box::new(SimdFftSseImpl)
    }
    #[cfg(all(
        target_arch = "aarch64",
        any(feature = "aarch64", target_feature = "neon")
    ))]
    {
        return Box::new(SimdFftAArch64Impl);
    }
    #[cfg(all(
        target_arch = "wasm32",
        any(feature = "wasm", target_feature = "simd128")
    ))]
    {
        return Box::new(SimdFftWasmImpl);
    }
    #[cfg(not(any(
        all(
            target_arch = "x86_64",
            any(feature = "x86_64", target_feature = "avx2")
        ),
        all(target_arch = "x86_64", any(feature = "sse", target_feature = "sse2")),
        all(
            target_arch = "aarch64",
            any(feature = "aarch64", target_feature = "neon")
        ),
        all(
            target_arch = "wasm32",
            any(feature = "wasm", target_feature = "simd128")
        )
    )))]
    {
        return Box::new(ScalarFftImpl::<f32>::default());
    }
}

/// Plan-based FFT: precompute twiddles and bit-reversal for repeated transforms.
#[cfg(feature = "std")]
pub struct FftPlan<T: Float> {
    pub n: usize,
    pub strategy: FftStrategy,
    pub twiddles: Option<TwiddleFactorBuffer>,
    pub fft: ScalarFftImpl<T>,
}

#[cfg(feature = "std")]
impl<T: Float> FftPlan<T> {
    /// Create a new FFT plan for size n and strategy (Radix2, Radix4, Auto)
    pub fn new(n: usize, strategy: FftStrategy) -> Self {
        let twiddles = if core::any::TypeId::of::<T>() == core::any::TypeId::of::<f32>() {
            Some(TwiddleFactorBuffer::new(n))
        } else {
            None
        };
        Self {
            n,
            strategy,
            twiddles,
            fft: ScalarFftImpl::<T>::default(),
        }
    }
    /// In-place FFT using the plan
    pub fn fft(&self, input: &mut [Complex<T>]) -> Result<(), FftError> {
        if input.len() != self.n {
            return Err(FftError::MismatchedLengths);
        }
        if core::any::TypeId::of::<T>() == core::any::TypeId::of::<f32>() {
            // Use generic implementation without specialized twiddles
            let _input32 = unsafe { &mut *(input as *mut [Complex<T>] as *mut [Complex32]) };
        }
        self.fft.fft_with_strategy(input, self.strategy)
    }
    /// In-place IFFT using the plan
    pub fn ifft(&self, input: &mut [Complex<T>]) -> Result<(), FftError> {
        if input.len() != self.n {
            return Err(FftError::MismatchedLengths);
        }
        for c in input.iter_mut() {
            c.im = -c.im;
        }
        self.fft(input)?;
        let scale = T::one() / T::from_f32(self.n as f32);
        for c in input.iter_mut() {
            c.im = -c.im;
            c.re = c.re * scale;
            c.im = c.im * scale;
        }
        Ok(())
    }
    /// Out-of-place FFT using the plan
    pub fn fft_out_of_place(
        &self,
        input: &[Complex<T>],
        output: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        if input.len() != self.n || output.len() != self.n {
            return Err(FftError::MismatchedLengths);
        }
        output.copy_from_slice(input);
        self.fft(output)
    }
    /// Out-of-place IFFT using the plan
    pub fn ifft_out_of_place(
        &self,
        input: &[Complex<T>],
        output: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        if input.len() != self.n || output.len() != self.n {
            return Err(FftError::MismatchedLengths);
        }
        output.copy_from_slice(input);
        self.ifft(output)
    }
}

/// Compute FFT using the default planner. When the `parallel` feature is
/// enabled and the input length exceeds a threshold, the transform is split
/// across threads using Rayon. Falls back to single-threaded execution when
/// Rayon is absent.
pub fn fft_parallel<T: Float>(input: &mut [Complex<T>]) -> Result<(), FftError> {
    ScalarFftImpl::<T>::default().fft(input)
}

/// Compute inverse FFT using the default planner. Parallelism is applied in
/// the same manner as [`fft_parallel`].
pub fn ifft_parallel<T: Float>(input: &mut [Complex<T>]) -> Result<(), FftError> {
    ScalarFftImpl::<T>::default().ifft(input)
}

/// Batch FFT: process a batch of mutable slices in-place
pub fn batch<T: Float, F: FftImpl<T>>(
    fft: &F,
    batches: &mut [Vec<Complex<T>>],
) -> Result<(), FftError> {
    for batch in batches.iter_mut() {
        fft.fft(batch)?;
    }
    Ok(())
}

/// Batch IFFT: process a batch of mutable slices in-place
pub fn batch_inverse<T: Float, F: FftImpl<T>>(
    fft: &F,
    batches: &mut [Vec<Complex<T>>],
) -> Result<(), FftError> {
    for batch in batches.iter_mut() {
        fft.ifft(batch)?;
    }
    Ok(())
}

/// Multi-channel FFT: process multiple real channels (e.g. audio)
pub fn multi_channel<T: Float, F: FftImpl<T>>(
    fft: &F,
    channels: &mut [Vec<Complex<T>>],
) -> Result<(), FftError> {
    batch(fft, channels)
}

/// Multi-channel IFFT: process multiple real channels (e.g. audio)
pub fn multi_channel_inverse<T: Float, F: FftImpl<T>>(
    fft: &F,
    channels: &mut [Vec<Complex<T>>],
) -> Result<(), FftError> {
    batch_inverse(fft, channels)
}

/// MCU/stack-only, const-generic, in-place FFT for power-of-two sizes (no heap, no alloc)
/// Note: All stack-only, const-generic APIs in this crate require the user to provide all output buffers.
/// This is a Rust limitation: you cannot allocate [T; N] for arbitrary N inside a function.
/// See dct2_inplace_stack, dst2_inplace_stack, haar_forward_inplace_stack, etc.
pub fn fft_inplace_stack<const N: usize>(buf: &mut [Complex<f32>; N]) -> Result<(), FftError> {
    if N == 0 {
        return Err(FftError::EmptyInput);
    }
    if N == 1 {
        return Ok(());
    }
    if N.count_ones() != 1 {
        // Only power-of-two supported for stack-only
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    // Bit-reversal permutation
    let mut j = 0;
    for i in 1..N {
        let mut bit = N >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if i < j {
            buf.swap(i, j);
        }
    }
    let mut len = 2;
    while len <= N {
        let ang = -2.0 * PI / (len as f32);
        let wlen = Complex32::expi(ang);
        let mut i = 0;
        while i < N {
            let mut w = Complex32::new(1.0, 0.0);
            for j in 0..(len / 2) {
                let u = buf[i + j];
                let v = buf[i + j + len / 2].mul(w);
                buf[i + j] = u.add(v);
                buf[i + j + len / 2] = u.sub(v);
                w = w.mul(wlen);
            }
            i += len;
        }
        len <<= 1;
    }
    Ok(())
}

/// MCU/stack-only, const-generic, in-place IFFT for power-of-two sizes (no heap, no alloc)
pub fn ifft_inplace_stack<const N: usize>(buf: &mut [Complex<f32>; N]) -> Result<(), FftError> {
    if N == 0 {
        return Err(FftError::EmptyInput);
    }
    if N == 1 {
        return Ok(());
    }
    if N.count_ones() != 1 {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    // Conjugate
    for c in buf.iter_mut() {
        c.im = -c.im;
    }
    fft_inplace_stack(buf)?;
    // Conjugate and scale
    let scale = 1.0 / (N as f32);
    for c in buf.iter_mut() {
        c.im = -c.im;
        c.re *= scale;
        c.im *= scale;
    }
    Ok(())
}

// Reference DFT/IDFT is now in dft.rs

#[cfg(test)]
mod coverage_tests {
    use super::*;
    use crate::fft::{Complex32, FftImpl, FftPlan, FftStrategy, ScalarFftImpl};
    use alloc::format;
    use alloc::vec;
    use proptest::prelude::*;

    #[test]
    fn test_empty_input_error() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data: Vec<Complex32> = vec![];
        assert!(fft.fft(&mut data).is_err());
        assert!(fft.ifft(&mut data).is_err());
    }

    #[test]
    fn test_single_element_fft() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![Complex32::new(42.0, -1.0)];
        assert!(fft.fft(&mut data).is_ok());
        assert!(fft.ifft(&mut data).is_ok());
        assert!((data[0].re - 42.0).abs() < 1e-6);
        assert!((data[0].im + 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_mismatched_lengths_out_of_place() {
        let fft = ScalarFftImpl::<f32>::default();
        let input = vec![Complex32::new(1.0, 0.0); 4];
        let mut output = vec![Complex32::zero(); 3];
        assert!(fft.fft_out_of_place(&input, &mut output).is_err());
        assert!(fft.ifft_out_of_place(&input, &mut output).is_err());
    }

    #[test]
    fn test_strided_fft_ifft() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
            Complex32::new(4.0, 0.0),
        ];
        let orig = data.clone();
        fft.fft_strided(&mut data, 2).unwrap();
        fft.ifft_strided(&mut data, 2).unwrap();
        for (a, b) in orig.iter().zip(data.iter()) {
            assert!((a.re - b.re).abs() < 1e-4);
        }
    }

    #[test]
    fn test_out_of_place_strided() {
        let fft = ScalarFftImpl::<f32>::default();
        let input = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
            Complex32::new(4.0, 0.0),
        ];
        let mut output = vec![Complex32::zero(); 4];
        fft.fft_out_of_place_strided(&input, 2, &mut output, 2)
            .unwrap();
        let mut output2 = output.clone();
        fft.ifft_out_of_place_strided(&output, 2, &mut output2, 2)
            .unwrap();
    }

    #[test]
    fn test_plan_based_fft_ifft() {
        let plan = FftPlan::<f32>::new(4, FftStrategy::Radix2);
        let mut data = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
            Complex32::new(4.0, 0.0),
        ];
        let orig = data.clone();
        plan.fft(&mut data).unwrap();
        plan.ifft(&mut data).unwrap();
        for (a, b) in orig.iter().zip(data.iter()) {
            assert!((a.re - b.re).abs() < 1e-4);
        }
    }

    #[test]
    fn test_plan_out_of_place() {
        let plan = FftPlan::<f32>::new(4, FftStrategy::Radix2);
        let input = vec![Complex32::new(1.0, 0.0); 4];
        let mut output = vec![Complex32::zero(); 4];
        plan.fft_out_of_place(&input, &mut output).unwrap();
        let mut output2 = output.clone();
        plan.ifft_out_of_place(&output, &mut output2).unwrap();
    }

    proptest! {
        #[test]
        fn prop_fft_ifft_roundtrip(len in proptest::sample::select(vec![2, 4, 8, 16, 32]), ref signal in proptest::collection::vec(-1000.0f32..1000.0, 32)) {
            let mut data: Vec<Complex32> = signal.iter().take(len).cloned().map(|x| Complex32::new(x, 0.0)).collect();
            let orig = data.clone();
            let fft = ScalarFftImpl::<f32>::default();
            if fft.fft(&mut data).is_ok() {
                fft.ifft(&mut data).unwrap();
                for (a, b) in orig.iter().zip(data.iter()) {
                    let err = (a.re - b.re).abs();
                    prop_assert!(err < 1e-2);
                }
            }
        }
    }

    #[test]
    fn test_non_power_of_two_error() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![Complex32::new(1.0, 0.0); 3];
        // Should error in no_std, but may work with std (Bluestein)
        let _ = fft.fft(&mut data);
    }

    #[test]
    fn test_bluestein_roundtrip() {
        let fft = ScalarFftImpl::<f32>::default();
        // length 6 triggers Bluestein algorithm
        let mut data = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
            Complex32::new(4.0, 0.0),
            Complex32::new(5.0, 0.0),
            Complex32::new(6.0, 0.0),
        ];
        let orig = data.clone();
        fft.fft(&mut data).unwrap();
        fft.ifft(&mut data).unwrap();
        for (a, b) in orig.iter().zip(data.iter()) {
            assert!((a.re - b.re).abs() < 1e-4);
        }
    }

    #[test]
    fn test_fft_with_strategy_variants() {
        let fft = ScalarFftImpl::<f32>::default();
        // length 16 exercises radix-4 implementation
        let mut data = (1..=16)
            .map(|i| Complex32::new(i as f32, 0.0))
            .collect::<Vec<_>>();
        // Explicit radix-4 strategy
        fft.fft_with_strategy(&mut data, FftStrategy::Radix4)
            .unwrap();
        // Auto strategy on power-of-two length
        fft.fft_with_strategy(&mut data, FftStrategy::Auto).unwrap();
    }

    #[test]
    fn test_fft_with_strategy_auto_matches_radix4() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut auto_data = (1..=16)
            .map(|i| Complex32::new(i as f32, 0.0))
            .collect::<Vec<_>>();
        let mut radix4_data = auto_data.clone();
        fft.fft_radix4(&mut radix4_data).unwrap();
        fft.fft_with_strategy(&mut auto_data, FftStrategy::Auto)
            .unwrap();
        for (a, b) in radix4_data.iter().zip(auto_data.iter()) {
            assert!((a.re - b.re).abs() < 1e-4);
            assert!((a.im - b.im).abs() < 1e-4);
        }
    }

    #[test]
    fn test_invalid_strides() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![Complex32::new(1.0, 0.0); 3];
        // stride 0
        assert!(fft.fft_strided(&mut data, 0).is_err());
        // length not divisible by stride
        assert!(fft.fft_strided(&mut data, 2).is_err());

        let input = vec![Complex32::new(1.0, 0.0); 4];
        let mut output = vec![Complex32::zero(); 4];
        // invalid strides for out-of-place APIs
        assert!(fft
            .fft_out_of_place_strided(&input, 0, &mut output, 1)
            .is_err());
        assert!(fft
            .ifft_out_of_place_strided(&input, 1, &mut output[..3], 1)
            .is_err());
        // invalid stride for ifft_strided
        assert!(fft.ifft_strided(&mut data, 0).is_err());
        // out-of-place length mismatch
        assert!(fft
            .fft_out_of_place_strided(&input[..3], 1, &mut output, 1)
            .is_err());
    }

    #[test]
    fn test_fft_vec_helpers() {
        let fft = ScalarFftImpl::<f32>::default();
        let input = vec![Complex32::new(1.0, 0.0); 4];
        let out = fft.fft_vec(&input).unwrap();
        let back = fft.ifft_vec(&out).unwrap();
        for (a, b) in input.iter().zip(back.iter()) {
            assert!((a.re - b.re).abs() < 1e-4);
        }
    }

    #[test]
    fn test_fft_with_strategy_empty() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data: Vec<Complex32> = Vec::new();
        assert!(fft.fft_with_strategy(&mut data, FftStrategy::Auto).is_err());
    }

    #[test]
    fn test_twiddle_factor_buffer_and_factorize() {
        let buf = TwiddleFactorBuffer::new(8);
        let t1 = buf.get(1);
        let t1_wrap = buf.get(1 + 4);
        assert!((t1.re + t1_wrap.re).abs() < 1e-6);
        assert!((t1.im + t1_wrap.im).abs() < 1e-6);

        let factors = factorize(360);
        assert_eq!(factors, vec![2, 2, 2, 3, 3, 5]);
    }

    #[test]
    fn test_plan_strategy() {
        let mut planner = FftPlanner::<f32>::new();
        assert_eq!(planner.plan_strategy(16), FftStrategy::Radix4);
        assert_eq!(planner.plan_strategy(8), FftStrategy::Radix2);
        assert_eq!(planner.plan_strategy(12), FftStrategy::Auto);
    }

    #[test]
    fn test_fft_inplace_stack_roundtrip() {
        let mut data = [
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
            Complex32::new(4.0, 0.0),
        ];
        let orig = data;
        fft_inplace_stack(&mut data).unwrap();
        ifft_inplace_stack(&mut data).unwrap();
        for (a, b) in data.iter().zip(orig.iter()) {
            assert!((a.re - b.re).abs() < 1e-4);
            assert!((a.im - b.im).abs() < 1e-4);
        }

        let mut data3 = [
            Complex32::new(0.0, 0.0),
            Complex32::new(0.0, 0.0),
            Complex32::new(0.0, 0.0),
        ];
        assert_eq!(
            fft_inplace_stack(&mut data3),
            Err(FftError::NonPowerOfTwoNoStd)
        );
        assert_eq!(
            ifft_inplace_stack(&mut data3),
            Err(FftError::NonPowerOfTwoNoStd)
        );
    }

    #[test]
    fn test_batch_and_multi_channel() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut batches = vec![
            vec![Complex32::new(1.0, 0.0); 4],
            vec![Complex32::new(2.0, 0.0); 4],
        ];
        let orig = batches.clone();
        batch(&fft, &mut batches).unwrap();
        batch_inverse(&fft, &mut batches).unwrap();
        for (batch, o) in batches.iter().zip(orig.iter()) {
            for (a, b) in batch.iter().zip(o.iter()) {
                assert!((a.re - b.re).abs() < 1e-4);
            }
        }
        multi_channel(&fft, &mut batches).unwrap();
        multi_channel_inverse(&fft, &mut batches).unwrap();
    }

    #[test]
    fn test_fft_plan_length_mismatch() {
        let plan = FftPlan::<f32>::new(4, FftStrategy::Radix2);
        let mut data = vec![Complex32::new(0.0, 0.0); 3];
        assert!(plan.fft(&mut data).is_err());
    }

    #[test]
    fn test_fft_inplace_stack_empty() {
        let mut empty: [Complex32; 0] = [];
        assert_eq!(fft_inplace_stack(&mut empty), Err(FftError::EmptyInput));
        assert_eq!(ifft_inplace_stack(&mut empty), Err(FftError::EmptyInput));
    }

    #[test]
    fn test_fft_plan_out_of_place_mismatch() {
        let plan = FftPlan::<f32>::new(4, FftStrategy::Radix2);
        let input = vec![Complex32::new(0.0, 0.0); 4];
        let mut short_output = vec![Complex32::zero(); 3];
        assert!(plan.fft_out_of_place(&input, &mut short_output).is_err());
        let short_input = vec![Complex32::new(0.0, 0.0); 3];
        let mut output = vec![Complex32::zero(); 4];
        assert!(plan.ifft_out_of_place(&short_input, &mut output).is_err());
        let mut data = vec![Complex32::new(0.0, 0.0); 3];
        assert!(plan.ifft(&mut data).is_err());
    }

    #[test]
    fn test_radix_with_twiddles_and_mixed() {
        let fft = ScalarFftImpl::<f32>::default();

        // Radix-2 with precomputed twiddles
        let mut d2 = (0..8)
            .map(|i| Complex32::new(i as f32, 0.0))
            .collect::<Vec<_>>();
        let tw2 = TwiddleFactorBuffer::new(8);
        fft.fft_radix2_with_twiddles(&mut d2, &tw2).unwrap();

        // Radix-4 with precomputed twiddles
        let mut d4 = (0..16)
            .map(|i| Complex32::new(i as f32, 0.0))
            .collect::<Vec<_>>();
        let tw4 = TwiddleFactorBuffer::new(16);
        fft.fft_radix4_with_twiddles(&mut d4, &tw4).unwrap();

        // Mixed radix helper chooses radix-2 path
        let mut mix = (0..8)
            .map(|i| Complex32::new(i as f32, 0.0))
            .collect::<Vec<_>>();
        fft.fft_mixed_radix(&mut mix).unwrap();

        // Mixed radix with twiddles falling back to generic FFT
        let mut mix6 = (0..6)
            .map(|i| Complex32::new(i as f32, 0.0))
            .collect::<Vec<_>>();
        let tw6 = TwiddleFactorBuffer::new(6);
        fft.fft_mixed_radix_with_twiddles(&mut mix6, &tw6).unwrap();
    }

    #[test]
    fn test_fft_radix4_sizes() {
        let fft = ScalarFftImpl::<f32>::default();
        for &n in &[16usize, 64usize] {
            let mut data: Vec<Complex32> = (0..n).map(|i| Complex32::new(i as f32, 0.0)).collect();
            fft.fft_radix4(&mut data).unwrap();
        }
    }
}
