use criterion::{criterion_group, criterion_main, Criterion};
use kofft::fft::{Complex32, FftImpl, ScalarFftImpl};

fn bench_aos_vs_soa(c: &mut Criterion) {
    let size = 1024;
    let mut aos: Vec<Complex32> = (0..size).map(|i| Complex32::new(i as f32, 0.0)).collect();
    let mut re: Vec<f32> = aos.iter().map(|c| c.re).collect();
    let mut im: Vec<f32> = aos.iter().map(|c| c.im).collect();
    let fft = ScalarFftImpl::<f32>::default();

    c.bench_function("fft_aos", |b| {
        b.iter(|| {
            fft.fft(&mut aos).unwrap();
        });
    });

    c.bench_function("fft_soa", |b| {
        b.iter(|| {
            fft.fft_split(&mut re, &mut im).unwrap();
        });
    });
}

criterion_group!(benches, bench_aos_vs_soa);
criterion_main!(benches);
