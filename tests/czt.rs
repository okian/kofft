// Test intent: verifies czt behavior including edge cases.
//! Tests for the Chirp Z-Transform implementation

use kofft::czt::{czt_f32, CztError};
use kofft::fft::fft_complex_vec;
use kofft::num::ComplexVec;

/// Tolerance for comparing floating-point results.
const EPSILON: f32 = 1e-4;

/// Verify that providing a zero `a` parameter results in an error.
#[test]
fn invalid_a_returns_error() {
    let input = [1.0_f32, 0.0];
    let w = (0.0_f32, 1.0_f32);
    let result = czt_f32(&input, 2, w, (0.0, 0.0));
    assert!(matches!(result, Err(CztError::InvalidParameter)));
}

/// Ensure the transform handles large numbers of output bins without panicking.
#[test]
fn large_m_produces_correct_length() {
    let input = vec![1.0_f32; 8];
    let m = 256;
    let w = (
        (-2.0 * core::f32::consts::PI / m as f32).cos(),
        (-2.0 * core::f32::consts::PI / m as f32).sin(),
    );
    let a = (1.0, 0.0);
    let result = czt_f32(&input, m, w, a).unwrap();
    assert_eq!(result.len(), m);
}

/// Compare CZT output against the standard FFT for numerical accuracy.
#[test]
fn czt_matches_fft() {
    let input = [1.0_f32, 2.0, 3.0, 4.0];
    let n = input.len();

    // FFT reference result
    let mut cv = ComplexVec::new(input.to_vec(), vec![0.0; n]);
    fft_complex_vec(&mut cv).unwrap();
    let fft_out = cv.to_complex_vec();

    // CZT with parameters equivalent to an N-point DFT
    let w = (
        (-2.0 * core::f32::consts::PI / n as f32).cos(),
        (-2.0 * core::f32::consts::PI / n as f32).sin(),
    );
    let a = (1.0, 0.0);
    let czt_out = czt_f32(&input, n, w, a).unwrap();

    for k in 0..n {
        assert!((czt_out[k].0 - fft_out[k].re).abs() < EPSILON);
        assert!((czt_out[k].1 - fft_out[k].im).abs() < EPSILON);
    }
}
