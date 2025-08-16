use kofft::fft::{fft_split, ifft_split, Complex64, FftImpl, ScalarFftImpl};

#[test]
fn fft_split_matches_aos_f64() {
    let n = 32;
    let data: Vec<Complex64> = (0..n).map(|i| Complex64::new(i as f64, 0.0)).collect();
    let mut re: Vec<f64> = data.iter().map(|c| c.re).collect();
    let mut im: Vec<f64> = data.iter().map(|c| c.im).collect();
    let mut aos = data.clone();
    let fft = ScalarFftImpl::<f64>::default();
    fft.fft(&mut aos).unwrap();
    fft_split(&mut re, &mut im).unwrap();
    for i in 0..n {
        assert!((aos[i].re - re[i]).abs() < 1e-10);
        assert!((aos[i].im - im[i]).abs() < 1e-10);
    }
}

#[test]
fn fft_split_non_pow2_f64() {
    let n = 12;
    let data: Vec<Complex64> = (0..n).map(|i| Complex64::new(i as f64, 0.0)).collect();
    let mut re: Vec<f64> = data.iter().map(|c| c.re).collect();
    let mut im: Vec<f64> = data.iter().map(|c| c.im).collect();
    let fft = ScalarFftImpl::<f64>::default();
    let mut aos = data.clone();
    fft.fft(&mut aos).unwrap();
    fft_split(&mut re, &mut im).unwrap();
    for i in 0..n {
        assert!((aos[i].re - re[i]).abs() < 1e-10);
        assert!((aos[i].im - im[i]).abs() < 1e-10);
    }
}

#[test]
fn ifft_split_roundtrip_f64() {
    let n = 64;
    let data: Vec<Complex64> = (0..n)
        .map(|i| Complex64::new(i as f64, -(i as f64)))
        .collect();
    let mut re: Vec<f64> = data.iter().map(|c| c.re).collect();
    let mut im: Vec<f64> = data.iter().map(|c| c.im).collect();
    fft_split(&mut re, &mut im).unwrap();
    ifft_split(&mut re, &mut im).unwrap();
    for i in 0..n {
        assert!((data[i].re - re[i]).abs() < 1e-8);
        assert!((data[i].im - im[i]).abs() < 1e-8);
    }
}
