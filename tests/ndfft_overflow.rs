use kofft::fft::{Complex, FftError, ScalarFftImpl};
use kofft::ndfft::{fft2d_inplace, fft3d_inplace, Fft3dScratch};

#[test]
fn fft2d_inplace_overflow() {
    let mut data: Vec<Complex<f32>> = Vec::new();
    let mut scratch: Vec<Complex<f32>> = Vec::new();
    let fft = ScalarFftImpl::<f32>::default();
    let res = fft2d_inplace(&mut data, usize::MAX, 2, &fft, &mut scratch);
    assert_eq!(res, Err(FftError::Overflow));
}

#[test]
fn fft3d_inplace_overflow() {
    let mut data: Vec<Complex<f32>> = Vec::new();
    let mut tube: Vec<Complex<f32>> = Vec::new();
    let mut row: Vec<Complex<f32>> = Vec::new();
    let mut col: Vec<Complex<f32>> = Vec::new();
    let mut scratch = Fft3dScratch {
        tube: &mut tube,
        row: &mut row,
        col: &mut col,
    };
    let fft = ScalarFftImpl::<f32>::default();
    let res = fft3d_inplace(&mut data, usize::MAX, 2, 2, &fft, &mut scratch);
    assert_eq!(res, Err(FftError::Overflow));
}
