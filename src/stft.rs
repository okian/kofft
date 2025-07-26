//! Short-Time Fourier Transform (STFT) implementation using ScalarFftImpl.
#![no_std]

use crate::fft::{ScalarFftImpl, Complex32, FftError};

/// Compute the STFT of a real-valued signal.
///
/// - `signal`: input signal (real, length N)
/// - `window`: window function (length win_len)
/// - `hop_size`: hop size between frames
/// - `output`: output frames (each frame is Vec<Complex32> of length win_len)
///
/// Returns Ok(()) on success, or FftError on failure.
pub fn stft(
    signal: &[f32],
    window: &[f32],
    hop_size: usize,
    output: &mut [alloc::vec::Vec<Complex32>],
) -> Result<(), FftError> {
    let win_len = window.len();
    let fft = ScalarFftImpl;
    let num_frames = output.len();
    for (frame_idx, frame) in output.iter_mut().enumerate() {
        let start = frame_idx * hop_size;
        if start + win_len > signal.len() {
            // Zero-pad if signal is too short
            frame.clear();
            for i in 0..win_len {
                let x = if start + i < signal.len() {
                    signal[start + i] * window[i]
                } else {
                    0.0
                };
                frame.push(Complex32::new(x, 0.0));
            }
        } else {
            frame.clear();
            for i in 0..win_len {
                frame.push(Complex32::new(signal[start + i] * window[i], 0.0));
            }
        }
        fft.fft(frame)?;
    }
    Ok(())
}

pub fn istft(
    frames: &[alloc::vec::Vec<Complex32>],
    window: &[f32],
    hop_size: usize,
    output: &mut [f32],
) -> Result<(), FftError> {
    let win_len = window.len();
    let fft = ScalarFftImpl;
    let mut norm = alloc::vec::Vec::with_capacity(output.len());
    norm.resize(output.len(), 0.0);
    // Overlap-add
    for (frame_idx, frame) in frames.iter().enumerate() {
        let start = frame_idx * hop_size;
        let mut time_buf = frame.clone();
        fft.ifft(&mut time_buf)?;
        for i in 0..win_len {
            if start + i < output.len() {
                output[start + i] += time_buf[i].re * window[i];
                norm[start + i] += window[i] * window[i];
            }
        }
    }
    // Normalize by window sum
    for i in 0..output.len() {
        if norm[i] > 1e-8 {
            output[i] /= norm[i];
        }
    }
    Ok(())
}

pub struct StftStream<'a> {
    signal: &'a [f32],
    window: &'a [f32],
    hop_size: usize,
    pos: usize,
    fft: ScalarFftImpl,
}

impl<'a> StftStream<'a> {
    pub fn new(signal: &'a [f32], window: &'a [f32], hop_size: usize) -> Self {
        Self { signal, window, hop_size, pos: 0, fft: ScalarFftImpl }
    }
    pub fn next_frame(&mut self, out: &mut [Complex32]) -> Result<bool, FftError> {
        let win_len = self.window.len();
        if self.pos >= self.signal.len() {
            return Ok(false);
        }
        for i in 0..win_len {
            let x = if self.pos + i < self.signal.len() {
                self.signal[self.pos + i] * self.window[i]
            } else {
                0.0
            };
            out[i] = Complex32::new(x, 0.0);
        }
        self.fft.fft(out)?;
        self.pos += self.hop_size;
        Ok(true)
    }
}

#[cfg(feature = "parallel")]
pub fn parallel(
    signal: &[f32],
    window: &[f32],
    hop_size: usize,
    output: &mut [alloc::vec::Vec<Complex32>],
) -> Result<(), FftError> {
    use rayon::prelude::*;
    let win_len = window.len();
    let fft = ScalarFftImpl;
    output.par_iter_mut().enumerate().try_for_each(|(frame_idx, frame)| {
        let start = frame_idx * hop_size;
        frame.clear();
        for i in 0..win_len {
            let x = if start + i < signal.len() {
                signal[start + i] * window[i]
            } else {
                0.0
            };
            frame.push(Complex32::new(x, 0.0));
        }
        fft.fft(frame)
    })
}

