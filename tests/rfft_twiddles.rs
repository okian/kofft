use kofft::num::Complex32;
use kofft::rfft::RfftPlanner;

#[test]
fn planner_twiddles_rfft_f32() {
    let mut planner = RfftPlanner::<f32>::new();
    let tw = planner.get_twiddles(8);
    assert_eq!(tw.len(), 8);
    let expected = Complex32::expi(-std::f32::consts::PI / 8.0);
    assert!((tw[1].re - expected.re).abs() < 1e-6);
    assert!((tw[1].im - expected.im).abs() < 1e-6);
    // Ensure cached reference is reused.
    let ptr1 = tw.as_ptr();
    let ptr2 = planner.get_twiddles(8).as_ptr();
    assert_eq!(ptr1, ptr2);
}
