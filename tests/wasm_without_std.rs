#![cfg(all(feature = "wasm", not(feature = "std")))]

/// Ensure that `wasm` feature can be used without the `std` feature.
#[test]
fn wasm_without_std_compiles() {
    assert!(cfg!(feature = "wasm"), "wasm feature not enabled");
    assert!(!cfg!(feature = "std"), "std feature should be disabled");
}
