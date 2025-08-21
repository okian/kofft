// Test intent: verifies db scale behavior including edge cases.
#![cfg(all(feature = "std", feature = "wasm", feature = "simd"))]

use kofft::visual::spectrogram::db_scale;

/// Ensure zero or extremely small maximum magnitudes yield a neutral output
/// instead of producing invalid logarithmic results.
#[test]
fn zero_or_tiny_max_mag_returns_zero() {
    assert_eq!(db_scale(1.0, 0.0, 80.0), 0.0);
    assert_eq!(db_scale(1.0, 1e-12, 80.0), 0.0);
    assert_eq!(db_scale(1.0, -1.0, 80.0), 0.0);
}

/// Confirm negative magnitudes are treated as silence and do not produce
/// negative scaling values.
#[test]
fn negative_magnitude_clamps_to_zero() {
    assert_eq!(db_scale(-1.0, 1.0, 80.0), 0.0);
}

/// Verify typical magnitudes scale into the expected 0..1 range.
#[test]
fn scales_nominal_values_within_unit_range() {
    let mag = 0.5;
    let max_mag = 1.0;
    let dynamic_range = 80.0;
    let result = db_scale(mag, max_mag, dynamic_range);
    let expected =
        ((20.0 * (mag / max_mag).log10() + dynamic_range) / dynamic_range).clamp(0.0, 1.0);
    assert!((result - expected).abs() < f32::EPSILON);
}
