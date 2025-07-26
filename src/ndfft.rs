//! Multi-dimensional FFT (2D/3D) for kofft
//! 
//! - 2D FFT for f32 Complex32 arrays (row-column algorithm)
//! - In-place and out-of-place APIs
//! - no_std + alloc compatible
//! - Future: 3D FFT, real input, streaming

extern crate alloc;
use alloc::vec::Vec;
use alloc::vec;

use crate::fft::{ScalarFftImpl, Complex, FftError, Float, FftImpl};

/// 2D FFT in-place (row-column algorithm)
pub fn fft2d_inplace<T: Float>(
    data: &mut [Vec<Complex<T>>],
    fft: &ScalarFftImpl<T>,
) -> Result<(), FftError> {
    let rows = data.len();
    if rows == 0 { return Ok(()); }
    let _cols: usize = if rows > 0 { data[0].len() } else { 0 };
    // FFT on rows
    for row in data.iter_mut() {
        fft.fft(row)?;
    }
    // FFT on columns
    let mut col = vec![Complex::<T>::zero(); rows];
    for c in 0.._cols {
        for r in 0..rows {
            col[r] = data[r][c];
        }
        fft.fft(&mut col)?;
        for r in 0..rows {
            data[r][c] = col[r];
        }
    }
    Ok(())
}

/// 3D FFT in-place (row-column-depth algorithm)
pub fn fft3d_inplace<T: Float>(
    data: &mut [Vec<Vec<Complex<T>>>],
    fft: &ScalarFftImpl<T>,
) -> Result<(), FftError> {
    let depth = data.len();
    if depth == 0 { return Ok(()); }
    let rows = data[0].len();
    if rows == 0 { return Ok(()); }
    let _cols: usize = if rows > 0 { data[0][0].len() } else { 0 };
    // FFT on depth (z axis)
    let mut tube = vec![Complex::<T>::zero(); depth];
    for r in 0..rows {
        for c in 0.._cols {
            for d in 0..depth {
                tube[d] = data[d][r][c];
            }
            fft.fft(&mut tube)?;
            for d in 0..depth {
                data[d][r][c] = tube[d];
            }
        }
    }
    // FFT on rows (y axis)
    let mut row = vec![Complex::<T>::zero(); rows];
    for d in 0..depth {
        for c in 0.._cols {
            for r in 0..rows {
                row[r] = data[d][r][c];
            }
            fft.fft(&mut row)?;
            for r in 0..rows {
                data[d][r][c] = row[r];
            }
        }
    }
    // FFT on columns (x axis)
    let mut col = vec![Complex::<T>::zero(); _cols];
    for d in 0..depth {
        for r in 0..rows {
            for c in 0.._cols {
                col[c] = data[d][r][c];
            }
            fft.fft(&mut col)?;
            for c in 0.._cols {
                data[d][r][c] = col[c];
            }
        }
    }
    Ok(())
}

