//! Real FFT (RFFT) utilities built on top of complex FFT routines.
//!
//! This module provides real-to-complex (`rfft`) and complex-to-real (`irfft`)
//! transforms by reusing the existing complex FFT implementations from
//! [`crate::fft`]. It also exposes stack-only helpers analogous to
//! [`crate::fft::fft_inplace_stack`] for embedded/`no_std` environments.

use alloc::{collections::VecDeque, sync::Arc, vec::Vec};

use hashbrown::HashMap;

use core::mem::MaybeUninit;

use crate::fft::{fft_inplace_stack, ifft_inplace_stack, Complex, Complex32, FftError, FftImpl};
use crate::num::Float;

/// Number of real samples that make up a complex pair.
pub const STRIDE: usize = 2;

/// Scalar used for halving values during post-processing.
pub const HALF: f32 = 0.5;

/// Smallest supported transform length.
pub const MIN_LEN: usize = STRIDE;

/// Maximum number of cached twiddle tables to retain in the planner.
pub const MAX_CACHE_ENTRIES: usize = 64;

/// Byte alignment in bytes required for safe SIMD loads and stores.
pub const SIMD_ALIGN: usize = 16;

/// Determine whether a slice's starting pointer satisfies [`SIMD_ALIGN`] alignment.
///
/// Empty slices are considered aligned because no memory access occurs.
#[inline]
fn is_aligned<T>(slice: &[T]) -> bool {
    slice.is_empty() || (slice.as_ptr() as usize) % SIMD_ALIGN == 0
}

/// Trait providing specialized real FFT implementations for concrete
/// floating-point types.
#[doc(hidden)]
pub trait RealFftNum: Float {
    #[cfg(feature = "compile-time-rfft")]
    fn load_precomputed(cache: &mut HashMap<usize, Arc<[Complex<Self>]>>);

    fn rfft_with_scratch_impl<F: FftImpl<Self> + ?Sized>(
        fft: &F,
        input: &mut [Self],
        output: &mut [Complex<Self>],
        scratch: &mut [Complex<Self>],
        twiddles: &[Complex<Self>],
        pack_twiddles: &[Complex<Self>],
    ) -> Result<(), FftError>;

    fn irfft_with_scratch_impl<F: FftImpl<Self> + ?Sized>(
        fft: &F,
        input: &mut [Complex<Self>],
        output: &mut [Self],
        scratch: &mut [Complex<Self>],
        twiddles: &[Complex<Self>],
        pack_twiddles: &[Complex<Self>],
    ) -> Result<(), FftError>;
}

impl RealFftNum for f32 {
    #[cfg(feature = "compile-time-rfft")]
    fn load_precomputed(cache: &mut HashMap<usize, Arc<[Complex<Self>]>>) {
        for &(m, table) in precomputed::F32 {
            cache.insert(m, Arc::from(table));
        }
    }

    fn rfft_with_scratch_impl<F: FftImpl<Self> + ?Sized>(
        fft: &F,
        input: &mut [Self],
        output: &mut [Complex<Self>],
        scratch: &mut [Complex<Self>],
        twiddles: &[Complex<Self>],
        pack_twiddles: &[Complex<Self>],
    ) -> Result<(), FftError> {
        #[cfg(all(target_arch = "x86_64", feature = "x86_64"))]
        {
            unsafe {
                rfft_direct_f32_avx(
                    |d| fft.fft(d),
                    input,
                    output,
                    scratch,
                    twiddles,
                    pack_twiddles,
                )
            }
        }
        #[cfg(all(target_arch = "aarch64", feature = "aarch64"))]
        {
            unsafe {
                rfft_direct_f32_neon(
                    |d| fft.fft(d),
                    input,
                    output,
                    scratch,
                    twiddles,
                    pack_twiddles,
                )
            }
        }
        #[cfg(not(any(
            all(target_arch = "x86_64", feature = "x86_64"),
            all(target_arch = "aarch64", feature = "aarch64"),
        )))]
        rfft_direct(fft, input, output, scratch, twiddles, pack_twiddles)
    }

    fn irfft_with_scratch_impl<F: FftImpl<Self> + ?Sized>(
        fft: &F,
        input: &mut [Complex<Self>],
        output: &mut [Self],
        scratch: &mut [Complex<Self>],
        twiddles: &[Complex<Self>],
        pack_twiddles: &[Complex<Self>],
    ) -> Result<(), FftError> {
        #[cfg(all(target_arch = "x86_64", feature = "x86_64"))]
        {
            unsafe {
                irfft_direct_f32_avx(
                    |d| fft.ifft(d),
                    input,
                    output,
                    scratch,
                    twiddles,
                    pack_twiddles,
                )
            }
        }
        #[cfg(all(target_arch = "aarch64", feature = "aarch64"))]
        {
            unsafe {
                irfft_direct_f32_neon(
                    |d| fft.ifft(d),
                    input,
                    output,
                    scratch,
                    twiddles,
                    pack_twiddles,
                )
            }
        }
        #[cfg(not(any(
            all(target_arch = "x86_64", feature = "x86_64"),
            all(target_arch = "aarch64", feature = "aarch64"),
        )))]
        irfft_direct(fft, input, output, scratch, twiddles, pack_twiddles)
    }
}

