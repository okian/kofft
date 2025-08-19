#[cfg(target_os = "linux")]
use criterion::{criterion_group, criterion_main, Criterion};
#[cfg(target_os = "linux")]
use kofft::fft::{Complex32, ScalarFftImpl};
#[cfg(target_os = "linux")]
use kofft::stft::IstftStream;
#[cfg(target_os = "linux")]
use procfs::process::Process;
use std::hint::black_box;

#[cfg(target_os = "linux")]
fn memory_usage_benchmark(c: &mut Criterion) {
    c.bench_function("istft_stream_memory_usage", |b| {
        b.iter(|| {
            let win_len = 1024;
            let hop = 512;
            let window = vec![1.0f32; win_len];
            let fft = ScalarFftImpl::<f32>::default();
            let mut istft = IstftStream::new(win_len, hop, &window, &fft).unwrap();
            let mut frame = vec![Complex32::new(0.0, 0.0); win_len];
            let process = Process::myself().unwrap();
            let before = process.statm().unwrap().resident;
            for _ in 0..1000 {
                istft.push_frame(&mut frame).unwrap();
            }
            let after = process.statm().unwrap().resident;
            black_box(after - before);
        });
    });
}

#[cfg(target_os = "linux")]
criterion_group!(benches, memory_usage_benchmark);
#[cfg(target_os = "linux")]
criterion_main!(benches);

#[cfg(not(target_os = "linux"))]
fn main() {}
