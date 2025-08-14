//! STFT usage example for kofft
//! Demonstrates forward and inverse STFT.
//! Run with `cargo run --example stft_usage`.
//!
//! When built with `--features parallel`, also showcases the parallel STFT helper.

use kofft::fft::FftError;
#[cfg(feature = "parallel")]
use kofft::stft::parallel;
use kofft::stft::{istft, stft};
use kofft::window::hann;

fn main() -> Result<(), FftError> {
    let signal = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let window = hann(4);
    let hop = 2;

    let mut frames = vec![vec![]; signal.len().div_ceil(hop)];
    stft(&signal, &window, hop, &mut frames)?;
    println!("STFT frames: {:?}", frames);

    #[cfg(feature = "parallel")]
    {
        let mut frames_par = vec![vec![]; signal.len().div_ceil(hop)];
        parallel(&signal, &window, hop, &mut frames_par)?;
        println!("Parallel STFT frames: {:?}", frames_par);
    }

    let mut reconstructed = vec![0.0; signal.len()];
    istft(&frames, &window, hop, &mut reconstructed)?;
    println!("Reconstructed signal: {:?}", reconstructed);
    Ok(())
}
