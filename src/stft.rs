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
//! let mut istft_stream = IstftStream::new(window.len(), hop, &window, &fft).unwrap();
//! let mut frame = vec![Complex32::new(0.0, 0.0); window.len()];
//! let mut out = Vec::new();
//! while stft_stream.next_frame(&mut frame).unwrap() {
//!     out.extend_from_slice(istft_stream.push_frame(&mut frame).unwrap());
//! }
//! out.extend_from_slice(istft_stream.flush());
//! ```

#[cfg(not(all(feature = "wasm", feature = "simd")))]
compile_error!("stft requires `wasm` and `simd` features to be enabled");

extern crate alloc;
use crate::fft::{Complex32, FftError, FftImpl};
use alloc::vec;
#[cfg(feature = "parallel")]
use core::mem::take; // for efficiently resetting buffers without reallocations

/// Minimum normalization denominator to avoid division by zero and unstable
/// amplification when overlap-adding STFT frames. Any accumulated window power
/// below this threshold is treated as silence.
const NORM_EPSILON: f32 = 1e-8;

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

#[cfg(all(feature = "parallel", test))]
/// Tests covering the parallel STFT implementation and its thread-safety
/// guarantees.
mod parallel_tests {
    use super::*;
    use crate::fft::{Complex32, FftError, FftImpl, FftStrategy, ScalarFftImpl};
    use alloc::vec::Vec;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Mutex,
    };

    /// Length of the synthetic test signal.
    const SIG_LEN: usize = 8;
    /// Length of the analysis window applied in tests.
    const WIN_LEN: usize = 4;
    /// Hop size between adjacent frames used in tests.
    const HOP: usize = 2;

    /// FFT wrapper counting the number of calls to detect data races.
    #[derive(Default)]
    struct CountingFft {
        /// Underlying scalar FFT implementation reused across frames.
        inner: Mutex<ScalarFftImpl<f32>>,
        /// Atomic counter incremented on each FFT invocation.
        calls: AtomicUsize,
    }

    impl FftImpl<f32> for CountingFft {
        /// Perform an FFT while atomically incrementing the call counter.
        fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
            // Increment atomically to ensure thread-safe mutation.
            self.calls.fetch_add(1, Ordering::SeqCst);
            self.inner.lock().unwrap().fft(input)
        }
        /// Delegate to the inner implementation for inverse FFT.
        fn ifft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
            self.inner.lock().unwrap().ifft(input)
        }
        /// Delegate strided FFT to the inner implementation.
        fn fft_strided(
            &self,
            input: &mut [Complex32],
            stride: usize,
            scratch: &mut [Complex32],
        ) -> Result<(), FftError> {
            self.inner
                .lock()
                .unwrap()
                .fft_strided(input, stride, scratch)
        }
        /// Delegate strided inverse FFT to the inner implementation.
        fn ifft_strided(
            &self,
            input: &mut [Complex32],
            stride: usize,
            scratch: &mut [Complex32],
        ) -> Result<(), FftError> {
            self.inner
                .lock()
                .unwrap()
                .ifft_strided(input, stride, scratch)
        }
        /// Delegate out-of-place strided FFT to the inner implementation.
        fn fft_out_of_place_strided(
            &self,
            input: &[Complex32],
            in_stride: usize,
            output: &mut [Complex32],
            out_stride: usize,
        ) -> Result<(), FftError> {
            self.inner
                .lock()
                .unwrap()
                .fft_out_of_place_strided(input, in_stride, output, out_stride)
        }
        /// Delegate out-of-place strided IFFT to the inner implementation.
        fn ifft_out_of_place_strided(
            &self,
            input: &[Complex32],
            in_stride: usize,
            output: &mut [Complex32],
            out_stride: usize,
        ) -> Result<(), FftError> {
            self.inner
                .lock()
                .unwrap()
                .ifft_out_of_place_strided(input, in_stride, output, out_stride)
        }
        /// Delegate strategy-based FFT to the inner implementation.
        fn fft_with_strategy(
            &self,
            input: &mut [Complex32],
            strategy: FftStrategy,
        ) -> Result<(), FftError> {
            self.inner
                .lock()
                .unwrap()
                .fft_with_strategy(input, strategy)
        }
    }

    /// Ensure parallel STFT matches sequential STFT output.
    #[test]
    fn parallel_matches_sequential() {
        let signal: [f32; SIG_LEN] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let window: [f32; WIN_LEN] = [1.0; WIN_LEN];
        let frames_needed = SIG_LEN.div_ceil(HOP);
        let mut seq_frames = vec![vec![Complex32::zero(); WIN_LEN]; frames_needed];
        let mut par_frames = vec![vec![Complex32::zero(); WIN_LEN]; frames_needed];
        let fft = CountingFft::default();
        // Sequential reference implementation.
        stft(&signal, &window, HOP, &mut seq_frames, &fft).unwrap();
        // Parallel computation under test.
        parallel(&signal, &window, HOP, &mut par_frames, &fft).unwrap();
        assert_eq!(seq_frames, par_frames);
    }

    /// Verify that insufficient output frames return an error.
    #[test]
    fn parallel_mismatched_output_len() {
        let signal: [f32; SIG_LEN] = [0.0; SIG_LEN];
        let window: [f32; WIN_LEN] = [0.0; WIN_LEN];
        let mut frames: Vec<Vec<Complex32>> = vec![]; // Too short on purpose.
        let fft = CountingFft::default();
        let res = parallel(&signal, &window, HOP, &mut frames, &fft);
        assert!(matches!(res, Err(FftError::MismatchedLengths)));
    }

    /// Verify that zero hop size fails fast.
    #[test]
    fn parallel_invalid_hop() {
        let signal: [f32; SIG_LEN] = [0.0; SIG_LEN];
        let window: [f32; WIN_LEN] = [0.0; WIN_LEN];
        let mut frames = vec![vec![Complex32::zero(); WIN_LEN]; 1];
        let fft = CountingFft::default();
        let res = parallel(&signal, &window, 0, &mut frames, &fft);
        assert!(matches!(res, Err(FftError::InvalidHopSize)));
    }

    /// Ensure each frame triggers exactly one FFT call with no data races.
    #[test]
    fn parallel_counts_calls() {
        let signal: [f32; SIG_LEN] = [0.0; SIG_LEN];
        let window: [f32; WIN_LEN] = [1.0; WIN_LEN];
        let frames_needed = SIG_LEN.div_ceil(HOP);
        let mut frames = vec![vec![Complex32::zero(); WIN_LEN]; frames_needed];
        let fft = CountingFft::default();
        parallel(&signal, &window, HOP, &mut frames, &fft).unwrap();
        assert_eq!(fft.calls.load(Ordering::SeqCst), frames_needed);
    }
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
    // Clear normalization buffer before accumulating window power.
    scratch.fill(0.0);
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
        if scratch[i] > NORM_EPSILON {
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
/// Parallel Short-Time Fourier Transform (STFT).
///
/// # Why parallel?
/// Computing large numbers of FFT frames can be expensive.  This variant uses
/// [`rayon`](https://crates.io/crates/rayon) to distribute the work across
/// threads for improved throughput.
///
/// # Safety and thread guarantees
/// The FFT instance is borrowed immutably by each worker thread.  The type
/// parameter therefore requires [`Sync`] so that sharing a reference across
/// threads is sound.  No mutable access occurs and the closure captures only
/// shared references, preventing data races.
///
/// # Parameters
/// - `signal`: input real-valued samples
/// - `window`: analysis window applied per frame
/// - `hop_size`: hop size between adjacent frames
/// - `output`: pre-allocated buffer for FFT frames
/// - `fft`: FFT implementation reused across frames
///
/// Returns [`FftError::InvalidHopSize`] if `hop_size` is zero or
/// [`FftError::MismatchedLengths`] when `output` does not contain enough
/// frames.
///
/// # Examples
/// ```ignore
/// use kofft::stft::parallel;
/// use kofft::window::hann;
/// use kofft::fft::ScalarFftImpl;
/// let signal = vec![0.0; 8];
/// let window = hann(4);
/// let mut frames = vec![vec![]; 4];
/// let fft = ScalarFftImpl::<f32>::default();
/// parallel(&signal, &window, 2, &mut frames, &fft).unwrap();
/// ```ignore
pub fn parallel<Fft: FftImpl<f32> + Sync>(
    signal: &[f32],
    window: &[f32],
    hop_size: usize,
    output: &mut [alloc::vec::Vec<Complex32>],
    fft: &Fft,
) -> Result<(), FftError> {
    use rayon::prelude::*;
    if hop_size == 0 {
        return Err(FftError::InvalidHopSize);
    }
    let required = signal.len().div_ceil(hop_size);
    if output.len() < required {
        return Err(FftError::MismatchedLengths);
    }
    let win_len = window.len();
    // Pre-size frames to avoid repeated allocations in the parallel loop
    for frame in output.iter_mut() {
        frame.resize(win_len, Complex32::zero());
    }
    output
        .par_iter_mut()
        .enumerate()
        .try_for_each(|(frame_idx, frame)| {
            let start = frame_idx * hop_size;
            for i in 0..win_len {
                let x = if start + i < signal.len() {
                    signal[start + i] * window[i]
                } else {
                    0.0
                };
                frame[i] = Complex32::new(x, 0.0);
            }
            // `fft` is an immutable reference shared between threads.  The
            // `Sync` bound on `Fft` guarantees that concurrent calls are safe.
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
/// * `fft` - FFT implementation to reuse cached plans
///
/// Returns [`FftError::InvalidHopSize`] if `hop_size` is zero.
///
/// # Examples
/// ```ignore
/// use kofft::stft::inverse_parallel;
/// use kofft::window::hann;
/// use kofft::fft::ScalarFftImpl;
/// let window = hann(4);
/// let frames = vec![vec![kofft::Complex32::zero(); 4]; 4];
/// let mut out = vec![0.0; 8];
/// let fft = ScalarFftImpl::<f32>::default();
/// inverse_parallel(&frames, &window, 2, &mut out, &fft).unwrap();
/// ```
pub fn inverse_parallel<Fft: FftImpl<f32> + Sync>(
    frames: &[alloc::vec::Vec<Complex32>],
    window: &[f32],
    hop_size: usize,
    output: &mut [f32],
    fft: &Fft,
) -> Result<(), FftError> {
    use rayon::prelude::*;
    if hop_size == 0 {
        return Err(FftError::InvalidHopSize);
    }
    let win_len = window.len();
    type Accum = (usize, alloc::vec::Vec<f32>, alloc::vec::Vec<f32>);
    type AccumResult = Result<alloc::vec::Vec<Accum>, FftError>;
    let partials: AccumResult = frames
        .par_iter()
        .enumerate()
        .map_init(
            || {
                (
                    vec![Complex32::new(0.0, 0.0); win_len],
                    vec![0.0f32; win_len],
                    vec![0.0f32; win_len],
                )
            },
            |(time_buf, acc, norm), (frame_idx, frame)| {
                let start = frame_idx * hop_size;
                time_buf.copy_from_slice(frame);
                fft.ifft(time_buf)?;
                // `acc` and `norm` are emptied by `take` at the end of the previous
                // iteration. Resize them here to restore capacity without reallocating.
                if acc.len() < win_len {
                    acc.resize(win_len, 0.0);
                    norm.resize(win_len, 0.0);
                }
                for i in 0..win_len {
                    acc[i] = time_buf[i].re * window[i];
                    norm[i] = window[i] * window[i];
                }
                // Move the accumulated data out for this frame while leaving the
                // buffers empty for reuse in the next iteration.
                let acc_frame = take(acc);
                let norm_frame = take(norm);
                Ok((start, acc_frame, norm_frame))
            },
        )
        .collect();
    let partials = partials?;
    output.fill(0.0);
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
        if norm[i] > NORM_EPSILON {
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
    window: &'a [f32],
    fft: &'a Fft,
    buffer: alloc::vec::Vec<f32>,
    /// Buffer storing the sum of squared window values for normalization.
    norm_buf: alloc::vec::Vec<f32>,
    buf_pos: usize,
    out_pos: usize,
    frame_count: usize,
}

impl<'a, Fft: crate::fft::FftImpl<f32>> IstftStream<'a, Fft> {
    pub fn new(
        win_len: usize,
        hop: usize,
        window: &'a [f32],
        fft: &'a Fft,
    ) -> Result<Self, FftError> {
        if hop == 0 {
            return Err(FftError::InvalidHopSize);
        }
        if window.len() != win_len {
            return Err(FftError::MismatchedLengths);
        }
        let buffer = vec![0.0f32; win_len + hop * 2];
        let norm_buf = vec![0.0f32; win_len + hop * 2];
        Ok(Self {
            win_len,
            hop,
            window,
            fft,
            buffer,
            norm_buf,
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
    pub fn push_frame(&mut self, frame: &mut [crate::fft::Complex32]) -> Result<&[f32], FftError> {
        if frame.len() != self.win_len {
            return Err(FftError::MismatchedLengths);
        }
        if self.buf_pos + self.win_len > self.buffer.len() {
            let shift = self.out_pos;
            self.buffer.copy_within(shift.., 0);
            self.norm_buf.copy_within(shift.., 0);
            self.buf_pos -= shift;
            self.out_pos = 0;
            for i in self.buf_pos + self.win_len - self.hop..self.buffer.len() {
                self.buffer[i] = 0.0;
                self.norm_buf[i] = 0.0;
            }
        }
        self.fft.ifft(frame)?;
        // Window and overlap-add
        for (i, sample) in frame.iter().enumerate().take(self.win_len) {
            let win = self.window[i];
            let val = sample.re * win;
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
            if self.norm_buf[i] > NORM_EPSILON {
                self.buffer[i] /= self.norm_buf[i];
            }
            self.norm_buf[i] = 0.0;
        }
        self.out_pos += self.hop;
        self.buf_pos += self.hop;
        for i in 0..self.hop {
            let idx = self.buf_pos + self.win_len - self.hop + i;
            if idx < self.buffer.len() {
                self.buffer[idx] = 0.0;
                self.norm_buf[idx] = 0.0;
            }
        }
        Ok(&self.buffer[out_start..out_end])
    }

    /// Return any remaining normalized samples after all frames have been
    /// processed.
    ///
    /// This should be called after the final frame is pushed to obtain the
    /// tail of the signal (`win_len - hop` samples). If no frames have been
    /// processed, this returns an empty slice. Subsequent calls will
    /// also return an empty slice.
    pub fn flush(&mut self) -> &[f32] {
        if self.frame_count == 0 {
            return &[];
        }
        let out_start = self.out_pos;
        let out_end = self.buf_pos + self.win_len - self.hop;
        if out_start >= out_end {
            return &[];
        }
        for i in out_start..out_end {
            if self.norm_buf[i] > NORM_EPSILON {
                self.buffer[i] /= self.norm_buf[i];
            }
            self.norm_buf[i] = 0.0;
        }
        self.out_pos = out_end;
        &self.buffer[out_start..out_end]
    }

    /// Current length of the internal buffer (for diagnostics and testing).
    pub fn buffer_len(&self) -> usize {
        self.buffer.len()
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    // Only the FFT types required for tests.
    use crate::fft::{Complex32, FftStrategy, ScalarFftImpl};

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
            if norm[i] > NORM_EPSILON {
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
        use std::sync::Mutex;

        struct SyncFft(Mutex<ScalarFftImpl<f32>>);
        impl Default for SyncFft {
            fn default() -> Self {
                Self(Mutex::new(ScalarFftImpl::<f32>::default()))
            }
        }
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
        let fft = SyncFft::default();
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
        let mut istft_stream = IstftStream::new(win_len, hop, &window, &fft).unwrap();
        let mut frame = vec![Complex32::new(0.0, 0.0); win_len - 1];
        let res = istft_stream.push_frame(&mut frame);
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
        let mut istft_stream = IstftStream::new(win_len, hop, &window, &fft).unwrap();
        let mut output = Vec::new();
        let mut frame = vec![Complex32::new(0.0, 0.0); win_len];
        while stft_stream.next_frame(&mut frame).unwrap() {
            let out = istft_stream.push_frame(&mut frame).unwrap();
            output.extend_from_slice(out);
        }
        let tail = istft_stream.flush();
        output.extend_from_slice(tail);
        output.truncate(signal.len());
        assert!(output.is_empty());
        assert!(tail.is_empty());
    }

    #[test]
    fn test_tiny_window_threshold() {
        let signal = [1.0f32, 2.0];
        // Extremely small non-zero window ensures accumulated power stays below NORM_EPSILON
        let window = [1e-9, 1e-9];
        let required = signal.len().div_ceil(1);
        let mut frames = vec![vec![Complex32::new(0.0, 0.0); window.len()]; required];
        let fft = ScalarFftImpl::<f32>::default();
        stft(&signal, &window, 1, &mut frames, &fft).unwrap();
        let mut output = vec![0.0f32; signal.len()];
        let mut scratch = vec![0.0f32; output.len()];
        istft(&mut frames, &window, 1, &mut output, &mut scratch, &fft).unwrap();
        // With such a tiny window, normalization should treat the output as silence
        assert!(output
            .iter()
            .all(|x| x.is_finite() && x.abs() <= NORM_EPSILON));
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
