use kofft::fft::Complex32;
use kofft::fft::{FftImpl, ScalarFftImpl};

#[test]
fn fft_split_matches_aos() {
    let n = 16;
    let data: Vec<Complex32> = (0..n).map(|i| Complex32::new(i as f32, 0.0)).collect();
    let mut re: Vec<f32> = data.iter().map(|c| c.re).collect();
    let mut im: Vec<f32> = data.iter().map(|c| c.im).collect();

    let fft = ScalarFftImpl::<f32>::default();
    let mut aos = data.clone();
    fft.fft(&mut aos).unwrap();
    fft.fft_split(&mut re, &mut im).unwrap();
    for i in 0..n {
        assert!((aos[i].re - re[i]).abs() < 1e-6);
        assert!((aos[i].im - im[i]).abs() < 1e-6);
    }
}
