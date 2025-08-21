// Test intent: verifies backend detection behavior including edge cases.
#[cfg(target_arch = "x86_64")]
#[test]
fn selects_x86_backend() {
    let backend = kofft::fft::new_fft_impl();
    let any = backend.as_ref() as &dyn core::any::Any;
    assert!(any.is::<kofft::fft::SimdFftX86_64Impl>());
}

#[cfg(target_arch = "aarch64")]
#[test]
fn selects_aarch64_backend() {
    let backend = kofft::fft::new_fft_impl();
    let any = backend.as_ref() as &dyn core::any::Any;
    assert!(any.is::<kofft::fft::SimdFftAarch64Impl>());
}

#[cfg(target_arch = "wasm32")]
#[test]
fn selects_wasm_backend() {
    let backend = kofft::fft::new_fft_impl();
    let any = backend.as_ref() as &dyn core::any::Any;
    assert!(any.is::<kofft::fft::SimdFftWasmImpl>());
}
