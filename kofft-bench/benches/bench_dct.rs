use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use kofft::dct;
use kofft::dct::slow as dct_slow;

fn bench_dct2(c: &mut Criterion) {
    let mut group = c.benchmark_group("dct2");
    for &size in &[64usize, 256, 1024] {
        let data: Vec<f32> = (0..size).map(|i| i as f32).collect();
        group.bench_with_input(BenchmarkId::new("fast", size), &data, |b, input| {
            b.iter(|| dct::dct2(input));
        });
        group.bench_with_input(BenchmarkId::new("slow", size), &data, |b, input| {
            b.iter(|| dct_slow::dct2(input));
        });
    }
    group.finish();
}

fn bench_dct3(c: &mut Criterion) {
    let mut group = c.benchmark_group("dct3");
    for &size in &[64usize, 256, 1024] {
        let data: Vec<f32> = (0..size).map(|i| i as f32).collect();
        group.bench_with_input(BenchmarkId::new("fast", size), &data, |b, input| {
            b.iter(|| dct::dct3(input));
        });
        group.bench_with_input(BenchmarkId::new("slow", size), &data, |b, input| {
            b.iter(|| dct_slow::dct3(input));
        });
    }
    group.finish();
}

fn bench_dct4(c: &mut Criterion) {
    let mut group = c.benchmark_group("dct4");
    for &size in &[64usize, 256, 1024] {
        let data: Vec<f32> = (0..size).map(|i| i as f32).collect();
        group.bench_with_input(BenchmarkId::new("fast", size), &data, |b, input| {
            b.iter(|| dct::dct4(input));
        });
        group.bench_with_input(BenchmarkId::new("slow", size), &data, |b, input| {
            b.iter(|| dct_slow::dct4(input));
        });
    }
    group.finish();
}

criterion_group!(benches, bench_dct2, bench_dct3, bench_dct4);
criterion_main!(benches);
