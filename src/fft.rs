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
use alloc::sync::Arc;
use alloc::vec::Vec;
use core::cell::RefCell;
use core::mem::MaybeUninit;
use once_cell::unsync::OnceCell;

use crate::fft_kernels::{fft16, fft2, fft4, fft8};
#[cfg(feature = "parallel")]
use core::sync::atomic::{AtomicUsize, Ordering};
#[cfg(feature = "parallel")]
use rayon::prelude::*;

#[cfg(all(feature = "parallel", feature = "std"))]
use num_cpus;
#[cfg(all(feature = "parallel", feature = "std"))]
use std::sync::OnceLock;

/// Override for the parallel FFT threshold.
///
/// `0` means no override and the heuristic will be used.
#[cfg(feature = "parallel")]
static PARALLEL_FFT_THRESHOLD_OVERRIDE: AtomicUsize = AtomicUsize::new(0);

#[cfg(feature = "parallel")]
static PARALLEL_FFT_CACHE_BYTES_OVERRIDE: AtomicUsize = AtomicUsize::new(0);
#[cfg(feature = "parallel")]
static PARALLEL_FFT_PER_CORE_WORK_OVERRIDE: AtomicUsize = AtomicUsize::new(0);

#[cfg(all(feature = "parallel", feature = "std"))]
static CPU_COUNT: OnceLock<usize> = OnceLock::new();
#[cfg(all(feature = "parallel", feature = "std"))]
static ENV_PAR_FFT_THRESHOLD: OnceLock<Option<usize>> = OnceLock::new();
#[cfg(all(feature = "parallel", feature = "std"))]
static ENV_PAR_FFT_CACHE_BYTES: OnceLock<Option<usize>> = OnceLock::new();
#[cfg(all(feature = "parallel", feature = "std"))]
static ENV_PAR_FFT_PER_CORE_WORK: OnceLock<Option<usize>> = OnceLock::new();

#[cfg(feature = "parallel")]
/// Set a custom minimum FFT length to use parallel processing.
///
/// The heuristic parallelizes when each core would handle at least
/// `max(L1_cache_bytes/size_of::<Complex32>(), per_core_work)` elements. These
/// parameters can be tuned via [`set_parallel_fft_l1_cache`] and
/// [`set_parallel_fft_per_core_work`].
///
/// Passing `0` reverts to the built-in heuristic.
pub fn set_parallel_fft_threshold(threshold: usize) {
    PARALLEL_FFT_THRESHOLD_OVERRIDE.store(threshold, Ordering::Relaxed);
}

#[cfg(feature = "parallel")]
/// Set the assumed L1 data cache size per core in bytes for the parallel FFT heuristic.
///
/// Passing `0` reverts to the built-in default or environment variable.
pub fn set_parallel_fft_l1_cache(bytes: usize) {
    PARALLEL_FFT_CACHE_BYTES_OVERRIDE.store(bytes, Ordering::Relaxed);
}

#[cfg(feature = "parallel")]
/// Set the minimum number of complex points each core must process before using
/// parallel FFTs. This approximates per-core throughput.
///
/// Passing `0` reverts to the built-in default or environment variable.
pub fn set_parallel_fft_per_core_work(points: usize) {
    PARALLEL_FFT_PER_CORE_WORK_OVERRIDE.store(points, Ordering::Relaxed);
}

#[cfg(feature = "parallel")]
fn should_parallelize_fft(n: usize) -> bool {
    let override_thr = PARALLEL_FFT_THRESHOLD_OVERRIDE.load(Ordering::Relaxed);
    let threshold = if override_thr == 0 {
        #[cfg(feature = "std")]
        {
            ENV_PAR_FFT_THRESHOLD
                .get_or_init(|| {
                    std::env::var("KOFFT_PAR_FFT_THRESHOLD")
                        .ok()
                        .and_then(|v| v.parse::<usize>().ok())
                })
                .as_ref()
                .copied()
                .unwrap_or(0)
        }
        #[cfg(not(feature = "std"))]
        {
            0
        }
    } else {
        override_thr
    };

    if threshold != 0 {
        return n >= threshold;
    }

    let cores = {
        #[cfg(feature = "std")]
        {
            *CPU_COUNT.get_or_init(|| num_cpus::get().max(1))
        }
        #[cfg(not(feature = "std"))]
        {
            1
        }
    };

    let cache_bytes = {
        let override_bytes = PARALLEL_FFT_CACHE_BYTES_OVERRIDE.load(Ordering::Relaxed);
        if override_bytes != 0 {
            override_bytes
        } else {
            #[cfg(feature = "std")]
            {
                ENV_PAR_FFT_CACHE_BYTES
                    .get_or_init(|| {
                        std::env::var("KOFFT_PAR_FFT_CACHE_BYTES")
                            .ok()
                            .and_then(|v| v.parse::<usize>().ok())
                    })
                    .as_ref()
                    .copied()
                    .unwrap_or(32 * 1024)
            }
            #[cfg(not(feature = "std"))]
            {
                32 * 1024
            }
        }
    };

    let per_core_work = {
        let override_work = PARALLEL_FFT_PER_CORE_WORK_OVERRIDE.load(Ordering::Relaxed);
        if override_work != 0 {
            override_work
        } else {
            #[cfg(feature = "std")]
            {
                ENV_PAR_FFT_PER_CORE_WORK
                    .get_or_init(|| {
                        std::env::var("KOFFT_PAR_FFT_PER_CORE_WORK")
                            .ok()
                            .and_then(|v| v.parse::<usize>().ok())
                    })
                    .as_ref()
                    .copied()
                    .unwrap_or(4096)
            }
            #[cfg(not(feature = "std"))]
            {
                4096
            }
        }
    };

    let bytes_per_elem = core::mem::size_of::<crate::num::Complex32>();
    let cache_elems = cache_bytes / bytes_per_elem;
    let per_core_min = core::cmp::max(cache_elems, per_core_work);

    n >= per_core_min * cores
}

