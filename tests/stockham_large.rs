use kofft::fft::{Complex32, FftImpl, ScalarFftImpl};

#[test]
fn stockham_fft_large_sizes() {
    let fft = ScalarFftImpl::<f32>::default();
    for &n in &[512usize, 1024] {
        let mut data: Vec<Complex32> = (0..n)
            .map(|i| Complex32::new((i as f32).sin(), (i as f32).cos()))
            .collect();
        let mut expected = data.clone();
        fft.fft(&mut expected).unwrap();
        fft.stockham_fft(&mut data).unwrap();
        for (a, b) in data.iter().zip(expected.iter()) {
            assert!((a.re - b.re).abs() < 1e-3);
            assert!((a.im - b.im).abs() < 1e-3);
        }
    }
}
