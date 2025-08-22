use kofft::fft::FftError;
use kofft::hilbert::hilbert_analytic;

/// Ensure analytic signal real part reconstructs original input.
#[test]
fn analytic_signal_reconstructs_input() {
    let input = [0.0f32, 1.0, 0.0, -1.0];
    let analytic = hilbert_analytic(&input).expect("Invariant: operation should succeed");
    for (orig, c) in input.iter().zip(analytic.iter()) {
        assert!((orig - c.re).abs() < 1e-6, "{} vs {}", orig, c.re);
    }
}

/// Verify zero-padding does not introduce stray values.
#[test]
fn zero_padding_behavior() {
    let base = [1.0f32, -1.0];
    let mut padded = base.to_vec();
    padded.resize(4, 0.0);
    let analytic = hilbert_analytic(&padded).expect("Invariant: operation should succeed");
    for c in &analytic[base.len()..] {
        assert!(c.re.abs() < 1e-6);
        assert!(c.im.is_finite());
    }
}

/// Real-valued inputs containing NaN should be rejected.
#[test]
fn rejects_nan_input() {
    let input = [0.0f32, f32::NAN, 0.0, 0.0];
    assert_eq!(hilbert_analytic(&input), Err(FftError::InvalidValue));
}
