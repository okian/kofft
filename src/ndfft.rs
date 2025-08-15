//! Multi-dimensional FFT (2D/3D) for kofft
//!
//! - 2D FFT for f32 Complex32 arrays (row-column algorithm)
//! - In-place and out-of-place APIs
//! - no_std + alloc compatible
//! - Scratch buffers supplied by caller to avoid reallocations
//! - Future: 3D FFT, real input, streaming

extern crate alloc;
#[cfg(all(feature = "internal-tests", test))]
use alloc::vec;
use alloc::vec::Vec;

use crate::fft::{Complex, FftError, FftImpl, Float, ScalarFftImpl};

/// Result type returned by [`flatten_3d`].
type Flatten3dResult<T> = (Vec<Complex<T>>, usize, usize, usize);

/// Flatten a 2D `Vec<Vec<Complex<T>>>` into a single `Vec<Complex<T>>` along
/// with its row/column dimensions.
pub fn flatten_2d<T: Float>(
    data: Vec<Vec<Complex<T>>>,
) -> Result<(Vec<Complex<T>>, usize, usize), FftError> {
    let rows = data.len();
    if rows == 0 {
        return Ok((Vec::new(), 0, 0));
    }
    let cols = data[0].len();
    if data.iter().any(|row| row.len() != cols) {
        return Err(FftError::MismatchedLengths);
    }
    let mut flat = Vec::with_capacity(rows * cols);
    for row in data {
        flat.extend(row);
    }
    Ok((flat, rows, cols))
}

/// Flatten a 3D `Vec<Vec<Vec<Complex<T>>>>` into a single `Vec<Complex<T>>`
/// along with its depth/row/column dimensions.
pub fn flatten_3d<T: Float>(
    data: Vec<Vec<Vec<Complex<T>>>>,
) -> Result<Flatten3dResult<T>, FftError> {
    let depth = data.len();
    if depth == 0 {
        return Ok((Vec::new(), 0, 0, 0));
    }
    let rows = data[0].len();
    let cols = if rows > 0 { data[0][0].len() } else { 0 };
    for plane in &data {
        if plane.len() != rows {
            return Err(FftError::MismatchedLengths);
        }
        for row in plane {
            if row.len() != cols {
                return Err(FftError::MismatchedLengths);
            }
        }
    }
    let mut flat = Vec::with_capacity(depth * rows * cols);
    for plane in data {
        for row in plane {
            flat.extend(row);
        }
    }
    Ok((flat, depth, rows, cols))
}

/// 2D FFT in-place (row-column algorithm)
/// Perform a 2D FFT in-place using a row-column algorithm.
///
/// `scratch_col` must have length equal to the number of rows and is used as
/// temporary storage when transforming columns.
pub fn fft2d_inplace<T: Float>(
    data: &mut [Complex<T>],
    rows: usize,
    cols: usize,
    fft: &ScalarFftImpl<T>,
    scratch_col: &mut [Complex<T>],
) -> Result<(), FftError> {
    if rows * cols != data.len() {
        return Err(FftError::MismatchedLengths);
    }
    if rows == 0 || cols == 0 {
        return Ok(());
    }
    if scratch_col.len() != rows {
        return Err(FftError::MismatchedLengths);
    }
    // FFT on rows
    for r in 0..rows {
        let start = r * cols;
        fft.fft(&mut data[start..start + cols])?;
    }
    // FFT on columns using strided transform
    for c in 0..cols {
        fft.fft_strided(&mut data[c..], cols, scratch_col)?;
    }
    Ok(())
}

/// Scratch buffers for [`fft3d_inplace`].
pub struct Fft3dScratch<'a, T: Float> {
    pub tube: &'a mut [Complex<T>],
    pub row: &'a mut [Complex<T>],
    pub col: &'a mut [Complex<T>],
}

