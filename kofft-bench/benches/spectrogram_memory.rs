#[cfg(target_os = "linux")]
use criterion::{criterion_group, criterion_main, Criterion};
#[cfg(target_os = "linux")]
use kofft::visual::spectrogram::stft_magnitudes;
#[cfg(target_os = "linux")]
use procfs::process::Process;
#[cfg(target_os = "linux")]
use std::hint::black_box;

/// Number of samples used in the memory benchmark.
#[cfg(target_os = "linux")]
const BENCH_SAMPLES: usize = 1 << 16;

/// Benchmark the resident memory growth when computing a spectrogram.
#[cfg(target_os = "linux")]
fn spectrogram_memory_usage(c: &mut Criterion) {
    c.bench_function("spectrogram_memory_usage", |b| {
        b.iter(|| {
            let samples = vec![0.0f32; BENCH_SAMPLES];
            let win_len = 1024;
            let hop = 512;
            let process = Process::myself().unwrap();
            let before = process.statm().unwrap().resident;
            let _ = stft_magnitudes(&samples, win_len, hop).unwrap();
            let after = process.statm().unwrap().resident;
            let pages = after - before;
            // Convert the resident set growth into bytes.
            let bytes = pages * procfs::page_size().unwrap_or(4096);
            println!("spectrogram memory bytes: {}", bytes);
            black_box(bytes);
        });
    });
}

#[cfg(target_os = "linux")]
criterion_group!(benches, spectrogram_memory_usage);
#[cfg(target_os = "linux")]
criterion_main!(benches);

#[cfg(not(target_os = "linux"))]
fn main() {}