impl RealFftNum for f64 {
    #[cfg(feature = "compile-time-rfft")]
    fn load_precomputed(cache: &mut HashMap<usize, Arc<[Complex<Self>]>>) {
        for &(m, table) in precomputed::F64 {
            cache.insert(m, Arc::from(table));
        }
    }

    fn rfft_with_scratch_impl<F: FftImpl<Self> + ?Sized>(
        fft: &F,
        input: &mut [Self],
        output: &mut [Complex<Self>],
        scratch: &mut [Complex<Self>],
        twiddles: &[Complex<Self>],
        pack_twiddles: &[Complex<Self>],
    ) -> Result<(), FftError> {
        rfft_direct(fft, input, output, scratch, twiddles, pack_twiddles)
    }

    fn irfft_with_scratch_impl<F: FftImpl<Self> + ?Sized>(
        fft: &F,
        input: &mut [Complex<Self>],
        output: &mut [Self],
        scratch: &mut [Complex<Self>],
        twiddles: &[Complex<Self>],
        pack_twiddles: &[Complex<Self>],
    ) -> Result<(), FftError> {
        irfft_direct(fft, input, output, scratch, twiddles, pack_twiddles)
    }
}

#[cfg(feature = "compile-time-rfft")]
mod precomputed {
    use crate::fft::{Complex32, Complex64};
    pub const F32: &[(usize, &[Complex32])] = &[];
    pub const F64: &[(usize, &[Complex64])] = &[];
}

/// Build a table of `m` complex twiddle factors.
///
/// Returns an error if `m` is zero or cannot be represented as the
/// floating-point type `T`, preventing invalid angles or excessive
/// allocations.
fn build_twiddle_table<T: Float>(m: usize) -> Result<alloc::vec::Vec<Complex<T>>, FftError> {
    if m == 0 {
        return Err(FftError::InvalidValue);
    }
    let m_t = T::from_usize(m).ok_or(FftError::InvalidValue)?;
    let angle = -T::pi() / m_t;
    let (sin_step, cos_step) = angle.sin_cos();
    let w = Complex::new(cos_step, sin_step);
    let mut table = alloc::vec::Vec::with_capacity(m);
    let mut current = Complex::new(T::one(), T::zero());
    for _ in 0..m {
        table.push(current);
        current = current.mul(w);
    }
    Ok(table)
}

/// Planner that caches RFFT twiddle tables by transform length.
///
/// In addition to the standard post-processing twiddles used by the
/// split-radix real FFT algorithm we also cache a second set of tables
/// that are employed when packing and unpacking the real/imaginary parts
/// of the input and output buffers.  These additional "pack" twiddles are
/// conceptually identical to the ones used by the [`realfft`] crate and
/// allow the kernels below to operate directly on the packed buffer without
/// recomputing trigonometric values on every invocation. Cached tables are
/// evicted in least-recently-used order when more than [`MAX_CACHE_ENTRIES`]
/// are retained to prevent unbounded memory growth.
pub struct RfftPlanner<T: RealFftNum> {
    /// Post-processing twiddle factors used after the complex FFT.
    cache: HashMap<usize, Arc<[Complex<T>]>>,
    /// LRU order for the post-processing twiddle cache.
    cache_order: VecDeque<usize>,
    /// Twiddles used when packing/unpacking the real-even/odd layout.
    pack_cache: HashMap<usize, Arc<[Complex<T>]>>,
    /// LRU order for the pack/unpack twiddle cache.
    pack_cache_order: VecDeque<usize>,
    /// Reusable scratch buffer.
    scratch: Vec<Complex<T>>,
}

impl<T: RealFftNum> Default for RfftPlanner<T> {
    fn default() -> Self {
        // Precomputed lengths are well-defined; unwrap is safe here.
        Self::new().expect("valid precomputed lengths")
    }
}

impl<T: RealFftNum> RfftPlanner<T> {
    /// Common transform lengths that are precomputed during planner
    /// construction. These cover typical power-of-two sizes used in audio
    /// and DSP applications and provide a sensible baseline without any
    /// runtime allocation.
    const PRECOMPUTED: &'static [usize] = &[2, 4, 8, 16, 32, 64, 128, 256];

    /// Create a new [`RfftPlanner`].
    pub fn new() -> Result<Self, FftError> {
        let mut cache: HashMap<usize, Arc<[Complex<T>]>> = HashMap::new();
        let mut pack_cache: HashMap<usize, Arc<[Complex<T>]>> = HashMap::new();
        let mut cache_order = VecDeque::new();
        let mut pack_cache_order = VecDeque::new();

        #[cfg(feature = "compile-time-rfft")]
        {
            T::load_precomputed(&mut cache);
            for &k in cache.keys() {
                cache_order.push_back(k);
            }
        }

        for &m in Self::PRECOMPUTED {
            if !cache.contains_key(&m) {
                let vec = build_twiddle_table::<T>(m)?;
                cache.insert(m, Arc::from(vec));
                cache_order.push_back(m);
            }
            if !pack_cache.contains_key(&m) {
                let vec = build_twiddle_table::<T>(m)?;
                pack_cache.insert(m, Arc::from(vec));
                pack_cache_order.push_back(m);
            }
        }

        Ok(Self {
            cache,
            cache_order,
            pack_cache,
            pack_cache_order,
            scratch: Vec::new(),
        })
    }

