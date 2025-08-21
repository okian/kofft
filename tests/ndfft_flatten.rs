use kofft::fft::{Complex, FftError, ScalarFftImpl};
use kofft::ndfft::{fft2d_inplace, flatten_2d, flatten_3d};

/// Indicates a dimension of zero length used in edge-case tests.
const EMPTY: usize = 0;
/// Small non-zero dimension used to construct minimal test matrices.
const TWO: usize = 2;

/// Flattening an empty 2D matrix should yield no data and zero dimensions.
#[test]
fn flatten_2d_empty() {
    let (flat, rows, cols) = flatten_2d::<f32>(Vec::new()).unwrap();
    assert!(flat.is_empty());
    assert_eq!(rows, EMPTY);
    assert_eq!(cols, EMPTY);
}

/// Non-rectangular 2D input must return a `MismatchedLengths` error.
#[test]
fn flatten_2d_non_rectangular() {
    let data = vec![
        vec![Complex::new(0.0f32, 0.0); TWO],
        vec![Complex::new(0.0f32, 0.0); TWO + 1],
    ];
    assert_eq!(flatten_2d(data), Err(FftError::MismatchedLengths));
}

/// Flattening an empty 3D volume should produce no data and zero dimensions.
#[test]
fn flatten_3d_empty() {
    let (flat, d, r, c) = flatten_3d::<f32>(Vec::new()).unwrap();
    assert!(flat.is_empty());
    assert_eq!((d, r, c), (EMPTY, EMPTY, EMPTY));
}

/// Non-rectangular 3D input should trigger `MismatchedLengths`.
#[test]
fn flatten_3d_non_rectangular() {
    let data = vec![
        vec![vec![Complex::new(0.0f32, 0.0); TWO]],
        vec![vec![Complex::new(0.0f32, 0.0); TWO + 1]],
    ];
    assert_eq!(flatten_3d(data), Err(FftError::MismatchedLengths));
}

/// Planes with differing row counts must also trigger `MismatchedLengths`.
#[test]
fn flatten_3d_plane_mismatch() {
    let data = vec![
        vec![vec![Complex::new(0.0f32, 0.0); TWO]; TWO],
        vec![vec![Complex::new(0.0f32, 0.0); TWO]],
    ];
    assert_eq!(flatten_3d(data), Err(FftError::MismatchedLengths));
}

/// Scratch buffer length is validated before any heavy work to fail fast.
#[test]
fn fft2d_inplace_fail_fast_scratch() {
    let mut data: Vec<Complex<f32>> = Vec::new();
    let mut scratch: Vec<Complex<f32>> = Vec::new();
    let fft = ScalarFftImpl::<f32>::default();
    let res = fft2d_inplace(&mut data, usize::MAX, TWO, &fft, &mut scratch);
    assert_eq!(res, Err(FftError::MismatchedLengths));
}

/// A zero-sized 2D transform is a no-op and should not error.
#[test]
fn fft2d_inplace_empty_dims() {
    let mut data: Vec<Complex<f32>> = Vec::new();
    let mut scratch: Vec<Complex<f32>> = Vec::new();
    let fft = ScalarFftImpl::<f32>::default();
    fft2d_inplace(&mut data, EMPTY, EMPTY, &fft, &mut scratch).unwrap();
}

/// Mismatched data length must produce an error.
#[test]
fn fft2d_inplace_mismatched_len() {
    let mut data = vec![Complex::new(1.0f32, 0.0)];
    let mut scratch = vec![Complex::new(0.0f32, 0.0)];
    let fft = ScalarFftImpl::<f32>::default();
    let res = fft2d_inplace(&mut data, TWO, TWO, &fft, &mut scratch);
    assert_eq!(res, Err(FftError::MismatchedLengths));
}
