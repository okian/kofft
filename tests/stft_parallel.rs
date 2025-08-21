// Test intent: verifies stft parallel behavior including edge cases.
#![cfg(feature = "parallel")]

use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Mutex,
};

use kofft::fft::{Complex32, FftError, FftImpl, FftStrategy, ScalarFftImpl};
use kofft::stft::parallel;
use kofft::window::hann;

/// Thread-safe FFT counting calls to ensure parallel execution uses the provided
/// instance exactly once per frame.
struct CountingFft {
    /// Inner FFT implementation protected by a mutex to provide `Sync`.
    inner: Mutex<ScalarFftImpl<f32>>,
    /// Total number of FFT operations performed.
    calls: AtomicUsize,
}

impl CountingFft {
    /// Create a new counting FFT wrapper.
    fn new() -> Self {
        Self {
            inner: Mutex::new(ScalarFftImpl::<f32>::default()),
            calls: AtomicUsize::new(0),
        }
    }
    /// Retrieve the number of FFT invocations.
    fn count(&self) -> usize {
        self.calls.load(Ordering::SeqCst)
    }
}

impl FftImpl<f32> for CountingFft {
    /// Forward FFT while incrementing the call counter.
    fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner.lock().unwrap().fft(input)
    }
    /// Inverse FFT while incrementing the call counter.
    fn ifft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner.lock().unwrap().ifft(input)
    }
    /// Delegate strided FFT and count the call.
    fn fft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner
            .lock()
            .unwrap()
            .fft_strided(input, stride, scratch)
    }
    /// Delegate strided inverse FFT and count the call.
    fn ifft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner
            .lock()
            .unwrap()
            .ifft_strided(input, stride, scratch)
    }
    /// Delegate out-of-place strided FFT and count the call.
    fn fft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner
            .lock()
            .unwrap()
            .fft_out_of_place_strided(input, in_stride, output, out_stride)
    }
    /// Delegate out-of-place strided inverse FFT and count the call.
    fn ifft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner
            .lock()
            .unwrap()
            .ifft_out_of_place_strided(input, in_stride, output, out_stride)
    }
    /// Delegate FFT with strategy and count the call.
    fn fft_with_strategy(
        &self,
        input: &mut [Complex32],
        strategy: FftStrategy,
    ) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner
            .lock()
            .unwrap()
            .fft_with_strategy(input, strategy)
    }
}

/// Ensure the parallel STFT uses the supplied FFT implementation exactly once per frame.
#[test]
fn parallel_uses_supplied_fft() {
    const SIGNAL_LEN: usize = 8;
    const WIN_LEN: usize = 4;
    const HOP: usize = 2;
    let signal = vec![0.0f32; SIGNAL_LEN];
    let window = hann(WIN_LEN);
    let frame_count = SIGNAL_LEN.div_ceil(HOP);
    let mut frames = vec![vec![Complex32::zero(); WIN_LEN]; frame_count];
    let fft = CountingFft::new();
    parallel(&signal, &window, HOP, &mut frames, &fft).unwrap();
    assert_eq!(fft.count(), frame_count);
    for frame in frames {
        assert_eq!(frame.len(), WIN_LEN);
    }
}
