// Test intent: verifies rfft twiddles behavior including edge cases.
use kofft::num::Complex32;
use kofft::rfft::RfftPlanner;

/// Number of twiddle factors requested for this test to exercise planner caching.
const TWIDDLE_LEN: usize = 8;
/// Permissible floating-point error tolerance when comparing twiddle values.
/// Chosen to exceed expected single-precision rounding error.
const FLOAT_EPSILON: f32 = 1e-6;
/// Index of the first non-trivial twiddle factor to validate.
const TWIDDLE_IDX: usize = 1;

/// Verify that the planner caches and computes RFFT twiddle factors accurately.
#[test]
fn planner_twiddles_rfft_f32() {
    let mut planner = RfftPlanner::<f32>::new().unwrap();
    let tw = planner.get_twiddles(TWIDDLE_LEN).unwrap();
    assert_eq!(tw.len(), TWIDDLE_LEN);
    let expected = Complex32::expi(-std::f32::consts::PI / (TWIDDLE_LEN as f32));
    assert!((tw[TWIDDLE_IDX].re - expected.re).abs() < FLOAT_EPSILON);
    assert!((tw[TWIDDLE_IDX].im - expected.im).abs() < FLOAT_EPSILON);
    // Ensure cached reference is reused.
    let ptr1 = tw.as_ptr();
    let ptr2 = planner.get_twiddles(TWIDDLE_LEN).unwrap().as_ptr();
    assert_eq!(ptr1, ptr2);
}
