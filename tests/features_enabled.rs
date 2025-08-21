// Test intent: verifies features enabled behavior including edge cases.
#![cfg(all(feature = "simd", feature = "wasm"))]

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
