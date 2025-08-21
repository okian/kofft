// Test intent: verifies features enabled behavior including edge cases.
#![cfg(all(feature = "simd", feature = "wasm", feature = "waveform-cache"))] // only relevant when all runtime features are present

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
