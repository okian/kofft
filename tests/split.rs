// Test intent: verifies split behavior including edge cases.
use kofft::fft::{
    complex32_to_split, fft_split_complex, ifft_split_complex, Complex32, FftImpl, ScalarFftImpl,
    SplitComplex32,
};
#[cfg(any(feature = "simd", feature = "soa"))]
use kofft::fft::{fft_complex_vec, ifft_complex_vec};
#[cfg(any(feature = "simd", feature = "soa"))]
use kofft::num::ComplexVec;

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

#[cfg(any(feature = "simd", feature = "soa"))]
#[test]
fn complex_vec_roundtrip() {
    let n = 32;
    let data: Vec<Complex32> = (0..n)
        .map(|i| Complex32::new(i as f32, -(i as f32)))
        .collect();
    let mut vec = ComplexVec {
        re: data.iter().map(|c| c.re).collect(),
        im: data.iter().map(|c| c.im).collect(),
    };
    fft_complex_vec(&mut vec).unwrap();
    ifft_complex_vec(&mut vec).unwrap();
    for (orig, (r, i)) in data.iter().zip(vec.re.iter().zip(vec.im.iter())) {
        assert!((orig.re - r).abs() < 1e-4);
        assert!((orig.im - i).abs() < 1e-4);
    }
}
