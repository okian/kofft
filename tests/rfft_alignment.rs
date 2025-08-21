// Test intent: ensures misaligned buffers trigger scalar fallback and remain numerically correct.
#![cfg(any(
    all(feature = "x86_64", target_arch = "x86_64"),
    all(feature = "aarch64", target_arch = "aarch64")
))]

use kofft::fft::{Complex32, ScalarFftImpl};
use kofft::rfft::RfftPlanner;

/// Validate that misaligned buffers fall back to the scalar implementation for IRFFT.
#[test]
fn irfft_misaligned_falls_back() {
    let size = 32usize;
    let mut planner = RfftPlanner::<f32>::new().unwrap();
    let fft = ScalarFftImpl::<f32>::default();
    // Generate frequency data using a scalar forward transform.
    let mut time = (0..size).map(|i| (i as f32).cos()).collect::<Vec<_>>();
    let mut freq = vec![Complex32::new(0.0, 0.0); size / 2 + 1];
    let mut scratch = vec![Complex32::new(0.0, 0.0); size / 2];
    planner
        .rfft_with_scratch(&fft, &mut time, &mut freq, &mut scratch)
        .unwrap();
    // Misalign frequency input and output buffers.
    let mut freq_buf = vec![Complex32::new(0.0, 0.0); size / 2 + 2];
    freq_buf[1..(size / 2 + 2)].copy_from_slice(&freq);
    let input = &mut freq_buf[1..(size / 2 + 2)];
    let mut output = vec![0.0f32; size];
    let mut scratch = vec![Complex32::new(0.0, 0.0); size / 2];
    planner
        .irfft_with_scratch(&fft, input, &mut output, &mut scratch)
        .unwrap();
    for (a, b) in output.iter().zip(time.iter()) {
        assert!((a - b).abs() < 1e-5);
    }
}

/// Validate that misaligned buffers fall back to the scalar implementation for RFFT.
#[test]
fn rfft_misaligned_falls_back() {
    let size = 32usize;
    let mut planner = RfftPlanner::<f32>::new().unwrap();
    let fft = ScalarFftImpl::<f32>::default();
    let mut time = (0..size).map(|i| (i as f32).cos()).collect::<Vec<_>>();
    // Aligned frequency result for comparison.
    let mut expected = vec![Complex32::new(0.0, 0.0); size / 2 + 1];
    let mut scratch = vec![Complex32::new(0.0, 0.0); size / 2];
    planner
        .rfft_with_scratch(&fft, &mut time, &mut expected, &mut scratch)
        .unwrap();
    // Misalign output buffer to trigger scalar fallback.
    let mut out_buf = vec![Complex32::new(0.0, 0.0); size / 2 + 2];
    let output = &mut out_buf[1..(size / 2 + 2)];
    let mut scratch2 = vec![Complex32::new(0.0, 0.0); size / 2];
    planner
        .rfft_with_scratch(&fft, &mut time, output, &mut scratch2)
        .unwrap();
    for (a, b) in output.iter().zip(expected.iter()) {
        assert!((a.re - b.re).abs() < 1e-5);
        assert!((a.im - b.im).abs() < 1e-5);
    }
}
