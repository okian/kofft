use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use kofft::fft::{Complex32, FftImpl, ScalarFftImpl};

fn bench_stockham(c: &mut Criterion) {
    let fft = ScalarFftImpl::<f32>::default();
    for &n in &[256usize, 1024, 4096] {
        let mut group = c.benchmark_group(format!("stockham_{n}"));
        let input: Vec<Complex32> = (0..n).map(|i| Complex32::new(i as f32, 0.0)).collect();
        let mut data = input.clone();
        group.bench_function(BenchmarkId::new("stockham", n), |b| {
            b.iter(|| {
                data.copy_from_slice(&input);
                fft.stockham_fft(&mut data).unwrap();
            });
        });
        group.finish();
    }
}

criterion_group!(benches, bench_stockham);
criterion_main!(benches);