/// 3D FFT in-place (row-column-depth algorithm)
/// Perform a 3D FFT in-place using a row-column-depth algorithm.
///
/// The scratch buffers must have lengths equal to the depth, rows, and columns
/// respectively.
pub fn fft3d_inplace<T: Float>(
    data: &mut [Complex<T>],
    depth: usize,
    rows: usize,
    cols: usize,
    fft: &ScalarFftImpl<T>,
    scratch: &mut Fft3dScratch<'_, T>,
) -> Result<(), FftError> {
    if depth * rows * cols != data.len() {
        return Err(FftError::MismatchedLengths);
    }
    if depth == 0 || rows == 0 || cols == 0 {
        return Ok(());
    }
    if scratch.tube.len() != depth || scratch.row.len() != rows || scratch.col.len() != cols {
        return Err(FftError::MismatchedLengths);
    }
    // FFT on depth (z axis)
    for r in 0..rows {
        for c in 0..cols {
            let start = r * cols + c;
            fft.fft_strided(&mut data[start..], rows * cols, scratch.tube)?;
        }
    }
    // FFT on rows (y axis)
    for d in 0..depth {
        for c in 0..cols {
            let start = d * rows * cols + c;
            fft.fft_strided(&mut data[start..], cols, scratch.row)?;
        }
    }
    // FFT on columns (x axis)
    for d in 0..depth {
        for r in 0..rows {
            let start = d * rows * cols + r * cols;
            fft.fft(&mut data[start..start + cols])?;
        }
    }
    Ok(())
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    use crate::fft::{Complex, FftError, ScalarFftImpl};
    use alloc::format;
    use proptest::prelude::*;

    fn inverse_2d<T: Float>(
        data: &mut [Complex<T>],
        rows: usize,
        cols: usize,
        fft: &ScalarFftImpl<T>,
    ) {
        for r in 0..rows {
            fft.ifft(&mut data[r * cols..(r + 1) * cols]).unwrap();
        }
        let mut col = vec![Complex::zero(); rows];
        for c in 0..cols {
            fft.ifft_strided(&mut data[c..], cols, &mut col).unwrap();
        }
    }

    fn inverse_3d<T: Float>(
        data: &mut [Complex<T>],
        depth: usize,
        rows: usize,
        cols: usize,
        fft: &ScalarFftImpl<T>,
    ) {
        let mut tube = vec![Complex::zero(); depth];
        for r in 0..rows {
            for c in 0..cols {
                let start = r * cols + c;
                fft.ifft_strided(&mut data[start..], rows * cols, &mut tube)
                    .unwrap();
            }
        }
        let mut row_buf = vec![Complex::zero(); rows];
        for d in 0..depth {
            for c in 0..cols {
                let start = d * rows * cols + c;
                fft.ifft_strided(&mut data[start..], cols, &mut row_buf)
                    .unwrap();
            }
        }
        for d in 0..depth {
            for r in 0..rows {
                let start = d * rows * cols + r * cols;
                fft.ifft(&mut data[start..start + cols]).unwrap();
            }
        }
    }

    #[test]
    fn test_fft2d_roundtrip_flat_f32() {
        let fft = ScalarFftImpl::<f32>::default();
        let rows = 2;
        let cols = 2;
        let mut data = vec![
            Complex::new(1.0, 0.0),
            Complex::new(2.0, 0.0),
            Complex::new(3.0, 0.0),
            Complex::new(4.0, 0.0),
        ];
        let orig = data.clone();
        let mut scratch = vec![Complex::zero(); rows];
        fft2d_inplace(&mut data, rows, cols, &fft, &mut scratch).unwrap();
        inverse_2d(&mut data, rows, cols, &fft);
        for (a, b) in data.iter().zip(orig.iter()) {
            let err = (a.re - b.re).abs().max((a.im - b.im).abs());
            assert!(err < 1e-3, "a = {:?}, b = {:?}, err = {}", a, b, err);
        }
    }

    #[test]
    fn test_fft2d_roundtrip_from_vecvec_f32() {
        let fft = ScalarFftImpl::<f32>::default();
        let nested = vec![
            vec![Complex::new(1.0, 0.0), Complex::new(2.0, 0.0)],
            vec![Complex::new(3.0, 0.0), Complex::new(4.0, 0.0)],
        ];
        let (mut data, rows, cols) = flatten_2d(nested.clone()).unwrap();
        let orig = data.clone();
        let mut scratch = vec![Complex::zero(); rows];
        fft2d_inplace(&mut data, rows, cols, &fft, &mut scratch).unwrap();
        inverse_2d(&mut data, rows, cols, &fft);
        for (a, b) in data.iter().zip(orig.iter()) {
            let err = (a.re - b.re).abs().max((a.im - b.im).abs());
            assert!(err < 1e-3, "a = {:?}, b = {:?}, err = {}", a, b, err);
        }
    }

    #[test]
    fn test_fft3d_roundtrip_flat_f32() {
        let fft = ScalarFftImpl::<f32>::default();
        let depth = 2;
        let rows = 2;
        let cols = 2;
        let mut data = vec![
            Complex::new(1.0, 0.0),
            Complex::new(2.0, 0.0),
            Complex::new(3.0, 0.0),
            Complex::new(4.0, 0.0),
            Complex::new(5.0, 0.0),
            Complex::new(6.0, 0.0),
            Complex::new(7.0, 0.0),
            Complex::new(8.0, 0.0),
        ];
        let orig = data.clone();
        let mut tube = vec![Complex::zero(); depth];
        let mut row = vec![Complex::zero(); rows];
        let mut col = vec![Complex::zero(); cols];
        let mut scratch = Fft3dScratch {
            tube: &mut tube,
            row: &mut row,
            col: &mut col,
        };
        fft3d_inplace(&mut data, depth, rows, cols, &fft, &mut scratch).unwrap();
        inverse_3d(&mut data, depth, rows, cols, &fft);
        for (a, b) in data.iter().zip(orig.iter()) {
            let err = (a.re - b.re).abs().max((a.im - b.im).abs());
            assert!(err < 1e-3, "a = {:?}, b = {:?}, err = {}", a, b, err);
        }
    }

    #[test]
    fn test_fft3d_roundtrip_from_vecvecvec_f32() {
        let fft = ScalarFftImpl::<f32>::default();
        let nested = vec![
            vec![
                vec![Complex::new(1.0, 0.0), Complex::new(2.0, 0.0)],
                vec![Complex::new(3.0, 0.0), Complex::new(4.0, 0.0)],
            ],
            vec![
                vec![Complex::new(5.0, 0.0), Complex::new(6.0, 0.0)],
                vec![Complex::new(7.0, 0.0), Complex::new(8.0, 0.0)],
            ],
        ];
        let (mut data, depth, rows, cols) = flatten_3d(nested.clone()).unwrap();
        let orig = data.clone();
        let mut tube = vec![Complex::zero(); depth];
        let mut row = vec![Complex::zero(); rows];
        let mut col = vec![Complex::zero(); cols];
        let mut scratch = Fft3dScratch {
            tube: &mut tube,
            row: &mut row,
            col: &mut col,
        };
        fft3d_inplace(&mut data, depth, rows, cols, &fft, &mut scratch).unwrap();
        inverse_3d(&mut data, depth, rows, cols, &fft);
        for (a, b) in data.iter().zip(orig.iter()) {
            let err = (a.re - b.re).abs().max((a.im - b.im).abs());
            assert!(err < 1e-3, "a = {:?}, b = {:?}, err = {}", a, b, err);
        }
    }

    proptest! {
        #[test]
        fn prop_fft2d_roundtrip(rows in proptest::sample::select(vec![2usize,4,8]),
                                cols in proptest::sample::select(vec![2usize,4,8]),
                                ref signal in proptest::collection::vec(-1000.0f32..1000.0, 64)) {
            let len = rows * cols;
            let mut data: Vec<Complex<f32>> = signal.iter().take(len)
                .cloned().map(|x| Complex::new(x, 0.0)).collect();
            let orig = data.clone();
            let fft = ScalarFftImpl::<f32>::default();
            let mut scratch = vec![Complex::zero(); rows];
            fft2d_inplace(&mut data, rows, cols, &fft, &mut scratch).unwrap();
            inverse_2d(&mut data, rows, cols, &fft);
            for (a, b) in orig.iter().zip(data.iter()) {
                let err = (a.re - b.re).abs().max((a.im - b.im).abs());
                prop_assert!(err < 1e-2);
            }
        }
    }

    proptest! {
        #[test]
        fn prop_fft3d_roundtrip(depth in proptest::sample::select(vec![2usize,4]),
                                rows in proptest::sample::select(vec![2usize,4]),
                                cols in proptest::sample::select(vec![2usize,4]),
                                ref signal in proptest::collection::vec(-1000.0f32..1000.0, 64)) {
            let len = depth * rows * cols;
            let mut data: Vec<Complex<f32>> = signal.iter().take(len)
                .cloned().map(|x| Complex::new(x, 0.0)).collect();
            let orig = data.clone();
            let fft = ScalarFftImpl::<f32>::default();
            let mut tube = vec![Complex::zero(); depth];
            let mut row = vec![Complex::zero(); rows];
            let mut col = vec![Complex::zero(); cols];
            let mut scratch = Fft3dScratch {
                tube: &mut tube,
                row: &mut row,
                col: &mut col,
            };
            fft3d_inplace(&mut data, depth, rows, cols, &fft, &mut scratch).unwrap();
            inverse_3d(&mut data, depth, rows, cols, &fft);
            for (a, b) in orig.iter().zip(data.iter()) {
                let err = (a.re - b.re).abs().max((a.im - b.im).abs());
                prop_assert!(err < 1e-2);
            }
        }
    }

    #[test]
    fn test_fft2d_mismatched_lengths() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![Complex::new(1.0, 0.0); 3];
        let mut scratch = vec![Complex::zero(); 2];
        assert_eq!(
            fft2d_inplace(&mut data, 2, 2, &fft, &mut scratch),
            Err(FftError::MismatchedLengths)
        );
    }

    #[test]
    fn test_fft3d_mismatched_lengths() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![Complex::new(1.0, 0.0); 7];
        let mut tube = vec![Complex::zero(); 2];
        let mut row = vec![Complex::zero(); 2];
        let mut col = vec![Complex::zero(); 2];
        let mut scratch = Fft3dScratch {
            tube: &mut tube,
            row: &mut row,
            col: &mut col,
        };
        assert_eq!(
            fft3d_inplace(&mut data, 2, 2, 2, &fft, &mut scratch),
            Err(FftError::MismatchedLengths)
        );
    }
}
