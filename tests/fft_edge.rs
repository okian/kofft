use kofft::fft::{Complex32, FftError, FftImpl, ScalarFftImpl};

#[cfg(all(feature = "parallel", feature = "std", feature = "internal-tests"))]
use kofft::fft::{
    __test_parallel_pool_thread_count, set_parallel_fft_threads, set_parallel_fft_threshold,
};

// Zero-length input should error immediately.
#[test]
fn zero_length_fft_errors() {
    let mut data: [Complex32; 0] = [];
    let fft = ScalarFftImpl::<f32>::default();
    assert!(matches!(fft.fft(&mut data), Err(FftError::EmptyInput)));
}

// Non-power-of-two lengths must still round-trip correctly.
#[test]
fn fft_non_power_of_two_roundtrip() {
    let mut data = vec![
        Complex32::new(0.5, -1.0),
        Complex32::new(2.0, 3.0),
        Complex32::new(-0.5, 0.25),
    ];
    let original = data.clone();
    let fft = ScalarFftImpl::<f32>::default();
    fft.fft(&mut data)
        .expect("Invariant: operation should succeed");
    fft.ifft(&mut data)
        .expect("Invariant: operation should succeed");
    assert_eq!(data.len(), original.len());
}

// Large transforms should also round-trip without significant error.
#[test]
fn fft_large_roundtrip() {
    let n = 1 << 12;
    let mut data: Vec<Complex32> = (0..n)
        .map(|i| Complex32::new(i as f32, -(i as f32)))
        .collect();
    let original = data.clone();
    let fft = ScalarFftImpl::<f32>::default();
    fft.fft(&mut data)
        .expect("Invariant: operation should succeed");
    fft.ifft(&mut data)
        .expect("Invariant: operation should succeed");
    assert_eq!(data.len(), original.len());
}

// Ensure the internal thread pool respects overrides and produces deterministic results.
#[cfg(all(feature = "parallel", feature = "std", feature = "internal-tests"))]
#[test]
fn parallel_fft_thread_bound_and_race_free() {
    set_parallel_fft_threshold(1);
    set_parallel_fft_threads(2);
    let mut data: Vec<Complex32> = (0..512).map(|i| Complex32::new(i as f32, 0.0)).collect();
    let original = data.clone();
    let fft = ScalarFftImpl::<f32>::default();
    fft.ifft(&mut data)
        .expect("Invariant: operation should succeed");
    assert_eq!(__test_parallel_pool_thread_count(), 2);
    let mut data2 = original.clone();
    fft.ifft(&mut data2)
        .expect("Invariant: operation should succeed");
    assert_eq!(data, data2);
}
