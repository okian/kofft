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

const BLOCK_SIZE: usize = 64;

fn transpose_blockwise<T: Float>(
    input: &[Complex<T>],
    output: &mut [Complex<T>],
    rows: usize,
    cols: usize,
) {
    let mut r = 0;
    while r < rows {
        let r_end = core::cmp::min(r + BLOCK_SIZE, rows);
        let mut c = 0;
        while c < cols {
            let c_end = core::cmp::min(c + BLOCK_SIZE, cols);
            for i in r..r_end {
                let src = i * cols;
                for j in c..c_end {
                    output[j * rows + i] = input[src + j];
                }
            }
            c += BLOCK_SIZE;
        }
        r += BLOCK_SIZE;
    }
}

/// 2D FFT in-place (row-column algorithm)
/// Perform a 2D FFT in-place using a row-column algorithm.
///
/// `scratch` must have length equal to `rows * cols` and is used as
/// temporary storage for block-wise transposes between the row and column
/// transforms.
pub fn fft2d_inplace<T: Float>(
    data: &mut [Complex<T>],
    rows: usize,
    cols: usize,
    fft: &ScalarFftImpl<T>,
    scratch: &mut [Complex<T>],
) -> Result<(), FftError> {
    if rows * cols != data.len() {
        return Err(FftError::MismatchedLengths);
    }
    if rows == 0 || cols == 0 {
        return Ok(());
    }
    if scratch.len() != data.len() {
        return Err(FftError::MismatchedLengths);
    }
    // FFT on rows
    for r in 0..rows {
        let start = r * cols;
        fft.fft(&mut data[start..start + cols])?;
    }
    // Transpose, FFT on former columns (now rows), transpose back
    transpose_blockwise(data, scratch, rows, cols);
    for c in 0..cols {
        let start = c * rows;
        fft.fft(&mut scratch[start..start + rows])?;
    }
    transpose_blockwise(scratch, data, cols, rows);
    Ok(())
}

/// Scratch buffers for [`fft3d_inplace`].
pub struct Fft3dScratch<'a, T: Float> {
    /// Scratch buffer of length `rows * cols` for plane transposes
    pub plane: &'a mut [Complex<T>],
    /// Scratch buffer of length `depth * rows * cols` for volume transposes
    pub volume: &'a mut [Complex<T>],
}

/// 3D FFT in-place (row-column-depth algorithm)
/// Perform a 3D FFT in-place using a row-column-depth algorithm.
///
/// `scratch.plane` must have length `rows * cols` and `scratch.volume` must have
/// length `depth * rows * cols`. These are used for block-wise transposes to
/// ensure FFTs operate on contiguous data.
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
    if scratch.plane.len() != rows * cols || scratch.volume.len() != depth * rows * cols {
        return Err(FftError::MismatchedLengths);
    }
    // FFT on columns (x axis)
    for d in 0..depth {
        for r in 0..rows {
            let start = (d * rows + r) * cols;
            fft.fft(&mut data[start..start + cols])?;
        }
    }
    // FFT on rows (y axis) via per-plane transpose
    for d in 0..depth {
        let plane_start = d * rows * cols;
        let plane = &mut data[plane_start..plane_start + rows * cols];
        transpose_blockwise(plane, scratch.plane, rows, cols);
        for c in 0..cols {
            let start = c * rows;
            fft.fft(&mut scratch.plane[start..start + rows])?;
        }
        transpose_blockwise(scratch.plane, plane, cols, rows);
    }
    // FFT on depth (z axis) via full-volume transpose
    transpose_blockwise(data, scratch.volume, depth, rows * cols);
    for rc in 0..rows * cols {
        let start = rc * depth;
        fft.fft(&mut scratch.volume[start..start + depth])?;
    }
    transpose_blockwise(scratch.volume, data, rows * cols, depth);
    Ok(())
}

// TODO: 3D FFT, real input, streaming, property-based tests

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    use crate::fft::{Complex, FftError, ScalarFftImpl};

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
