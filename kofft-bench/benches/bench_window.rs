use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use kofft::window;

fn hann_scalar(len: usize) -> Vec<f32> {
    (0..len)
        .map(|i| 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / len as f32).cos())
        .collect()
}

fn hamming_scalar(len: usize) -> Vec<f32> {
    (0..len)
        .map(|i| 0.54 - 0.46 * (2.0 * std::f32::consts::PI * i as f32 / len as f32).cos())
        .collect()
}

fn blackman_scalar(len: usize) -> Vec<f32> {
    (0..len)
        .map(|i| {
            let a0 = 0.42;
            let a1 = 0.5;
            let a2 = 0.08;
            let x = i as f32 / len as f32;
            a0 - a1 * (2.0 * std::f32::consts::PI * x).cos()
                + a2 * (4.0 * std::f32::consts::PI * x).cos()
        })
        .collect()
}

fn bench_hann(c: &mut Criterion) {
    let mut g = c.benchmark_group("hann");
    for &size in &[256usize, 1024, 4096] {
        g.bench_with_input(BenchmarkId::new("simd", size), &size, |b, &n| {
            b.iter(|| window::hann(n));
        });
        g.bench_with_input(BenchmarkId::new("scalar", size), &size, |b, &n| {
            b.iter(|| hann_scalar(n));
        });
    }
    g.finish();
}

fn bench_hamming(c: &mut Criterion) {
    let mut g = c.benchmark_group("hamming");
    for &size in &[256usize, 1024, 4096] {
        g.bench_with_input(BenchmarkId::new("simd", size), &size, |b, &n| {
            b.iter(|| window::hamming(n));
        });
        g.bench_with_input(BenchmarkId::new("scalar", size), &size, |b, &n| {
            b.iter(|| hamming_scalar(n));
        });
    }
    g.finish();
}

fn bench_blackman(c: &mut Criterion) {
    let mut g = c.benchmark_group("blackman");
    for &size in &[256usize, 1024, 4096] {
        g.bench_with_input(BenchmarkId::new("simd", size), &size, |b, &n| {
            b.iter(|| window::blackman(n));
        });
        g.bench_with_input(BenchmarkId::new("scalar", size), &size, |b, &n| {
            b.iter(|| blackman_scalar(n));
        });
    }
    g.finish();
}

criterion_group!(benches, bench_hann, bench_hamming, bench_blackman);
criterion_main!(benches);
