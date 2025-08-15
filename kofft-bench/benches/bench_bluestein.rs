use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use kofft::fft::{Complex32, FftImpl, FftPlanner, ScalarFftImpl};

struct CountingAlloc;

static ALLOC: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for CountingAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let ptr = System.alloc(layout);
        if !ptr.is_null() {
            ALLOC.fetch_add(1, Ordering::Relaxed);
        }
        ptr
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        System.dealloc(ptr, layout);
    }
}

#[global_allocator]
static GLOBAL: CountingAlloc = CountingAlloc;

fn reset_alloc() {
    ALLOC.store(0, Ordering::Relaxed);
}
fn allocs() -> usize {
    ALLOC.load(Ordering::Relaxed)
}

fn bench_bluestein(c: &mut Criterion) {
    let mut group = c.benchmark_group("bluestein_alloc");
    let sizes = [3usize, 5, 6, 7, 9, 10, 12, 15, 18, 20, 30, 33];
    for &size in &sizes {
        group.bench_with_input(BenchmarkId::from_parameter(size), &size, |b, &n| {
            let input: Vec<Complex32> = (0..n)
                .map(|i| Complex32::new(i as f32, -(i as f32)))
                .collect();
            let planner = FftPlanner::<f32>::new();
            let fft = ScalarFftImpl::with_planner(planner);
            let mut data = input.clone();
            fft.fft(&mut data).unwrap();
            b.iter_custom(|iters| {
                let mut data = input.clone();
                reset_alloc();
                let mut total = Duration::ZERO;
                for _ in 0..iters {
                    data.clone_from_slice(&input);
                    let start = Instant::now();
                    fft.fft(&mut data).unwrap();
                    total += start.elapsed();
                    assert_eq!(allocs(), 0);
                }
                total
            });
        });
    }
    group.finish();
}

criterion_group!(benches, bench_bluestein);
criterion_main!(benches);
