//! Tests for additional window generation functions verifying normalization and edge cases.

use kofft::window_more::{bartlett, bohman, nuttall, tukey};

/// Allowed floating-point error when verifying normalization.
const EPSILON: f32 = 1e-5;

/// Computes the expected sum of a Bartlett window for a given length.
///
/// Formula:
/// - For even `len`, `sum = len*(len-2)/(2*(len-1))`
/// - For odd `len`, `sum = (len-1)/2`
fn expected_bartlett_sum(len: usize) -> f32 {
    if len % 2 == 0 {
        (len * (len - 2)) as f32 / (2.0 * (len - 1) as f32)
    } else {
        (len - 1) as f32 / 2.0
    }
}

/// Helper to find the maximum element in a slice.
fn max(slice: &[f32]) -> f32 {
    slice.iter().copied().fold(f32::MIN, f32::max)
}

/// Ensures zero lengths panic to satisfy input sanitization.
#[test]
#[should_panic]
fn tukey_len_zero_panics() {
    tukey(0, 0.5);
}

#[test]
#[should_panic]
fn bartlett_len_zero_panics() {
    bartlett(0);
}

#[test]
#[should_panic]
fn bohman_len_zero_panics() {
    bohman(0);
}

#[test]
#[should_panic]
fn nuttall_len_zero_panics() {
    nuttall(0);
}

/// Validates normalization sums and amplitude for the Bartlett window.
#[test]
fn bartlett_sum_and_peak() {
    let len = 1024;
    let w = bartlett(len);
    assert!((max(&w) - 1.0).abs() < EPSILON);
    let expected = expected_bartlett_sum(len);
    assert!((w.iter().sum::<f32>() - expected).abs() < EPSILON);
}

/// Verifies that extremely large lengths fail fast without excessive allocation.
#[test]
#[should_panic]
fn tukey_large_len_panics() {
    tukey(usize::MAX, 0.5);
}