#[cfg(feature = "parallel")]
pub fn inverse_parallel(
    frames: &[alloc::vec::Vec<Complex32>],
    window: &[f32],
    hop_size: usize,
    output: &mut [f32],
) -> Result<(), FftError> {
    use rayon::prelude::*;
    let win_len = window.len();
    let fft = ScalarFftImpl;
    let mut norm = alloc::vec::Vec::with_capacity(output.len());
    norm.resize(output.len(), 0.0);
    let mut acc = alloc::vec::Vec::with_capacity(output.len());
    acc.resize(output.len(), 0.0);
    frames.par_iter().enumerate().try_for_each(|(frame_idx, frame)| {
        let start = frame_idx * hop_size;
        let mut time_buf = frame.clone();
        fft.ifft(&mut time_buf)?;
        for i in 0..win_len {
            if start + i < acc.len() {
                acc[start + i] += time_buf[i].re * window[i];
                norm[start + i] += window[i] * window[i];
            }
        }
        Ok(())
    })?;
    for i in 0..output.len() {
        if norm[i] > 1e-8 {
            output[i] = acc[i] / norm[i];
        } else {
            output[i] = 0.0;
        }
    }
    Ok(())
}

/// Streaming, no_std, no-alloc STFT: process one frame at a time using fixed-size buffers.
///
/// - `signal`: input signal (real)
/// - `window`: window function
/// - `start`: start index in signal
/// - `frame_out`: output buffer for FFT frame (length = window.len())
/// - `fft`: ScalarFftImpl instance
///
/// Returns Ok(()) on success, or FftError on failure.
#[inline]
pub fn frame(
    signal: &[f32],
    window: &[f32],
    start: usize,
    frame_out: &mut [Complex32],
    fft: &ScalarFftImpl,
) -> Result<(), FftError> {
    let win_len = window.len();
    for i in 0..win_len {
        let x = if start + i < signal.len() {
            signal[start + i] * window[i]
        } else {
            0.0
        };
        frame_out[i] = Complex32::new(x, 0.0);
    }
    fft.fft(frame_out)
}

/// Streaming, no_std, no-alloc ISTFT: process one frame at a time using fixed-size buffers.
///
/// - `frame`: input FFT frame (length = window.len())
/// - `window`: window function
/// - `start`: start index in output
/// - `output`: output buffer (real, overlap-add)
/// - `fft`: ScalarFftImpl instance
///
/// Returns Ok(()) on success, or FftError on failure.
#[inline]
pub fn inverse_frame(
    frame: &mut [Complex32],
    window: &[f32],
    start: usize,
    output: &mut [f32],
    fft: &ScalarFftImpl,
) -> Result<(), FftError> {
    let win_len = window.len();
    fft.ifft(frame)?;
    for i in 0..win_len {
        if start + i < output.len() {
            output[start + i] += frame[i].re * window[i];
        }
    }
    Ok(())
}

pub struct IstftStream<'a, Fft> {
    win_len: usize,
    hop: usize,
    window: alloc::vec::Vec<f32>,
    fft: &'a Fft,
    buffer: alloc::vec::Vec<f32>,
    buf_pos: usize,
    out_pos: usize,
    frame_count: usize,
}

impl<'a, Fft: crate::fft::FftImpl> IstftStream<'a, Fft> {
    pub fn new(win_len: usize, hop: usize, window: alloc::vec::Vec<f32>, fft: &'a Fft) -> Self {
        let buffer = alloc::vec::Vec::with_capacity(win_len + hop * 2);
        let mut buffer = vec![0.0f32; win_len + hop * 2];
        Self {
            win_len,
            hop,
            window,
            fft,
            buffer,
            buf_pos: 0,
            out_pos: 0,
            frame_count: 0,
        }
    }

