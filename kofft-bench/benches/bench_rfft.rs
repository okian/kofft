use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use kofft::fft::{Complex32, FftPlanner, ScalarFftImpl};
use kofft::rfft::RealFftImpl;
use realfft::RealFftPlanner as RustRealFftPlanner;

#[cfg(all(feature = "aarch64", target_arch = "aarch64"))]
use kofft::fft::SimdFftAarch64Impl;
#[cfg(all(feature = "x86_64", target_arch = "x86_64"))]
use kofft::fft::SimdFftX86_64Impl;

fn bench_rfft(c: &mut Criterion) {
    let mut group = c.benchmark_group("rfft_parity");
    for &size in &[1024usize, 2048, 4096] {
        let mut input: Vec<f32> = (0..size).map(|i| i as f32).collect();
        let mut output = vec![Complex32::new(0.0, 0.0); size / 2 + 1];
        let mut scratch = vec![Complex32::new(0.0, 0.0); size / 2];
        let planner = FftPlanner::<f32>::new();
        let fft = ScalarFftImpl::with_planner(planner);
        group.bench_function(BenchmarkId::new("kofft", size), |b| {
            b.iter(|| {
                fft.rfft_with_scratch(&mut input, &mut output, &mut scratch)
                    .unwrap();
            })
        });

        #[cfg(any(
            all(feature = "x86_64", target_arch = "x86_64"),
            all(feature = "aarch64", target_arch = "aarch64")
        ))]
        {
            let mut simd_out = vec![Complex32::new(0.0, 0.0); size / 2 + 1];
            #[cfg(all(feature = "x86_64", target_arch = "x86_64"))]
            let fft_simd = SimdFftX86_64Impl::default();
            #[cfg(all(feature = "aarch64", target_arch = "aarch64"))]
            let fft_simd = SimdFftAarch64Impl::default();
            group.bench_function(BenchmarkId::new("kofft_simd", size), |b| {
                b.iter(|| {
                    fft_simd
                        .rfft_with_scratch(&mut input, &mut simd_out, &mut scratch)
                        .unwrap();
                })
            });
        }

        let mut planner = RustRealFftPlanner::<f32>::new();
        let rfft = planner.plan_fft_forward(size);
        let mut in_data = input.clone();
        let mut out_data = rfft.make_output_vec();
        group.bench_function(BenchmarkId::new("realfft", size), |b| {
            b.iter(|| {
                rfft.process(&mut in_data, &mut out_data).unwrap();
            })
        });
    }
    group.finish();
}

criterion_group!(benches, bench_rfft);
criterion_main!(benches);
