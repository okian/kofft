//! Integration tests asserting the Discrete Hartley Transform matches the
//! equivalent Fast Fourier Transform behaviour.

use kofft::fft::{FftError, FftImpl, ScalarFftImpl};
use kofft::hartley::dht;
use kofft::num::Complex32;

/// Allowed floating‑point error tolerance when comparing transform results.
///
/// A relatively loose threshold keeps the tests stable across different
/// architectures while still catching significant numerical regressions.
const EPSILON: f32 = 1e-4;

/// Verify that the DHT matches `Re(FFT) - Im(FFT)` for even-length inputs.
///
/// This ensures the implementation agrees with the FFT-based definition of the
/// Hartley transform for a simple deterministic vector.
#[test]
fn dht_matches_fft_even_length() {
    let input = [1.0f32, 2.0, 3.0, 4.0];
    let mut fft_data: Vec<Complex32> = input.iter().map(|&x| Complex32::new(x, 0.0)).collect();
    let fft = ScalarFftImpl::<f32>::default();
    fft.fft(&mut fft_data).unwrap();
    let dht_out = dht(&input);
    for (k, &val) in dht_out.iter().enumerate() {
        let c = fft_data[k];
        let expected = c.re - c.im;
        assert!(
            (val - expected).abs() <= EPSILON,
            "index {k}: {val} vs {expected}"
        );
    }
}

/// Verify that DHT and FFT remain equivalent for odd-length signals.
///
/// Odd sizes stress the general FFT path and help maintain ≥50 % test coverage
/// for the Hartley transform.
#[test]
fn dht_matches_fft_odd_length() {
    let input = [1.0f32, 2.0, 3.0, 4.0, 5.0];
    let mut fft_data: Vec<Complex32> = input.iter().map(|&x| Complex32::new(x, 0.0)).collect();
    let fft = ScalarFftImpl::<f32>::default();
    fft.fft(&mut fft_data).unwrap();
    let dht_out = dht(&input);
    for (k, &val) in dht_out.iter().enumerate() {
        let c = fft_data[k];
        let expected = c.re - c.im;
        assert!(
            (val - expected).abs() <= EPSILON,
            "index {k}: {val} vs {expected}"
        );
    }
}

/// Ensure zero-length inputs produce an empty DHT and the FFT implementation
/// rejects them with a clear error.
///
/// Handling this edge case prevents `NaN` propagation and division-by-zero
/// bugs in production usage.
#[test]
fn dht_empty_matches_fft_behavior() {
    let input: [f32; 0] = [];
    let dht_out = dht(&input);
    assert!(dht_out.is_empty());

    let mut fft_data: Vec<Complex32> = Vec::new();
    let fft = ScalarFftImpl::<f32>::default();
    let fft_result = fft.fft(&mut fft_data);
    assert!(matches!(fft_result, Err(FftError::EmptyInput)));
}
