// Test intent: verifies parallel stockham behavior including edge cases.
#![cfg(feature = "parallel")]

use kofft::fft::{set_parallel_fft_threshold, Complex32, ScalarFftImpl};

#[test]
fn stockham_fft_parallel_matches_serial() {
    let size = 1 << 12; // 4096
    let mut input_par: Vec<Complex32> = (0..size)
        .map(|i| Complex32::new(i as f32, (2 * i) as f32))
        .collect();
    let mut input_ser = input_par.clone();

    // Force parallel execution
    set_parallel_fft_threshold(1);
    let fft = ScalarFftImpl::<f32>::default();
    fft.stockham_fft(&mut input_par)
        .expect("Invariant: operation should succeed");

    // Force serial execution
    set_parallel_fft_threshold(usize::MAX);
    fft.stockham_fft(&mut input_ser)
        .expect("Invariant: operation should succeed");

    // Reset threshold
    set_parallel_fft_threshold(0);

    for (a, b) in input_par.iter().zip(input_ser.iter()) {
        assert!((a.re - b.re).abs() < 1e-4 && (a.im - b.im).abs() < 1e-4);
    }
}
