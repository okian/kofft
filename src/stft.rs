//! Short-Time Fourier Transform (STFT) utilities.
//!
//! # Examples
//!
//! Batch STFT/ISTFT:
//! ```no_run
//! use kofft::stft::{stft, istft};
//! use kofft::window::hann;
//! use kofft::fft::ScalarFftImpl;
//!
//! let signal = vec![1.0, 2.0, 3.0, 4.0];
//! let window = hann(2);
//! let hop = 1;
//! let fft = ScalarFftImpl::<f32>::default();
//! let mut frames = vec![vec![]; 4];
//! stft(&signal, &window, hop, &mut frames, &fft).unwrap();
//! let mut out = vec![0.0; signal.len()];
//! let mut scratch = vec![0.0; out.len()];
//! istft(&mut frames, &window, hop, &mut out, &mut scratch, &fft).unwrap();
//! ```
//!
//! Streaming STFT:
//! ```no_run
//! use kofft::stft::{StftStream, istft};
//! use kofft::window::hann;
//! use kofft::fft::{Complex32, ScalarFftImpl};
//!
//! let signal = vec![1.0, 2.0, 3.0, 4.0];
//! let window = hann(2);
//! let hop = 1;
//! let fft = ScalarFftImpl::<f32>::default();
//! let mut stream = StftStream::new(&signal, &window, hop, &fft).unwrap();
//! let mut frames = Vec::new();
//! let mut buf = vec![Complex32::new(0.0, 0.0); window.len()];
//! while stream.next_frame(&mut buf).unwrap() {
//!     frames.push(buf.clone());
//! }
//! let mut out = vec![0.0; signal.len()];
//! let mut scratch = vec![0.0; out.len()];
//! istft(&mut frames, &window, hop, &mut out, &mut scratch, &fft).unwrap();
//! ```
//!
//! Streaming ISTFT:
//! ```no_run
//! use kofft::stft::{StftStream, IstftStream};
//! use kofft::window::hann;
//! use kofft::fft::{Complex32, ScalarFftImpl};
//!
//! let signal = vec![1.0, 2.0, 3.0, 4.0];
//! let window = hann(2);
//! let hop = 1;
//! let fft = ScalarFftImpl::<f32>::default();
//! let mut stft_stream = StftStream::new(&signal, &window, hop, &fft).unwrap();
//! let mut istft_stream = IstftStream::new(window.len(), hop, window.clone(), &fft).unwrap();
//! let mut frame = vec![Complex32::new(0.0, 0.0); window.len()];
//! let mut out = Vec::new();
//! while stft_stream.next_frame(&mut frame).unwrap() {
//!     out.extend_from_slice(istft_stream.push_frame(&frame).unwrap());
//! }
//! out.extend_from_slice(istft_stream.flush());
//! ```

extern crate alloc;
use crate::fft::{Complex32, FftError, FftImpl};
use alloc::vec;

/// Compute the STFT of a real-valued signal.
///
/// - `signal`: input signal (real, length N)
/// - `window`: window function (length win_len)
/// - `hop_size`: hop size between frames
/// - `output`: output frames (each frame is Vec<Complex32> of length win_len)
/// - `fft`: FFT implementation to reuse cached plans
///
/// Returns Ok(()) on success, or FftError on failure.
pub fn stft<Fft: FftImpl<f32>>(
    signal: &[f32],
    window: &[f32],
    hop_size: usize,
    output: &mut [alloc::vec::Vec<Complex32>],
    fft: &Fft,
) -> Result<(), FftError> {
    if hop_size == 0 {
        return Err(FftError::InvalidHopSize);
    }
    let required = signal.len().div_ceil(hop_size);
    if output.len() < required {
        return Err(FftError::MismatchedLengths);
    }
    let win_len = window.len();
    for (frame_idx, frame) in output.iter_mut().enumerate() {
        let start = frame_idx * hop_size;
        frame.resize(win_len, Complex32::new(0.0, 0.0));
        for i in 0..win_len {
            let x = if start + i < signal.len() {
                signal[start + i] * window[i]
            } else {
                0.0
            };
            frame[i] = Complex32::new(x, 0.0);
        }
        fft.fft(frame)?;
    }
    Ok(())
}

