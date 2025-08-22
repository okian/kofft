// Test intent: verifies stockham parity behavior including edge cases.
use kofft::fft::{Complex32, FftImpl, ScalarFftImpl};

#[test]
fn stockham_matches_fft_for_large_powers_of_two() {
    let fft = ScalarFftImpl::<f32>::default();
    for &n in &[32usize, 64, 128, 256] {
        let mut data: Vec<Complex32> = (0..n)
            .map(|i| Complex32::new(i as f32, -(i as f32) * 0.25))
            .collect();
        let mut expected = data.clone();
        fft.fft(&mut expected)
            .expect("Invariant: operation should succeed");
        fft.stockham_fft(&mut data)
            .expect("Invariant: operation should succeed");
        for (a, b) in data.iter().zip(expected.iter()) {
            assert!((a.re - b.re).abs() < 1e-3);
            assert!((a.im - b.im).abs() < 1e-3);
        }
    }
}