    /// Retrieve or build the twiddle table for length `m`.
    pub fn get_twiddles(&mut self, m: usize) -> Result<Arc<[Complex<T>]>, FftError> {
        if !self.cache.contains_key(&m) {
            let vec = build_twiddle_table::<T>(m)?;
            if self.cache.len() == MAX_CACHE_ENTRIES {
                if let Some(old) = self.cache_order.pop_front() {
                    self.cache.remove(&old);
                }
            }
            self.cache.insert(m, Arc::from(vec));
        }
        self.cache_order.retain(|&x| x != m);
        self.cache_order.push_back(m);
        Ok(Arc::clone(self.cache.get(&m).unwrap()))
    }

    /// Retrieve or build the pack/unpack twiddle table for length `m`.
    pub fn get_pack_twiddles(&mut self, m: usize) -> Result<Arc<[Complex<T>]>, FftError> {
        if !self.pack_cache.contains_key(&m) {
            let vec = build_twiddle_table::<T>(m)?;
            if self.pack_cache.len() == MAX_CACHE_ENTRIES {
                if let Some(old) = self.pack_cache_order.pop_front() {
                    self.pack_cache.remove(&old);
                }
            }
            self.pack_cache.insert(m, Arc::from(vec));
        }
        self.pack_cache_order.retain(|&x| x != m);
        self.pack_cache_order.push_back(m);
        Ok(Arc::clone(self.pack_cache.get(&m).unwrap()))
    }

    /// Number of entries currently stored in the twiddle cache.
    #[cfg(any(test, feature = "internal-tests"))]
    pub fn cache_len(&self) -> usize {
        self.cache.len()
    }

    /// Number of entries currently stored in the pack/unpack twiddle cache.
    #[cfg(any(test, feature = "internal-tests"))]
    pub fn pack_cache_len(&self) -> usize {
        self.pack_cache.len()
    }

    /// Compute a real-input FFT using cached twiddle tables.
    pub fn rfft_with_scratch<F: FftImpl<T> + ?Sized>(
        &mut self,
        fft: &F,
        input: &mut [T],
        output: &mut [Complex<T>],
        scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let n = input.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
            return Err(FftError::InvalidValue);
        }
        let m = n / STRIDE;
        if output.len() != m + 1 || scratch.len() < m {
            return Err(FftError::MismatchedLengths);
        }
        let twiddles = self.get_twiddles(m)?;
        let pack_twiddles = self.get_pack_twiddles(m)?;
        T::rfft_with_scratch_impl(
            fft,
            input,
            output,
            scratch,
            twiddles.as_ref(),
            pack_twiddles.as_ref(),
        )
    }

    /// Convenience wrapper that allocates a scratch buffer internally.
    pub fn rfft<F: FftImpl<T> + ?Sized>(
        &mut self,
        fft: &F,
        input: &mut [T],
        output: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let n = input.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
            return Err(FftError::InvalidValue);
        }
        if output.len() != n / STRIDE + 1 {
            return Err(FftError::MismatchedLengths);
        }
        let scratch_len = n / STRIDE;
        let mut scratch = core::mem::take(&mut self.scratch);
        if scratch.len() < scratch_len {
            scratch.resize(scratch_len, Complex::zero());
        }
        let res = self.rfft_with_scratch(fft, input, output, &mut scratch[..scratch_len]);
        self.scratch = scratch;
        res
    }

    /// Compute the inverse real FFT using cached twiddle tables.
    pub fn irfft_with_scratch<F: FftImpl<T> + ?Sized>(
        &mut self,
        fft: &F,
        input: &mut [Complex<T>],
        output: &mut [T],
        scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let n = output.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
            return Err(FftError::InvalidValue);
        }
        let m = n / STRIDE;
        if input.len() != m + 1 || scratch.len() < m {
            return Err(FftError::MismatchedLengths);
        }
        let twiddles = self.get_twiddles(m)?;
        let pack_twiddles = self.get_pack_twiddles(m)?;
        T::irfft_with_scratch_impl(
            fft,
            input,
            output,
            scratch,
            twiddles.as_ref(),
            pack_twiddles.as_ref(),
        )
    }

    /// Convenience wrapper that allocates scratch internally.
    pub fn irfft<F: FftImpl<T> + ?Sized>(
        &mut self,
        fft: &F,
        input: &mut [Complex<T>],
        output: &mut [T],
    ) -> Result<(), FftError> {
        let n = output.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
            return Err(FftError::InvalidValue);
        }
        if input.len() != n / STRIDE + 1 {
            return Err(FftError::MismatchedLengths);
        }
        let scratch_len = n / STRIDE;
        let mut scratch = core::mem::take(&mut self.scratch);
        if scratch.len() < scratch_len {
            scratch.resize(scratch_len, Complex::zero());
        }
        let res = self.irfft_with_scratch(fft, input, output, &mut scratch[..scratch_len]);
        self.scratch = scratch;
        res
    }
}

