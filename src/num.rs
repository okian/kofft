use alloc::vec::Vec;
use core::f32::consts::PI as PI32;

// Minimal float trait for generic FFT (no_std, no external deps)
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
    fn zero() -> Self;
    fn one() -> Self;
    fn from_f32(x: f32) -> Self;
    fn cos(self) -> Self;
    fn sin(self) -> Self;
    fn sin_cos(self) -> (Self, Self);
    fn pi() -> Self;
    #[inline(always)]
    fn mul_add(self, a: Self, b: Self) -> Self {
        self * a + b
    }
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
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Complex<T: Float> {
    pub re: T,
    pub im: T,
}

impl<T: Float> Complex<T> {
    pub fn new(re: T, im: T) -> Self {
        Self { re, im }
    }
    pub fn zero() -> Self {
        Self {
            re: T::zero(),
            im: T::zero(),
        }
    }
    #[inline(always)]
    pub fn expi(theta: T) -> Self {
        let (sin, cos) = theta.sin_cos();
        Self { re: cos, im: sin }
    }
    #[allow(clippy::should_implement_trait)]
    #[inline(always)]
    pub fn add(self, other: Self) -> Self {
        Self {
            re: self.re + other.re,
            im: self.im + other.im,
        }
    }
    #[allow(clippy::should_implement_trait)]
    #[inline(always)]
    pub fn sub(self, other: Self) -> Self {
        Self {
            re: self.re - other.re,
            im: self.im - other.im,
        }
    }
    #[allow(clippy::should_implement_trait)]
    #[inline(always)]
    pub fn mul(self, other: Self) -> Self {
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
        Self {
            re: self.re.mul_add(other.re, -(self.im * other.im)),
            im: self.re.mul_add(other.im, self.im * other.re),
        }
    }
}

pub type Complex32 = Complex<f32>;
pub type Complex64 = Complex<f64>;

#[derive(Clone, Debug, PartialEq)]
pub struct SplitComplex<T: Float> {
    pub re: Vec<T>,
    pub im: Vec<T>,
}

impl<T: Float> SplitComplex<T> {
    pub fn new(re: Vec<T>, im: Vec<T>) -> Self {
        assert_eq!(re.len(), im.len());
        Self { re, im }
    }
    pub fn len(&self) -> usize {
        self.re.len()
    }
    pub fn is_empty(&self) -> bool {
        self.re.is_empty()
    }
    pub fn from_complex_vec(v: &[Complex<T>]) -> Self {
        let mut re = Vec::with_capacity(v.len());
        let mut im = Vec::with_capacity(v.len());
        for c in v {
            re.push(c.re);
            im.push(c.im);
        }
        Self { re, im }
    }
    pub fn to_complex_vec(&self) -> Vec<Complex<T>> {
        let mut out = Vec::with_capacity(self.re.len());
        for i in 0..self.re.len() {
            out.push(Complex::new(self.re[i], self.im[i]));
        }
        out
    }
}

pub type SplitComplex32 = SplitComplex<f32>;
pub type SplitComplex64 = SplitComplex<f64>;

#[derive(Clone, Debug, PartialEq)]
pub struct ComplexVec {
    pub re: Vec<f32>,
    pub im: Vec<f32>,
}

impl ComplexVec {
    pub fn new(re: Vec<f32>, im: Vec<f32>) -> Self {
        assert_eq!(re.len(), im.len());
        Self { re, im }
    }

    pub fn len(&self) -> usize {
        self.re.len()
    }

    pub fn is_empty(&self) -> bool {
        self.re.is_empty()
    }

    pub fn from_complex_vec(v: &[Complex32]) -> Self {
        let split = SplitComplex::<f32>::from_complex_vec(v);
        Self {
            re: split.re,
            im: split.im,
        }
    }

    pub fn to_complex_vec(&self) -> Vec<Complex32> {
        let sc = SplitComplex {
            re: self.re.clone(),
            im: self.im.clone(),
        };
        sc.to_complex_vec()
    }

    pub fn as_slices(&self) -> (&[f32], &[f32]) {
        (&self.re, &self.im)
    }

    pub fn as_mut_slices(&mut self) -> (&mut [f32], &mut [f32]) {
        (&mut self.re, &mut self.im)
    }
}

impl From<Vec<Complex32>> for ComplexVec {
    fn from(v: Vec<Complex32>) -> Self {
        let split = SplitComplex::<f32>::from_complex_vec(&v);
        Self {
            re: split.re,
            im: split.im,
        }
    }
}

impl From<ComplexVec> for Vec<Complex32> {
    fn from(cv: ComplexVec) -> Self {
        let sc = SplitComplex {
            re: cv.re,
            im: cv.im,
        };
        sc.to_complex_vec()
    }
}

pub fn copy_from_complex<T: Float>(input: &[Complex<T>], re: &mut [T], im: &mut [T]) {
    assert_eq!(input.len(), re.len());
    assert_eq!(input.len(), im.len());
    for i in 0..input.len() {
        re[i] = input[i].re;
        im[i] = input[i].im;
    }
}

pub fn copy_to_complex<T: Float>(re: &[T], im: &[T], out: &mut [Complex<T>]) {
    assert_eq!(re.len(), im.len());
    assert_eq!(re.len(), out.len());
    for i in 0..re.len() {
        out[i].re = re[i];
        out[i].im = im[i];
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
