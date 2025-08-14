//! Short-Time Fourier Transform (STFT) implementation using ScalarFftImpl.

extern crate alloc;
use crate::fft::{Complex32, FftError, FftImpl, ScalarFftImpl};
use alloc::vec;

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
    if hop_size == 0 {
        return Err(FftError::InvalidHopSize);
    }
    let win_len = window.len();
    let fft = ScalarFftImpl::<f32>::default();
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
    if hop_size == 0 {
        return Err(FftError::InvalidHopSize);
    }
    let win_len = window.len();
    let fft = ScalarFftImpl::<f32>::default();
    let mut norm = alloc::vec::Vec::with_capacity(output.len());
    norm.resize(output.len(), 0.0);
    // Overlap-add
    for (frame_idx, frame) in frames.iter().enumerate() {
        let start = frame_idx * hop_size;
        if frame.len() != win_len {
            return Err(FftError::MismatchedLengths);
        }
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

/// Streaming STFT helper that yields successive FFT frames.
///
/// # Example
/// ```no_run
/// use kofft::stft::StftStream;
/// use kofft::window::hann;
/// use kofft::fft::Complex32;
///
/// let signal = vec![1.0, 2.0, 3.0, 4.0];
/// let window = hann(2);
/// let mut stream = StftStream::new(&signal, &window, 1).unwrap();
/// let mut frame = vec![Complex32::new(0.0, 0.0); window.len()];
/// while stream.next_frame(&mut frame).unwrap() {
///     // process frame
/// }
/// ```
pub struct StftStream<'a> {
    signal: &'a [f32],
    window: &'a [f32],
    hop_size: usize,
    pos: usize,
    fft: ScalarFftImpl<f32>,
}

impl<'a> StftStream<'a> {
    pub fn new(signal: &'a [f32], window: &'a [f32], hop_size: usize) -> Result<Self, FftError> {
        if hop_size == 0 {
            return Err(FftError::InvalidHopSize);
        }
        Ok(Self {
            signal,
            window,
            hop_size,
            pos: 0,
            fft: ScalarFftImpl::<f32>::default(),
        })
    }
    pub fn next_frame(&mut self, out: &mut [Complex32]) -> Result<bool, FftError> {
        let win_len = self.window.len();
        if out.len() != win_len {
            return Err(FftError::MismatchedLengths);
        }
        if self.pos >= self.signal.len() {
            return Ok(false);
        }
        for (i, out_i) in out.iter_mut().enumerate() {
            let x = if self.pos + i < self.signal.len() {
                self.signal[self.pos + i] * self.window[i]
            } else {
                0.0
            };
            *out_i = Complex32::new(x, 0.0);
        }
        self.fft.fft(out)?;
        self.pos += self.hop_size;
        Ok(true)
    }
}

