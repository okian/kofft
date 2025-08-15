use criterion::{criterion_group, criterion_main, Criterion};
use kofft::fft::{Complex32, FftImpl, ScalarFftImpl};

fn bench_small_fft(c: &mut Criterion) {
    let fft = ScalarFftImpl::<f32>::default();
    for &n in &[2usize, 4, 8, 16] {
        let mut group = c.benchmark_group(format!("fft_{}", n));
        let input: Vec<Complex32> = (0..n).map(|i| Complex32::new(i as f32, 0.0)).collect();
        let mut data = input.clone();
        group.bench_function("fft", |b| {
            b.iter(|| {
                data.copy_from_slice(&input);
                fft.fft(&mut data).unwrap();
            });
        });
        group.finish();
    }
}

criterion_group!(benches, bench_small_fft);
criterion_main!(benches);
