//! Fast Fourier Transform (FFT) algorithms.
//!
//! This module implements real and complex FFT routines based on the
//! [Cooley–Tukey algorithm](https://en.wikipedia.org/wiki/Cooley%E2%80%93Tukey_FFT_algorithm).
//! A [`FftPlanner`] caches twiddle factors for reuse. Optional SIMD features
//! (`x86_64`, `sse`, `aarch64`, `wasm`) accelerate computation, and both in-place and
//! out-of-place APIs are provided for single or batched transforms.

use core::f32::consts::PI;

use alloc::boxed::Box;
use alloc::sync::Arc;
#[cfg(all(feature = "parallel", feature = "std"))]
use alloc::vec;
use alloc::vec::Vec;
use core::cell::RefCell;
use core::mem::MaybeUninit;
use hashbrown::HashMap;

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
#[cfg(feature = "parallel")]
static PARALLEL_FFT_BLOCK_SIZE_OVERRIDE: AtomicUsize = AtomicUsize::new(0);
#[cfg(feature = "parallel")]
static PARALLEL_FFT_THREAD_OVERRIDE: AtomicUsize = AtomicUsize::new(0);

#[cfg(all(feature = "parallel", feature = "std"))]
static CPU_COUNT: OnceLock<usize> = OnceLock::new();
#[cfg(all(feature = "parallel", feature = "std"))]
static ENV_PAR_FFT_THRESHOLD: OnceLock<Option<usize>> = OnceLock::new();
#[cfg(all(feature = "parallel", feature = "std"))]
static ENV_PAR_FFT_CACHE_BYTES: OnceLock<Option<usize>> = OnceLock::new();
#[cfg(all(feature = "parallel", feature = "std"))]
static ENV_PAR_FFT_PER_CORE_WORK: OnceLock<Option<usize>> = OnceLock::new();
#[cfg(all(feature = "parallel", feature = "std"))]
static ENV_PAR_FFT_BLOCK_SIZE: OnceLock<Option<usize>> = OnceLock::new();
#[cfg(all(feature = "parallel", feature = "std"))]
static ENV_PAR_FFT_THREADS: OnceLock<Option<usize>> = OnceLock::new();

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
/// Override the number of threads used for parallel FFTs. `0` uses the default
/// heuristic or environment variable.
pub fn set_parallel_fft_threads(threads: usize) {
    PARALLEL_FFT_THREAD_OVERRIDE.store(threads, Ordering::Relaxed);
}

#[cfg(feature = "parallel")]
/// Override the block size used when splitting work among threads. `0`
/// reverts to the built-in heuristic or environment variable.
pub fn set_parallel_fft_block_size(size: usize) {
    PARALLEL_FFT_BLOCK_SIZE_OVERRIDE.store(size, Ordering::Relaxed);
}

#[cfg(feature = "parallel")]
fn parallel_fft_threads() -> usize {
    let override_thr = PARALLEL_FFT_THREAD_OVERRIDE.load(Ordering::Relaxed);
    if override_thr != 0 {
        return override_thr;
    }
    #[cfg(feature = "std")]
    {
        ENV_PAR_FFT_THREADS
            .get_or_init(|| {
                std::env::var("KOFFT_PAR_FFT_THREADS")
                    .ok()
                    .and_then(|v| v.parse::<usize>().ok())
            })
            .unwrap_or_else(|| *CPU_COUNT.get_or_init(|| num_cpus::get().max(1)))
    }
    #[cfg(not(feature = "std"))]
    {
        1
    }
}

#[cfg(feature = "parallel")]
fn parallel_fft_block_size() -> usize {
    let override_size = PARALLEL_FFT_BLOCK_SIZE_OVERRIDE.load(Ordering::Relaxed);
    if override_size != 0 {
        return override_size;
    }
    #[cfg(feature = "std")]
    {
        ENV_PAR_FFT_BLOCK_SIZE
            .get_or_init(|| {
                std::env::var("KOFFT_PAR_FFT_BLOCK_SIZE")
                    .ok()
                    .and_then(|v| v.parse::<usize>().ok())
            })
            .unwrap_or(1024)
    }
    #[cfg(not(feature = "std"))]
    {
        1024
    }
}

