//! NDFFT usage example for kofft
//! Demonstrates a 2D FFT using `ndfft::fft2d_inplace`.

use kofft::fft::{FftError, ScalarFftImpl};
use kofft::ndfft::{fft2d_inplace, flatten_2d};
use kofft::Complex32;

fn main() -> Result<(), FftError> {
    let nested = vec![
        vec![Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0)],
        vec![Complex32::new(3.0, 0.0), Complex32::new(4.0, 0.0)],
    ];
    let (mut data, rows, cols) = flatten_2d(nested)?;
    let fft = ScalarFftImpl::<f32>::default();
    let mut scratch = vec![Complex32::zero(); rows];

    fft2d_inplace(&mut data, rows, cols, &fft, &mut scratch)?;
    println!("2D FFT result: {:?}", data);
    Ok(())
}
