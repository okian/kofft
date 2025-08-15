#![cfg(any(feature = "x86_64", feature = "aarch64"))]
use kofft::fft::{Complex32, ScalarFftImpl};
#[allow(unused_imports)]
use kofft::rfft::RealFftImpl;
use kofft::rfft::RfftPlanner;

#[test]
fn rfft_matches_scalar() {
    let size = 32usize;
    let input: Vec<f32> = (0..size).map(|i| (i as f32).sin()).collect();
    let mut scalar_out = vec![Complex32::new(0.0, 0.0); size / 2 + 1];
    let mut simd_out = vec![Complex32::new(0.0, 0.0); size / 2 + 1];
    let mut scratch = vec![Complex32::new(0.0, 0.0); size / 2];
    let fft_scalar = ScalarFftImpl::<f32>::default();
    let mut planner = RfftPlanner::<f32>::new();
    planner
        .rfft_with_scratch(
            &fft_scalar,
            &mut input.clone(),
            &mut scalar_out,
            &mut scratch,
        )
        .unwrap();
    #[cfg(feature = "x86_64")]
    {
        use kofft::fft::SimdFftX86_64Impl;
        let fft_simd = SimdFftX86_64Impl;
        planner
            .rfft_with_scratch(&fft_simd, &mut input.clone(), &mut simd_out, &mut scratch)
            .unwrap();
    }
    #[cfg(feature = "aarch64")]
    {
        use kofft::fft::SimdFftAarch64Impl;
        let fft_simd = SimdFftAarch64Impl;
        planner
            .rfft_with_scratch(&fft_simd, &mut input.clone(), &mut simd_out, &mut scratch)
            .unwrap();
    }
    for (a, b) in scalar_out.iter().zip(simd_out.iter()) {
        assert!((a.re - b.re).abs() < 1e-5 && (a.im - b.im).abs() < 1e-5);
    }
}
