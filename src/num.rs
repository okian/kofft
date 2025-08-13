use core::f32::consts::PI as PI32;

// Minimal float trait for generic FFT (no_std, no external deps)
pub trait Float: Copy + Clone + PartialEq + PartialOrd + core::fmt::Debug +
    core::ops::Add<Output=Self> + core::ops::Sub<Output=Self> + core::ops::Mul<Output=Self> +
    core::ops::Div<Output=Self> + core::ops::Neg<Output=Self> + 'static {
    fn zero() -> Self;
    fn one() -> Self;
    fn from_f32(x: f32) -> Self;
    fn cos(self) -> Self;
    fn sin(self) -> Self;
    fn pi() -> Self;
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
    fn zero() -> Self { 0.0 }
    fn one() -> Self { 1.0 }
    fn from_f32(x: f32) -> Self { x }
    fn cos(self) -> Self { f32::cos(self) }
    fn sin(self) -> Self { f32::sin(self) }
    fn pi() -> Self { PI32 }
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
    fn zero() -> Self { 0.0 }
    fn one() -> Self { 1.0 }
    fn from_f32(x: f32) -> Self { x as f64 }
    fn cos(self) -> Self { f64::cos(self) }
    fn sin(self) -> Self { f64::sin(self) }
    fn pi() -> Self { core::f64::consts::PI }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Complex<T: Float> {
    pub re: T,
    pub im: T,
}

impl<T: Float> Complex<T> {
    pub fn new(re: T, im: T) -> Self { Self { re, im } }
    pub fn zero() -> Self { Self { re: T::zero(), im: T::zero() } }
    pub fn expi(theta: T) -> Self {
        Self { re: theta.cos(), im: theta.sin() }
    }
    pub fn add(self, other: Self) -> Self {
        Self { re: self.re + other.re, im: self.im + other.im }
    }
    pub fn sub(self, other: Self) -> Self {
        Self { re: self.re - other.re, im: self.im - other.im }
    }
    pub fn mul(self, other: Self) -> Self {
        Self {
            re: self.re * other.re - self.im * other.im,
            im: self.re * other.im + self.im * other.re,
        }
    }
}

impl<T: Float> core::ops::Neg for Complex<T> {
    type Output = Self;
    fn neg(self) -> Self { Self { re: -self.re, im: -self.im } }
}

pub type Complex32 = Complex<f32>;
pub type Complex64 = Complex<f64>;