/// Compute the inverse STFT of frequency-domain frames in-place.
///
/// - `frames`: mutable frequency-domain frames (each of length `window.len()`)
/// - `window`: synthesis window
/// - `hop_size`: hop size between frames
/// - `output`: buffer to receive the reconstructed signal
/// - `scratch`: scratch buffer for overlap-add normalization (length = `output.len()`)
/// - `fft`: FFT implementation to reuse cached plans
///
/// Returns Ok(()) on success, or [`FftError`] on failure.
pub fn istft<Fft: FftImpl<f32>>(
    frames: &mut [alloc::vec::Vec<Complex32>],
    window: &[f32],
    hop_size: usize,
    output: &mut [f32],
    scratch: &mut [f32],
    fft: &Fft,
) -> Result<(), FftError> {
    if hop_size == 0 {
        return Err(FftError::InvalidHopSize);
    }
    if scratch.len() != output.len() {
        return Err(FftError::MismatchedLengths);
    }
    let win_len = window.len();
    for x in scratch.iter_mut() {
        *x = 0.0;
    }
    // Overlap-add
    for (frame_idx, frame) in frames.iter_mut().enumerate() {
        let start = frame_idx * hop_size;
        if frame.len() != win_len {
            return Err(FftError::MismatchedLengths);
        }
        fft.ifft(frame)?;
        for i in 0..win_len {
            if start + i < output.len() {
                output[start + i] += frame[i].re * window[i];
                scratch[start + i] += window[i] * window[i];
            }
        }
    }
    // Normalize by window sum
    for i in 0..output.len() {
        if scratch[i] > 1e-8 {
            output[i] /= scratch[i];
        }
    }
    Ok(())
}
/// Streaming STFT helper.
///
/// See the module-level documentation for an example.
pub struct StftStream<'a, Fft: crate::fft::FftImpl<f32>> {
    signal: &'a [f32],
    window: &'a [f32],
    hop_size: usize,
    pos: usize,
    fft: &'a Fft,
}

