#![cfg(all(feature = "simd", feature = "wasm"))]

use kofft::fft::{Complex32, FftError, ScalarFftImpl};
use kofft::stft::{istft, stft, IstftStream, StftStream};
use kofft::window::hann;

#[cfg(feature = "parallel")]
mod sync_fft {
    use super::*;
    use kofft::fft::{FftImpl, FftStrategy};
    use std::sync::Mutex;

    #[derive(Default)]
    pub struct SyncFft(Mutex<ScalarFftImpl<f32>>);

    impl FftImpl<f32> for SyncFft {
        fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
            self.0.lock().unwrap().fft(input)
        }
        fn ifft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
            self.0.lock().unwrap().ifft(input)
        }
        fn fft_strided(
            &self,
            input: &mut [Complex32],
            stride: usize,
            scratch: &mut [Complex32],
        ) -> Result<(), FftError> {
            self.0.lock().unwrap().fft_strided(input, stride, scratch)
        }
        fn ifft_strided(
            &self,
            input: &mut [Complex32],
            stride: usize,
            scratch: &mut [Complex32],
        ) -> Result<(), FftError> {
            self.0.lock().unwrap().ifft_strided(input, stride, scratch)
        }
        fn fft_out_of_place_strided(
            &self,
            input: &[Complex32],
            in_stride: usize,
            output: &mut [Complex32],
            out_stride: usize,
        ) -> Result<(), FftError> {
            self.0
                .lock()
                .unwrap()
                .fft_out_of_place_strided(input, in_stride, output, out_stride)
        }
        fn ifft_out_of_place_strided(
            &self,
            input: &[Complex32],
            in_stride: usize,
            output: &mut [Complex32],
            out_stride: usize,
        ) -> Result<(), FftError> {
            self.0
                .lock()
                .unwrap()
                .ifft_out_of_place_strided(input, in_stride, output, out_stride)
        }
        fn fft_with_strategy(
            &self,
            input: &mut [Complex32],
            strategy: FftStrategy,
        ) -> Result<(), FftError> {
            self.0.lock().unwrap().fft_with_strategy(input, strategy)
        }
    }
}

/// Ensure hop sizes larger than the window are rejected.
#[test]
fn stft_rejects_large_hop() {
    let signal = [0.0f32; 8];
    let window = hann(4);
    let hop = 8; // larger than window
    let mut frames = vec![vec![Complex32::new(0.0, 0.0); window.len()]; 1];
    let fft = ScalarFftImpl::<f32>::default();
    let res = stft(&signal, &window, hop, &mut frames, &fft);
    assert!(matches!(res, Err(FftError::InvalidHopSize)));
}

/// STFT rejects a zero hop size.
#[test]
fn stft_rejects_zero_hop() {
    let signal = [0.0f32; 4];
    let window = hann(4);
    let hop = 0;
    let mut frames = vec![vec![Complex32::new(0.0, 0.0); window.len()]; 1];
    let fft = ScalarFftImpl::<f32>::default();
    let res = stft(&signal, &window, hop, &mut frames, &fft);
    assert!(matches!(res, Err(FftError::InvalidHopSize)));
}

/// ISTFT validates hop against the window length and output size.
#[test]
fn istft_rejects_large_hop_and_short_output() {
    let window = hann(4);
    let hop = 8; // invalid
    let mut frames = vec![vec![Complex32::new(0.0, 0.0); window.len()]; 1];
    let mut out = vec![0.0f32; 4];
    let mut scratch = vec![0.0f32; 4];
    let fft = ScalarFftImpl::<f32>::default();
    let res = istft(&mut frames, &window, hop, &mut out, &mut scratch, &fft);
    assert!(matches!(res, Err(FftError::InvalidHopSize)));

    // Now test output length mismatch
    let hop = 2;
    let mut out_short = vec![0.0f32; 3];
    let mut scratch_short = vec![0.0f32; 3];
    let res = istft(
        &mut frames,
        &window,
        hop,
        &mut out_short,
        &mut scratch_short,
        &fft,
    );
    assert!(matches!(res, Err(FftError::MismatchedLengths)));
}

