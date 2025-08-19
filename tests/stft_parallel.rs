#![cfg(feature = "parallel")]

use std::sync::atomic::{AtomicUsize, Ordering};

use kofft::fft::{Complex32, FftError, FftImpl, FftStrategy, ScalarFftImpl};
use kofft::stft::parallel;
use kofft::window::hann;

struct CountingFft {
    inner: ScalarFftImpl<f32>,
    calls: AtomicUsize,
}

impl CountingFft {
    fn new() -> Self {
        Self {
            inner: ScalarFftImpl::<f32>::default(),
            calls: AtomicUsize::new(0),
        }
    }
    fn count(&self) -> usize {
        self.calls.load(Ordering::SeqCst)
    }
}

impl FftImpl<f32> for CountingFft {
    fn fft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner.fft(input)
    }
    fn ifft(&self, input: &mut [Complex32]) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner.ifft(input)
    }
    fn fft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner.fft_strided(input, stride, scratch)
    }
    fn ifft_strided(
        &self,
        input: &mut [Complex32],
        stride: usize,
        scratch: &mut [Complex32],
    ) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner.ifft_strided(input, stride, scratch)
    }
    fn fft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner
            .fft_out_of_place_strided(input, in_stride, output, out_stride)
    }
    fn ifft_out_of_place_strided(
        &self,
        input: &[Complex32],
        in_stride: usize,
        output: &mut [Complex32],
        out_stride: usize,
    ) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner
            .ifft_out_of_place_strided(input, in_stride, output, out_stride)
    }
    fn fft_with_strategy(
        &self,
        input: &mut [Complex32],
        strategy: FftStrategy,
    ) -> Result<(), FftError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.inner.fft_with_strategy(input, strategy)
    }
}

#[test]
fn parallel_uses_supplied_fft() {
    let signal = vec![0.0f32; 8];
    let window = hann(4);
    let hop = 2;
    let frame_count = signal.len().div_ceil(hop);
    let mut frames = vec![vec![Complex32::zero(); window.len()]; frame_count];
    let fft = CountingFft::new();
    parallel(&signal, &window, hop, &mut frames, &fft).unwrap();
    assert_eq!(fft.count(), frame_count);
    for frame in frames {
        assert_eq!(frame.len(), window.len());
    }
}
