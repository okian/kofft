//! STFT usage example for kofft
//! Demonstrates forward and inverse STFT.
//! Run with `cargo run --example stft_usage`.
//!
//! When built with `--features parallel`, also showcases the parallel STFT helper.

use kofft::fft::{FftError, FftImpl, FftStrategy, ScalarFftImpl};
#[cfg(feature = "parallel")]
use kofft::stft::parallel;
use kofft::stft::{istft, stft};
use kofft::window::hann;
use std::sync::Mutex;

/// Thread-safe wrapper enabling shared access to [`ScalarFftImpl`].
struct SyncFft(Mutex<ScalarFftImpl<f32>>);

impl Default for SyncFft {
    fn default() -> Self {
        Self(Mutex::new(ScalarFftImpl::<f32>::default()))
    }
}

impl FftImpl<f32> for SyncFft {
    fn fft(&self, input: &mut [kofft::Complex32]) -> Result<(), FftError> {
        self.0.lock().unwrap().fft(input)
    }
    fn ifft(&self, input: &mut [kofft::Complex32]) -> Result<(), FftError> {
        self.0.lock().unwrap().ifft(input)
    }
    fn fft_strided(
        &self,
        input: &mut [kofft::Complex32],
        stride: usize,
        scratch: &mut [kofft::Complex32],
    ) -> Result<(), FftError> {
        self.0.lock().unwrap().fft_strided(input, stride, scratch)
    }
    fn ifft_strided(
        &self,
        input: &mut [kofft::Complex32],
        stride: usize,
        scratch: &mut [kofft::Complex32],
    ) -> Result<(), FftError> {
        self.0.lock().unwrap().ifft_strided(input, stride, scratch)
    }
    fn fft_out_of_place_strided(
        &self,
        input: &[kofft::Complex32],
        in_stride: usize,
        output: &mut [kofft::Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        self.0
            .lock()
            .unwrap()
            .fft_out_of_place_strided(input, in_stride, output, out_stride)
    }
    fn ifft_out_of_place_strided(
        &self,
        input: &[kofft::Complex32],
        in_stride: usize,
        output: &mut [kofft::Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        self.0
            .lock()
            .unwrap()
            .ifft_out_of_place_strided(input, in_stride, output, out_stride)
    }
    fn fft_with_strategy(
        &self,
        input: &mut [kofft::Complex32],
        strategy: FftStrategy,
    ) -> Result<(), FftError> {
        self.0.lock().unwrap().fft_with_strategy(input, strategy)
    }
}

fn main() -> Result<(), FftError> {
    let signal = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let window = hann(4);
    let hop = 2;

    let fft = SyncFft::default();
    let mut frames = vec![vec![]; signal.len().div_ceil(hop)];
    stft(&signal, &window, hop, &mut frames, &fft)?;
    println!("STFT frames: {:?}", frames);

    #[cfg(feature = "parallel")]
    {
        let mut frames_par = vec![vec![]; signal.len().div_ceil(hop)];
        parallel(&signal, &window, hop, &mut frames_par, &fft)?;
        println!("Parallel STFT frames: {:?}", frames_par);
    }

    let mut reconstructed = vec![0.0; signal.len()];
    let mut scratch = vec![0.0; reconstructed.len()];
    istft(
        &mut frames,
        &window,
        hop,
        &mut reconstructed,
        &mut scratch,
        &fft,
    )?;
    println!("Reconstructed signal: {:?}", reconstructed);
    Ok(())
}
