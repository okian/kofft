use criterion::{criterion_group, criterion_main, Criterion};
use kofft::fft::{Complex32, FftPlanner, ScalarFftImpl};
use kofft::ndfft::{fft2d_inplace, fft3d_inplace, Fft3dScratch};

fn bench_fft2d(c: &mut Criterion) {
    let rows = 128;
    let cols = 128;
    let planner = FftPlanner::new();
    let fft = ScalarFftImpl::<f32>::with_planner(planner);
    let mut data = vec![Complex32::zero(); rows * cols];
    let mut scratch = vec![Complex32::zero(); rows * cols];
    c.bench_function("fft2d", |b| {
        b.iter(|| {
            fft2d_inplace(&mut data, rows, cols, &fft, &mut scratch).unwrap();
        });
    });
}

fn bench_fft3d(c: &mut Criterion) {
    let depth = 32;
    let rows = 32;
    let cols = 32;
    let planner = FftPlanner::new();
    let fft = ScalarFftImpl::<f32>::with_planner(planner);
    let mut data = vec![Complex32::zero(); depth * rows * cols];
    let mut plane = vec![Complex32::zero(); rows * cols];
    let mut volume = vec![Complex32::zero(); depth * rows * cols];
    let mut scratch = Fft3dScratch {
        plane: &mut plane,
        volume: &mut volume,
    };
    c.bench_function("fft3d", |b| {
        b.iter(|| {
            fft3d_inplace(&mut data, depth, rows, cols, &fft, &mut scratch).unwrap();
        });
    });
}

criterion_group!(benches, bench_fft2d, bench_fft3d);
criterion_main!(benches);