/// ISTFT rejects zero hop size.
#[test]
fn istft_rejects_zero_hop() {
    let window = hann(4);
    let hop = 0;
    let mut frames = vec![vec![Complex32::new(0.0, 0.0); window.len()]; 1];
    let mut out = vec![0.0f32; 4];
    let mut scratch = vec![0.0f32; 4];
    let fft = ScalarFftImpl::<f32>::default();
    let res = istft(&mut frames, &window, hop, &mut out, &mut scratch, &fft);
    assert!(matches!(res, Err(FftError::InvalidHopSize)));
}

/// Streaming STFT rejects hop sizes exceeding the window length.
#[test]
fn stft_stream_rejects_large_hop() {
    let signal = [0.0f32; 8];
    let window = hann(4);
    let fft = ScalarFftImpl::<f32>::default();
    let res = StftStream::new(&signal, &window, 8, &fft);
    assert!(matches!(res, Err(FftError::InvalidHopSize)));
}

/// STFT stream errors when the output frame size is incorrect.
#[test]
fn stft_stream_frame_size_mismatch() {
    let signal = [0.0f32; 8];
    let window = hann(4);
    let hop = 2;
    let fft = ScalarFftImpl::<f32>::default();
    let mut stream = StftStream::new(&signal, &window, hop, &fft).unwrap();
    let mut frame = vec![Complex32::new(0.0, 0.0); window.len() - 1];
    let res = stream.next_frame(&mut frame);
    assert!(matches!(res, Err(FftError::MismatchedLengths)));
}

/// Streaming ISTFT checks hop size and window length during construction.
#[test]
fn istft_stream_rejects_large_hop() {
    let window = hann(4);
    let fft = ScalarFftImpl::<f32>::default();
    let res = IstftStream::new(4, 8, &window, &fft);
    assert!(matches!(res, Err(FftError::InvalidHopSize)));
}

/// Flushing twice should yield an empty slice on the second call.
#[test]
fn istft_stream_double_flush_empty() {
    let signal = [1.0, 2.0, 3.0, 4.0];
    let window = hann(4);
    let hop = 2;
    let fft = ScalarFftImpl::<f32>::default();
    let mut stft_stream = StftStream::new(&signal, &window, hop, &fft).unwrap();
    let mut istft_stream = IstftStream::new(window.len(), hop, &window, &fft).unwrap();
    let mut frame = vec![Complex32::new(0.0, 0.0); window.len()];
    while stft_stream.next_frame(&mut frame).unwrap() {
        let _ = istft_stream.push_frame(&mut frame).unwrap();
    }
    let tail = istft_stream.flush();
    assert!(!tail.is_empty());
    assert!(istft_stream.flush().is_empty());
}

#[cfg(feature = "parallel")]
/// Parallel STFT validates hop size similarly to the sequential version.
#[test]
fn parallel_stft_rejects_large_hop() {
    use kofft::stft::parallel;
    let signal = [0.0f32; 8];
    let window = hann(4);
    let hop = 8; // invalid
    let mut frames = vec![vec![Complex32::new(0.0, 0.0); window.len()]; 1];
    let fft = sync_fft::SyncFft::default();
    let res = parallel(&signal, &window, hop, &mut frames, &fft);
    assert!(matches!(res, Err(FftError::InvalidHopSize)));
}

#[cfg(feature = "parallel")]
/// Parallel inverse STFT validates hop size and output length.
#[test]
fn inverse_parallel_rejects_large_hop() {
    use kofft::stft::inverse_parallel;
    let window = hann(4);
    let hop = 8; // invalid
    let frames = vec![vec![Complex32::new(0.0, 0.0); window.len()]; 1];
    let mut out = vec![0.0f32; 4];
    let fft = sync_fft::SyncFft::default();
    let res = inverse_parallel(&frames, &window, hop, &mut out, &fft);
    assert!(matches!(res, Err(FftError::InvalidHopSize)));
}