/// Old packed real FFT kernel used for comparison and fallback.
pub fn rfft_packed<T: RealFftNum, F: FftImpl<T>>(
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
    if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
        return Err(FftError::InvalidValue);
    }
    let m = n / STRIDE;
    if output.len() != m + 1 || scratch.len() < m {
        return Err(FftError::MismatchedLengths);
    }
    for i in 0..m {
        scratch[i] = Complex::new(input[STRIDE * i], input[STRIDE * i + 1]);
    }
    fft.fft(&mut scratch[..m])?;
    let y0 = scratch[0];
    output[0] = Complex::new(y0.re + y0.im, T::zero());
    output[m] = Complex::new(y0.re - y0.im, T::zero());
    let half = T::from_f32(HALF);
    let twiddles = planner.get_twiddles(m)?;
    for k in 1..m {
        let a = scratch[k];
        let b = Complex::new(scratch[m - k].re, -scratch[m - k].im);
        let sum = a.add(b);
        let diff = a.sub(b);
        let w = twiddles[k];
        let t = w.mul(diff);
        let temp = sum.add(Complex::new(t.im, -t.re));
        output[k] = Complex::new(temp.re * half, temp.im * half);
    }
    Ok(())
}

/// Packed inverse real FFT kernel used for comparison and fallback.
pub fn irfft_packed<T: RealFftNum, F: FftImpl<T>>(
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
    if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
        return Err(FftError::InvalidValue);
    }
    let m = n / STRIDE;
    if input.len() != m + 1 || scratch.len() < m {
        return Err(FftError::MismatchedLengths);
    }
    let half = T::from_f32(HALF);
    scratch[0] = Complex::new(
        (input[0].re + input[m].re) * half,
        (input[0].re - input[m].re) * half,
    );
    let twiddles = planner.get_twiddles(m)?;
    for k in 1..m {
        let a = input[k];
        let b = Complex::new(input[m - k].re, -input[m - k].im);
        let sum = a.add(b);
        let diff = a.sub(b);
        let w = Complex::new(twiddles[k].re, -twiddles[k].im);
        let t = w.mul(diff);
        let temp = sum.sub(Complex::new(t.im, -t.re));
        scratch[k] = Complex::new(temp.re * half, temp.im * half);
    }
    fft.ifft(&mut scratch[..m])?;
    for i in 0..m {
        output[STRIDE * i] = scratch[i].re;
        output[STRIDE * i + 1] = scratch[i].im;
    }
    Ok(())
}

/// Real FFT kernel using a half-size complex FFT with post-processing.
fn rfft_direct<T: Float, F: FftImpl<T> + ?Sized>(
    fft: &F,
    input: &mut [T],
    output: &mut [Complex<T>],
    scratch: &mut [Complex<T>],
    twiddles: &[Complex<T>],
    _pack_twiddles: &[Complex<T>],
) -> Result<(), FftError> {
    let n = input.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
        return Err(FftError::InvalidValue);
    }
    let m = n / STRIDE;
    if output.len() != m + 1 || scratch.len() < m {
        return Err(FftError::MismatchedLengths);
    }
    for i in 0..m {
        output[i] = Complex::new(input[STRIDE * i], input[STRIDE * i + 1]);
    }
    fft.fft(&mut output[..m])?;
    // Copy FFT results so we can perform the symmetric post-processing
    scratch[..m].copy_from_slice(&output[..m]);
    let y0 = scratch[0];
    output[0] = Complex::new(y0.re + y0.im, T::zero());
    output[m] = Complex::new(y0.re - y0.im, T::zero());
    let half = T::from_f32(HALF);
    for k in 1..m {
        let a = scratch[k];
        let b = Complex::new(scratch[m - k].re, -scratch[m - k].im);
        let sum = a.add(b);
        let diff = a.sub(b);
        let w = twiddles[k];
        let t = w.mul(diff);
        let temp = sum.add(Complex::new(t.im, -t.re));
        output[k] = Complex::new(temp.re * half, temp.im * half);
    }
    Ok(())
}

/// Inverse real FFT kernel using a half-size complex FFT with post-processing.
fn irfft_direct<T: Float, F: FftImpl<T> + ?Sized>(
    fft: &F,
    input: &mut [Complex<T>],
    output: &mut [T],
    scratch: &mut [Complex<T>],
    twiddles: &[Complex<T>],
    _pack_twiddles: &[Complex<T>],
) -> Result<(), FftError> {
    let n = output.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
        return Err(FftError::InvalidValue);
    }
    let m = n / STRIDE;
    if input.len() != m + 1 || scratch.len() < m {
        return Err(FftError::MismatchedLengths);
    }
    let half = T::from_f32(HALF);
    scratch[0] = Complex::new(
        (input[0].re + input[m].re) * half,
        (input[0].re - input[m].re) * half,
    );
    for k in 1..m {
        let a = input[k];
        let b = Complex::new(input[m - k].re, -input[m - k].im);
        let sum = a.add(b);
        let diff = a.sub(b);
        let w = Complex::new(twiddles[k].re, -twiddles[k].im);
        let t = w.mul(diff);
        let temp = sum.sub(Complex::new(t.im, -t.re));
        scratch[k] = Complex::new(temp.re * half, temp.im * half);
    }
    fft.ifft(&mut scratch[..m])?;
    for i in 0..m {
        output[STRIDE * i] = scratch[i].re;
        output[STRIDE * i + 1] = scratch[i].im;
    }
    Ok(())
}

