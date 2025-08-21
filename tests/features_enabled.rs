// Test intent: verifies features enabled behavior including edge cases.
//! Compile-time guard ensuring this test only runs when all optional features
//! are enabled simultaneously.
#![cfg(all(
    feature = "simd",
    feature = "wasm",
    feature = "parallel",
    feature = "waveform-cache"
))]
/// Confirms that all optional features are enabled when this test compiles.
#[test]
fn required_features_enabled() {
    assert!(cfg!(feature = "wasm"), "wasm feature not enabled");
    assert!(cfg!(feature = "simd"), "simd feature not enabled");
    assert!(cfg!(feature = "parallel"), "parallel feature not enabled");
    assert!(
        cfg!(feature = "waveform-cache"),
        "waveform-cache feature not enabled"
    );
}
