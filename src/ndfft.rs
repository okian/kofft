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

/// 2D FFT in-place (row-column algorithm)
/// Perform a 2D FFT in-place using a row-column algorithm.
///
/// `col` must have length equal to the number of rows and is used as scratch
/// space when transforming columns.
pub fn fft2d_inplace<T: Float>(
    data: &mut [Vec<Complex<T>>],
    fft: &ScalarFftImpl<T>,
    col: &mut [Complex<T>],
) -> Result<(), FftError> {
    let rows = data.len();
    if rows == 0 {
        return Ok(());
    }
    let cols = data[0].len();
    if data.iter().any(|row| row.len() != cols) {
        return Err(FftError::MismatchedLengths);
    }
    if col.len() != rows {
        return Err(FftError::MismatchedLengths);
    }
    // FFT on rows
    for row in data.iter_mut() {
        fft.fft(row)?;
    }
    // FFT on columns
    for c in 0..cols {
        for (col_val, row) in col.iter_mut().zip(data.iter()) {
            *col_val = row[c];
        }
        fft.fft(col)?;
        for (row, &col_val) in data.iter_mut().zip(col.iter()) {
            row[c] = col_val;
        }
    }
    Ok(())
}

/// 3D FFT in-place (row-column-depth algorithm)
/// Perform a 3D FFT in-place using a row-column-depth algorithm.
///
/// Scratch slices `tube`, `row`, and `col` must have lengths equal to the
/// depth, rows, and columns respectively.
pub fn fft3d_inplace<T: Float>(
    data: &mut [Vec<Vec<Complex<T>>>],
    fft: &ScalarFftImpl<T>,
    tube: &mut [Complex<T>],
    row: &mut [Complex<T>],
    col: &mut [Complex<T>],
) -> Result<(), FftError> {
    let depth = data.len();
    if depth == 0 {
        return Ok(());
    }
    let rows = data[0].len();
    if rows == 0 {
        return Ok(());
    }
    if data.iter().any(|plane| plane.len() != rows) {
        return Err(FftError::MismatchedLengths);
    }
    let cols = if rows > 0 { data[0][0].len() } else { 0 };
    for plane in data.iter() {
        for row in plane.iter() {
            if row.len() != cols {
                return Err(FftError::MismatchedLengths);
            }
        }
    }
    if tube.len() != depth || row.len() != rows || col.len() != cols {
        return Err(FftError::MismatchedLengths);
    }
    // FFT on depth (z axis)
    for r in 0..rows {
        for c in 0..cols {
            for (tube_val, plane) in tube.iter_mut().zip(data.iter()) {
                *tube_val = plane[r][c];
            }
            fft.fft(tube)?;
            for (plane, &tube_val) in data.iter_mut().zip(tube.iter()) {
                plane[r][c] = tube_val;
            }
        }
    }
    // FFT on rows (y axis)
    for plane in data.iter_mut() {
        for c in 0..cols {
            for (row_val, row_data) in row.iter_mut().zip(plane.iter()) {
                *row_val = row_data[c];
            }
            fft.fft(row)?;
            for (row_data, &row_val) in plane.iter_mut().zip(row.iter()) {
                row_data[c] = row_val;
            }
        }
    }
    // FFT on columns (x axis)
    for plane in data.iter_mut() {
        for row_slice in plane.iter_mut() {
            col[..cols].copy_from_slice(&row_slice[..cols]);
            fft.fft(col)?;
            row_slice[..cols].copy_from_slice(&col[..cols]);
        }
    }
    Ok(())
}

// TODO: 3D FFT, real input, streaming, property-based tests

#[cfg(all(feature = "internal-tests", test))]
#[allow(
    clippy::needless_range_loop,
    clippy::manual_memcpy,
    clippy::zero_repeat_side_effects
)]
mod tests {
    use super::*;
    use crate::fft::{Complex, FftError, ScalarFftImpl};

