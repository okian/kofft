use kofft::fft::{Complex32, FftPlanner, ScalarFftImpl};

#[test]
fn block_size_env_override() {
    std::env::set_var("KOFFT_FFT_BLOCK_SIZE", "4");
    let planner = FftPlanner::<f32>::new();
    assert_eq!(planner.block_size(), 4);
    std::env::remove_var("KOFFT_FFT_BLOCK_SIZE");
}

#[test]
fn stockham_fft_blocked_matches_default() {
    let n = 32;
    let mut data: Vec<Complex32> = (0..n)
        .map(|i| Complex32::new(i as f32, (2 * i) as f32))
        .collect();
    let mut expected = data.clone();

    let default_impl = ScalarFftImpl::<f32>::default();
    default_impl.stockham_fft(&mut expected).unwrap();

    let planner = FftPlanner::<f32>::with_block_size(4);
    let fft = ScalarFftImpl::with_planner(planner);
    fft.stockham_fft(&mut data).unwrap();

    for (a, b) in data.iter().zip(expected.iter()) {
        assert!((a.re - b.re).abs() < 1e-4);
        assert!((a.im - b.im).abs() < 1e-4);
    }
}