/// Scalar fallback implementation for a 32-bit real-input FFT.
///
/// This mirrors [`rfft_direct`] but accepts an FFT closure so it can be used
/// when SIMD prerequisites such as [`SIMD_ALIGN`] alignment are not met.
fn rfft_direct_f32_scalar<F>(
    mut fft: F,
    input: &mut [f32],
    output: &mut [Complex32],
    scratch: &mut [Complex32],
    twiddles: &[Complex32],
    _pack_twiddles: &[Complex32],
) -> Result<(), FftError>
where
    F: FnMut(&mut [Complex32]) -> Result<(), FftError>,
{
    let n = input.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
        return Err(FftError::InvalidValue);
    }
    let m = n / STRIDE;
    if output.len() != m + 1 || scratch.len() < m {
        return Err(FftError::MismatchedLengths);
    }
    for i in 0..m {
        output[i] = Complex32::new(input[STRIDE * i], input[STRIDE * i + 1]);
    }
    fft(&mut output[..m])?;
    scratch[..m].copy_from_slice(&output[..m]);
    let y0 = scratch[0];
    output[0] = Complex32::new(y0.re + y0.im, 0.0);
    output[m] = Complex32::new(y0.re - y0.im, 0.0);
    let half = HALF;
    for k in 1..m {
        let a = scratch[k];
        let b = Complex32::new(scratch[m - k].re, -scratch[m - k].im);
        let sum_re = a.re + b.re;
        let sum_im = a.im + b.im;
        let diff_re = a.re - b.re;
        let diff_im = a.im - b.im;
        let w = twiddles[k];
        let t = Complex32::new(
            diff_re * w.re - diff_im * w.im,
            diff_re * w.im + diff_im * w.re,
        );
        output[k] = Complex32::new((sum_re + t.im) * half, (sum_im - t.re) * half);
    }
    Ok(())
}

/// Scalar fallback implementation for a 32-bit inverse real-input FFT.
///
/// Used when SIMD alignment checks fail in [`irfft_direct_f32_avx`] or
/// [`irfft_direct_f32_neon`]. Accepts an IFFT closure identical to
/// [`irfft_direct`].
fn irfft_direct_f32_scalar<F>(
    mut ifft: F,
    input: &mut [Complex32],
    output: &mut [f32],
    scratch: &mut [Complex32],
    twiddles: &[Complex32],
    _pack_twiddles: &[Complex32],
) -> Result<(), FftError>
where
    F: FnMut(&mut [Complex32]) -> Result<(), FftError>,
{
    let n = output.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
        return Err(FftError::InvalidValue);
    }
    let m = n / STRIDE;
    if input.len() != m + 1 || scratch.len() < m {
        return Err(FftError::MismatchedLengths);
    }
    let half = HALF;
    scratch[0] = Complex32::new(
        (input[0].re + input[m].re) * half,
        (input[0].re - input[m].re) * half,
    );
    for k in 1..m {
        let a = input[k];
        let b = Complex32::new(input[m - k].re, -input[m - k].im);
        let sum_re = a.re + b.re;
        let sum_im = a.im + b.im;
        let diff_re = a.re - b.re;
        let diff_im = a.im - b.im;
        let w = Complex32::new(twiddles[k].re, -twiddles[k].im);
        let t = Complex32::new(
            diff_re * w.re - diff_im * w.im,
            diff_re * w.im + diff_im * w.re,
        );
        scratch[k] = Complex32::new((sum_re - t.im) * half, (sum_im + t.re) * half);
    }
    ifft(&mut scratch[..m])?;
    for i in 0..m {
        output[STRIDE * i] = scratch[i].re;
        output[STRIDE * i + 1] = scratch[i].im;
    }
    Ok(())
}

#[cfg(all(target_arch = "x86_64", feature = "x86_64"))]
use core::arch::x86_64::*;