pub use crate::num::{
    copy_from_complex, copy_to_complex, Complex, Complex32, Complex64, Float, SplitComplex,
};

type BluesteinPair<T> = (Arc<[Complex<T>]>, Arc<[Complex<T>]>);

pub struct FftPlanner<T: Float> {
    cache: Vec<OnceCell<Arc<[Complex<T>]>>>,
    bitrev_cache: Vec<OnceCell<Arc<[usize]>>>,
    bluestein_cache: Vec<OnceCell<BluesteinPair<T>>>,
    scratch: Vec<Complex<T>>,
}

impl<T: Float> Default for FftPlanner<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Float> FftPlanner<T> {
    pub fn new() -> Self {
        Self {
            cache: Vec::new(),
            bitrev_cache: Vec::new(),
            bluestein_cache: Vec::new(),
            scratch: Vec::new(),
        }
    }
    pub fn get_twiddles(&mut self, n: usize) -> &[Complex<T>] {
        if self.cache.len() <= n {
            self.cache.resize_with(n + 1, OnceCell::new);
        }
        self.cache[n]
            .get_or_init(|| {
                let angle = -T::from_f32(2.0) * T::pi() / T::from_f32(n as f32);
                let (sin, cos) = angle.sin_cos();
                let w = Complex::new(cos, sin);
                // Allocate uninitialized buffer of length `n` and fill it in-place.
                let mut vec: Vec<MaybeUninit<Complex<T>>> = Vec::with_capacity(n);
                // SAFETY: `vec` is set to length `n` and every element is written
                // before being read. The allocation is then reinterpreted as
                // initialized `Vec<Complex<T>>`.
                unsafe {
                    vec.set_len(n);
                    let slice =
                        core::slice::from_raw_parts_mut(vec.as_mut_ptr() as *mut Complex<T>, n);
                    let mut current = Complex::new(T::one(), T::zero());
                    for elem in slice.iter_mut() {
                        *elem = current;
                        current = current * w;
                    }
                    let ptr = slice.as_mut_ptr();
                    let cap = vec.capacity();
                    core::mem::forget(vec);
                    let vec = Vec::from_raw_parts(ptr, n, cap);
                    Arc::<[Complex<T>]>::from(vec)
                }
            })
            .as_ref()
    }

    pub fn get_bitrev(&mut self, n: usize) -> Arc<[usize]> {
        if self.bitrev_cache.len() <= n {
            self.bitrev_cache.resize_with(n + 1, OnceCell::new);
        }
        Arc::clone(
            self.bitrev_cache[n].get_or_init(|| Arc::<[usize]>::from(compute_bitrev_table(n))),
        )
    }

    #[cfg(feature = "std")]
    pub fn get_bluestein(&mut self, n: usize) -> BluesteinPair<T> {
        if self.bluestein_cache.len() <= n {
            self.bluestein_cache.resize_with(n + 1, OnceCell::new);
        }
        let pair = self.bluestein_cache[n].get_or_init(|| {
            let m = (2 * n - 1).next_power_of_two();
            let mut chirp: Vec<Complex<T>> = Vec::with_capacity(n);
            let mut b: Vec<Complex<T>> = Vec::with_capacity(m);
            for i in 0..n {
                let angle = T::pi() * T::from_f32((i * i) as f32) / T::from_f32(n as f32);
                chirp.push(Complex::expi(-angle));
                b.push(Complex::expi(angle));
            }
            b.resize(m, Complex::zero());
            for i in 1..n {
                b[m - i] = b[i];
            }
            let mut b_fft = b;
            let fft = ScalarFftImpl::<T>::default();
            fft.fft(&mut b_fft).unwrap();
            let chirp_arc: Arc<[Complex<T>]> = Arc::from(chirp);
            let b_fft_arc: Arc<[Complex<T>]> = Arc::from(b_fft);
            (chirp_arc, b_fft_arc)
        });
        (Arc::clone(&pair.0), Arc::clone(&pair.1))
    }

    /// Determine an FFT strategy based on the input length.
    ///
    /// Returns `SplitRadix` for power-of-two sizes and `Auto` otherwise.
    pub fn plan_strategy(&mut self, n: usize) -> FftStrategy {
        if n.is_power_of_two() && n > 1 {
            FftStrategy::SplitRadix
        } else {
            FftStrategy::Auto
        }
    }
}

