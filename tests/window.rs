//! Tests for window generation functions covering edge cases and normalization.

use kofft::window::{
    blackman, blackman_inplace_stack, hamming, hamming_inplace_stack, hann, hann_inplace_stack,
    kaiser,
};

/// Helper to find the maximum element in a slice.
fn max(slice: &[f32]) -> f32 {
    slice.iter().copied().fold(f32::MIN, f32::max)
}

/// Allowed floating-point error when verifying normalization.
const EPSILON: f32 = 1e-5;
/// Expected sum factor for the Hann window (`sum = HANN_SUM_FACTOR * len`).
const HANN_SUM_FACTOR: f32 = 0.5;
/// Expected sum factor for the Hamming window (`sum = HAMMING_SUM_FACTOR * len`).
const HAMMING_SUM_FACTOR: f32 = 0.54;
/// Expected sum factor for the Blackman window (`sum = BLACKMAN_SUM_FACTOR * len`).
const BLACKMAN_SUM_FACTOR: f32 = 0.42;

/// Validates edge cases and normalization for the Hann window.
#[test]
#[should_panic]
fn hann_len_zero_panics() {
    hann(0);
}

/// Validates edge cases, normalization, and sum for the Hann window.
#[test]
fn hann_edges_and_large() {
    assert_eq!(hann(1), vec![1.0]);
    let w = hann(1024);
    assert!((max(&w) - 1.0).abs() < EPSILON);
    let expected_sum = HANN_SUM_FACTOR * 1024.0;
    assert!((w.iter().sum::<f32>() - expected_sum).abs() < EPSILON);

    let mut buf = [0.0f32; 1];
    hann_inplace_stack(&mut buf);
    assert_eq!(buf, [1.0]);
}

/// Ensures extreme lengths fail fast without undefined behavior.
#[test]
#[should_panic]
fn hann_large_len_panics() {
    hann(usize::MAX);
}

/// Validates edge cases and normalization for the Hamming window.
#[test]
#[should_panic]
fn hamming_len_zero_panics() {
    hamming(0);
}

/// Validates edge cases, normalization, and sum for the Hamming window.
#[test]
fn hamming_edges_and_large() {
    assert_eq!(hamming(1), vec![1.0]);
    let w = hamming(1024);
    assert!((max(&w) - 1.0).abs() < EPSILON);
    let expected_sum = HAMMING_SUM_FACTOR * 1024.0;
    assert!((w.iter().sum::<f32>() - expected_sum).abs() < EPSILON);

    let mut buf = [0.0f32; 1];
    hamming_inplace_stack(&mut buf);
    assert_eq!(buf, [1.0]);
}

/// Validates edge cases and normalization for the Blackman window.
#[test]
#[should_panic]
fn blackman_len_zero_panics() {
    blackman(0);
}

/// Validates edge cases, normalization, and sum for the Blackman window.
#[test]
fn blackman_edges_and_large() {
    assert_eq!(blackman(1), vec![1.0]);
    let w = blackman(1024);
    assert!((max(&w) - 1.0).abs() < EPSILON);
    let expected_sum = BLACKMAN_SUM_FACTOR * 1024.0;
    assert!((w.iter().sum::<f32>() - expected_sum).abs() < EPSILON);

    let mut buf = [0.0f32; 1];
    blackman_inplace_stack(&mut buf);
    assert_eq!(buf, [1.0]);
}

/// Validates normalization and parameter checks for the Kaiser window.
#[test]
fn kaiser_edges_and_large() {
    assert_eq!(kaiser(1, 5.0), vec![1.0]);
    let w = kaiser(1024, 5.0);
    assert!((max(&w) - 1.0).abs() < EPSILON);
}

/// Ensures providing a negative beta panics as input sanitization.
#[test]
#[should_panic]
fn kaiser_negative_beta_panics() {
    kaiser(8, -1.0);
}

/// Ensures zero length triggers a panic instead of returning an empty window.
#[test]
#[should_panic]
fn kaiser_len_zero_panics() {
    kaiser(0, 5.0);
}