#[cfg(all(target_arch = "x86_64", feature = "x86_64"))]
#[target_feature(enable = "avx")]
/// AVX-accelerated real-input FFT kernel.
unsafe fn rfft_direct_f32_avx<F>(
    mut fft: F,
    input: &mut [f32],
    output: &mut [Complex32],
    scratch: &mut [Complex32],
    twiddles: &[Complex32],
    _pack_twiddles: &[Complex32],
) -> Result<(), FftError>
where
    F: FnMut(&mut [Complex32]) -> Result<(), FftError>,
{
    let n = input.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
        return Err(FftError::InvalidValue);
    }
    let m = n / STRIDE;
    if output.len() != m + 1 || scratch.len() < m {
        return Err(FftError::MismatchedLengths);
    }
    if !(is_aligned(input)
        && is_aligned(output)
        && is_aligned(scratch)
        && is_aligned(twiddles)
        && is_aligned(_pack_twiddles))
    {
        return rfft_direct_f32_scalar(fft, input, output, scratch, twiddles, _pack_twiddles);
    }
    for i in 0..m {
        output[i] = Complex32::new(input[STRIDE * i], input[STRIDE * i + 1]);
    }
    fft(&mut output[..m])?;
    scratch[..m].copy_from_slice(&output[..m]);
    let y0 = scratch[0];
    output[0] = Complex32::new(y0.re + y0.im, 0.0);
    output[m] = Complex32::new(y0.re - y0.im, 0.0);
    let half = _mm_set1_ps(HALF);
    for k in 1..m {
        let a = scratch[k];
        let b = Complex32::new(scratch[m - k].re, -scratch[m - k].im);
        let sum_re = a.re + b.re;
        let sum_im = a.im + b.im;
        let diff_re = a.re - b.re;
        let diff_im = a.im - b.im;
        let w = twiddles[k];
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
        output[k].re = _mm_cvtss_f32(res_re);
        output[k].im = _mm_cvtss_f32(res_im);
    }
    Ok(())
}

#[cfg(all(target_arch = "x86_64", feature = "x86_64"))]
#[target_feature(enable = "avx")]
/// AVX-accelerated inverse real-input FFT kernel.
unsafe fn irfft_direct_f32_avx<F>(
    mut ifft: F,
    input: &mut [Complex32],
    output: &mut [f32],
    scratch: &mut [Complex32],
    twiddles: &[Complex32],
    _pack_twiddles: &[Complex32],
) -> Result<(), FftError>
where
    F: FnMut(&mut [Complex32]) -> Result<(), FftError>,
{
    let n = output.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
        return Err(FftError::InvalidValue);
    }
    let m = n / STRIDE;
    if input.len() != m + 1 || scratch.len() < m {
        return Err(FftError::MismatchedLengths);
    }
    if !(is_aligned(input)
        && is_aligned(output)
        && is_aligned(scratch)
        && is_aligned(twiddles)
        && is_aligned(_pack_twiddles))
    {
        return irfft_direct_f32_scalar(ifft, input, output, scratch, twiddles, _pack_twiddles);
    }
    let half = _mm_set1_ps(HALF);
    let a0 = _mm_set_ss(input[0].re + input[m].re);
    let b0 = _mm_set_ss(input[0].re - input[m].re);
    scratch[0] = Complex32::new(
        _mm_cvtss_f32(_mm_mul_ss(a0, half)),
        _mm_cvtss_f32(_mm_mul_ss(b0, half)),
    );
    for k in 1..m {
        let a = input[k];
        let b = Complex32::new(input[m - k].re, -input[m - k].im);
        let sum_re = a.re + b.re;
        let sum_im = a.im + b.im;
        let diff_re = a.re - b.re;
        let diff_im = a.im - b.im;
        let w = Complex32::new(twiddles[k].re, -twiddles[k].im);
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
        scratch[k].re = _mm_cvtss_f32(res_re);
        scratch[k].im = _mm_cvtss_f32(res_im);
    }
    ifft(&mut scratch[..m])?;
    for i in 0..m {
        output[STRIDE * i] = scratch[i].re;
        output[STRIDE * i + 1] = scratch[i].im;
    }
    Ok(())
}

#[cfg(all(target_arch = "aarch64", feature = "aarch64"))]
use core::arch::aarch64::*;

#[cfg(all(target_arch = "aarch64", feature = "aarch64"))]
#[target_feature(enable = "neon")]
/// NEON-accelerated real-input FFT kernel.
unsafe fn rfft_direct_f32_neon<F>(
    mut fft: F,
    input: &mut [f32],
    output: &mut [Complex32],
    scratch: &mut [Complex32],
    twiddles: &[Complex32],
    _pack_twiddles: &[Complex32],
) -> Result<(), FftError>
where
    F: FnMut(&mut [Complex32]) -> Result<(), FftError>,
{
    let n = input.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
        return Err(FftError::InvalidValue);
    }
    let m = n / STRIDE;
    if output.len() != m + 1 || scratch.len() < m {
        return Err(FftError::MismatchedLengths);
    }
    for i in 0..m {
        output[i] = Complex32::new(input[STRIDE * i], input[STRIDE * i + 1]);
    }
    fft(&mut output[..m])?;
    scratch[..m].copy_from_slice(&output[..m]);
    let y0 = scratch[0];
    output[0] = Complex32::new(y0.re + y0.im, 0.0);
    output[m] = Complex32::new(y0.re - y0.im, 0.0);
    let half = vdupq_n_f32(HALF);
    for k in 1..m {
        let a = scratch[k];
        let b = Complex32::new(scratch[m - k].re, -scratch[m - k].im);
        let sum_re = a.re + b.re;
        let sum_im = a.im + b.im;
        let diff_re = a.re - b.re;
        let diff_im = a.im - b.im;
        let w = twiddles[k];
        let v_re = vdupq_n_f32(diff_re);
        let v_im = vdupq_n_f32(diff_im);
        let w_re = vdupq_n_f32(w.re);
        let w_im = vdupq_n_f32(w.im);
        let t1 = vmulq_f32(v_re, w_re);
        let t2 = vmulq_f32(v_im, w_im);
        let t3 = vmulq_f32(v_re, w_im);
        let t4 = vmulq_f32(v_im, w_re);
        let vw_re = vsubq_f32(t1, t2);
        let vw_im = vaddq_f32(t3, t4);
        let t_re = vgetq_lane_f32(vw_re, 0);
        let t_im = vgetq_lane_f32(vw_im, 0);
        let temp_re = sum_re + t_im;
        let temp_im = sum_im - t_re;
        let res_re = vmulq_f32(vdupq_n_f32(temp_re), half);
        let res_im = vmulq_f32(vdupq_n_f32(temp_im), half);
        output[k].re = vgetq_lane_f32(res_re, 0);
        output[k].im = vgetq_lane_f32(res_im, 0);
    }
    Ok(())
}

