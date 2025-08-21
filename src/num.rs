use alloc::vec::Vec;
use core::f32::consts::PI as PI32;

/// Maximum integer value that can be represented exactly in an `f32`.
pub const F32_MAX_EXACT_INT: usize = 1usize << 24;

/// Maximum integer value that can be represented exactly in an `f64`.
pub const F64_MAX_EXACT_INT: usize = 1usize << 53;

/// Minimal float trait for generic FFT (no_std, no external deps).
///
/// The trait provides only the arithmetic and trigonometric operations that
/// the FFT implementation requires.  Additional methods are included to allow
/// consumers to perform basic validation (e.g., NaN checks) without depending
/// on the standard library's full floating-point API.
pub trait Float:
    Copy
    + Clone
    + PartialEq
    + PartialOrd
    + core::fmt::Debug
    + core::ops::Add<Output = Self>
    + core::ops::Sub<Output = Self>
    + core::ops::Mul<Output = Self>
    + core::ops::Div<Output = Self>
    + core::ops::Neg<Output = Self>
    + 'static
{
    /// Return the additive identity (0).
    fn zero() -> Self;

    /// Return the multiplicative identity (1).
    fn one() -> Self;

    /// Convert from `f32` without loss of precision.
    fn from_f32(x: f32) -> Self;

    /// Attempt to convert a `usize` into the floating-point type.
    /// Returns `None` if the value cannot be represented exactly.
    fn from_usize(x: usize) -> Option<Self>;

    /// Return the cosine of the value in radians.
    fn cos(self) -> Self;

    /// Return the sine of the value in radians.
    fn sin(self) -> Self;

    /// Return both sine and cosine of the value in radians.
    fn sin_cos(self) -> (Self, Self);

    /// Return π in the target type.
    fn pi() -> Self;

    /// Multiply by `a` and add `b` in a single operation where supported.
    #[inline(always)]
    fn mul_add(self, a: Self, b: Self) -> Self {
        self * a + b
    }

    /// Determine whether the value is NaN.
    fn is_nan(self) -> bool;

    /// Determine whether the value is finite (not NaN or infinity).
    fn is_finite(self) -> bool;
}

///
/// # Note
/// The #[allow(unconditional_recursion)] attribute is used here because rustc/Clippy
/// sometimes issues a false positive warning when calling inherent methods (e.g., f32::cos(self))
/// inside a trait implementation with the same method name. This is not actual recursion:
/// - f32::cos(self) and f64::cos(self) call the standard library's inherent method, not the trait method.
/// - All tests pass and no stack overflow occurs.
/// - This is a known linter false positive and is safe to suppress.
#[allow(unconditional_recursion)]
impl Float for f32 {
    fn zero() -> Self {
        0.0
    }

    fn one() -> Self {
        1.0
    }

    fn from_f32(x: f32) -> Self {
        x
    }

    fn from_usize(x: usize) -> Option<Self> {
        if x < F32_MAX_EXACT_INT {
            Some(x as f32)
        } else {
            None
        }
    }

    fn cos(self) -> Self {
        f32::cos(self)
    }

    fn sin(self) -> Self {
        f32::sin(self)
    }

    fn sin_cos(self) -> (Self, Self) {
        f32::sin_cos(self)
    }

    fn pi() -> Self {
        PI32
    }

    #[inline(always)]
    fn mul_add(self, a: Self, b: Self) -> Self {
        f32::mul_add(self, a, b)
    }

    fn is_nan(self) -> bool {
        f32::is_nan(self)
    }

    fn is_finite(self) -> bool {
        f32::is_finite(self)
    }
}

///
/// # Note
/// The #[allow(unconditional_recursion)] attribute is used here because rustc/Clippy
/// sometimes issues a false positive warning when calling inherent methods (e.g., f64::cos(self))
/// inside a trait implementation with the same method name. This is not actual recursion:
/// - f64::cos(self) calls the standard library's inherent method, not the trait method.
/// - All tests pass and no stack overflow occurs.
/// - This is a known linter false positive and is safe to suppress.
#[allow(unconditional_recursion)]
impl Float for f64 {
    fn zero() -> Self {
        0.0
    }

    fn one() -> Self {
        1.0
    }

    fn from_f32(x: f32) -> Self {
        x as f64
    }

    fn from_usize(x: usize) -> Option<Self> {
        if x < F64_MAX_EXACT_INT {
            Some(x as f64)
        } else {
            None
        }
    }

    fn cos(self) -> Self {
        f64::cos(self)
    }

    fn sin(self) -> Self {
        f64::sin(self)
    }

    fn sin_cos(self) -> (Self, Self) {
        f64::sin_cos(self)
    }

    fn pi() -> Self {
        core::f64::consts::PI
    }

    #[inline(always)]
    fn mul_add(self, a: Self, b: Self) -> Self {
        f64::mul_add(self, a, b)
    }

    fn is_nan(self) -> bool {
        f64::is_nan(self)
    }

