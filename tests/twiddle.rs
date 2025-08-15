use kofft::{
    fft::FftPlanner,
    num::{Complex32, Complex64},
};

#[test]
#[ignore]
fn planner_twiddles_f32_f64() {
    let mut p32 = FftPlanner::<f32>::new();
    let t32 = p32.get_twiddles(8);
    let expected32 = Complex32::expi(-2.0 * std::f32::consts::PI / 8.0);
    assert!((t32[1].re - expected32.re).abs() < 1e-6);
    assert!((t32[1].im - expected32.im).abs() < 1e-6);

    // Ensure Bluestein cache lengths are correct for non-power-of-two
    #[cfg(feature = "std")]
    {
        let (chirp, fft_b) = p32.get_bluestein(5);
        assert_eq!(chirp.len(), 5);
        assert_eq!(fft_b.len(), 16);
    }

    let mut p64 = FftPlanner::<f64>::new();
    let t64 = p64.get_twiddles(8);
    let expected64 = Complex64::expi(-2.0 * std::f64::consts::PI / 8.0);
    assert!((t64[1].re - expected64.re).abs() < 1e-12);
    assert!((t64[1].im - expected64.im).abs() < 1e-12);
}
