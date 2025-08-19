use kofft::fft::{Complex, FftImpl, ScalarFftImpl};
use kofft::ndfft::{fft2d_inplace, fft3d_inplace, Fft3dScratch};

#[test]
fn fft2d_roundtrip() {
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
    // inverse 2D FFT
    for r in 0..rows {
        fft.ifft(&mut data[r * cols..(r + 1) * cols]).unwrap();
    }
    let mut col = vec![Complex::zero(); rows];
    for c in 0..cols {
        fft.ifft_strided(&mut data[c..], cols, &mut col).unwrap();
    }
    for (a, b) in data.iter().zip(orig.iter()) {
        let err = (a.re - b.re).abs().max((a.im - b.im).abs());
        assert!(err < 1e-3, "err={}", err);
    }
}

#[test]
fn fft3d_roundtrip() {
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
    // inverse 3D FFT
    for r in 0..rows {
        for c in 0..cols {
            let start = r * cols + c;
            fft.ifft_strided(&mut data[start..], rows * cols, &mut tube)
                .unwrap();
        }
    }
    for d in 0..depth {
        for c in 0..cols {
            let start = d * rows * cols + c;
            fft.ifft_strided(&mut data[start..], cols, &mut row)
                .unwrap();
        }
    }
    for d in 0..depth {
        for r in 0..rows {
            let start = d * rows * cols + r * cols;
            fft.ifft(&mut data[start..start + cols]).unwrap();
        }
    }
    for (a, b) in data.iter().zip(orig.iter()) {
        let err = (a.re - b.re).abs().max((a.im - b.im).abs());
        assert!(err < 1e-3, "err={}", err);
    }
}
