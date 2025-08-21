// Test intent: verifies twiddle behavior including edge cases.
use kofft::fft::FftPlanner;
#[cfg(feature = "precomputed-twiddles")]
use kofft::num::{Complex32, Complex64};

#[test]
fn twiddle_generation_and_cache() {
    let mut planner = FftPlanner::<f32>::new();
    // Use a non-precomputed size to force generation.
    let t1 = planner.get_twiddles(10);
    let ptr1 = t1.as_ptr();
    let t2 = planner.get_twiddles(10);
    assert_eq!(ptr1, t2.as_ptr());
}

#[cfg(feature = "precomputed-twiddles")]
#[test]
fn twiddle_precomputed_f32_f64() {
    let mut p32 = FftPlanner::<f32>::new();
    let t32 = p32.get_twiddles(8);
    let expected32 = Complex32::expi(-2.0 * std::f32::consts::PI / 8.0);
    assert!((t32[1].re - expected32.re).abs() < 1e-6);
    assert!((t32[1].im - expected32.im).abs() < 1e-6);
    let ptr1 = t32.as_ptr();
    let ptr2 = p32.get_twiddles(8).as_ptr();
    assert_eq!(ptr1, ptr2);

    let mut p64 = FftPlanner::<f64>::new();
    let t64 = p64.get_twiddles(8);
    let expected64 = Complex64::expi(-2.0 * std::f64::consts::PI / 8.0);
    assert!((t64[1].re - expected64.re).abs() < 1e-12);
    assert!((t64[1].im - expected64.im).abs() < 1e-12);
}