impl<'a, Fft: crate::fft::FftImpl<f32>> StftStream<'a, Fft> {
    pub fn new(
        signal: &'a [f32],
        window: &'a [f32],
        hop_size: usize,
        fft: &'a Fft,
    ) -> Result<Self, FftError> {
        if hop_size == 0 {
            return Err(FftError::InvalidHopSize);
        }
        Ok(Self {
            signal,
            window,
            hop_size,
            pos: 0,
            fft,
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
/// * `fft` - FFT implementation to reuse cached plans
///
/// Returns [`FftError::InvalidHopSize`] if `hop_size` is zero.
///
/// # Examples
/// ```
/// use kofft::stft::parallel;
/// use kofft::window::hann;
/// use kofft::fft::ScalarFftImpl;
/// let signal = vec![0.0; 8];
/// let window = hann(4);
/// let mut frames = vec![vec![]; 4];
/// let fft = ScalarFftImpl::<f32>::default();
/// parallel(&signal, &window, 2, &mut frames, &fft).unwrap();
/// ```
pub fn parallel<Fft: FftImpl<f32>>(
    signal: &[f32],
    window: &[f32],
    hop_size: usize,
    output: &mut [alloc::vec::Vec<Complex32>],
    fft: &Fft,
) -> Result<(), FftError> {
    use crate::fft::ScalarFftImpl;
    use rayon::prelude::*;
    let _ = fft;
    if hop_size == 0 {
        return Err(FftError::InvalidHopSize);
    }
    let win_len = window.len();
    output
        .par_iter_mut()
        .enumerate()
        .try_for_each(|(frame_idx, frame)| {
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
            let fft_local = ScalarFftImpl::<f32>::default();
            fft_local.fft(frame)
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
/// * `fft` - FFT implementation to reuse cached plans
///
/// Returns [`FftError::InvalidHopSize`] if `hop_size` is zero.
///
/// # Examples
/// ```
/// use kofft::stft::inverse_parallel;
/// use kofft::window::hann;
/// use kofft::fft::ScalarFftImpl;
/// let window = hann(4);
/// let frames = vec![vec![kofft::Complex32::zero(); 4]; 4];
/// let mut out = vec![0.0; 8];
/// let fft = ScalarFftImpl::<f32>::default();
/// inverse_parallel(&frames, &window, 2, &mut out, &fft).unwrap();
/// ```
pub fn inverse_parallel<Fft: FftImpl<f32>>(
    frames: &[alloc::vec::Vec<Complex32>],
    window: &[f32],
    hop_size: usize,
    output: &mut [f32],
    fft: &Fft,
) -> Result<(), FftError> {
    use crate::fft::ScalarFftImpl;
    use rayon::prelude::*;
    let _ = fft;
    if hop_size == 0 {
        return Err(FftError::InvalidHopSize);
    }
    let win_len = window.len();
    type Accum = (usize, alloc::vec::Vec<f32>, alloc::vec::Vec<f32>);
    type AccumResult = Result<alloc::vec::Vec<Accum>, FftError>;
    let partials: AccumResult = frames
        .par_iter()
        .enumerate()
        .map(|(frame_idx, frame)| {
            let start = frame_idx * hop_size;
            let mut time_buf = frame.clone();
            let fft_local = ScalarFftImpl::<f32>::default();
            fft_local.ifft(&mut time_buf)?;
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
/// - `fft`: FFT instance implementing [`FftImpl`]
///
/// Returns Ok(()) on success, or FftError on failure.
#[inline]
pub fn frame<Fft: FftImpl<f32>>(
    signal: &[f32],
    window: &[f32],
    start: usize,
    frame_out: &mut [Complex32],
    fft: &Fft,
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
/// - `fft`: FFT instance implementing [`FftImpl`]
///
/// Returns Ok(()) on success, or FftError on failure.
#[inline]
pub fn inverse_frame<Fft: FftImpl<f32>>(
    frame: &mut [Complex32],
    window: &[f32],
    start: usize,
    output: &mut [f32],
    fft: &Fft,
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

/// Streaming inverse STFT (ISTFT) helper implementing overlap-add with
/// normalization.
///
/// Frames are pushed using [`push_frame`], which returns the next `hop` samples
/// of the reconstructed signal. After the final frame has been processed, call
/// [`flush`](IstftStream::flush) to obtain the remaining samples.
pub struct IstftStream<'a, Fft: crate::fft::FftImpl<f32>> {
    win_len: usize,
    hop: usize,
    window: alloc::vec::Vec<f32>,
    fft: &'a Fft,
    buffer: alloc::vec::Vec<f32>,
    /// Buffer storing the sum of squared window values for normalization.
    norm_buf: alloc::vec::Vec<f32>,
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
        let norm_buf = vec![0.0f32; win_len + hop * 2];
        let time_buf = vec![crate::fft::Complex32::new(0.0, 0.0); win_len];
        Ok(Self {
            win_len,
            hop,
            window,
            fft,
            buffer,
            norm_buf,
            time_buf,
            buf_pos: 0,
            out_pos: 0,
            frame_count: 0,
        })
    }

    /// Feed in the next STFT frame and obtain a slice of normalized output samples.
    ///
    /// Returns a slice of length `hop` containing the next chunk of time-domain
    /// signal. Remaining samples after all frames have been pushed can be
    /// retrieved via [`flush`].
    pub fn push_frame(&mut self, frame: &[crate::fft::Complex32]) -> Result<&[f32], FftError> {
        if frame.len() != self.win_len {
            return Err(FftError::MismatchedLengths);
        }
        self.time_buf.copy_from_slice(frame);
        self.fft.ifft(&mut self.time_buf)?;
        // Window and overlap-add
        for i in 0..self.win_len {
            let win = self.window[i];
            let val = self.time_buf[i].re * win;
            let idx = self.buf_pos + i;
            self.buffer[idx] += val;
            self.norm_buf[idx] += win * win;
        }
        self.frame_count += 1;
        // Output is available after the first frame
        let out_start = self.out_pos;
        let out_end = self.out_pos + self.hop;
        // Normalize output before returning
        for i in out_start..out_end {
            if self.norm_buf[i] > 1e-8 {
                self.buffer[i] /= self.norm_buf[i];
            }
            self.norm_buf[i] = 0.0;
        }
        self.out_pos += self.hop;
        self.buf_pos += self.hop;
        // Zero the region that will be written next time
        if self.buf_pos + self.win_len > self.buffer.len() {
            // Extend buffer if needed
            let new_len = self.buf_pos + self.win_len;
            self.buffer.resize(new_len, 0.0);
            self.norm_buf.resize(new_len, 0.0);
        }
        for i in 0..self.hop {
            let idx = self.buf_pos + self.win_len - self.hop + i;
            self.buffer[idx] = 0.0;
            self.norm_buf[idx] = 0.0;
        }
        Ok(&self.buffer[out_start..out_end])
    }

    /// Return any remaining normalized samples after all frames have been
    /// processed.
    ///
    /// This should be called after the final frame is pushed to obtain the
    /// tail of the signal (`win_len - hop` samples). Subsequent calls will
    /// return an empty slice.
    pub fn flush(&mut self) -> &[f32] {
        let out_start = self.out_pos;
        let out_end = self.buf_pos + self.win_len - self.hop;
        if out_start >= out_end {
            return &[];
        }
        for i in out_start..out_end {
            if self.norm_buf[i] > 1e-8 {
                self.buffer[i] /= self.norm_buf[i];
            }
            self.norm_buf[i] = 0.0;
        }
        self.out_pos = out_end;
        &self.buffer[out_start..out_end]
    }
}

#[cfg(all(feature = "internal-tests", test))]
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
        let fft = ScalarFftImpl::<f32>::default();
        stft(&signal, &window, hop, &mut frames, &fft).unwrap();
        let mut output = vec![0.0f32; n];
        let mut scratch = vec![0.0f32; n];
        istft(&mut frames, &window, hop, &mut output, &mut scratch, &fft).unwrap();
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
        let fft = ScalarFftImpl::<f32>::default();
        parallel(&signal, &window, hop, &mut frames, &fft).unwrap();
        let mut output = vec![0.0f32; n];
        inverse_parallel(&frames, &window, hop, &mut output, &fft).unwrap();
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-4, "{} vs {}", a, b);
        }
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod streaming_tests {
    use super::*;
    use crate::fft::{Complex32, ScalarFftImpl};
    use alloc::vec::Vec;

    #[test]
    fn test_stft_istft_stream_roundtrip() {
        let win_len = 4;
        let hop = 2;
        let window = vec![1.0f32; win_len];
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let fft = ScalarFftImpl::<f32>::default();
        let mut stft_stream = StftStream::new(&signal, &window, hop, &fft).unwrap();
        let mut frames = Vec::new();
        let mut frame = vec![Complex32::new(0.0, 0.0); win_len];
        while stft_stream.next_frame(&mut frame).unwrap() {
            frames.push(frame.clone());
        }
        let mut output = vec![0.0f32; signal.len()];
        let mut scratch = vec![0.0f32; output.len()];
        istft(&mut frames, &window, hop, &mut output, &mut scratch, &fft).unwrap();
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-4, "{} vs {}", a, b);
        }
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod edge_case_tests {
    use super::*;
    use crate::fft::{Complex32, ScalarFftImpl};
    use alloc::vec::Vec;

    #[test]
    fn test_empty_signal_batch() {
        let signal: [f32; 0] = [];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let fft = ScalarFftImpl::<f32>::default();
        let res = stft(&signal, &window, 2, &mut frames, &fft);
        assert!(res.is_ok());
        let mut output = vec![0.0f32; 0];
        let mut scratch = vec![0.0f32; 0];
        let res = istft(&mut frames, &window, 2, &mut output, &mut scratch, &fft);
        assert!(res.is_ok());
    }

    #[test]
    fn test_mismatched_lengths_batch() {
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        // Output buffer too short
        let mut output = vec![0.0f32; 2];
        let mut scratch = vec![0.0f32; output.len()];
        let fft = ScalarFftImpl::<f32>::default();
        let res = istft(&mut frames, &window, 2, &mut output, &mut scratch, &fft);
        assert!(res.is_ok()); // Should not panic, just not fill all output
    }

    #[test]
    fn test_istft_frame_size_mismatch() {
        let window = [1.0, 1.0, 1.0, 1.0];
        // Frame shorter than window length
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 3]];
        let mut output = vec![0.0f32; 4];
        let mut scratch = vec![0.0f32; output.len()];
        let fft = ScalarFftImpl::<f32>::default();
        let res = istft(&mut frames, &window, 2, &mut output, &mut scratch, &fft);
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
        let fft = ScalarFftImpl::<f32>::default();
        let res = stft(&signal, &window, 0, &mut frames, &fft);
        assert!(res.is_err());
    }

    #[test]
    fn test_all_zero_window() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [0.0, 0.0, 0.0, 0.0];
        let hop = 2;
        let num_frames = signal.len().div_ceil(hop);
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); window.len()]; num_frames];
        let fft = ScalarFftImpl::<f32>::default();
        stft(&signal, &window, hop, &mut frames, &fft).unwrap();
        for frame in &frames {
            for c in frame {
                assert_eq!(c.re, 0.0);
                assert_eq!(c.im, 0.0);
            }
        }
        let mut output = vec![0.0f32; signal.len()];
        let mut scratch = vec![0.0f32; output.len()];
        istft(&mut frames, &window, hop, &mut output, &mut scratch, &fft).unwrap();
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
        let fft = ScalarFftImpl::<f32>::default();
        stft(&signal, &window, hop, &mut frames, &fft).unwrap();
        let mut output = vec![0.0f32; n];
        let mut scratch = vec![0.0f32; output.len()];
        istft(&mut frames, &window, hop, &mut output, &mut scratch, &fft).unwrap();
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
        let mut stft_stream = StftStream::new(&signal, &window, hop, &fft).unwrap();
        let mut istft_stream = IstftStream::new(win_len, hop, window.clone(), &fft).unwrap();
        let mut output = Vec::new();
        let mut frame = vec![Complex32::new(0.0, 0.0); win_len];
        while stft_stream.next_frame(&mut frame).unwrap() {
            let out = istft_stream.push_frame(&frame).unwrap();
            output.extend_from_slice(out);
        }
        let tail = istft_stream.flush();
        output.extend_from_slice(tail);
        output.truncate(signal.len());
        assert!(output.is_empty());
        assert!(tail.is_empty());
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod coverage_tests {
    use super::*;
    use crate::fft::{Complex32, ScalarFftImpl};
    use alloc::format;
    use proptest::prelude::*;

    #[test]
    fn test_stft_empty() {
        let signal: [f32; 0] = [];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let fft = ScalarFftImpl::<f32>::default();
        let res = stft(&signal, &window, 2, &mut frames, &fft);
        assert!(res.is_ok());
    }
    #[test]
    fn test_stft_single_frame() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let fft = ScalarFftImpl::<f32>::default();
        stft(&signal, &window, 4, &mut frames, &fft).unwrap();
        let mut output = vec![0.0f32; 4];
        let mut scratch = vec![0.0f32; output.len()];
        istft(&mut frames, &window, 4, &mut output, &mut scratch, &fft).unwrap();
        for (a, b) in signal.iter().zip(output.iter()) {
            assert!((a - b).abs() < 1e-4);
        }
    }
    #[test]
    fn test_stft_all_zeros() {
        let signal = [0.0; 8];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]; 2];
        let fft = ScalarFftImpl::<f32>::default();
        stft(&signal, &window, 4, &mut frames, &fft).unwrap();
        let mut output = vec![0.0f32; 8];
        let mut scratch = vec![0.0f32; output.len()];
        istft(&mut frames, &window, 4, &mut output, &mut scratch, &fft).unwrap();
        for &x in &output {
            assert_eq!(x, 0.0);
        }
    }
    #[test]
    fn test_stft_all_ones() {
        let signal = [1.0; 8];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]; 2];
        let fft = ScalarFftImpl::<f32>::default();
        stft(&signal, &window, 4, &mut frames, &fft).unwrap();
        let mut output = vec![0.0f32; 8];
        let mut scratch = vec![0.0f32; output.len()];
        istft(&mut frames, &window, 4, &mut output, &mut scratch, &fft).unwrap();
        for &x in &output {
            assert!(x > 0.0);
        }
    }
    #[test]
    fn test_stft_zero_hop() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let fft = ScalarFftImpl::<f32>::default();
        let res = stft(&signal, &window, 0, &mut frames, &fft);
        assert!(res.is_err());
    }

    #[test]
    fn test_istft_zero_hop() {
        let window = [1.0, 1.0, 1.0, 1.0];
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); 4]];
        let mut out = vec![0.0f32; 4];
        let mut scratch = vec![0.0f32; out.len()];
        let fft = ScalarFftImpl::<f32>::default();
        let res = istft(&mut frames, &window, 0, &mut out, &mut scratch, &fft);
        assert!(res.is_err());
    }

    #[test]
    fn test_stft_stream_iteration() {
        let signal = [1.0, 2.0, 3.0, 4.0, 5.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let fft = ScalarFftImpl::<f32>::default();
        let mut stream = StftStream::new(&signal, &window, 2, &fft).unwrap();
        let mut buf = vec![Complex32::new(0.0, 0.0); 4];
        assert!(stream.next_frame(&mut buf).unwrap());
        while stream.next_frame(&mut buf).unwrap() {}
    }

    #[test]
    fn test_stream_buffer_mismatch() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [1.0, 1.0, 1.0, 1.0];
        let fft = ScalarFftImpl::<f32>::default();
        let mut stream = StftStream::new(&signal, &window, 2, &fft).unwrap();
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
        let fft = ScalarFftImpl::<f32>::default();
        assert!(StftStream::new(&signal, &window, 0, &fft).is_err());
    }
    #[test]
    fn test_stft_all_zero_window() {
        let signal = [1.0, 2.0, 3.0, 4.0];
        let window = [0.0, 0.0, 0.0, 0.0];
        let hop = 2;
        let num_frames = signal.len().div_ceil(hop);
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); window.len()]; num_frames];
        let fft = ScalarFftImpl::<f32>::default();
        stft(&signal, &window, hop, &mut frames, &fft).unwrap();
        for frame in &frames {
            for c in frame {
                assert_eq!(c.re, 0.0);
                assert_eq!(c.im, 0.0);
            }
        }
        let mut output = vec![0.0f32; signal.len()];
        let mut scratch = vec![0.0f32; output.len()];
        istft(&mut frames, &window, hop, &mut output, &mut scratch, &fft).unwrap();
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
            let fft = ScalarFftImpl::<f32>::default();
            stft(signal, &window, hop, &mut frames, &fft).unwrap();
            let mut output = vec![0.0f32; len];
            let mut scratch = vec![0.0f32; output.len()];
            istft(&mut frames, &window, hop, &mut output, &mut scratch, &fft).unwrap();
            for (a, b) in signal.iter().zip(output.iter()) {
                prop_assert!((a - b).abs() < 1e-2);
            }
        }
    }
}
