// Test intent: ensures misaligned buffers trigger scalar fallback and remain
// numerically correct while aligned buffers utilize SIMD paths.
#![cfg(any(
    all(feature = "x86_64", target_arch = "x86_64"),
    all(feature = "aarch64", target_arch = "aarch64")
))]

use kofft::fft::{Complex32, ScalarFftImpl};
use kofft::rfft::{RfftPlanner, SIMD_ALIGN};

/// Transform size used by alignment tests.
const SIZE: usize = 32;

/// Numerical tolerance for float comparisons in alignment tests.
const EPSILON: f32 = 1e-5;

/// Ensure the exported alignment constant matches the expected value.
#[test]
fn simd_align_is_64() {
    assert_eq!(SIMD_ALIGN, 64);
}

/// Validate that misaligned buffers fall back to the scalar implementation for IRFFT.
#[test]
fn irfft_misaligned_falls_back() {
    let mut planner = RfftPlanner::<f32>::new().expect("Invariant: operation should succeed");
    let fft = ScalarFftImpl::<f32>::default();
    // Generate frequency data using a scalar forward transform.
    let mut time = (0..SIZE).map(|i| (i as f32).cos()).collect::<Vec<_>>();
    let mut freq = vec![Complex32::new(0.0, 0.0); SIZE / 2 + 1];
    let mut scratch = vec![Complex32::new(0.0, 0.0); SIZE / 2];
    planner
        .rfft_with_scratch(&fft, &mut time, &mut freq, &mut scratch)
        .expect("Invariant: operation should succeed");
    // Misalign frequency input and output buffers.
    let mut freq_buf = vec![Complex32::new(0.0, 0.0); SIZE / 2 + 2];
    freq_buf[1..(SIZE / 2 + 2)].copy_from_slice(&freq);
    let input = &mut freq_buf[1..(SIZE / 2 + 2)];
    assert_ne!(input.as_ptr().align_offset(SIMD_ALIGN), 0);
    let mut output = vec![0.0f32; SIZE];
    let mut scratch = vec![Complex32::new(0.0, 0.0); SIZE / 2];
    planner
        .irfft_with_scratch(&fft, input, &mut output, &mut scratch)
        .expect("Invariant: operation should succeed");
    for (a, b) in output.iter().zip(time.iter()) {
        assert!((a - b).abs() < EPSILON);
    }
}

/// Validate that misaligned buffers fall back to the scalar implementation for RFFT.
#[test]
fn rfft_misaligned_falls_back() {
    let mut planner = RfftPlanner::<f32>::new().expect("Invariant: operation should succeed");
    let fft = ScalarFftImpl::<f32>::default();
    let mut time = (0..SIZE).map(|i| (i as f32).cos()).collect::<Vec<_>>();
    // Aligned frequency result for comparison.
    let mut expected = vec![Complex32::new(0.0, 0.0); SIZE / 2 + 1];
    let mut scratch = vec![Complex32::new(0.0, 0.0); SIZE / 2];
    planner
        .rfft_with_scratch(&fft, &mut time, &mut expected, &mut scratch)
        .expect("Invariant: operation should succeed");
    // Misalign output buffer to trigger scalar fallback.
    let mut out_buf = vec![Complex32::new(0.0, 0.0); SIZE / 2 + 2];
    let output = &mut out_buf[1..(SIZE / 2 + 2)];
    assert_ne!(output.as_ptr().align_offset(SIMD_ALIGN), 0);
    let mut scratch2 = vec![Complex32::new(0.0, 0.0); SIZE / 2];
    planner
        .rfft_with_scratch(&fft, &mut time, output, &mut scratch2)
        .expect("Invariant: operation should succeed");
    for (a, b) in output.iter().zip(expected.iter()) {
        assert!((a.re - b.re).abs() < EPSILON);
        assert!((a.im - b.im).abs() < EPSILON);
    }
}

/// Verify round-trip transforms operate correctly when buffers are 64-byte aligned.
#[test]
fn rfft_irfft_aligned_round_trip() {
    let mut planner = RfftPlanner::<f32>::new().expect("Invariant: operation should succeed");
    let fft = ScalarFftImpl::<f32>::default();
    let baseline: Vec<f32> = (0..SIZE).map(|i| (i as f32).cos()).collect();

    // Allocate 64-byte-aligned real input.
    let elem = core::mem::size_of::<f32>();
    let extra = SIMD_ALIGN / elem + 1;
    let mut time_storage = vec![0.0f32; SIZE + extra];
    let ptr = time_storage.as_mut_ptr() as usize;
    let offset = (SIMD_ALIGN - (ptr % SIMD_ALIGN)) % SIMD_ALIGN;
    let start = offset / elem;
    let time = &mut time_storage[start..start + SIZE];
    time.copy_from_slice(&baseline);
    assert_eq!(time.as_ptr().align_offset(SIMD_ALIGN), 0);

    // Allocate 64-byte-aligned frequency and scratch buffers.
    let elem_c = core::mem::size_of::<Complex32>();
    let extra_c = SIMD_ALIGN / elem_c + 1;
    let mut freq_storage = vec![Complex32::new(0.0, 0.0); SIZE / 2 + 1 + extra_c];
    let ptr_f = freq_storage.as_mut_ptr() as usize;
    let offset_f = (SIMD_ALIGN - (ptr_f % SIMD_ALIGN)) % SIMD_ALIGN;
    let start_f = offset_f / elem_c;
    let freq = &mut freq_storage[start_f..start_f + SIZE / 2 + 1];
    assert_eq!(freq.as_ptr().align_offset(SIMD_ALIGN), 0);
    let mut scratch_storage = vec![Complex32::new(0.0, 0.0); SIZE / 2 + extra_c];
    let ptr_s = scratch_storage.as_mut_ptr() as usize;
    let offset_s = (SIMD_ALIGN - (ptr_s % SIMD_ALIGN)) % SIMD_ALIGN;
    let start_s = offset_s / elem_c;
    let scratch = &mut scratch_storage[start_s..start_s + SIZE / 2];
    assert_eq!(scratch.as_ptr().align_offset(SIMD_ALIGN), 0);

    planner
        .rfft_with_scratch(&fft, time, freq, scratch)
        .expect("Invariant: operation should succeed");

    // Allocate aligned buffers for the inverse transform.
    let mut out_storage = vec![0.0f32; SIZE + extra];
    let ptr_o = out_storage.as_mut_ptr() as usize;
    let offset_o = (SIMD_ALIGN - (ptr_o % SIMD_ALIGN)) % SIMD_ALIGN;
    let start_o = offset_o / elem;
    let output = &mut out_storage[start_o..start_o + SIZE];
    let mut scratch2_storage = vec![Complex32::new(0.0, 0.0); SIZE / 2 + extra_c];
    let ptr_s2 = scratch2_storage.as_mut_ptr() as usize;
    let offset_s2 = (SIMD_ALIGN - (ptr_s2 % SIMD_ALIGN)) % SIMD_ALIGN;
    let start_s2 = offset_s2 / elem_c;
    let scratch2 = &mut scratch2_storage[start_s2..start_s2 + SIZE / 2];
    planner
        .irfft_with_scratch(&fft, freq, output, scratch2)
        .expect("Invariant: operation should succeed");

    for (a, b) in output.iter().zip(baseline.iter()) {
        assert!((a - b).abs() < EPSILON);
    }
}
