use kofft::fft::{Complex32, FftError, ScalarFftImpl};
use kofft::rfft::{rfft_stack, RfftPlanner, MAX_CACHE_ENTRIES, STRIDE};

/// Helper to build a zero-filled complex buffer of length `n`.
fn zero_complex(len: usize) -> Vec<Complex32> {
    vec![Complex32::new(0.0, 0.0); len]
}

#[test]
fn rejects_odd_length() {
    let fft = ScalarFftImpl::<f32>::default();
    let mut planner = RfftPlanner::<f32>::new().unwrap();
    let mut input = vec![1.0f32; 3];
    let mut output = zero_complex(input.len() / STRIDE + 1);
    let mut scratch = zero_complex(input.len() / STRIDE);
    let err = planner
        .rfft_with_scratch(&fft, &mut input, &mut output, &mut scratch)
        .unwrap_err();
    assert_eq!(err, FftError::InvalidValue);
}

#[test]
fn handles_min_length() {
    let fft = ScalarFftImpl::<f32>::default();
    let mut planner = RfftPlanner::<f32>::new().unwrap();
    let mut input = vec![1.0f32, -1.0];
    let mut output = zero_complex(input.len() / STRIDE + 1);
    let mut scratch = zero_complex(input.len() / STRIDE);
    planner
        .rfft_with_scratch(&fft, &mut input, &mut output, &mut scratch)
        .unwrap();
    let mut time = vec![0.0f32; input.len()];
    planner
        .irfft_with_scratch(&fft, &mut output, &mut time, &mut scratch)
        .unwrap();
    for (a, b) in input.iter().zip(time.iter()) {
        assert!((a - b).abs() < 1e-5);
    }
}

#[test]
fn handles_large_input() {
    const N: usize = 1 << 14; // 16384 samples
    let fft = ScalarFftImpl::<f32>::default();
    let mut planner = RfftPlanner::<f32>::new().unwrap();
    let mut input: Vec<f32> = (0..N).map(|i| (i as f32).sin()).collect();
    let mut output = zero_complex(N / STRIDE + 1);
    let mut scratch = zero_complex(N / STRIDE);
    planner
        .rfft_with_scratch(&fft, &mut input, &mut output, &mut scratch)
        .unwrap();
    let mut time = vec![0.0f32; N];
    planner
        .irfft_with_scratch(&fft, &mut output, &mut time, &mut scratch)
        .unwrap();
    for (a, b) in input.iter().zip(time.iter()) {
        assert!((a - b).abs() < 1e-3);
    }
}

#[test]
fn planner_cache_eviction() {
    let fft = ScalarFftImpl::<f32>::default();
    let mut planner = RfftPlanner::<f32>::new().unwrap();
    for i in 0..(MAX_CACHE_ENTRIES + 10) {
        let n = (i + 1) * STRIDE;
        let mut input = vec![0.0f32; n];
        let mut output = zero_complex(n / STRIDE + 1);
        let mut scratch = zero_complex(n / STRIDE);
        planner
            .rfft_with_scratch(&fft, &mut input, &mut output, &mut scratch)
            .unwrap();
    }
    assert!(planner.cache_len() <= MAX_CACHE_ENTRIES);
    assert!(planner.pack_cache_len() <= MAX_CACHE_ENTRIES);
}

#[test]
fn rfft_stack_rejects_odd_length() {
    const N: usize = 3;
    const M: usize = N / STRIDE + 1;
    let input = [0.0f32; N];
    let mut output = [Complex32::new(0.0, 0.0); M];
    let err = rfft_stack::<N, M>(&input, &mut output).unwrap_err();
    assert_eq!(err, FftError::InvalidValue);
}
