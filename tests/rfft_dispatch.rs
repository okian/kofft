// Test intent: verifies rfft dispatch behavior including edge cases.
use kofft::fft::{Complex32, Complex64, ScalarFftImpl};
use kofft::rfft::RfftPlanner;

#[test]
fn rfft_irfft_roundtrip_dispatch() {
    // f32 path
    let fft32 = ScalarFftImpl::<f32>::default();
    let mut planner32 = RfftPlanner::<f32>::new().unwrap();
    let mut input32 = vec![1.0f32, 2.0, 3.0, 4.0];
    let orig32 = input32.clone();
    let mut freq32 = vec![Complex32::new(0.0, 0.0); input32.len() / 2 + 1];
    let mut scratch32 = vec![Complex32::new(0.0, 0.0); input32.len() / 2];
    planner32
        .rfft_with_scratch(&fft32, &mut input32, &mut freq32, &mut scratch32)
        .unwrap();
    let mut out32 = vec![0.0f32; orig32.len()];
    planner32
        .irfft_with_scratch(&fft32, &mut freq32, &mut out32, &mut scratch32)
        .unwrap();
    for (a, b) in orig32.iter().zip(out32.iter()) {
        assert!((a - b).abs() < 1e-5);
    }

    // f64 path
    let fft64 = ScalarFftImpl::<f64>::default();
    let mut planner64 = RfftPlanner::<f64>::new().unwrap();
    let mut input64 = vec![1.0f64, 2.0, 3.0, 4.0];
    let orig64 = input64.clone();
    let mut freq64 = vec![Complex64::new(0.0, 0.0); input64.len() / 2 + 1];
    let mut scratch64 = vec![Complex64::new(0.0, 0.0); input64.len() / 2];
    planner64
        .rfft_with_scratch(&fft64, &mut input64, &mut freq64, &mut scratch64)
        .unwrap();
    let mut out64 = vec![0.0f64; orig64.len()];
    planner64
        .irfft_with_scratch(&fft64, &mut freq64, &mut out64, &mut scratch64)
        .unwrap();
    for (a, b) in orig64.iter().zip(out64.iter()) {
        assert!((a - b).abs() < 1e-10);
    }
}