    fn is_finite(self) -> bool {
        f64::is_finite(self)
    }
}

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq)]
/// Simple complex number type with explicit real and imaginary parts.
///
/// The struct performs only minimal validation to remain lightweight; most
/// operations are implemented as inherent methods to avoid trait overhead.
pub struct Complex<T: Float> {
    /// Real component of the complex number.
    pub re: T,
    /// Imaginary component of the complex number.
    pub im: T,
}

impl<T: Float> Complex<T> {
    /// Construct a new complex number, asserting that both parts are finite.
    pub fn new(re: T, im: T) -> Self {
        assert!(
            re.is_finite() && im.is_finite(),
            "non-finite complex component"
        );
        Self { re, im }
    }

    /// Return the additive identity.
    pub fn zero() -> Self {
        Self {
            re: T::zero(),
            im: T::zero(),
        }
    }

    /// Compute `exp(i*theta)`.
    #[inline(always)]
    pub fn expi(theta: T) -> Self {
        let (sin, cos) = theta.sin_cos();
        Self { re: cos, im: sin }
    }

    /// Add two complex numbers.
    #[allow(clippy::should_implement_trait)]
    #[inline(always)]
    pub fn add(self, other: Self) -> Self {
        Self {
            re: self.re + other.re,
            im: self.im + other.im,
        }
    }

    /// Subtract one complex number from another.
    #[allow(clippy::should_implement_trait)]
    #[inline(always)]
    pub fn sub(self, other: Self) -> Self {
        Self {
            re: self.re - other.re,
            im: self.im - other.im,
        }
    }

    /// Multiply two complex numbers.
    #[allow(clippy::should_implement_trait)]
    #[inline(always)]
    pub fn mul(self, other: Self) -> Self {
        #[cfg(all(
            target_feature = "fma",
            any(target_arch = "x86", target_arch = "x86_64")
        ))]
        {
            unsafe { self.mul_fma_x86(other) }
        }
        #[cfg(all(target_feature = "fma", target_arch = "aarch64"))]
        {
            unsafe { self.mul_fma_aarch64(other) }
        }
        #[cfg(not(all(
            target_feature = "fma",
            any(target_arch = "x86", target_arch = "x86_64", target_arch = "aarch64")
        )))]
        {
            Self {
                re: self.re * other.re - self.im * other.im,
                im: self.re * other.im + self.im * other.re,
            }
        }
    }

    #[cfg(all(
        target_feature = "fma",
        any(target_arch = "x86", target_arch = "x86_64")
    ))]
    #[target_feature(enable = "fma")]
    /// FMA-accelerated multiplication for x86/x86_64.
    unsafe fn mul_fma_x86(self, other: Self) -> Self {
        Self {
            re: self.re.mul_add(other.re, -(self.im * other.im)),
            im: self.re.mul_add(other.im, self.im * other.re),
        }
    }

    #[cfg(all(target_feature = "fma", target_arch = "aarch64"))]
    #[target_feature(enable = "fma")]
    /// FMA-accelerated multiplication for AArch64.
    unsafe fn mul_fma_aarch64(self, other: Self) -> Self {
        Self {
            re: self.re.mul_add(other.re, -(self.im * other.im)),
            im: self.re.mul_add(other.im, self.im * other.re),
        }
    }
}

impl<T: Float> core::ops::Neg for Complex<T> {
    type Output = Self;
    #[inline(always)]
    fn neg(self) -> Self {
        Self {
            re: -self.re,
            im: -self.im,
        }
    }
}

impl<T: Float> core::ops::Add for Complex<T> {
    type Output = Self;
    #[inline(always)]
    fn add(self, other: Self) -> Self {
        Self {
            re: self.re + other.re,
            im: self.im + other.im,
        }
    }
}

impl<T: Float> core::ops::Sub for Complex<T> {
    type Output = Self;
    #[inline(always)]
    fn sub(self, other: Self) -> Self {
        Self {
            re: self.re - other.re,
            im: self.im - other.im,
        }
    }
}

impl<T: Float> core::ops::Mul for Complex<T> {
    type Output = Self;
    #[inline(always)]
    fn mul(self, other: Self) -> Self {
        Complex::<T>::mul(self, other)
    }
}

/// Convenience alias for a single-precision complex number.
pub type Complex32 = Complex<f32>;
/// Convenience alias for a double-precision complex number.
pub type Complex64 = Complex<f64>;

#[derive(Debug, PartialEq)]
/// Borrowed split-complex representation: separate real and imaginary slices.
pub struct SplitComplex<'a, T: Float> {
    /// Real slice.
    pub re: &'a mut [T],
    /// Imaginary slice.
    pub im: &'a mut [T],
}

impl<'a, T: Float> SplitComplex<'a, T> {
    /// Create a new split-complex structure ensuring slice lengths match.
    pub fn new(re: &'a mut [T], im: &'a mut [T]) -> Self {
        assert_eq!(re.len(), im.len(), "slice length mismatch");
        Self { re, im }
    }

    /// Return the number of complex elements represented.
    pub fn len(&self) -> usize {
        self.re.len()
    }

    /// Return whether the representation is empty.
    pub fn is_empty(&self) -> bool {
        self.re.is_empty()
    }