#[cfg(all(target_arch = "aarch64", feature = "aarch64"))]
#[target_feature(enable = "neon")]
/// NEON-accelerated inverse real-input FFT kernel.
unsafe fn irfft_direct_f32_neon<F>(
    mut ifft: F,
    input: &mut [Complex32],
    output: &mut [f32],
    scratch: &mut [Complex32],
    twiddles: &[Complex32],
    _pack_twiddles: &[Complex32],
) -> Result<(), FftError>
where
    F: FnMut(&mut [Complex32]) -> Result<(), FftError>,
{
    let n = output.len();
    if n == 0 {
        return Err(FftError::EmptyInput);
    }
    if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
        return Err(FftError::InvalidValue);
    }
    let m = n / STRIDE;
    if input.len() != m + 1 || scratch.len() < m {
        return Err(FftError::MismatchedLengths);
    }
    if !(is_aligned(input)
        && is_aligned(output)
        && is_aligned(scratch)
        && is_aligned(twiddles)
        && is_aligned(_pack_twiddles))
    {
        return irfft_direct_f32_scalar(ifft, input, output, scratch, twiddles, _pack_twiddles);
    }
    let half = vdupq_n_f32(HALF);
    let a0 = vdupq_n_f32(input[0].re + input[m].re);
    let b0 = vdupq_n_f32(input[0].re - input[m].re);
    scratch[0] = Complex32::new(
        vgetq_lane_f32(vmulq_f32(a0, half), 0),
        vgetq_lane_f32(vmulq_f32(b0, half), 0),
    );
    for k in 1..m {
        let a = input[k];
        let b = Complex32::new(input[m - k].re, -input[m - k].im);
        let sum_re = a.re + b.re;
        let sum_im = a.im + b.im;
        let diff_re = a.re - b.re;
        let diff_im = a.im - b.im;
        let w = Complex32::new(twiddles[k].re, -twiddles[k].im);
        let v_re = vdupq_n_f32(diff_re);
        let v_im = vdupq_n_f32(diff_im);
        let w_re = vdupq_n_f32(w.re);
        let w_im = vdupq_n_f32(w.im);
        let t1 = vmulq_f32(v_re, w_re);
        let t2 = vmulq_f32(v_im, w_im);
        let t3 = vmulq_f32(v_re, w_im);
        let t4 = vmulq_f32(v_im, w_re);
        let vw_re = vsubq_f32(t1, t2);
        let vw_im = vaddq_f32(t3, t4);
        let t_re = vgetq_lane_f32(vw_re, 0);
        let t_im = vgetq_lane_f32(vw_im, 0);
        let temp_re = sum_re - t_im;
        let temp_im = sum_im + t_re;
        let res_re = vmulq_f32(vdupq_n_f32(temp_re), half);
        let res_im = vmulq_f32(vdupq_n_f32(temp_im), half);
        scratch[k].re = vgetq_lane_f32(res_re, 0);
        scratch[k].im = vgetq_lane_f32(res_im, 0);
    }
    ifft(&mut scratch[..m])?;
    for i in 0..m {
        output[STRIDE * i] = scratch[i].re;
        output[STRIDE * i + 1] = scratch[i].im;
    }
    Ok(())
}

/// Trait providing real-valued FFT transforms built on top of [`FftImpl`].
pub trait RealFftImpl<T: RealFftNum>: FftImpl<T> {
    /// Compute the real-input FFT, producing `N/2 + 1` complex samples.
    /// The provided scratch buffer must have length `N/2` and is used as
    /// workspace for the intermediate complex FFT. When SIMD features are
    /// enabled this routine dispatches to SIMD-accelerated variants.
    fn rfft_with_scratch(
        &self,
        input: &mut [T],
        output: &mut [Complex<T>],
        scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let mut planner = RfftPlanner::new()?;
        planner.rfft_with_scratch(self, input, output, scratch)
    }