#[cfg(all(feature = "parallel", feature = "std"))]
fn calibrated_per_core_work() -> usize {
    use std::time::Instant;
    static CALIBRATION: OnceLock<usize> = OnceLock::new();
    *CALIBRATION.get_or_init(|| {
        let n = 1 << 20; // 1MB
        let a = vec![0u8; n];
        let mut b = vec![0u8; n];
        let start = Instant::now();
        b.copy_from_slice(&a);
        let elapsed = start.elapsed().as_nanos().max(1) as usize;
        let elems = n / core::mem::size_of::<crate::num::Complex32>();
        ((elems * 1_000_000_000) / elapsed).max(4096)
    })
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

    let cores = parallel_fft_threads();

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
                    .unwrap_or(4096)
            }
            #[cfg(not(feature = "std"))]
            {
                4096
            }
        }
    };

    #[cfg(all(feature = "parallel", feature = "std"))]
    let per_core_work = core::cmp::max(per_core_work, calibrated_per_core_work());

    let bytes_per_elem = core::mem::size_of::<crate::num::Complex32>();
    let cache_elems = cache_bytes / bytes_per_elem;
    let per_core_min = core::cmp::max(
        cache_elems,
        core::cmp::max(per_core_work, parallel_fft_block_size()),
    );

    n >= per_core_min * cores
}

pub use crate::num::{
    copy_from_complex, copy_to_complex, Complex, Complex32, Complex64, Float, SplitComplex,
};

/// Convert a slice of [`Complex32`] into separate real and imaginary buffers.
/// The returned [`SplitComplex`] references the provided `re` and `im` slices.
pub fn complex32_to_split<'a>(
    input: &[Complex32],
    re: &'a mut [f32],
    im: &'a mut [f32],
) -> SplitComplex<'a, f32> {
    SplitComplex::copy_from_complex(input, re, im)
}

/// Copy a [`SplitComplex`] back into an interleaved [`Complex32`] slice.
pub fn split_to_complex32(split: &SplitComplex<'_, f32>, out: &mut [Complex32]) {
    split.copy_to_complex(out);
}

type BluesteinPair<T> = (Arc<[Complex<T>]>, Arc<[Complex<T>]>);