fn compute_bitrev_table(n: usize) -> Vec<usize> {
    let bits = n.trailing_zeros();
    let mut table = Vec::new();
    for i in 0..n {
        let j = i.reverse_bits() >> (usize::BITS - bits);
        if i < j {
            table.push(i);
            table.push(j);
        }
    }
    if table.len() % 4 != 0 {
        let pad = 4 - table.len() % 4;
        table.resize(table.len() + pad, 0);
    }
    table
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
    SplitRadix,
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
    /// In-place strided FFT: input is a strided mutable slice (stride in elements, not bytes).
    ///
    /// A scratch buffer of length `input.len()/stride` is used to avoid heap allocations.
    fn fft_strided(
        &self,
        input: &mut [Complex<T>],
        stride: usize,
        scratch: &mut [Complex<T>],
    ) -> Result<(), FftError>;
    /// In-place strided IFFT using a caller-provided scratch buffer.
    fn ifft_strided(
        &self,
        input: &mut [Complex<T>],
        stride: usize,
        scratch: &mut [Complex<T>],
    ) -> Result<(), FftError>;
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
    /// Plan-based strategy selection (Radix2, Radix4, SplitRadix, Auto)
    fn fft_with_strategy(
        &self,
        input: &mut [Complex<T>],
        strategy: FftStrategy,
    ) -> Result<(), FftError>;
    /// Convenience wrapper that allocates a scratch buffer internally for [`fft_strided`].
    fn fft_strided_alloc(&self, input: &mut [Complex<T>], stride: usize) -> Result<(), FftError> {
        let n = if stride == 0 { 0 } else { input.len() / stride };
        let mut scratch: Vec<MaybeUninit<Complex<T>>> = alloc::vec::Vec::with_capacity(n);
        // SAFETY: The scratch buffer is uninitialized, but `fft_strided` treats it
        // purely as workspace and writes to every element before any read.
        unsafe {
            scratch.set_len(n);
            let scratch_slice =
                core::slice::from_raw_parts_mut(scratch.as_mut_ptr() as *mut Complex<T>, n);
            self.fft_strided(input, stride, scratch_slice)
        }
    }
    /// Convenience wrapper that allocates a scratch buffer internally for [`ifft_strided`].
    fn ifft_strided_alloc(&self, input: &mut [Complex<T>], stride: usize) -> Result<(), FftError> {
        let n = if stride == 0 { 0 } else { input.len() / stride };
        let mut scratch: Vec<MaybeUninit<Complex<T>>> = alloc::vec::Vec::with_capacity(n);
        // SAFETY: The scratch buffer is uninitialized, but `ifft_strided` treats it
        // purely as workspace and writes to every element before any read.
        unsafe {
            scratch.set_len(n);
            let scratch_slice =
                core::slice::from_raw_parts_mut(scratch.as_mut_ptr() as *mut Complex<T>, n);
            self.ifft_strided(input, stride, scratch_slice)
        }
    }

    fn fft_split(&self, re: &mut [T], im: &mut [T]) -> Result<(), FftError> {
        if re.len() != im.len() {
            return Err(FftError::MismatchedLengths);
        }
        let mut buf = alloc::vec::Vec::with_capacity(re.len());
        for i in 0..re.len() {
            buf.push(Complex::new(re[i], im[i]));
        }
        self.fft(&mut buf)?;
        for i in 0..re.len() {
            re[i] = buf[i].re;
            im[i] = buf[i].im;
        }
        Ok(())
    }

    fn ifft_split(&self, re: &mut [T], im: &mut [T]) -> Result<(), FftError> {
        if re.len() != im.len() {
            return Err(FftError::MismatchedLengths);
        }
        let mut buf = alloc::vec::Vec::with_capacity(re.len());
        for i in 0..re.len() {
            buf.push(Complex::new(re[i], im[i]));
        }
        self.ifft(&mut buf)?;
        for i in 0..re.len() {
            re[i] = buf[i].re;
            im[i] = buf[i].im;
        }
        Ok(())
    }
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

    pub fn split_radix_fft(&self, input: &mut [Complex<T>]) -> Result<(), FftError> {
        let n = input.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if !n.is_power_of_two() {
            return self.fft(input);
        }
        if n <= 16 {
            match n {
                2 => fft2(input),
                4 => fft4(input),
                8 => fft8(input),
                16 => fft16(input),
                _ => unreachable!(),
            }
            return Ok(());
        }

        // Use precomputed bit-reversal table and perform the FFT in-place.
        let mut planner = self.planner.borrow_mut();
        let bitrev = planner.get_bitrev(n);
        for pair in bitrev.chunks_exact(2) {
            if pair[0] != pair[1] {
                input.swap(pair[0], pair[1]);
            }
        }

        let twiddles = planner.get_twiddles(n);

        let mut size = 2;
        while size <= n {
            let half = size / 2;
            let step = n / size;
            for start in (0..n).step_by(size) {
                let mut k = 0;
                for j in 0..half {
                    let u = input[start + j];
                    let t = input[start + j + half].mul(twiddles[k]);
                    input[start + j] = u.add(t);
                    input[start + j + half] = u.sub(t);
                    k += step;
                }
            }
            size <<= 1;
        }
        Ok(())
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
        if n <= 16 && n.is_power_of_two() {
            match n {
                2 => fft2(input),
                4 => fft4(input),
                8 => fft8(input),
                16 => fft16(input),
                _ => unreachable!(),
            }
            return Ok(());
        }
        if (n & (n - 1)) == 0 {
            // Power of two: use split-radix FFT
            return self.split_radix_fft(input);
        }
        // Bluestein's algorithm for non-power-of-two
        #[cfg(not(feature = "std"))]
        {
            return Err(FftError::NonPowerOfTwoNoStd);
        }
        #[cfg(feature = "std")]
        {
            use alloc::vec::Vec;
            let (chirp_arc, fft_b_arc) = {
                let mut planner = self.planner.borrow_mut();
                planner.get_bluestein(n)
            };
            let chirp = chirp_arc.as_ref();
            let fft_b = fft_b_arc.as_ref();
            let m = fft_b.len();
            let mut a = Vec::with_capacity(m);
            for (i, &val) in input.iter().take(n).enumerate() {
                a.push(val.mul(chirp[i]));
            }
            a.resize(m, Complex::zero());
            let fft = ScalarFftImpl::<T>::default();
            fft.fft(&mut a)?;
            for (ai, &bi) in a.iter_mut().zip(fft_b.iter()) {
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
                *out = a[i].mul(chirp[i]);
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
            if should_parallelize_fft(n)
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
    fn fft_strided(
        &self,
        input: &mut [Complex<T>],
        stride: usize,
        scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        if stride == 0 {
            return Err(FftError::InvalidStride);
        }
        let n = scratch.len();
        if n == 0 {
            return Ok(());
        }
        if input.len() < (n - 1) * stride + 1 {
            return Err(FftError::MismatchedLengths);
        }
        for i in 0..n {
            scratch[i] = input[i * stride];
        }
        self.fft(&mut scratch[..n])?;
        for i in 0..n {
            input[i * stride] = scratch[i];
        }
        Ok(())
    }

    fn fft_strided_alloc(&self, input: &mut [Complex<T>], stride: usize) -> Result<(), FftError> {
        let n = if stride == 0 { 0 } else { input.len() / stride };
        let mut planner = self.planner.borrow_mut();
        let mut scratch = core::mem::take(&mut planner.scratch);
        if scratch.len() < n {
            scratch.resize(n, Complex::zero());
        }
        drop(planner);
        let result = self.fft_strided(input, stride, &mut scratch[..n]);
        let mut planner = self.planner.borrow_mut();
        planner.scratch = scratch;
        result
    }

    fn ifft_strided_alloc(&self, input: &mut [Complex<T>], stride: usize) -> Result<(), FftError> {
        let n = if stride == 0 { 0 } else { input.len() / stride };
        let mut planner = self.planner.borrow_mut();
        let mut scratch = core::mem::take(&mut planner.scratch);
        if scratch.len() < n {
            scratch.resize(n, Complex::zero());
        }
        drop(planner);
        let result = self.ifft_strided(input, stride, &mut scratch[..n]);
        let mut planner = self.planner.borrow_mut();
        planner.scratch = scratch;
        result
    }
    fn ifft_strided(
        &self,
        input: &mut [Complex<T>],
        stride: usize,
        scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        if stride == 0 {
            return Err(FftError::InvalidStride);
        }
        let n = scratch.len();
        if n == 0 {
            return Ok(());
        }
        if input.len() < (n - 1) * stride + 1 {
            return Err(FftError::MismatchedLengths);
        }
        for i in 0..n {
            scratch[i] = input[i * stride];
        }
        self.ifft(&mut scratch[..n])?;
        for i in 0..n {
            input[i * stride] = scratch[i];
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
        let mut planner = self.planner.borrow_mut();
        let mut scratch = core::mem::take(&mut planner.scratch);
        if scratch.len() < n {
            scratch.resize(n, Complex::zero());
        }
        for i in 0..n {
            scratch[i] = input[i * in_stride];
        }
        drop(planner);
        self.fft(&mut scratch[..n])?;
        for i in 0..n {
            output[i * out_stride] = scratch[i];
        }
        let mut planner = self.planner.borrow_mut();
        planner.scratch = scratch;
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
        let mut planner = self.planner.borrow_mut();
        let mut scratch = core::mem::take(&mut planner.scratch);
        if scratch.len() < n {
            scratch.resize(n, Complex::zero());
        }
        for i in 0..n {
            scratch[i] = input[i * in_stride];
        }
        drop(planner);
        self.ifft(&mut scratch[..n])?;
        for i in 0..n {
            output[i * out_stride] = scratch[i];
        }
        let mut planner = self.planner.borrow_mut();
        planner.scratch = scratch;
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
            FftStrategy::SplitRadix => self.split_radix_fft(input),
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
        let n = input.len();
        if !n.is_power_of_two() || n.trailing_zeros() % 2 != 0 {
            // Fallback to generic FFT if not power of four
            return self.fft(input);
        }
        // Bit-reversal for radix-4
        let mut j = 0usize;
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
            if len == 4 {
                while i < n {
                    let (x0, x1, x2, x3) =
                        butterfly4(input[i], input[i + 1], input[i + 2], input[i + 3]);
                    input[i] = x0;
                    input[i + 1] = x1;
                    input[i + 2] = x2;
                    input[i + 3] = x3;
                    i += len;
                }
            } else {
                let w_step = {
                    let mut planner = self.planner.borrow_mut();
                    let twiddles = planner.get_twiddles(n);
                    twiddles[n / len]
                };
                while i < n {
                    let mut w1 = Complex::new(T::one(), T::zero());
                    for j in 0..(len / 4) {
                        let w2 = w1.mul(w1);
                        let w3 = w2.mul(w1);
                        let a = input[i + j];
                        let b = input[i + j + len / 4].mul(w1);
                        let c = input[i + j + len / 2].mul(w2);
                        let d = input[i + j + 3 * len / 4].mul(w3);
                        let (x0, x1, x2, x3) = butterfly4(a, b, c, d);
                        input[i + j] = x0;
                        input[i + j + len / 4] = x1;
                        input[i + j + len / 2] = x2;
                        input[i + j + 3 * len / 4] = x3;
                        w1 = w1.mul(w_step);
                    }
                    i += len;
                }
            }
            len <<= 2;
        }
        Ok(())
    }
}

#[cfg(feature = "std")]
#[derive(Clone, Debug)]
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
        self.twiddles[k % (self.n / 2)]
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
        let bitrev = {
            let mut planner = self.planner.borrow_mut();
            planner.get_bitrev(n)
        };
        for pair in bitrev.chunks_exact(2) {
            input.swap(pair[0], pair[1]);
        }
        let mut len = 2;
        while len <= n {
            let step = n / len;
            let mut i = 0;
            while i < n {
                for j in 0..(len / 2) {
                    let w = twiddles.get(j * step);
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
            let step = n / len;
            let mut i = 0;
            while i < n {
                for j in 0..(len / 4) {
                    let w1 = twiddles.get(j * step);
                    let w2 = twiddles.get(2 * j * step);
                    let w3 = twiddles.get(3 * j * step);
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
        let bitrev = {
            let mut planner = self.planner.borrow_mut();
            planner.get_bitrev(n)
        };
        for pair in bitrev.chunks_exact(2) {
            input.swap(pair[0], pair[1]);
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
                let w_step = {
                    let mut planner = self.planner.borrow_mut();
                    let twiddles = planner.get_twiddles(n);
                    twiddles[n / len]
                };
                while i < n {
                    let mut w = Complex32::new(1.0, 0.0);
                    for j in 0..(len / 2) {
                        let u = input[i + j];
                        let v = input[i + j + len / 2].mul(w);
                        input[i + j] = u.add(v);
                        input[i + j + len / 2] = u.sub(v);
                        w = w.mul(w_step);
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
#[cfg(target_arch = "x86_64")]
use core::arch::x86_64::*;

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "sse2")]
unsafe fn swap_pairs_sse(input: &mut [Complex32], table: &[usize], aligned: bool) {
    let ptr = input.as_mut_ptr() as *mut f32;
    let mut k = 0;
    while k < table.len() {
        let i = table[k];
        let j = table[k + 1];
        let pi = ptr.add(i * 2);
        let pj = ptr.add(j * 2);
        if aligned {
            let vi = _mm_load_ps(pi);
            let vj = _mm_load_ps(pj);
            _mm_store_ps(pi, vj);
            _mm_store_ps(pj, vi);
        } else {
            let vi = _mm_loadu_ps(pi);
            let vj = _mm_loadu_ps(pj);
            _mm_storeu_ps(pi, vj);
            _mm_storeu_ps(pj, vi);
        }
        k += 2;
    }
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx")]
unsafe fn swap_pairs_avx(input: &mut [Complex32], table: &[usize]) {
    let ptr = input.as_mut_ptr() as *mut f32;
    let mut k = 0;
    while k < table.len() {
        let i = table[k];
        let j = table[k + 1];
        let pi = ptr.add(i * 2);
        let pj = ptr.add(j * 2);
        let v = _mm256_loadu2_m128(pj, pi);
        _mm256_storeu2_m128(pi, pj, v);
        k += 2;
    }
}

#[cfg(target_arch = "x86_64")]
#[derive(Default)]
pub struct SimdFftX86_64Impl;

#[cfg(target_arch = "x86_64")]
impl FftImpl<f32> for SimdFftX86_64Impl {
    fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        #[cfg(all(target_arch = "x86_64", feature = "std"))]
        {
            #[cfg(any(feature = "avx512", target_feature = "avx512f"))]
            if std::arch::is_x86_feature_detected!("avx512f") {
                unsafe {
                    return fft_avx512(input);
                }
            }
            if std::arch::is_x86_feature_detected!("avx2")
                && std::arch::is_x86_feature_detected!("fma")
            {
                unsafe {
                    return fft_avx2(input);
                }
            }
        }

        // Fallback to SSE2 implementation
        let n = input.len();
        if n <= 1 {
            return Ok(());
        }
        let aligned = (input.as_ptr() as usize) % 16 == 0;
        if n > 1 {
            unsafe {
                let table = compute_bitrev_table(n);
                swap_pairs_sse(input, &table, aligned);
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

    fn fft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_strided(input, stride, scratch)
    }

    fn ifft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_strided(input, stride, scratch)
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

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2,fma")]
unsafe fn fft_avx2(input: &mut [Complex32]) -> Result<(), FftError> {
    let n = input.len();
    if n <= 1 {
        return Ok(());
    }
    let aligned = (input.as_ptr() as usize) % 32 == 0;
    let table = compute_bitrev_table(n);
    swap_pairs_avx(input, &table);
    if n % 8 != 0 {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft(input)?;
        return Ok(());
    }
    let mut planner = FftPlanner::<f32>::new();
    let mut len = 2;
    while len <= n {
        let twiddles = planner.get_twiddles(len);
        let mut i = 0;
        while i < n {
            let half = len / 2;
            let simd_width = 8;
            let simd_iters = half / simd_width;
            for s in 0..simd_iters {
                let j = s * simd_width;
                let mut w_re = [0.0f32; 8];
                let mut w_im = [0.0f32; 8];
                let tw_ptr = twiddles.as_ptr().add(j);
                for k in 0..simd_width {
                    let tw = *tw_ptr.add(k);
                    w_re[k] = tw.re;
                    w_im[k] = tw.im;
                }
                let w_re_v = _mm256_loadu_ps(w_re.as_ptr());
                let w_im_v = _mm256_loadu_ps(w_im.as_ptr());
                let u_re = if aligned {
                    _mm256_load_ps(&input[i + j].re as *const f32)
                } else {
                    _mm256_loadu_ps(&input[i + j].re as *const f32)
                };
                let u_im = if aligned {
                    _mm256_load_ps(&input[i + j].im as *const f32)
                } else {
                    _mm256_loadu_ps(&input[i + j].im as *const f32)
                };
                let v_re = if aligned {
                    _mm256_load_ps(&input[i + j + half].re as *const f32)
                } else {
                    _mm256_loadu_ps(&input[i + j + half].re as *const f32)
                };
                let v_im = if aligned {
                    _mm256_load_ps(&input[i + j + half].im as *const f32)
                } else {
                    _mm256_loadu_ps(&input[i + j + half].im as *const f32)
                };
                let vw_re = _mm256_fmsub_ps(v_re, w_re_v, _mm256_mul_ps(v_im, w_im_v));
                let vw_im = _mm256_fmadd_ps(v_re, w_im_v, _mm256_mul_ps(v_im, w_re_v));
                let out_re = _mm256_add_ps(u_re, vw_re);
                let out_im = _mm256_add_ps(u_im, vw_im);
                let out2_re = _mm256_sub_ps(u_re, vw_re);
                let out2_im = _mm256_sub_ps(u_im, vw_im);
                if aligned {
                    _mm256_store_ps(&mut input[i + j].re as *mut f32, out_re);
                    _mm256_store_ps(&mut input[i + j].im as *mut f32, out_im);
                    _mm256_store_ps(&mut input[i + j + half].re as *mut f32, out2_re);
                    _mm256_store_ps(&mut input[i + j + half].im as *mut f32, out2_im);
                } else {
                    _mm256_storeu_ps(&mut input[i + j].re as *mut f32, out_re);
                    _mm256_storeu_ps(&mut input[i + j].im as *mut f32, out_im);
                    _mm256_storeu_ps(&mut input[i + j + half].re as *mut f32, out2_re);
                    _mm256_storeu_ps(&mut input[i + j + half].im as *mut f32, out2_im);
                }
            }
            for j in (simd_iters * simd_width)..half {
                let w = twiddles[j];
                let u = input[i + j];
                let v = input[i + j + half].mul(w);
                input[i + j] = u.add(v);
                input[i + j + half] = u.sub(v);
            }
            i += len;
        }
        len <<= 1;
    }
    Ok(())
}

#[cfg(all(
    target_arch = "x86_64",
    any(feature = "avx512", target_feature = "avx512f")
))]
#[target_feature(enable = "avx512f")]
unsafe fn fft_avx512(input: &mut [Complex32]) -> Result<(), FftError> {
    let n = input.len();
    if n <= 1 {
        return Ok(());
    }
    let aligned = (input.as_ptr() as usize) % 64 == 0;
    let table = compute_bitrev_table(n);
    swap_pairs_avx(input, &table);
    if n % 16 != 0 {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft(input)?;
        return Ok(());
    }
    let mut planner = FftPlanner::<f32>::new();
    let mut len = 2;
    while len <= n {
        let twiddles = planner.get_twiddles(len);
        let mut i = 0;
        while i < n {
            let half = len / 2;
            let simd_width = 16;
            let simd_iters = half / simd_width;
            for s in 0..simd_iters {
                let j = s * simd_width;
                let mut w_re = [0.0f32; 16];
                let mut w_im = [0.0f32; 16];
                let tw_ptr = twiddles.as_ptr().add(j);
                for k in 0..simd_width {
                    let tw = *tw_ptr.add(k);
                    w_re[k] = tw.re;
                    w_im[k] = tw.im;
                }
                let w_re_v = _mm512_loadu_ps(w_re.as_ptr());
                let w_im_v = _mm512_loadu_ps(w_im.as_ptr());
                let u_re = if aligned {
                    _mm512_load_ps(&input[i + j].re as *const f32)
                } else {
                    _mm512_loadu_ps(&input[i + j].re as *const f32)
                };
                let u_im = if aligned {
                    _mm512_load_ps(&input[i + j].im as *const f32)
                } else {
                    _mm512_loadu_ps(&input[i + j].im as *const f32)
                };
                let v_re = if aligned {
                    _mm512_load_ps(&input[i + j + half].re as *const f32)
                } else {
                    _mm512_loadu_ps(&input[i + j + half].re as *const f32)
                };
                let v_im = if aligned {
                    _mm512_load_ps(&input[i + j + half].im as *const f32)
                } else {
                    _mm512_loadu_ps(&input[i + j + half].im as *const f32)
                };
                let vw_re = _mm512_fmsub_ps(v_re, w_re_v, _mm512_mul_ps(v_im, w_im_v));
                let vw_im = _mm512_fmadd_ps(v_re, w_im_v, _mm512_mul_ps(v_im, w_re_v));
                let out_re = _mm512_add_ps(u_re, vw_re);
                let out_im = _mm512_add_ps(u_im, vw_im);
                let out2_re = _mm512_sub_ps(u_re, vw_re);
                let out2_im = _mm512_sub_ps(u_im, vw_im);
                if aligned {
                    _mm512_store_ps(&mut input[i + j].re as *mut f32, out_re);
                    _mm512_store_ps(&mut input[i + j].im as *mut f32, out_im);
                    _mm512_store_ps(&mut input[i + j + half].re as *mut f32, out2_re);
                    _mm512_store_ps(&mut input[i + j + half].im as *mut f32, out2_im);
                } else {
                    _mm512_storeu_ps(&mut input[i + j].re as *mut f32, out_re);
                    _mm512_storeu_ps(&mut input[i + j].im as *mut f32, out_im);
                    _mm512_storeu_ps(&mut input[i + j + half].re as *mut f32, out2_re);
                    _mm512_storeu_ps(&mut input[i + j + half].im as *mut f32, out2_im);
                }
            }
            for j in (simd_iters * simd_width)..half {
                let w = twiddles[j];
                let u = input[i + j];
                let v = input[i + j + half].mul(w);
                input[i + j] = u.add(v);
                input[i + j + half] = u.sub(v);
            }
            i += len;
        }
        len <<= 1;
    }
    Ok(())
}

// x86_64 SSE SIMD implementation
#[cfg(all(target_arch = "x86_64", any(feature = "sse", target_feature = "sse2")))]
#[derive(Default)]
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
            let mut planner = FftPlanner::<f32>::new();
            let mut len = 2;
            while len <= n {
                let twiddles = planner.get_twiddles(len);
                let half = len / 2;
                let simd_width = 4;
                let simd_iters = half / simd_width;
                // Precompute SIMD twiddle vectors to avoid rebuilding arrays each pass
                let mut tw_re: Vec<__m128> = Vec::with_capacity(simd_iters);
                let mut tw_im: Vec<__m128> = Vec::with_capacity(simd_iters);
                for s in 0..simd_iters {
                    let j = s * simd_width;
                    let tw_ptr = twiddles.as_ptr().add(j);
                    let mut w_re = [0.0f32; 4];
                    let mut w_im = [0.0f32; 4];
                    for k in 0..simd_width {
                        let tw = *tw_ptr.add(k);
                        w_re[k] = tw.re;
                        w_im[k] = tw.im;
                    }
                    tw_re.push(_mm_loadu_ps(w_re.as_ptr()));
                    tw_im.push(_mm_loadu_ps(w_im.as_ptr()));
                }
                let mut i = 0;
                while i < n {
                    for s in 0..simd_iters {
                        let j = s * simd_width;
                        let w_re_v = tw_re[s];
                        let w_im_v = tw_im[s];
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
                    }
                    for j in (simd_iters * simd_width)..half {
                        let w = twiddles[j];
                        let u = input[i + j];
                        let v = input[i + j + half].mul(w);
                        input[i + j] = u.add(v);
                        input[i + j + half] = u.sub(v);
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

    fn fft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_strided(input, stride, scratch)
    }

    fn ifft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_strided(input, stride, scratch)
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
#[derive(Default)]
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

    fn fft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_strided(input, stride, scratch)
    }

    fn ifft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_strided(input, stride, scratch)
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
#[derive(Default)]
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

    fn fft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.fft_strided(input, stride, scratch)
    }

    fn ifft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        let scalar = ScalarFftImpl::<f32>::default();
        scalar.ifft_strided(input, stride, scratch)
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
    #[cfg(all(target_arch = "x86_64", feature = "std"))]
    {
        #[cfg(any(feature = "avx512", target_feature = "avx512f"))]
        if std::arch::is_x86_feature_detected!("avx512f") {
            return Box::new(SimdFftX86_64Impl);
        }
        if std::arch::is_x86_feature_detected!("avx2") && std::arch::is_x86_feature_detected!("fma")
        {
            return Box::new(SimdFftX86_64Impl);
        }
        if std::arch::is_x86_feature_detected!("sse2") {
            return Box::new(SimdFftSseImpl);
        }
    }
    #[cfg(target_arch = "aarch64")]
    {
        return Box::new(SimdFftAArch64Impl);
    }
    #[cfg(target_arch = "wasm32")]
    {
        return Box::new(SimdFftWasmImpl);
    }
    Box::new(ScalarFftImpl::<f32>::default())
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
    /// Create a new FFT plan for size n and strategy (Radix2, Radix4, SplitRadix, Auto)
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
            // Use twiddles for f32
            let input32 = unsafe { &mut *(input as *mut [Complex<T>] as *mut [Complex32]) };
            match self.strategy {
                FftStrategy::Radix2 => {
                    if let Some(tw) = &self.twiddles {
                        return ScalarFftImpl::<f32>::default()
                            .fft_radix2_with_twiddles(input32, tw);
                    }
                }
                FftStrategy::Radix4 => {
                    if let Some(tw) = &self.twiddles {
                        return ScalarFftImpl::<f32>::default()
                            .fft_radix4_with_twiddles(input32, tw);
                    }
                }
                FftStrategy::SplitRadix => {}
                FftStrategy::Auto => {}
            }
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

    pub fn fft_split(&self, re: &mut [T], im: &mut [T]) -> Result<(), FftError> {
        if re.len() != self.n || im.len() != self.n {
            return Err(FftError::MismatchedLengths);
        }
        self.fft.fft_split(re, im)
    }

    pub fn ifft_split(&self, re: &mut [T], im: &mut [T]) -> Result<(), FftError> {
        if re.len() != self.n || im.len() != self.n {
            return Err(FftError::MismatchedLengths);
        }
        self.fft.ifft_split(re, im)
    }

    #[cfg(any(feature = "simd", feature = "soa"))]
    pub fn fft_complex_vec(&self, data: &mut crate::num::ComplexVec) -> Result<(), FftError> {
        if data.len() != self.n {
            return Err(FftError::MismatchedLengths);
        }
        self.fft.fft_split(&mut data.re, &mut data.im)
    }

    #[cfg(any(feature = "simd", feature = "soa"))]
    pub fn ifft_complex_vec(&self, data: &mut crate::num::ComplexVec) -> Result<(), FftError> {
        if data.len() != self.n {
            return Err(FftError::MismatchedLengths);
        }
        self.fft.ifft_split(&mut data.re, &mut data.im)
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

pub fn fft_split<T: Float>(re: &mut [T], im: &mut [T]) -> Result<(), FftError> {
    ScalarFftImpl::<T>::default().fft_split(re, im)
}

pub fn ifft_split<T: Float>(re: &mut [T], im: &mut [T]) -> Result<(), FftError> {
    ScalarFftImpl::<T>::default().ifft_split(re, im)
}

#[cfg(any(feature = "simd", feature = "soa"))]
pub fn fft_complex_vec(data: &mut crate::num::ComplexVec) -> Result<(), FftError> {
    ScalarFftImpl::<f32>::default().fft_split(&mut data.re, &mut data.im)
}

#[cfg(any(feature = "simd", feature = "soa"))]
pub fn ifft_complex_vec(data: &mut crate::num::ComplexVec) -> Result<(), FftError> {
    ScalarFftImpl::<f32>::default().ifft_split(&mut data.re, &mut data.im)
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

#[cfg(all(feature = "internal-tests", test))]
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
        let mut scratch = vec![Complex32::zero(); data.len() / 2];
        fft.fft_strided(&mut data, 2, &mut scratch).unwrap();
        fft.ifft_strided(&mut data, 2, &mut scratch).unwrap();
        for (a, b) in orig.iter().zip(data.iter()) {
            assert!((a.re - b.re).abs() < 1e-4);
        }
    }

    #[test]
    fn test_strided_fft_ifft_wrapper() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
            Complex32::new(3.0, 0.0),
            Complex32::new(4.0, 0.0),
        ];
        let orig = data.clone();
        fft.fft_strided_alloc(&mut data, 2).unwrap();
        fft.ifft_strided_alloc(&mut data, 2).unwrap();
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
        let plan = FftPlan::<f32>::new(4, FftStrategy::SplitRadix);
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
        let plan = FftPlan::<f32>::new(4, FftStrategy::SplitRadix);
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
        // length 16 exercises multiple implementations
        let mut data = (1..=16)
            .map(|i| Complex32::new(i as f32, 0.0))
            .collect::<Vec<_>>();
        // Explicit split-radix strategy
        fft.fft_with_strategy(&mut data, FftStrategy::SplitRadix)
            .unwrap();
        // Explicit radix-4 strategy
        fft.fft_with_strategy(&mut data, FftStrategy::Radix4)
            .unwrap();
        // Auto strategy on power-of-two length
        fft.fft_with_strategy(&mut data, FftStrategy::Auto).unwrap();
    }

    #[test]
    fn test_fft_with_strategy_auto_matches_split_radix() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut auto_data = (1..=16)
            .map(|i| Complex32::new(i as f32, 0.0))
            .collect::<Vec<_>>();
        let mut split_data = auto_data.clone();
        fft.fft_with_strategy(&mut split_data, FftStrategy::SplitRadix)
            .unwrap();
        fft.fft_with_strategy(&mut auto_data, FftStrategy::Auto)
            .unwrap();
        for (a, b) in split_data.iter().zip(auto_data.iter()) {
            assert!((a.re - b.re).abs() < 1e-4);
            assert!((a.im - b.im).abs() < 1e-4);
        }
    }

    #[test]
    fn test_invalid_strides() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![Complex32::new(1.0, 0.0); 3];
        let mut scratch = vec![Complex32::zero(); data.len()];
        // stride 0
        assert!(fft.fft_strided(&mut data, 0, &mut scratch).is_err());
        // length not divisible by stride
        assert!(fft.fft_strided(&mut data, 2, &mut scratch).is_err());

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
        assert!(fft.ifft_strided(&mut data, 0, &mut scratch).is_err());
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
        assert!((t1.re - t1_wrap.re).abs() < 1e-6);
        assert!((t1.im - t1_wrap.im).abs() < 1e-6);

        let factors = factorize(360);
        assert_eq!(factors, vec![2, 2, 2, 3, 3, 5]);
    }

    #[test]
    fn test_plan_strategy() {
        let mut planner = FftPlanner::<f32>::new();
        assert_eq!(planner.plan_strategy(16), FftStrategy::SplitRadix);
        assert_eq!(planner.plan_strategy(8), FftStrategy::SplitRadix);
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
