#![cfg(any(
    target_arch = "x86_64",
    target_arch = "aarch64",
    target_arch = "wasm32"
))]
use kofft::fft::{Complex32, FftImpl, ScalarFftImpl};

#[test]
fn fft_matches_scalar() {
    let input: Vec<Complex32> = (0..16).map(|i| Complex32::new(i as f32, 0.0)).collect();
    let mut simd_input = input.clone();
    let mut scalar_input = input.clone();

    let scalar = ScalarFftImpl::<f32>::default();
    scalar.fft(&mut scalar_input).unwrap();

    #[cfg(target_arch = "x86_64")]
    {
        use kofft::fft::SimdFftX86_64Impl;
        let simd = SimdFftX86_64Impl;
        simd.fft(&mut simd_input).unwrap();
    }
    #[cfg(target_arch = "aarch64")]
    {
        use kofft::fft::SimdFftAarch64Impl;
        let simd = SimdFftAarch64Impl;
        simd.fft(&mut simd_input).unwrap();
    }
    #[cfg(target_arch = "wasm32")]
    {
        use kofft::fft::SimdFftWasmImpl;
        let simd = SimdFftWasmImpl;
        simd.fft(&mut simd_input).unwrap();
    }

    for (a, b) in scalar_input.iter().zip(simd_input.iter()) {
        assert!((a.re - b.re).abs() < 1e-5 && (a.im - b.im).abs() < 1e-5);
    }
}
