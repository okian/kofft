#![cfg(all(feature = "simd", feature = "wasm"))]

#[test]
fn wasm_and_simd_features_enabled() {
    assert!(cfg!(feature = "wasm"), "wasm feature not enabled");
    assert!(cfg!(feature = "simd"), "simd feature not enabled");
}
