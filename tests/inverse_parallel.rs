// Test intent: verifies inverse parallel behavior including edge cases.
#![cfg(feature = "parallel")]

use kofft::fft::{Complex32, FftError, FftImpl, FftStrategy, ScalarFftImpl};
use kofft::stft::{inverse_parallel, istft, stft};
use kofft::window::hann;
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Mutex,
};

struct CountingAlloc;
static ALLOC: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for CountingAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let ptr = System.alloc(layout);
        if !ptr.is_null() {
            ALLOC.fetch_add(1, Ordering::Relaxed);
        }
        ptr
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        System.dealloc(ptr, layout);
    }
}

#[global_allocator]
static GLOBAL: CountingAlloc = CountingAlloc;

#[derive(Default)]
struct SyncFft(Mutex<ScalarFftImpl<f32>>);

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

fn reset_alloc() {
    ALLOC.store(0, Ordering::Relaxed);
}
fn allocs() -> usize {
    ALLOC.load(Ordering::Relaxed)
}

#[test]
fn inverse_parallel_matches_istft() {
    let signal: Vec<f32> = (0..128).map(|i| i as f32).collect();
    let win_len = 32;
    let hop = 16;
    let window = hann(win_len);
    let fft = SyncFft::default();
    let mut frames = vec![vec![]; signal.len().div_ceil(hop)];
    stft(&signal, &window, hop, &mut frames, &fft).unwrap();
    let expected = (frames.len() - 1) * hop + win_len;
    let mut out_seq = vec![0.0; expected];
    let mut scratch = vec![0.0; expected];
    istft(
        &mut frames.clone(),
        &window,
        hop,
        &mut out_seq,
        &mut scratch,
        &fft,
    )
    .unwrap();
    let mut out_par = vec![0.0; expected];
    inverse_parallel(&frames, &window, hop, &mut out_par, &fft).unwrap();
    for (a, b) in out_seq.iter().zip(out_par.iter()) {
        assert!((a - b).abs() < 1e-5);
    }
}
#[test]
fn inverse_parallel_large_batch_allocation() {
    /// Window length used for each frame.
    const WIN_LEN: usize = 64;
    /// Hop size in samples between frames.
    const HOP: usize = 32;
    /// Total number of frames processed in the test batch.
    const FRAMES_COUNT: usize = 512;
    /// Maximum acceptable allocations per frame to remain efficient.
    const MAX_ALLOCS_PER_FRAME: f32 = 3.5;

    let window = hann(WIN_LEN);
    let frames = vec![vec![Complex32::new(1.0, 0.0); WIN_LEN]; FRAMES_COUNT];
    let out_len = HOP * (FRAMES_COUNT - 1) + WIN_LEN;
    let mut out = vec![0.0f32; out_len];
    let fft = SyncFft::default();
    // Warm up to populate FFT plans before measuring allocations.
    inverse_parallel(&frames, &window, HOP, &mut out, &fft).unwrap();
    reset_alloc();
    inverse_parallel(&frames, &window, HOP, &mut out, &fft).unwrap();
    let per_frame = allocs() as f32 / FRAMES_COUNT as f32;
    // Threshold chosen empirically: allows minor internal buffers while remaining efficient.
    assert!(per_frame < MAX_ALLOCS_PER_FRAME);
}