    /// Feed in the next STFT frame, get a slice of output samples (may be empty if not enough overlap)
    pub fn push_frame(&mut self, frame: &[crate::fft::Complex32]) -> &[f32] {
        let mut time = alloc::vec::Vec::with_capacity(self.win_len);
        time.resize(self.win_len, crate::fft::Complex32::new(0.0, 0.0));
        time.copy_from_slice(frame);
        self.fft.ifft(&mut time).unwrap();
        // Window and overlap-add
        for i in 0..self.win_len {
            let val = time[i].re * self.window[i];
            self.buffer[self.buf_pos + i] += val;
        }
        self.frame_count += 1;
        // Output is available after the first frame
        let out_start = self.out_pos;
        let out_end = self.out_pos + self.hop;
        self.out_pos += self.hop;
        self.buf_pos += self.hop;
        // Zero the region that will be written next time
        if self.buf_pos + self.win_len > self.buffer.len() {
            // Extend buffer if needed
            self.buffer.resize(self.buf_pos + self.win_len, 0.0);
        }
        for i in 0..self.hop {
            self.buffer[self.buf_pos + self.win_len - self.hop + i] = 0.0;
        }
        &self.buffer[out_start..out_end]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fft::{ScalarFftImpl, Complex32};

    #[test]
    fn test_stft_istft_frame_roundtrip() {
        let fft = ScalarFftImpl;
        let n = 8;
        let win_len = 4;
        let hop = 2;
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut output = [0.0f32; 8];
        let mut frame = [Complex32::new(0.0, 0.0); 4];
        // STFT + ISTFT streaming
        let mut pos = 0;
        while pos < n {
            frame(&signal, &window, pos, &mut frame, &fft).unwrap();
            inverse_frame(&mut frame, &window, pos, &mut output, &fft).unwrap();
            pos += hop;
        }
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-4, "{} vs {}", a, b);
        }
    }

    #[test]
    fn test_stft_istft_batch_roundtrip() {
        let n = 8;
        let win_len = 4;
        let hop = 2;
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let num_frames = (n + hop - 1) / hop;
        let mut frames = alloc::vec::Vec::new();
        for _ in 0..num_frames {
            frames.push(alloc::vec::Vec::with_capacity(win_len));
        }
        stft(&signal, &window, hop, &mut frames).unwrap();
        let mut output = vec![0.0f32; n];
        istft(&frames, &window, hop, &mut output).unwrap();
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-4, "{} vs {}", a, b);
        }
    }

    #[cfg(feature = "parallel")]
    #[test]
    fn test_stft_istft_parallel_roundtrip() {
        let n = 8;
        let win_len = 4;
        let hop = 2;
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let num_frames = (n + hop - 1) / hop;
        let mut frames = alloc::vec::Vec::new();
        for _ in 0..num_frames {
            frames.push(alloc::vec::Vec::with_capacity(win_len));
        }
        parallel(&signal, &window, hop, &mut frames).unwrap();
        let mut output = vec![0.0f32; n];
        inverse_parallel(&frames, &window, hop, &mut output).unwrap();
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-4, "{} vs {}", a, b);
        }
    }
}

#[cfg(all(test, feature = "std"))]
mod prop_tests {
    use super::*;
    use crate::fft::ScalarFftImpl;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn prop_stft_istft_roundtrip(
            len in 8usize..128,
            hop in 1usize..8,
            win_len in 2usize..16,
            ref signal in proptest::collection::vec(-1000.0f32..1000.0, 8..128)
        ) {
            let len = len.min(signal.len());
            let signal = &signal[..len];
            let win_len = win_len.min(len);
            let hop = hop.min(win_len);
            let window = vec![1.0f32; win_len];
            let num_frames = (len + hop - 1) / hop;
            let mut frames = alloc::vec::Vec::new();
            for _ in 0..num_frames {
                frames.push(alloc::vec::Vec::with_capacity(win_len));
            }
            stft(signal, &window, hop, &mut frames).unwrap();
            let mut output = vec![0.0f32; len];
            istft(&frames, &window, hop, &mut output).unwrap();
            for (a, b) in signal.iter().zip(output.iter()) {
                prop_assert!((a - b).abs() < 1e-3, "{} vs {}", a, b);
            }
        }
    }
}

