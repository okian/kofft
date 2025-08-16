use kofft::fft::{
    fft_split_complex, ifft_split_complex, Complex64, FftImpl, ScalarFftImpl, SplitComplex,
};

#[test]
fn fft_split_matches_aos_f64() {
    let n = 16;
    let data: Vec<Complex64> = (0..n).map(|i| Complex64::new(i as f64, 0.0)).collect();
    let mut re = vec![0.0f64; n];
    let mut im = vec![0.0f64; n];
    let split = SplitComplex::copy_from_complex(&data, &mut re, &mut im);

    let fft = ScalarFftImpl::<f64>::default();
    let mut aos = data.clone();
    fft.fft(&mut aos).unwrap();
    fft_split_complex(split).unwrap();
    for i in 0..n {
        assert!((aos[i].re - re[i]).abs() < 1e-9);
        assert!((aos[i].im - im[i]).abs() < 1e-9);
    }
}

#[test]
fn ifft_split_roundtrip_f64() {
    let n = 32;
    let data: Vec<Complex64> = (0..n)
        .map(|i| Complex64::new(i as f64, -(i as f64)))
        .collect();
    let mut re = vec![0.0f64; n];
    let mut im = vec![0.0f64; n];
    let mut split = SplitComplex::copy_from_complex(&data, &mut re, &mut im);
    fft_split_complex(split).unwrap();
    split = SplitComplex {
        re: &mut re,
        im: &mut im,
    };
    ifft_split_complex(split).unwrap();
    for i in 0..n {
        assert!((data[i].re - re[i]).abs() < 1e-9);
        assert!((data[i].im - im[i]).abs() < 1e-9);
    }
}

#[test]
fn fft_roundtrip_f64() {
    let n = 32;
    let data: Vec<Complex64> = (0..n)
        .map(|i| Complex64::new((i as f64).sin(), (i as f64).cos()))
        .collect();
    let mut buf = data.clone();
    let fft = ScalarFftImpl::<f64>::default();
    fft.fft(&mut buf).unwrap();
    fft.ifft(&mut buf).unwrap();
    for i in 0..n {
        assert!((data[i].re - buf[i].re).abs() < 1e-9);
        assert!((data[i].im - buf[i].im).abs() < 1e-9);
    }
}

#[test]
fn fft_split_non_pow2_f64() {
    let n = 12;
    let data: Vec<Complex64> = (0..n).map(|i| Complex64::new(i as f64, 0.0)).collect();
    let mut re = vec![0.0f64; n];
    let mut im = vec![0.0f64; n];
    let split = SplitComplex::copy_from_complex(&data, &mut re, &mut im);
    let fft = ScalarFftImpl::<f64>::default();
    let mut aos = data.clone();
    fft.fft(&mut aos).unwrap();
    fft_split_complex(split).unwrap();
    for i in 0..n {
        assert!((aos[i].re - re[i]).abs() < 1e-9);
        assert!((aos[i].im - im[i]).abs() < 1e-9);
    }
}