    /// Convenience wrapper that allocates a scratch buffer internally.
    fn rfft(&self, input: &mut [T], output: &mut [Complex<T>]) -> Result<(), FftError> {
        let n = input.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
            return Err(FftError::InvalidValue);
        }
        if output.len() != n / STRIDE + 1 {
            return Err(FftError::MismatchedLengths);
        }
        let scratch_len = n / STRIDE;
        let mut scratch: Vec<MaybeUninit<Complex<T>>> = Vec::with_capacity(scratch_len);
        // SAFETY: `rfft_with_scratch` initializes every element of the buffer
        // before any read occurs.
        unsafe {
            scratch.set_len(scratch_len);
            let scratch_slice = core::slice::from_raw_parts_mut(
                scratch.as_mut_ptr() as *mut Complex<T>,
                scratch_len,
            );
            self.rfft_with_scratch(input, output, scratch_slice)
        }
    }

    /// Compute the inverse real FFT, consuming `N/2 + 1` complex samples and
    /// producing `N` real time-domain values. A scratch buffer of length `N/2`
    /// is used to hold the intermediate complex data.
    fn irfft_with_scratch(
        &self,
        input: &mut [Complex<T>],
        output: &mut [T],
        scratch: &mut [Complex<T>],
    ) -> Result<(), FftError> {
        let mut planner = RfftPlanner::new()?;
        planner.irfft_with_scratch(self, input, output, scratch)
    }

    /// Convenience wrapper that allocates scratch internally.
    fn irfft(&self, input: &mut [Complex<T>], output: &mut [T]) -> Result<(), FftError> {
        let n = output.len();
        if n == 0 {
            return Err(FftError::EmptyInput);
        }
        if n < MIN_LEN || !n.is_multiple_of(STRIDE) {
            return Err(FftError::InvalidValue);
        }
        if input.len() != n / STRIDE + 1 {
            return Err(FftError::MismatchedLengths);
        }
        let scratch_len = n / STRIDE;
        let mut scratch: Vec<MaybeUninit<Complex<T>>> = Vec::with_capacity(scratch_len);
        // SAFETY: `irfft_with_scratch` initializes every element of the buffer
        // before any read occurs.
        unsafe {
            scratch.set_len(scratch_len);
            let scratch_slice = core::slice::from_raw_parts_mut(
                scratch.as_mut_ptr() as *mut Complex<T>,
                scratch_len,
            );
            self.irfft_with_scratch(input, output, scratch_slice)
        }
    }
}

// Blanket implementation for any complex FFT provider.
impl<T: RealFftNum, U: FftImpl<T>> RealFftImpl<T> for U {}

/// Perform a real-input FFT using only stack allocation.
///
/// The transform length `N` must be even and non-zero. The output buffer must
/// have length `N/2 + 1`.
pub fn rfft_stack<const N: usize, const M: usize>(
    input: &[f32; N],
    output: &mut [Complex32; M],
) -> Result<(), FftError> {
    if N == 0 {
        return Err(FftError::EmptyInput);
    }
    if N < MIN_LEN || N % STRIDE != 0 {
        return Err(FftError::InvalidValue);
    }
    if M != N / STRIDE + 1 {
        return Err(FftError::MismatchedLengths);
    }
    let mut buf = [Complex32::new(0.0, 0.0); N];
    for (b, &x) in buf.iter_mut().zip(input.iter()) {
        *b = Complex32::new(x, 0.0);
    }
    fft_inplace_stack(&mut buf)?;
    output[..(N / STRIDE + 1)].copy_from_slice(&buf[..(N / STRIDE + 1)]);
    Ok(())
}

/// Perform an inverse real-input FFT using only stack allocation.
///
/// The transform length `N` must be even and non-zero. The input buffer must
/// have length `N/2 + 1`.
pub fn irfft_stack<const N: usize, const M: usize>(
    input: &[Complex32; M],
    output: &mut [f32; N],
) -> Result<(), FftError> {
    if N == 0 {
        return Err(FftError::EmptyInput);
    }
    if N < MIN_LEN || N % STRIDE != 0 {
        return Err(FftError::InvalidValue);
    }
    if M != N / STRIDE + 1 {
        return Err(FftError::MismatchedLengths);
    }
    let mut buf = [Complex32::new(0.0, 0.0); N];
    buf[..(N / STRIDE + 1)].copy_from_slice(&input[..(N / STRIDE + 1)]);
    for k in 1..N / STRIDE {
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
        let mut freq = vec![Complex32::new(0.0, 0.0); input.len() / STRIDE + 1];
        let mut scratch = vec![Complex32::new(0.0, 0.0); input.len() / STRIDE];
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
        let mut freq = vec![Complex64::new(0.0, 0.0); input.len() / STRIDE + 1];
        let mut scratch = vec![Complex64::new(0.0, 0.0); input.len() / STRIDE];
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

#[cfg(test)]
mod twiddle_table_tests {
    use super::*;
    use crate::fft::Complex32;

    #[test]
    fn rejects_zero_length() {
        assert!(build_twiddle_table::<f32>(0).is_err());
    }

    #[test]
    fn rejects_unrepresentable_length() {
        assert!(build_twiddle_table::<f32>(usize::MAX).is_err());
    }

    #[test]
    fn builds_large_table() {
        const M: usize = 1024;
        let table = build_twiddle_table::<f32>(M).unwrap();
        assert_eq!(table.len(), M);
        assert_eq!(table[0], Complex32::new(1.0, 0.0));
    }
}