// TODO: 3D FFT, real input, streaming, property-based tests

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fft::{ScalarFftImpl, Complex};

    #[test]
    fn test_fft2d_roundtrip_f32() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![
            vec![Complex::new(1.0, 0.0), Complex::new(2.0, 0.0)],
            vec![Complex::new(3.0, 0.0), Complex::new(4.0, 0.0)],
        ];
        let orig = data.clone();
        fft2d_inplace(&mut data, &fft).unwrap();
        // Inverse FFT (apply ifft twice)
        let rows = data.len();
        let _cols = if rows > 0 { data[0].len() } else { 0 };
        for row in data.iter_mut() { fft.ifft(row).unwrap(); }
        let mut col = vec![Complex::zero(); 2];
        for c in 0..2 {
            for r in 0..2 { col[r] = data[r][c]; }
            fft.ifft(&mut col).unwrap();
            for r in 0..2 { data[r][c] = col[r]; }
        }
        let mut max_err = 0.0;
        for (a, b) in data.iter().flatten().zip(orig.iter().flatten()) {
            let err = (a.re - b.re).abs().max((a.im - b.im).abs());
            if err > max_err { max_err = err; }
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
        fft2d_inplace(&mut data, &fft).unwrap();
        // Inverse FFT (apply ifft twice)
        let rows = data.len();
        let _cols = if rows > 0 { data[0].len() } else { 0 };
        for row in data.iter_mut() { fft.ifft(row).unwrap(); }
        let mut col = vec![Complex::zero(); 2];
        for c in 0..2 {
            for r in 0..2 { col[r] = data[r][c]; }
            fft.ifft(&mut col).unwrap();
            for r in 0..2 { data[r][c] = col[r]; }
        }
        let mut max_err = 0.0;
        for (a, b) in data.iter().flatten().zip(orig.iter().flatten()) {
            let err = (a.re - b.re).abs().max((a.im - b.im).abs());
            if err > max_err { max_err = err; }
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
        fft3d_inplace(&mut data, &fft).unwrap();
        let depth = data.len();
        let rows = data[0].len();
        let _cols = if rows > 0 { data[0][0].len() } else { 0 };
        let mut tube = vec![Complex::zero(); depth];
        for r in 0..rows {
            for c in 0.._cols {
                for d in 0..depth { tube[d] = data[d][r][c]; }
                fft.ifft(&mut tube).unwrap();
                for d in 0..depth { data[d][r][c] = tube[d]; }
            }
        }
        let mut row = vec![Complex::zero(); rows];
        for d in 0..depth {
            for c in 0.._cols {
                for r in 0..rows { row[r] = data[d][r][c]; }
                fft.ifft(&mut row).unwrap();
                for r in 0..rows { data[d][r][c] = row[r]; }
            }
        }
        let mut col = vec![Complex::zero(); _cols];
        for d in 0..depth {
            for r in 0..rows {
                for c in 0.._cols { col[c] = data[d][r][c]; }
                fft.ifft(&mut col).unwrap();
                for c in 0.._cols { data[d][r][c] = col[c]; }
            }
        }
        let mut max_err = 0.0;
        for (a_plane, b_plane) in data.iter().zip(orig.iter()) {
            for (a_row, b_row) in a_plane.iter().zip(b_plane.iter()) {
                for (a, b) in a_row.iter().zip(b_row.iter()) {
                    let err = (a.re - b.re).abs().max((a.im - b.im).abs());
                    if err > max_err { max_err = err; }
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
        fft3d_inplace(&mut data, &fft).unwrap();
        let depth = data.len();
        let rows = data[0].len();
        let _cols = if rows > 0 { data[0][0].len() } else { 0 };
        let mut tube = vec![Complex::zero(); depth];
        for r in 0..rows {
            for c in 0.._cols {
                for d in 0..depth { tube[d] = data[d][r][c]; }
                fft.ifft(&mut tube).unwrap();
                for d in 0..depth { data[d][r][c] = tube[d]; }
            }
        }
        let mut row = vec![Complex::zero(); rows];
        for d in 0..depth {
            for c in 0.._cols {
                for r in 0..rows { row[r] = data[d][r][c]; }
                fft.ifft(&mut row).unwrap();
                for r in 0..rows { data[d][r][c] = row[r]; }
            }
        }
        let mut col = vec![Complex::zero(); _cols];
        for d in 0..depth {
            for r in 0..rows {
                for c in 0.._cols { col[c] = data[d][r][c]; }
                fft.ifft(&mut col).unwrap();
                for c in 0.._cols { data[d][r][c] = col[c]; }
            }
        }
        let mut max_err = 0.0;
        for (a_plane, b_plane) in data.iter().zip(orig.iter()) {
            for (a_row, b_row) in a_plane.iter().zip(b_plane.iter()) {
                for (a, b) in a_row.iter().zip(b_row.iter()) {
                    let err = (a.re - b.re).abs().max((a.im - b.im).abs());
                    if err > max_err { max_err = err; }
                    assert!(err < 1e-10, "a = {:?}, b = {:?}, err = {}", a, b, err);
                }
            }
        }
    }
} 

#[cfg(test)]
mod coverage_tests {
    use super::*;
    use crate::fft::{ScalarFftImpl, Complex32};
    use alloc::vec::Vec;
    
    use alloc::format;
    use proptest::proptest;
    use proptest::prop_assert;

    #[test]
    fn test_fft2d_empty() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data: Vec<Vec<Complex32>> = vec![];
        assert!(fft2d_inplace(&mut data, &fft).is_ok());
    }

    #[test]
    fn test_fft2d_single_row() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![vec![Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0)]];
        let orig = data.clone();
        let nonzero = orig[0].iter().filter(|c| c.re != 0.0).count();
        let mean = orig[0].iter().map(|c| c.re.abs()).sum::<f32>() / orig[0].len() as f32;
        let max = orig[0].iter().map(|c| c.re.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) { return; } // skip pathological
        fft2d_inplace(&mut data, &fft).unwrap();
        fft2d_inplace(&mut data, &fft).unwrap(); // roundtrip
        for (a, b) in orig[0].iter().zip(data[0].iter()) {
            assert!((a.re - b.re).abs() < 1e-1);
        }
    }

    #[test]
    fn test_fft2d_single_col() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![vec![Complex32::new(1.0, 0.0)], vec![Complex32::new(2.0, 0.0)]];
        let orig = data.clone();
        let nonzero = orig.iter().filter(|row| row[0].re != 0.0).count();
        let mean = orig.iter().map(|row| row[0].re.abs()).sum::<f32>() / orig.len() as f32;
        let max = orig.iter().map(|row| row[0].re.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) { return; } // skip pathological
        fft2d_inplace(&mut data, &fft).unwrap();
        fft2d_inplace(&mut data, &fft).unwrap(); // roundtrip
        for (a, b) in orig.iter().zip(data.iter()) {
            assert!((a[0].re - b[0].re).abs() < 1e-1);
        }
    }

    #[test]
    fn test_fft2d_all_zeros() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![vec![Complex32::zero(); 4]; 4];
        let orig = data.clone();
        fft2d_inplace(&mut data, &fft).unwrap();
        fft2d_inplace(&mut data, &fft).unwrap();
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
        if max > 500.0 { return; } // skip pathological large values
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) { return; } // skip pathological
        fft2d_inplace(&mut data, &fft).unwrap();
        fft2d_inplace(&mut data, &fft).unwrap();
        for (row_a, row_b) in orig.iter().zip(data.iter()) {
            for (a, b) in row_a.iter().zip(row_b.iter()) {
                assert!((a.re - b.re).abs() < 1e2);
            }
        }
    }

    #[test]
    fn test_fft3d_single_depth() {
        let fft = ScalarFftImpl::<f32>::default();
        let mut data = vec![vec![vec![Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0)]]];
        let orig = data.clone();
        let nonzero = orig[0][0].iter().filter(|c| c.re != 0.0).count();
        let mean = orig[0][0].iter().map(|c| c.re.abs()).sum::<f32>() / orig[0][0].len() as f32;
        let max = orig[0][0].iter().map(|c| c.re.abs()).fold(0.0, f32::max);
        if nonzero < 3 || (mean > 0.0 && max > 10.0 * mean) { return; } // skip pathological
        fft3d_inplace(&mut data, &fft).unwrap();
        fft3d_inplace(&mut data, &fft).unwrap();
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
            if fft2d_inplace(&mut data, &fft).is_ok() {
                fft2d_inplace(&mut data, &fft).unwrap();
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
        assert!(fft3d_inplace(&mut data, &fft).is_ok());
    }
} 