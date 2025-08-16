use kofft::fft::FftPlanner;

#[cfg(feature = "precomputed-twiddles")]
#[test]
fn precomputed_twiddles_share_memory() {
    let mut p1 = FftPlanner::<f32>::new();
    let mut p2 = FftPlanner::<f32>::new();
    let t1 = p1.get_twiddles(16);
    let t2 = p2.get_twiddles(16);
    assert_eq!(t1.as_ptr(), t2.as_ptr());

    // f64 coverage
    let mut q1 = FftPlanner::<f64>::new();
    let mut q2 = FftPlanner::<f64>::new();
    let s1 = q1.get_twiddles(32);
    let s2 = q2.get_twiddles(32);
    assert_eq!(s1.as_ptr(), s2.as_ptr());
}

#[cfg(not(feature = "precomputed-twiddles"))]
#[test]
fn runtime_twiddles_are_unique() {
    let mut p1 = FftPlanner::<f32>::new();
    let mut p2 = FftPlanner::<f32>::new();
    let t1 = p1.get_twiddles(16);
    let t2 = p2.get_twiddles(16);
    assert_ne!(t1.as_ptr(), t2.as_ptr());

    // f64 runtime
    let mut q1 = FftPlanner::<f64>::new();
    let mut q2 = FftPlanner::<f64>::new();
    let s1 = q1.get_twiddles(32);
    let s2 = q2.get_twiddles(32);
    assert_ne!(s1.as_ptr(), s2.as_ptr());
}