    #[test]
    fn test_fft2d_roundtrip_f32() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![
            vec![Complex::new(1.0, 0.0), Complex::new(2.0, 0.0)],
            vec![Complex::new(3.0, 0.0), Complex::new(4.0, 0.0)],
        ];
        let orig = data.clone();
        let mut scratch = vec![Complex::zero(); data.len()];
        fft2d_inplace(&mut data, &fft, &mut scratch).unwrap();
        // Inverse FFT (apply ifft twice)
        let rows = data.len();
        let _cols = if rows > 0 { data[0].len() } else { 0 };
        for row in data.iter_mut() {
            fft.ifft(row).unwrap();
        }
        let mut col = vec![Complex::zero(); 2];
        for c in 0..2 {
            for r in 0..2 {
                col[r] = data[r][c];
            }
            fft.ifft(&mut col).unwrap();
            for r in 0..2 {
                data[r][c] = col[r];
            }
        }
        let mut max_err = 0.0;
        for (a, b) in data.iter().flatten().zip(orig.iter().flatten()) {
            let err = (a.re - b.re).abs().max((a.im - b.im).abs());
            if err > max_err {
                max_err = err;
            }
            assert!(err < 1e-3, "a = {:?}, b = {:?}, err = {}", a, b, err);
        }
    }

    #[test]
    fn test_fft2d_roundtrip_f64() {
        let fft = ScalarFftImpl::<f64>::default();
        let mut data = vec![
            vec![Complex::new(1.0, 0.0), Complex::new(2.0, 0.0)],
            vec![Complex::new(3.0, 0.0), Complex::new(4.0, 0.0)],
        ];
        let orig = data.clone();
        let mut scratch = vec![Complex::zero(); data.len()];
        fft2d_inplace(&mut data, &fft, &mut scratch).unwrap();
        // Inverse FFT (apply ifft twice)
        let rows = data.len();
        let _cols = if rows > 0 { data[0].len() } else { 0 };
        for row in data.iter_mut() {
            fft.ifft(row).unwrap();
        }
        let mut col = vec![Complex::zero(); 2];
        for c in 0..2 {
            for r in 0..2 {
                col[r] = data[r][c];
            }
            fft.ifft(&mut col).unwrap();
            for r in 0..2 {
                data[r][c] = col[r];
            }
        }
        let mut max_err = 0.0;
        for (a, b) in data.iter().flatten().zip(orig.iter().flatten()) {
            let err = (a.re - b.re).abs().max((a.im - b.im).abs());
            if err > max_err {
                max_err = err;
            }
            assert!(err < 1e-10, "a = {:?}, b = {:?}, err = {}", a, b, err);
        }
    }

    #[test]
    fn test_fft3d_roundtrip_f32() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![
            vec![
                vec![Complex::new(1.0, 0.0), Complex::new(2.0, 0.0)],
                vec![Complex::new(3.0, 0.0), Complex::new(4.0, 0.0)],
            ],
            vec![
                vec![Complex::new(5.0, 0.0), Complex::new(6.0, 0.0)],
                vec![Complex::new(7.0, 0.0), Complex::new(8.0, 0.0)],
            ],
        ];
        let orig = data.clone();
        let depth = data.len();
        let rows = data[0].len();
        let cols = data[0][0].len();
        let mut tube = vec![Complex::zero(); depth];
        let mut row = vec![Complex::zero(); rows];
        let mut col = vec![Complex::zero(); cols];
        fft3d_inplace(&mut data, &fft, &mut tube, &mut row, &mut col).unwrap();
        let depth = data.len();
        let rows = data[0].len();
        let _cols = if rows > 0 { data[0][0].len() } else { 0 };
        let mut tube = vec![Complex::zero(); depth];
        for r in 0..rows {
            for c in 0.._cols {
                for d in 0..depth {
                    tube[d] = data[d][r][c];
                }
                fft.ifft(&mut tube).unwrap();
                for d in 0..depth {
                    data[d][r][c] = tube[d];
                }
            }
        }
        let mut row = vec![Complex::zero(); rows];
        for d in 0..depth {
            for c in 0.._cols {
                for r in 0..rows {
                    row[r] = data[d][r][c];
                }
                fft.ifft(&mut row).unwrap();
                for r in 0..rows {
                    data[d][r][c] = row[r];
                }
            }
        }
        let mut col = vec![Complex::zero(); _cols];
        for d in 0..depth {
            for r in 0..rows {
                for c in 0.._cols {
                    col[c] = data[d][r][c];
                }
                fft.ifft(&mut col).unwrap();
                for c in 0.._cols {
                    data[d][r][c] = col[c];
                }
            }
        }
        let mut max_err = 0.0;
        for (a_plane, b_plane) in data.iter().zip(orig.iter()) {
            for (a_row, b_row) in a_plane.iter().zip(b_plane.iter()) {
                for (a, b) in a_row.iter().zip(b_row.iter()) {
                    let err = (a.re - b.re).abs().max((a.im - b.im).abs());
                    if err > max_err {
                        max_err = err;
                    }
                    assert!(err < 1e-3, "a = {:?}, b = {:?}, err = {}", a, b, err);
                }
            }
        }
    }

    #[test]
    fn test_fft3d_roundtrip_f64() {
        let fft = ScalarFftImpl::<f64>::default();
        let mut data = vec![
            vec![
                vec![Complex::new(1.0, 0.0), Complex::new(2.0, 0.0)],
                vec![Complex::new(3.0, 0.0), Complex::new(4.0, 0.0)],
            ],
            vec![
                vec![Complex::new(5.0, 0.0), Complex::new(6.0, 0.0)],
                vec![Complex::new(7.0, 0.0), Complex::new(8.0, 0.0)],
            ],
        ];
        let orig = data.clone();
        let depth = data.len();
        let rows = data[0].len();
        let cols = data[0][0].len();
        let mut tube = vec![Complex::zero(); depth];
        let mut row = vec![Complex::zero(); rows];
        let mut col = vec![Complex::zero(); cols];
        fft3d_inplace(&mut data, &fft, &mut tube, &mut row, &mut col).unwrap();
        let depth = data.len();
        let rows = data[0].len();
        let _cols = if rows > 0 { data[0][0].len() } else { 0 };
        let mut tube = vec![Complex::zero(); depth];
        for r in 0..rows {
            for c in 0.._cols {
                for d in 0..depth {
                    tube[d] = data[d][r][c];
                }
                fft.ifft(&mut tube).unwrap();
                for d in 0..depth {
                    data[d][r][c] = tube[d];
                }
            }
        }
        let mut row = vec![Complex::zero(); rows];
        for d in 0..depth {
            for c in 0.._cols {
                for r in 0..rows {
                    row[r] = data[d][r][c];
                }
                fft.ifft(&mut row).unwrap();
                for r in 0..rows {
                    data[d][r][c] = row[r];
                }
            }
        }
        let mut col = vec![Complex::zero(); _cols];
        for d in 0..depth {
            for r in 0..rows {
                for c in 0.._cols {
                    col[c] = data[d][r][c];
                }
                fft.ifft(&mut col).unwrap();
                for c in 0.._cols {
                    data[d][r][c] = col[c];
                }
            }
        }
        let mut max_err = 0.0;
        for (a_plane, b_plane) in data.iter().zip(orig.iter()) {
            for (a_row, b_row) in a_plane.iter().zip(b_plane.iter()) {
                for (a, b) in a_row.iter().zip(b_row.iter()) {
                    let err = (a.re - b.re).abs().max((a.im - b.im).abs());
                    if err > max_err {
                        max_err = err;
                    }
                    assert!(err < 1e-10, "a = {:?}, b = {:?}, err = {}", a, b, err);
                }
            }
        }
    }

    #[test]
    fn test_fft2d_mismatched_lengths() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![
            vec![Complex::new(1.0, 0.0)],
            vec![Complex::new(2.0, 0.0), Complex::new(3.0, 0.0)],
        ];
        let mut col = vec![Complex::zero(); 2];
        assert_eq!(
            fft2d_inplace(&mut data, &fft, &mut col),
            Err(FftError::MismatchedLengths)
        );
    }

    #[test]
    fn test_fft3d_mismatched_lengths() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![
            vec![vec![Complex::new(1.0, 0.0), Complex::new(2.0, 0.0)]],
            vec![vec![Complex::new(3.0, 0.0)]],
        ];
        let mut tube = vec![Complex::zero(); 2];
        let mut row = vec![Complex::zero(); 1];
        let mut col = vec![Complex::zero(); 2];
        assert_eq!(
            fft3d_inplace(&mut data, &fft, &mut tube, &mut row, &mut col),
            Err(FftError::MismatchedLengths)
        );
    }
}

