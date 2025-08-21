#![cfg(all(feature = "wasm", feature = "std"))]

/// Ensure that enabling both `wasm` and `std` features works concurrently.
#[test]
fn wasm_and_std_features_enabled() {
    assert!(cfg!(feature = "wasm"), "wasm feature not enabled");
    assert!(cfg!(feature = "std"), "std feature not enabled");
}