#[cfg(feature = "parallel")]
/// Compute the Short-Time Fourier Transform (STFT) of `signal` using Rayon for parallelism.
///
/// Requires the `parallel` feature, which enables the [`rayon`](https://crates.io/crates/rayon) dependency.
///
/// * `signal` - input real-valued signal
/// * `window` - analysis window
/// * `hop_size` - hop size between adjacent frames
/// * `output` - pre-allocated buffer for FFT frames
///
/// Returns [`FftError::InvalidHopSize`] if `hop_size` is zero.
///
/// # Examples
/// ```
/// use kofft::stft::parallel;
/// use kofft::window::hann;
/// let signal = vec![0.0; 8];
/// let window = hann(4);
/// let mut frames = vec![vec![]; 4];
/// parallel(&signal, &window, 2, &mut frames).unwrap();
/// ```
pub fn parallel(
    signal: &[f32],
    window: &[f32],
    hop_size: usize,
    output: &mut [alloc::vec::Vec<Complex32>],
) -> Result<(), FftError> {
    use rayon::prelude::*;
    if hop_size == 0 {
        return Err(FftError::InvalidHopSize);
    }
    let win_len = window.len();
    output
        .par_iter_mut()
        .enumerate()
        .try_for_each(|(frame_idx, frame)| {
            let fft = ScalarFftImpl::<f32>::default();
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
/// Inverse STFT using Rayon for parallel synthesis.
///
/// Requires the `parallel` feature, which enables the [`rayon`](https://crates.io/crates/rayon) dependency.
///
/// * `frames` - frequency-domain frames
/// * `window` - synthesis window
/// * `hop_size` - hop size between frames
/// * `output` - buffer to receive the reconstructed signal
///
/// Returns [`FftError::InvalidHopSize`] if `hop_size` is zero.
///
/// # Examples
/// ```
/// use kofft::stft::inverse_parallel;
/// use kofft::window::hann;
/// let window = hann(4);
/// let frames = vec![vec![kofft::Complex32::zero(); 4]; 4];
/// let mut out = vec![0.0; 8];
/// inverse_parallel(&frames, &window, 2, &mut out).unwrap();
/// ```
pub fn inverse_parallel(
    frames: &[alloc::vec::Vec<Complex32>],
    window: &[f32],
    hop_size: usize,
    output: &mut [f32],
) -> Result<(), FftError> {
    use rayon::prelude::*;
    if hop_size == 0 {
        return Err(FftError::InvalidHopSize);
    }
    let win_len = window.len();
    let partials: Result<
        alloc::vec::Vec<(usize, alloc::vec::Vec<f32>, alloc::vec::Vec<f32>)>,
        FftError,
    > = frames
        .par_iter()
        .enumerate()
        .map(|(frame_idx, frame)| {
            let fft = ScalarFftImpl::<f32>::default();
            let start = frame_idx * hop_size;
            let mut time_buf = frame.clone();
            fft.ifft(&mut time_buf)?;
            let mut acc = alloc::vec::Vec::with_capacity(win_len);
            acc.resize(win_len, 0.0);
            let mut norm = alloc::vec::Vec::with_capacity(win_len);
            norm.resize(win_len, 0.0);
            for i in 0..win_len {
                acc[i] = time_buf[i].re * window[i];
                norm[i] = window[i] * window[i];
            }
            Ok((start, acc, norm))
        })
        .collect();
    let partials = partials?;
    let mut norm = alloc::vec::Vec::with_capacity(output.len());
    norm.resize(output.len(), 0.0);
    for (start, acc_frame, norm_frame) in partials {
        for i in 0..win_len {
            if start + i < output.len() {
                output[start + i] += acc_frame[i];
                norm[start + i] += norm_frame[i];
            }
        }
    }
    for i in 0..output.len() {
        if norm[i] > 1e-8 {
            output[i] /= norm[i];
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
    fft: &ScalarFftImpl<f32>,
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
    fft: &ScalarFftImpl<f32>,
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

pub struct IstftStream<'a, Fft: crate::fft::FftImpl<f32>> {
    win_len: usize,
    hop: usize,
    window: alloc::vec::Vec<f32>,
    fft: &'a Fft,
    buffer: alloc::vec::Vec<f32>,
    time_buf: alloc::vec::Vec<crate::fft::Complex32>,
    buf_pos: usize,
    out_pos: usize,
    frame_count: usize,
}

impl<'a, Fft: crate::fft::FftImpl<f32>> IstftStream<'a, Fft> {
    pub fn new(
        win_len: usize,
        hop: usize,
        window: alloc::vec::Vec<f32>,
        fft: &'a Fft,
    ) -> Result<Self, FftError> {
        if hop == 0 {
            return Err(FftError::InvalidHopSize);
        }
        let buffer = vec![0.0f32; win_len + hop * 2];
        let time_buf = vec![crate::fft::Complex32::new(0.0, 0.0); win_len];
        Ok(Self {
            win_len,
            hop,
            window,
            fft,
            buffer,
            time_buf,
            buf_pos: 0,
            out_pos: 0,
            frame_count: 0,
        })
    }

    /// Feed in the next STFT frame, get a slice of output samples (may be empty if not enough overlap)
    pub fn push_frame(&mut self, frame: &[crate::fft::Complex32]) -> Result<&[f32], FftError> {
        if frame.len() != self.win_len {
            return Err(FftError::MismatchedLengths);
        }
        self.time_buf.copy_from_slice(frame);
        self.fft.ifft(&mut self.time_buf)?;
        // Window and overlap-add
        for i in 0..self.win_len {
            let val = self.time_buf[i].re * self.window[i];
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
        Ok(&self.buffer[out_start..out_end])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fft::{Complex32, ScalarFftImpl};

    #[test]
    fn test_stft_istft_frame_roundtrip() {
        let fft = ScalarFftImpl::<f32>::default();
        let n: usize = 8;
        let win_len: usize = 4;
        let hop: usize = 2;
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut output = [0.0f32; 8];
        let mut norm = [0.0f32; 8];
        let mut frame_buf = [Complex32::new(0.0, 0.0); 4];
        // STFT + ISTFT streaming
        let mut pos = 0;
        while pos < n {
            frame(&signal, &window, pos, &mut frame_buf, &fft).unwrap();
            inverse_frame(&mut frame_buf, &window, pos, &mut output, &fft).unwrap();
            for i in 0..win_len {
                if pos + i < n {
                    norm[pos + i] += window[i] * window[i];
                }
            }
            pos += hop;
        }
        for i in 0..n {
            if norm[i] > 1e-8 {
                output[i] /= norm[i];
            }
        }
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-4, "{} vs {}", a, b);
        }
    }

    #[test]
    fn test_stft_istft_batch_roundtrip() {
        let n: usize = 8;
        let win_len: usize = 4;
        let hop: usize = 2;
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let num_frames = n.div_ceil(hop);
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
        let n: usize = 8;
        let win_len: usize = 4;
        let hop: usize = 2;
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let num_frames = n.div_ceil(hop);
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

#[cfg(test)]
mod streaming_tests {
    use super::*;
    use crate::fft::Complex32;
    use alloc::vec::Vec;

    #[test]
    fn test_stft_istft_stream_roundtrip() {
        let win_len = 4;
        let hop = 2;
        let window = vec![1.0f32; win_len];
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let mut stft_stream = StftStream::new(&signal, &window, hop).unwrap();
        let mut frames = Vec::new();
        let mut frame = vec![Complex32::new(0.0, 0.0); win_len];
        while stft_stream.next_frame(&mut frame).unwrap() {
            frames.push(frame.clone());
        }
        let mut output = vec![0.0f32; signal.len()];
        istft(&frames, &window, hop, &mut output).unwrap();
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-4, "{} vs {}", a, b);
        }
    }
}

#[cfg(test)]
mod edge_case_tests {
    use super::*;
    use crate::fft::{Complex32, ScalarFftImpl};
    use alloc::vec::Vec;

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
        let window = [1.0, 1.0, 1.0, 1.0];
        let frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        // Output buffer too short
        let mut output = vec![0.0f32; 2];
        let res = istft(&frames, &window, 2, &mut output);
        assert!(res.is_ok()); // Should not panic, just not fill all output
    }

    #[test]
    fn test_istft_frame_size_mismatch() {
        let window = [1.0, 1.0, 1.0, 1.0];
        // Frame shorter than window length
        let frames = vec![vec![Complex32::new(0.0, 0.0); 3]];
        let mut output = vec![0.0f32; 4];
        let res = istft(&frames, &window, 2, &mut output);
        assert!(matches!(res, Err(FftError::MismatchedLengths)));
    }

    #[test]
    fn test_istft_stream_frame_size_mismatch() {
        let win_len = 4;
        let hop = 2;
        let window = vec![1.0f32; win_len];
        let fft = ScalarFftImpl::<f32>::default();
        let mut istft_stream = IstftStream::new(win_len, hop, window.clone(), &fft).unwrap();
        let frame = vec![Complex32::new(0.0, 0.0); win_len - 1];
        let res = istft_stream.push_frame(&frame);
        assert!(matches!(res, Err(FftError::MismatchedLengths)));
    }

    #[test]
    fn test_zero_hop_size() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let res = stft(&signal, &window, 0, &mut frames);
        assert!(res.is_err());
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
        let n: usize = 8;
        let win_len: usize = 4;
        let hop: usize = 2;
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let window: Vec<f32> = (0..win_len)
            .map(|i| 0.5 - 0.5 * (core::f32::consts::PI * 2.0 * i as f32 / win_len as f32).cos())
            .collect();
        let num_frames = n.div_ceil(hop);
        let mut frames = alloc::vec::Vec::new();
        for _ in 0..num_frames {
            frames.push(alloc::vec::Vec::with_capacity(win_len));
        }
        stft(&signal, &window, hop, &mut frames).unwrap();
        let mut output = vec![0.0f32; n];
        istft(&frames, &window, hop, &mut output).unwrap();
        // Should roughly reconstruct signal (Hann window has edge attenuation)
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1.1, "{} vs {}", a, b);
        }
    }

    #[test]
    fn test_streaming_empty_signal() {
        let win_len = 4;
        let hop = 2;
        let window = vec![1.0f32; win_len];
        let fft = ScalarFftImpl::<f32>::default();
        let signal: [f32; 0] = [];
        let mut stft_stream = StftStream::new(&signal, &window, hop).unwrap();
        let mut istft_stream = IstftStream::new(win_len, hop, window.clone(), &fft).unwrap();
        let mut output = Vec::new();
        let mut frame = vec![Complex32::new(0.0, 0.0); win_len];
        while stft_stream.next_frame(&mut frame).unwrap() {
            let out = istft_stream.push_frame(&frame).unwrap();
            output.extend_from_slice(out);
        }
        frame.iter_mut().for_each(|c| *c = Complex32::new(0.0, 0.0));
        for _ in 0..win_len {
            let out = istft_stream.push_frame(&frame).unwrap();
            output.extend_from_slice(out);
        }
        output.truncate(signal.len());
        assert!(output.is_empty());
    }
}

#[cfg(test)]
mod coverage_tests {
    use super::*;
    use crate::fft::Complex32;
    use alloc::format;
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
        for &x in &output {
            assert_eq!(x, 0.0);
        }
    }
    #[test]
    fn test_stft_all_ones() {
        let signal = [1.0; 8];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]; 2];
        stft(&signal, &window, 4, &mut frames).unwrap();
        let mut output = vec![0.0f32; 8];
        istft(&frames, &window, 4, &mut output).unwrap();
        for &x in &output {
            assert!(x > 0.0);
        }
    }
    #[test]
    fn test_stft_zero_hop() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let res = stft(&signal, &window, 0, &mut frames);
        assert!(res.is_err());
    }

    #[test]
    fn test_istft_zero_hop() {
        let window = [1.0, 1.0, 1.0, 1.0];
        let frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let mut out = vec![0.0f32; 4];
        let res = istft(&frames, &window, 0, &mut out);
        assert!(res.is_err());
    }

    #[test]
    fn test_stft_stream_iteration() {
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut stream = StftStream::new(&signal, &window, 2).unwrap();
        let mut buf = vec![Complex32::new(0.0, 0.0); 4];
        assert!(stream.next_frame(&mut buf).unwrap());
        while stream.next_frame(&mut buf).unwrap() {}
    }

    #[test]
    fn test_stream_buffer_mismatch() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut stream = StftStream::new(&signal, &window, 2).unwrap();
        let mut buf = vec![Complex32::new(0.0, 0.0); 3];
        assert_eq!(
            stream.next_frame(&mut buf).unwrap_err(),
            FftError::MismatchedLengths
        );
    }

    #[test]
    fn test_stft_stream_invalid_hop() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        assert!(StftStream::new(&signal, &window, 0).is_err());
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
        for &x in &output {
            assert_eq!(x, 0.0);
        }
    }
    proptest! {
        #[test]
        fn prop_stft_istft_roundtrip(len in 8usize..64, hop in 1usize..8, win_len in 2usize..16, ref signal in proptest::collection::vec(-1000.0f32..1000.0, 64)) {
            let len = len.min(signal.len());
            let signal = &signal[..len];
            let win_len = win_len.min(len);
            let hop = hop.min(win_len);
            let window = vec![1.0f32; win_len];
            let num_frames = len.div_ceil(hop);
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
