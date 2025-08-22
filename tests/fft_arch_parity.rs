// Test intent: verifies fft arch parity behavior including edge cases.
#![cfg(any(
    target_arch = "x86_64",
    target_arch = "aarch64",
    target_arch = "wasm32"
))]
use kofft::fft::{Complex32, FftError, FftImpl, ScalarFftImpl};

/// Large amplitude used to test FFT stability with extreme values.
const EXTREME_SAMPLE: f32 = 1.0e30;

#[test]
fn fft_matches_scalar() {
    let input: Vec<Complex32> = (0..16).map(|i| Complex32::new(i as f32, 0.0)).collect();
    let mut simd_input = input.clone();
    let mut scalar_input = input.clone();

    let scalar = ScalarFftImpl::<f32>::default();
    scalar
        .fft(&mut scalar_input)
        .expect("Invariant: operation should succeed");

    #[cfg(target_arch = "x86_64")]
    {
        use kofft::fft::SimdFftX86_64Impl;
        let simd = SimdFftX86_64Impl;
        simd.fft(&mut simd_input)
            .expect("Invariant: operation should succeed");
    }
    #[cfg(target_arch = "aarch64")]
    {
        use kofft::fft::SimdFftAarch64Impl;
        let simd = SimdFftAarch64Impl;
        simd.fft(&mut simd_input)
            .expect("Invariant: operation should succeed");
    }
    #[cfg(target_arch = "wasm32")]
    {
        use kofft::fft::SimdFftWasmImpl;
        let simd = SimdFftWasmImpl;
        simd.fft(&mut simd_input)
            .expect("Invariant: operation should succeed");
    }

    for (a, b) in scalar_input.iter().zip(simd_input.iter()) {
        assert!((a.re - b.re).abs() < 1e-5 && (a.im - b.im).abs() < 1e-5);
    }
}

/// Verifies SIMD and scalar FFT agree for non-power-of-two lengths.
#[test]
fn fft_matches_scalar_non_power_of_two() {
    let input: Vec<Complex32> = (0..15).map(|i| Complex32::new(i as f32, 0.0)).collect();
    let mut simd_input = input.clone();
    let mut scalar_input = input.clone();
    let scalar = ScalarFftImpl::<f32>::default();
    scalar
        .fft(&mut scalar_input)
        .expect("Invariant: operation should succeed");
    #[cfg(target_arch = "x86_64")]
    {
        use kofft::fft::SimdFftX86_64Impl;
        let simd = SimdFftX86_64Impl;
        simd.fft(&mut simd_input)
            .expect("Invariant: operation should succeed");
    }
    #[cfg(target_arch = "aarch64")]
    {
        use kofft::fft::SimdFftAarch64Impl;
        let simd = SimdFftAarch64Impl;
        simd.fft(&mut simd_input)
            .expect("Invariant: operation should succeed");
    }
    #[cfg(target_arch = "wasm32")]
    {
        use kofft::fft::SimdFftWasmImpl;
        let simd = SimdFftWasmImpl;
        simd.fft(&mut simd_input)
            .expect("Invariant: operation should succeed");
    }
    for (a, b) in scalar_input.iter().zip(simd_input.iter()) {
        assert!((a.re - b.re).abs() < 1e-5 && (a.im - b.im).abs() < 1e-5);
    }
}

/// Ensures FFT returns an error when given empty input.
#[test]
fn fft_errors_on_empty_input() {
    let mut data: [Complex32; 0] = [];
    let scalar = ScalarFftImpl::<f32>::default();
    assert_eq!(scalar.fft(&mut data).unwrap_err(), FftError::EmptyInput);
}

/// Ensures out-of-place FFT detects mismatched input and output lengths.
#[test]
fn fft_out_of_place_mismatched_length_errors() {
    let input = vec![Complex32::new(0.0, 0.0); 4];
    let mut output = vec![Complex32::new(0.0, 0.0); 2];
    let scalar = ScalarFftImpl::<f32>::default();
    assert_eq!(
        scalar.fft_out_of_place(&input, &mut output).unwrap_err(),
        FftError::MismatchedLengths
    );
}

/// Runs FFT on large values to ensure results remain finite.
#[test]
fn fft_handles_large_values() {
    let mut data = vec![Complex32::new(EXTREME_SAMPLE, -EXTREME_SAMPLE); 16];
    let scalar = ScalarFftImpl::<f32>::default();
    scalar
        .fft(&mut data)
        .expect("Invariant: operation should succeed");
    assert!(data.iter().all(|c| c.re.is_finite() && c.im.is_finite()));
}