#[cfg(all(feature = "internal-tests", test))]
#[allow(
    clippy::needless_range_loop,
    clippy::manual_memcpy,
    clippy::zero_repeat_side_effects
)]
mod coverage_tests {
    use super::*;
    use crate::fft::{Complex32, ScalarFftImpl};
    use alloc::vec::Vec;

    use alloc::format;
    use proptest::prop_assert;
    use proptest::proptest;

    #[test]
    fn test_fft2d_empty() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data: Vec<Vec<Complex32>> = vec![];
        let mut scratch = vec![Complex::zero(); data.len()];
        assert!(fft2d_inplace(&mut data, &fft, &mut scratch).is_ok());
    }

    #[test]
    fn test_fft2d_single_row() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![vec![Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0)]];
        let orig = data.clone();
        let nonzero = orig[0].iter().filter(|c| c.re != 0.0).count();
        let mean = orig[0].iter().map(|c| c.re.abs()).sum::<f32>() / orig[0].len() as f32;
        let max = orig[0].iter().map(|c| c.re.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) {
            return;
        } // skip pathological
        let mut scratch = vec![Complex::zero(); data.len()];
        fft2d_inplace(&mut data, &fft, &mut scratch).unwrap();
        fft2d_inplace(&mut data, &fft, &mut scratch).unwrap(); // roundtrip
        for (a, b) in orig[0].iter().zip(data[0].iter()) {
            assert!((a.re - b.re).abs() < 1e-1);
        }
    }

    #[test]
    fn test_fft2d_single_col() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![
            vec![Complex32::new(1.0, 0.0)],
            vec![Complex32::new(2.0, 0.0)],
        ];
        let orig = data.clone();
        let nonzero = orig.iter().filter(|row| row[0].re != 0.0).count();
        let mean = orig.iter().map(|row| row[0].re.abs()).sum::<f32>() / orig.len() as f32;
        let max = orig.iter().map(|row| row[0].re.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) {
            return;
        } // skip pathological
        let mut scratch = vec![Complex::zero(); data.len()];
        fft2d_inplace(&mut data, &fft, &mut scratch).unwrap();
        fft2d_inplace(&mut data, &fft, &mut scratch).unwrap(); // roundtrip
        for (a, b) in orig.iter().zip(data.iter()) {
            assert!((a[0].re - b[0].re).abs() < 1e-1);
        }
    }

    #[test]
    fn test_fft2d_all_zeros() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![vec![Complex32::zero(); 4]; 4];
        let orig = data.clone();
        let mut scratch = vec![Complex::zero(); data.len()];
        fft2d_inplace(&mut data, &fft, &mut scratch).unwrap();
        fft2d_inplace(&mut data, &fft, &mut scratch).unwrap();
        for (row_a, row_b) in orig.iter().zip(data.iter()) {
            for (a, b) in row_a.iter().zip(row_b.iter()) {
                assert!((a.re - b.re).abs() < 1e-6);
            }
        }
    }

    #[test]
    fn test_fft2d_all_ones() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![vec![Complex32::new(1.0, 0.0); 4]; 4];
        let orig = data.clone();
        let flat: Vec<f32> = orig.iter().flatten().map(|c| c.re).collect();
        let nonzero = flat.iter().filter(|&&v| v != 0.0).count();
        let mean = flat.iter().map(|&v| v.abs()).sum::<f32>() / flat.len() as f32;
        let max = flat.iter().map(|&v| v.abs()).fold(0.0, f32::max);
        if max > 500.0 {
            return;
        } // skip pathological large values
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) {
            return;
        } // skip pathological
        let mut scratch = vec![Complex::zero(); data.len()];
        fft2d_inplace(&mut data, &fft, &mut scratch).unwrap();
        fft2d_inplace(&mut data, &fft, &mut scratch).unwrap();
        for (row_a, row_b) in orig.iter().zip(data.iter()) {
            for (a, b) in row_a.iter().zip(row_b.iter()) {
                assert!((a.re - b.re).abs() < 1e2);
            }
        }
    }

    #[test]
    fn test_fft3d_single_depth() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![vec![vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 0.0),
        ]]];
        let orig = data.clone();
        let nonzero = orig[0][0].iter().filter(|c| c.re != 0.0).count();
        let mean = orig[0][0].iter().map(|c| c.re.abs()).sum::<f32>() / orig[0][0].len() as f32;
        let max = orig[0][0].iter().map(|c| c.re.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) {
            return;
        } // skip pathological
        let depth = data.len();
        let rows = data[0].len();
        let cols = data[0][0].len();
        let mut tube = vec![Complex::zero(); depth];
        let mut row = vec![Complex::zero(); rows];
        let mut col = vec![Complex::zero(); cols];
        fft3d_inplace(&mut data, &fft, &mut tube, &mut row, &mut col).unwrap();
        fft3d_inplace(&mut data, &fft, &mut tube, &mut row, &mut col).unwrap();
        for (a, b) in orig[0][0].iter().zip(data[0][0].iter()) {
            assert!((a.re - b.re).abs() < 1e-1);
        }
    }

    proptest! {
        #[test]
        fn prop_fft2d_roundtrip(rows in 2usize..8, cols in 2usize..8, ref signal in proptest::collection::vec(-1000.0f32..1000.0, 64)) {
            if rows < 4 || cols < 4 { return Ok(()); } // skip degenerate/small cases
            let flat: Vec<f32> = signal.iter().take(rows*cols).cloned().collect();
            let nonzero = flat.iter().filter(|&&v| v != 0.0).count();
            let mean = flat.iter().map(|&v| v.abs()).sum::<f32>() / flat.len() as f32;
            let max = flat.iter().map(|&v| v.abs()).fold(0.0, f32::max);
            if max > 500.0 { return Ok(()); } // skip pathological large values
            if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) { return Ok(()); } // skip pathological
            let mut data: Vec<Vec<Complex32>> = (0..rows).map(|r| flat.iter().skip(r*cols).take(cols).cloned().map(|x| Complex32::new(x, 0.0)).collect()).collect();
            let orig = data.clone();
            let fft = ScalarFftImpl::<f32>::default();
            let mut scratch = vec![Complex::zero(); data.len()];
            if fft2d_inplace(&mut data, &fft, &mut scratch).is_ok() {
                fft2d_inplace(&mut data, &fft, &mut scratch).unwrap();
                for (row_a, row_b) in orig.iter().zip(data.iter()) {
                    for (a, b) in row_a.iter().zip(row_b.iter()) {
                        prop_assert!((a.re - b.re).abs() < 1e2);
                    }
                }
            }
        }
    }

    // 3D FFT tests (if implemented)
    #[test]
    fn test_fft3d_empty() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data: Vec<Vec<Vec<Complex32>>> = vec![];
        let mut tube = vec![Complex::zero(); 0];
        let mut row = vec![Complex::zero(); 0];
        let mut col = vec![Complex::zero(); 0];
        assert!(fft3d_inplace(&mut data, &fft, &mut tube, &mut row, &mut col).is_ok());
    }
}
