// Test intent: ensures parallel and sequential FFT paths produce identical results.
#![cfg(all(feature = "parallel", feature = "std"))]

use kofft::fft::{set_parallel_fft_threshold, Complex32, FftImpl, ScalarFftImpl};

/// Size of the FFT used for parity testing.
const FFT_SIZE: usize = 1 << 10;

#[test]
/// Run the same FFT in forced-parallel and forced-sequential modes and compare outputs.
fn parallel_matches_sequential() {
    let mut input_par: Vec<Complex32> = (0..FFT_SIZE)
        .map(|i| Complex32::new(i as f32, -(i as f32)))
        .collect();
    let mut input_seq = input_par.clone();
    let fft = ScalarFftImpl::<f32>::default();

    set_parallel_fft_threshold(1);
    fft.fft(&mut input_par).unwrap();

    set_parallel_fft_threshold(usize::MAX);
    fft.fft(&mut input_seq).unwrap();

    set_parallel_fft_threshold(0);

    for (a, b) in input_par.iter().zip(input_seq.iter()) {
        assert!((a.re - b.re).abs() < 1e-4 && (a.im - b.im).abs() < 1e-4);
    }
}