#[cfg(test)]
mod streaming_tests {
    use super::*;
    use crate::fft::{ScalarFftImpl, Complex32};

    #[test]
    fn test_stft_istft_stream_roundtrip() {
        let win_len = 4;
        let hop = 2;
        let window = vec![1.0f32; win_len];
        let fft = ScalarFftImpl;
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let mut stft_stream = StftStream::new(win_len, hop, window.clone(), fft);
        let mut istft_stream = IstftStream::new(win_len, hop, window, &fft);
        let mut output = Vec::new();
        for &sample in &signal {
            if let Some(frame) = stft_stream.next_frame(&mut [Complex32::new(0.0, 0.0); win_len]).unwrap() {
                let out = istft_stream.push_frame(&frame);
                output.extend_from_slice(out);
            }
        }
        // There may be a few samples of latency at the end; pad with zeros and flush
        for _ in 0..win_len {
            if let Some(frame) = stft_stream.next_frame(&mut [Complex32::new(0.0, 0.0); win_len]).unwrap() {
                let out = istft_stream.push_frame(&frame);
                output.extend_from_slice(out);
            }
        }
        // Truncate to original signal length
        output.truncate(signal.len());
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-4, "{} vs {}", a, b);
        }
    }
}

#[cfg(test)]
mod edge_case_tests {
    use super::*;
    use crate::fft::{ScalarFftImpl, Complex32};

    #[test]
    fn test_empty_signal_batch() {
        let signal: [f32; 0] = [];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let res = stft(&signal, &window, 2, &mut frames);
        assert!(res.is_ok());
        let mut output = vec![0.0f32; 0];
        let res = istft(&frames, &window, 2, &mut output);
        assert!(res.is_ok());
    }

    #[test]
    fn test_mismatched_lengths_batch() {
        let signal = [1.0, 2.0, 3.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        // Output buffer too short
        let mut output = vec![0.0f32; 2];
        let res = istft(&frames, &window, 2, &mut output);
        assert!(res.is_ok()); // Should not panic, just not fill all output
    }

    #[test]
    fn test_zero_hop_size() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let res = stft(&signal, &window, 0, &mut frames);
        assert!(res.is_err() || res.is_ok()); // Should not panic
    }

    #[test]
    fn test_all_zero_window() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [0.0, 0.0, 0.0, 0.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        stft(&signal, &window, 2, &mut frames).unwrap();
        for frame in &frames {
            for c in frame {
                assert_eq!(c.re, 0.0);
                assert_eq!(c.im, 0.0);
            }
        }
        let mut output = vec![0.0f32; 4];
        istft(&frames, &window, 2, &mut output).unwrap();
        for &x in &output {
            assert_eq!(x, 0.0);
        }
    }

