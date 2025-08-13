//! NDFFT usage example for kofft
//! Demonstrates a 2D FFT using `ndfft::fft2d_inplace`.

use kofft::fft::{FftError, ScalarFftImpl};
use kofft::ndfft::fft2d_inplace;
use kofft::Complex32;

fn main() -> Result<(), FftError> {
    let mut data = vec![
        vec![Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0)],
        vec![Complex32::new(3.0, 0.0), Complex32::new(4.0, 0.0)],
    ];
    let fft = ScalarFftImpl::<f32>::default();
    let mut scratch = vec![Complex32::zero(); data.len()];

    fft2d_inplace(&mut data, &fft, &mut scratch)?;
    println!("2D FFT result: {:?}", data);
    Ok(())
}