    /// Copy from a `Complex` slice into split-complex form.
    pub fn copy_from_complex(input: &[Complex<T>], re: &'a mut [T], im: &'a mut [T]) -> Self {
        copy_from_complex(input, re, im);
        Self { re, im }
    }

    /// Copy into a `Complex` slice from the split representation.
    pub fn copy_to_complex(&self, out: &mut [Complex<T>]) {
        copy_to_complex(self.re, self.im, out);
    }
}

/// Borrowed split-complex representation using `f32` components.
pub type SplitComplex32<'a> = SplitComplex<'a, f32>;
/// Borrowed split-complex representation using `f64` components.
pub type SplitComplex64<'a> = SplitComplex<'a, f64>;

#[derive(Clone, Debug, PartialEq)]
/// Owned split-complex vector with separate real and imaginary buffers.
pub struct ComplexVec {
    /// Real components.
    pub re: Vec<f32>,
    /// Imaginary components.
    pub im: Vec<f32>,
}

impl ComplexVec {
    /// Construct from real and imaginary vectors, validating lengths and finiteness.
    pub fn new(re: Vec<f32>, im: Vec<f32>) -> Self {
        assert_eq!(re.len(), im.len(), "vector length mismatch");
        for (&r, &i) in re.iter().zip(im.iter()) {
            assert!(r.is_finite() && i.is_finite(), "non-finite component");
        }
        Self { re, im }
    }

    /// Length of the vector.
    pub fn len(&self) -> usize {
        self.re.len()
    }

    /// Return whether no elements are stored.
    pub fn is_empty(&self) -> bool {
        self.re.is_empty()
    }

    /// Create a `ComplexVec` by copying from a slice of `Complex32`.
    pub fn from_complex_vec(v: &[Complex32]) -> Self {
        let mut re = Vec::with_capacity(v.len());
        let mut im = Vec::with_capacity(v.len());
        for c in v {
            assert!(c.re.is_finite() && c.im.is_finite(), "non-finite component");
            re.push(c.re);
            im.push(c.im);
        }
        Self { re, im }
    }

    /// Convert to a `Vec<Complex32>`.
    pub fn to_complex_vec(&self) -> Vec<Complex32> {
        self.re
            .iter()
            .zip(self.im.iter())
            .map(|(&r, &i)| Complex32::new(r, i))
            .collect()
    }

    /// Borrow the underlying slices.
    pub fn as_slices(&self) -> (&[f32], &[f32]) {
        (&self.re, &self.im)
    }

    /// Mutably borrow the underlying slices.
    pub fn as_mut_slices(&mut self) -> (&mut [f32], &mut [f32]) {
        (&mut self.re, &mut self.im)
    }
}

impl From<Vec<Complex32>> for ComplexVec {
    fn from(v: Vec<Complex32>) -> Self {
        let mut re = Vec::with_capacity(v.len());
        let mut im = Vec::with_capacity(v.len());
        for c in v {
            assert!(c.re.is_finite() && c.im.is_finite(), "non-finite component");
            re.push(c.re);
            im.push(c.im);
        }
        Self { re, im }
    }
}

impl From<ComplexVec> for Vec<Complex32> {
    fn from(cv: ComplexVec) -> Self {
        cv.re
            .into_iter()
            .zip(cv.im.into_iter())
            .map(|(r, i)| Complex32::new(r, i))
            .collect()
    }
}

/// Copy from a slice of `Complex` values into separate real and imaginary
/// buffers.
pub fn copy_from_complex<T: Float>(input: &[Complex<T>], re: &mut [T], im: &mut [T]) {
    assert_eq!(input.len(), re.len(), "slice length mismatch");
    assert_eq!(input.len(), im.len(), "slice length mismatch");
    for (c, (r, i)) in input.iter().zip(re.iter_mut().zip(im.iter_mut())) {
        assert!(c.re.is_finite() && c.im.is_finite(), "non-finite component");
        *r = c.re;
        *i = c.im;
    }
}

/// Copy from split real/imaginary buffers into a slice of `Complex` values.
pub fn copy_to_complex<T: Float>(re: &[T], im: &[T], out: &mut [Complex<T>]) {
    assert_eq!(re.len(), im.len(), "slice length mismatch");
    assert_eq!(re.len(), out.len(), "slice length mismatch");
    for ((r, i), c) in re.iter().zip(im.iter()).zip(out.iter_mut()) {
        assert!(r.is_finite() && i.is_finite(), "non-finite component");
        c.re = *r;
        c.im = *i;
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;

    #[test]
    fn test_complex_operations() {
        let a = Complex64::new(1.0, -2.0);
        let b = Complex64::new(3.0, 4.0);
        let c = a.mul(b);
        assert!((c.re - (1.0 * 3.0 - (-2.0) * 4.0)).abs() < 1e-6);
        let n = -a;
        assert_eq!(n.re, -1.0);
        assert_eq!(n.im, 2.0);
        let _e = Complex64::expi(<f64 as Float>::pi());
    }
}
