use kofft::fft::{
    complex32_to_split, fft_split_complex, ifft_split_complex, Complex32, FftImpl, ScalarFftImpl,
    SplitComplex32,
};

#[test]
fn fft_split_matches_aos() {
    let n = 16;
    let data: Vec<Complex32> = (0..n).map(|i| Complex32::new(i as f32, 0.0)).collect();
    let mut re = vec![0.0f32; n];
    let mut im = vec![0.0f32; n];
    let split = complex32_to_split(&data, &mut re, &mut im);

    let fft = ScalarFftImpl::<f32>::default();
    let mut aos = data.clone();
    fft.fft(&mut aos).unwrap();
    fft_split_complex(split).unwrap();
    for i in 0..n {
        assert!((aos[i].re - re[i]).abs() < 1e-6);
        assert!((aos[i].im - im[i]).abs() < 1e-6);
    }
}

#[test]
fn fft_split_non_pow2() {
    let n = 12;
    let data: Vec<Complex32> = (0..n).map(|i| Complex32::new(i as f32, 0.0)).collect();
    let mut re = vec![0.0f32; n];
    let mut im = vec![0.0f32; n];
    let split = complex32_to_split(&data, &mut re, &mut im);
    let fft = ScalarFftImpl::<f32>::default();
    let mut aos = data.clone();
    fft.fft(&mut aos).unwrap();
    fft_split_complex(split).unwrap();
    for i in 0..n {
        assert!((aos[i].re - re[i]).abs() < 1e-6);
        assert!((aos[i].im - im[i]).abs() < 1e-6);
    }
}

#[test]
fn ifft_split_roundtrip() {
    let n = 64;
    let data: Vec<Complex32> = (0..n)
        .map(|i| Complex32::new(i as f32, -(i as f32)))
        .collect();
    let mut re = vec![0.0f32; n];
    let mut im = vec![0.0f32; n];
    let split = complex32_to_split(&data, &mut re, &mut im);
    fft_split_complex(split).unwrap();
    let split = SplitComplex32 {
        re: &mut re,
        im: &mut im,
    };
    ifft_split_complex(split).unwrap();
    for i in 0..n {
        assert!((data[i].re - re[i]).abs() < 1e-4);
        assert!((data[i].im - im[i]).abs() < 1e-4);
    }
}

#[test]
fn fft_split_errors() {
    let mut re = [0.0f32; 4];
    let mut im = [0.0f32; 3];
    let split = SplitComplex32 {
        re: &mut re,
        im: &mut im,
    };
    assert!(fft_split_complex(split).is_err());
}