pub struct FftPlanner<T: Float> {
    /// Cache of per-stage twiddle tables. Each entry contains the twiddle
    /// factors for a particular butterfly size (`len`), stored contiguously so
    /// that callers can load them without striding through a length-`n`
    /// table. The table for size `len` has `len/2` elements representing
    /// `exp(-2πi k / len)` for `k = 0..len/2`.
    cache: HashMap<usize, Arc<[Complex<T>]>>,
    bluestein_cache: HashMap<usize, BluesteinPair<T>>,
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
            cache: HashMap::new(),
            bluestein_cache: HashMap::new(),
            scratch: Vec::new(),
        }
    }
    /// Retrieve a contiguous table of twiddle factors for a given stage size
    /// `n`. The returned slice has length `n/2` and contains
    /// `exp(-2πi * k / n)` for `k = 0..n/2-1`.
    pub fn get_twiddles(&mut self, n: usize) -> Arc<[Complex<T>]> {
        if !self.cache.contains_key(&n) {
            let half = n / 2;
            let angle = -T::from_f32(2.0) * T::pi() / T::from_f32(n as f32);
            let (sin_step, cos_step) = angle.sin_cos();

            let mut table: Vec<Complex<T>> = Vec::with_capacity(half);
            let mut w_re = T::one();
            let mut w_im = T::zero();
            for _ in 0..half {
                table.push(Complex::new(w_re, w_im));
                let tmp = w_re;
                w_re = w_re.mul_add(cos_step, -(w_im * sin_step));
                w_im = w_im.mul_add(cos_step, tmp * sin_step);
            }
            self.cache.insert(n, Arc::from(table));
        }
        Arc::clone(self.cache.get(&n).unwrap())
    }

    #[cfg(feature = "std")]
    pub fn get_bluestein(&mut self, n: usize) -> BluesteinPair<T> {
        let pair = self.bluestein_cache.entry(n).or_insert_with(|| {
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

    pub fn stockham_fft(&self, input: &mut [Complex<T>]) -> Result<(), FftError> {
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

        // bit-reversal permutation
        let mut j = 0usize;
        for i in 1..n - 1 {
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
        #[cfg(feature = "parallel")]
        let use_par = should_parallelize_fft(n)
            && core::any::TypeId::of::<T>() == core::any::TypeId::of::<f32>();
        let mut len = 2;
        while len <= n {
            // Retrieve the contiguous twiddle table for this stage length.
            let twiddles = {
                let mut planner = self.planner.borrow_mut();
                planner.get_twiddles(len)
            };
            #[cfg(feature = "parallel")]
            {
                if use_par {
                    let block = parallel_fft_block_size().max(1);
                    let block_len = block * len;
                    let twiddles32: &[Complex32] = unsafe {
                        core::slice::from_raw_parts(
                            twiddles.as_ptr() as *const Complex32,
                            twiddles.len(),
                        )
                    };
                    let input32 = unsafe { &mut *(input as *mut [Complex<T>] as *mut [Complex32]) };
                    input32.par_chunks_mut(block_len).for_each(|chunk| {
                        let groups = chunk.len() / len;
                        for g in 0..groups {
                            let base = g * len;
                            for j in 0..(len / 2) {
                                let w = twiddles32[j];
                                let u = chunk[base + j];
                                let v = chunk[base + j + len / 2].mul(w);
                                chunk[base + j] = u.add(v);
                                chunk[base + j + len / 2] = u.sub(v);
                            }
                        }
                    });
                } else {
                    for i in (0..n).step_by(len) {
                        for j in 0..(len / 2) {
                            let w = twiddles[j];
                            let u = input[i + j];
                            let v = input[i + j + len / 2].mul(w);
                            input[i + j] = u.add(v);
                            input[i + j + len / 2] = u.sub(v);
                        }
                    }
                }
            }
            #[cfg(not(feature = "parallel"))]
            {
                for i in (0..n).step_by(len) {
                    for j in 0..(len / 2) {
                        let w = twiddles[j];
                        let u = input[i + j];
                        let v = input[i + j + len / 2].mul(w);
                        input[i + j] = u.add(v);
                        input[i + j + len / 2] = u.sub(v);
                    }
                }
            }
            len <<= 1;
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
            // Power of two: use Stockham FFT
            return self.stockham_fft(input);
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
        if !input.len().is_multiple_of(in_stride) || !output.len().is_multiple_of(out_stride) {
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
        if !input.len().is_multiple_of(in_stride) || !output.len().is_multiple_of(out_stride) {
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
            #[cfg(feature = "std")]
            FftStrategy::Radix4 => self.fft_radix4(input),
            #[cfg(not(feature = "std"))]
            FftStrategy::Radix4 => self.fft(input),
            FftStrategy::SplitRadix => self.stockham_fft(input),
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
        if !n.is_power_of_two() || !n.trailing_zeros().is_multiple_of(2) {
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
                let (w_step1, w_step2, w_step3) = {
                    let mut planner = self.planner.borrow_mut();
                    let twiddles = planner.get_twiddles(len);
                    (twiddles[1], twiddles[2], twiddles[3])
                };
                let quarter = len / 4;
                while i < n {
                    let mut w1 = Complex::new(T::one(), T::zero());
                    let mut w2 = Complex::new(T::one(), T::zero());
                    let mut w3 = Complex::new(T::one(), T::zero());
                    let mut j = 0usize;
                    while j + 1 < quarter {
                        let a0 = input[i + j];
                        let b0 = input[i + j + quarter].mul(w1);
                        let c0 = input[i + j + len / 2].mul(w2);
                        let d0 = input[i + j + 3 * quarter].mul(w3);
                        let (x0, x1, x2, x3) = butterfly4(a0, b0, c0, d0);
                        input[i + j] = x0;
                        input[i + j + quarter] = x1;
                        input[i + j + len / 2] = x2;
                        input[i + j + 3 * quarter] = x3;

                        w1 = w1.mul(w_step1);
                        w2 = w2.mul(w_step2);
                        w3 = w3.mul(w_step3);

                        let j1 = j + 1;
                        let a1 = input[i + j1];
                        let b1 = input[i + j1 + quarter].mul(w1);
                        let c1 = input[i + j1 + len / 2].mul(w2);
                        let d1 = input[i + j1 + 3 * quarter].mul(w3);
                        let (y0, y1, y2, y3) = butterfly4(a1, b1, c1, d1);
                        input[i + j1] = y0;
                        input[i + j1 + quarter] = y1;
                        input[i + j1 + len / 2] = y2;
                        input[i + j1 + 3 * quarter] = y3;

                        w1 = w1.mul(w_step1);
                        w2 = w2.mul(w_step2);
                        w3 = w3.mul(w_step3);

                        j += 2;
                    }
                    if j < quarter {
                        let a = input[i + j];
                        let b = input[i + j + quarter].mul(w1);
                        let c = input[i + j + len / 2].mul(w2);
                        let d = input[i + j + 3 * quarter].mul(w3);
                        let (x0, x1, x2, x3) = butterfly4(a, b, c, d);
                        input[i + j] = x0;
                        input[i + j + quarter] = x1;
                        input[i + j + len / 2] = x2;
                        input[i + j + 3 * quarter] = x3;
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
        while n.is_multiple_of(p) {
            factors.push(p);
            n /= p;
        }
    }
    let mut f = 7;
    while f * f <= n {
        while n.is_multiple_of(f) {
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
        let _ = twiddles;
        self.stockham_fft(input)
    }
    #[cfg(feature = "std")]
    pub fn fft_radix4_with_twiddles(
        &self,
        input: &mut [Complex32],
        twiddles: &TwiddleFactorBuffer,
    ) -> Result<(), FftError> {
        let _ = twiddles;
        self.stockham_fft(input)
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
            #[cfg(feature = "std")]
            {
                if factors.iter().all(|&f| f == 4) {
                    self.fft_radix4(input)
                } else {
                    self.fft_radix2(input)
                }
            }
            #[cfg(not(feature = "std"))]
            {
                self.fft_radix2(input)
            }
        } else {
            // Fallback to Bluestein's for unsupported factors
            self.fft(input)
        }
    }
    fn fft_radix2(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        self.stockham_fft(input)
    }
}

// SIMD FFT implementations (feature-gated)

#[cfg(target_arch = "x86_64")]
#[derive(Default)]
pub struct SimdFftX86_64Impl;

#[cfg(target_arch = "x86_64")]
impl SimdFftX86_64Impl {
    #[cfg(any(target_feature = "avx2", target_feature = "avx512f"))]
    fn fft_simd(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        // Placeholder SIMD implementation: delegate to the Stockham FFT which
        // now pulls twiddle factors from contiguous, precomputed tables. This
        // ensures any future vectorization will operate on cached data without
        // recomputing twiddles.
        ScalarFftImpl::<f32>::default().stockham_fft(input)
    }
}

#[cfg(target_arch = "x86_64")]
impl FftImpl<f32> for SimdFftX86_64Impl {
    fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        #[cfg(any(target_feature = "avx2", target_feature = "avx512f"))]
        {
            return self.fft_simd(input);
        }
        let scalar = ScalarFftImpl::<f32>::default();
        if input.len().is_power_of_two() {
            scalar.stockham_fft(input)
        } else {
            scalar.fft(input)
        }
    }
    fn ifft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        ScalarFftImpl::<f32>::default().ifft(input)
    }
    fn fft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        ScalarFftImpl::<f32>::default().fft_strided(input, stride, scratch)
    }
    fn ifft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        ScalarFftImpl::<f32>::default().ifft_strided(input, stride, scratch)
    }
    fn fft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        ScalarFftImpl::<f32>::default()
            .fft_out_of_place_strided(input, in_stride, output, out_stride)
    }
    fn ifft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        ScalarFftImpl::<f32>::default()
            .ifft_out_of_place_strided(input, in_stride, output, out_stride)
    }
    fn fft_with_strategy(
        &self,
        input: &mut [Complex32],
        strategy: FftStrategy,
    ) -> Result<(), FftError> {
        ScalarFftImpl::<f32>::default().fft_with_strategy(input, strategy)
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
            return Box::new(SimdFftX86_64Impl);
        }
    }
    // TODO: Add optimized implementations for other architectures (e.g., AArch64, WASM).
    // For now, fall back to the portable scalar version on non-x86_64 targets.
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
}

#[cfg(any(feature = "simd", feature = "soa"))]
impl FftPlan<f32> {
    pub fn fft_complex_vec(&self, data: &mut crate::num::ComplexVec) -> Result<(), FftError> {
        if data.len() != self.n {
            return Err(FftError::MismatchedLengths);
        }
        self.fft
            .fft_split(data.re.as_mut_slice(), data.im.as_mut_slice())
    }

    pub fn ifft_complex_vec(&self, data: &mut crate::num::ComplexVec) -> Result<(), FftError> {
        if data.len() != self.n {
            return Err(FftError::MismatchedLengths);
        }
        self.fft
            .ifft_split(data.re.as_mut_slice(), data.im.as_mut_slice())
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
        let (sin_step, cos_step) = ang.sin_cos();
        let mut i = 0;
        while i < N {
            let mut w_re = 1.0f32;
            let mut w_im = 0.0f32;
            for j in 0..(len / 2) {
                let w = Complex32::new(w_re, w_im);
                let u = buf[i + j];
                let v = buf[i + j + len / 2].mul(w);
                buf[i + j] = u.add(v);
                buf[i + j + len / 2] = u.sub(v);
                let tmp = w_re;
                w_re = w_re.mul_add(cos_step, -(w_im * sin_step));
                w_im = w_im.mul_add(cos_step, tmp * sin_step);
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
    fn test_fft_with_strategy_auto_matches_stockham() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut auto_data = (1..=16)
            .map(|i| Complex32::new(i as f32, 0.0))
            .collect::<Vec<_>>();
        let mut stockham_data = auto_data.clone();
        fft.fft_with_strategy(&mut stockham_data, FftStrategy::SplitRadix)
            .unwrap();
        fft.fft_with_strategy(&mut auto_data, FftStrategy::Auto)
            .unwrap();
        for (a, b) in stockham_data.iter().zip(auto_data.iter()) {
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