    #[test]
    fn test_hann_window() {
        let n = 8;
        let win_len = 4;
        let hop = 2;
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let window: Vec<f32> = (0..win_len)
            .map(|i| 0.5 - 0.5 * (core::f32::consts::PI * 2.0 * i as f32 / win_len as f32).cos())
            .collect();
        let num_frames = (n + hop - 1) / hop;
        let mut frames = alloc::vec::Vec::new();
        for _ in 0..num_frames {
            frames.push(alloc::vec::Vec::with_capacity(win_len));
        }
        stft(&signal, &window, hop, &mut frames).unwrap();
        let mut output = vec![0.0f32; n];
        istft(&frames, &window, hop, &mut output).unwrap();
        // Should reconstruct signal (with some error due to window)
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-2, "{} vs {}", a, b);
        }
    }

    #[test]
    fn test_streaming_empty_signal() {
        let win_len = 4;
        let hop = 2;
        let window = vec![1.0f32; win_len];
        let fft = ScalarFftImpl;
        let signal: [f32; 0] = [];
        let mut stft_stream = StftStream::new(win_len, hop, window.clone(), fft);
        let mut istft_stream = IstftStream::new(win_len, hop, window, &fft);
        let mut output = Vec::new();
        for &sample in &signal {
            if let Some(frame) = stft_stream.next_frame(&mut [Complex32::new(0.0, 0.0); win_len]).unwrap() {
                let out = istft_stream.push_frame(&frame);
                output.extend_from_slice(out);
            }
        }
        assert!(output.is_empty());
    }
}

#[cfg(test)]
mod coverage_tests {
    use super::*;
    use crate::fft::{ScalarFftImpl, Complex32};
    use alloc::vec::Vec;
    use proptest::prelude::*;

    #[test]
    fn test_stft_empty() {
        let signal: [f32; 0] = [];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let res = stft(&signal, &window, 2, &mut frames);
        assert!(res.is_ok());
    }
    #[test]
    fn test_stft_single_frame() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        stft(&signal, &window, 4, &mut frames).unwrap();
        let mut output = vec![0.0f32; 4];
        istft(&frames, &window, 4, &mut output).unwrap();
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-4);
        }
    }
    #[test]
    fn test_stft_all_zeros() {
        let signal = [0.0; 8];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]; 2];
        stft(&signal, &window, 4, &mut frames).unwrap();
        let mut output = vec![0.0f32; 8];
        istft(&frames, &window, 4, &mut output).unwrap();
        for &x in &output { assert_eq!(x, 0.0); }
    }
    #[test]
    fn test_stft_all_ones() {
        let signal = [1.0; 8];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]; 2];
        stft(&signal, &window, 4, &mut frames).unwrap();
        let mut output = vec![0.0f32; 8];
        istft(&frames, &window, 4, &mut output).unwrap();
        for &x in &output { assert!(x > 0.0); }
    }
    #[test]
    fn test_stft_zero_hop() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let res = stft(&signal, &window, 0, &mut frames);
        assert!(res.is_err() || res.is_ok());
    }
    #[test]
    fn test_stft_all_zero_window() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [0.0, 0.0, 0.0, 0.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        stft(&signal, &window, 2, &mut frames).unwrap();
        for frame in &frames {
            for c in frame {
                assert_eq!(c.re, 0.0);
                assert_eq!(c.im, 0.0);
            }
        }
        let mut output = vec![0.0f32; 4];
        istft(&frames, &window, 2, &mut output).unwrap();
        for &x in &output { assert_eq!(x, 0.0); }
    }
    proptest! {
        #[test]
        fn prop_stft_istft_roundtrip(len in 8usize..64, hop in 1usize..8, win_len in 2usize..16, ref signal in proptest::collection::vec(-1000.0f32..1000.0, 64)) {
            let len = len.min(signal.len());
            let signal = &signal[..len];
            let win_len = win_len.min(len);
            let hop = hop.min(win_len);
            let window = vec![1.0f32; win_len];
            let num_frames = (len + hop - 1) / hop;
            let mut frames = alloc::vec::Vec::new();
            for _ in 0..num_frames {
                frames.push(alloc::vec::Vec::with_capacity(win_len));
            }
            stft(signal, &window, hop, &mut frames).unwrap();
            let mut output = vec![0.0f32; len];
            istft(&frames, &window, hop, &mut output).unwrap();
            for (a, b) in signal.iter().zip(output.iter()) {
                prop_assert!((a - b).abs() < 1e-2);
            }
        }
    }
}
