#![cfg(feature = "parallel")]

use criterion::{criterion_group, criterion_main, Criterion};
use kofft::fft::{Complex32, ScalarFftImpl};
use kofft::stft::{parallel, stft};
use kofft::window::hann;

fn benchmark_stft_parallel(c: &mut Criterion) {
    let signal = vec![0.1f32; 4096];
    let window = hann(256);
    let hop = 128;
    let fft = ScalarFftImpl::<f32>::default();
    let frame_count = signal.len().div_ceil(hop);

    c.bench_function("stft_serial", |b| {
        b.iter(|| {
            let mut frames = vec![vec![Complex32::zero(); window.len()]; frame_count];
            stft(&signal, &window, hop, &mut frames, &fft).unwrap();
        });
    });

    c.bench_function("stft_parallel", |b| {
        b.iter(|| {
            let mut frames = vec![vec![Complex32::zero(); window.len()]; frame_count];
            parallel(&signal, &window, hop, &mut frames, &fft).unwrap();
        });
    });
}

criterion_group!(benches, benchmark_stft_parallel);
criterion_main!(benches);
