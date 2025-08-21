#[cfg(target_os = "linux")]
use criterion::{criterion_group, criterion_main, Criterion};
#[cfg(target_os = "linux")]
use kofft::wavelet::haar_forward;
#[cfg(target_os = "linux")]
use procfs::process::Process;
#[cfg(target_os = "linux")]
use std::hint::black_box;

#[cfg(target_os = "linux")]
/// Benchmarks resident memory usage of the Haar forward transform to verify
/// buffer preallocation reduces allocations.
fn haar_memory_benchmark(c: &mut Criterion) {
    c.bench_function("haar_forward_memory", |b| {
        b.iter(|| {
            let input = vec![0.0f32; 1 << 16];
            let process = Process::myself().unwrap();
            let before = process.statm().unwrap().resident;
            let _ = haar_forward(&input).unwrap();
            let after = process.statm().unwrap().resident;
            black_box(after - before);
        });
    });
}

#[cfg(target_os = "linux")]
criterion_group!(benches, haar_memory_benchmark);
#[cfg(target_os = "linux")]
criterion_main!(benches);

#[cfg(not(target_os = "linux"))]
fn main() {}
