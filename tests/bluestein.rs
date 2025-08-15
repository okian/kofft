use kofft::fft::{Complex32, FftImpl, FftPlanner, ScalarFftImpl};
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};

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

fn dft(input: &[Complex32]) -> Vec<Complex32> {
    let len = input.len();
    (0..len)
        .map(|k| {
            let mut sum = Complex32::new(0.0, 0.0);
            for (n, &x) in input.iter().enumerate() {
                let angle = -2.0 * std::f32::consts::PI * k as f32 * n as f32 / len as f32;
                let tw = Complex32::new(angle.cos(), angle.sin());
                sum = sum + x * tw;
            }
            sum
        })
        .collect()
}

#[test]
fn bluestein_fft_matches_dft_and_reuses_scratch() {
    let n = 15;
    let input: Vec<Complex32> = (0..n)
        .map(|i| Complex32::new(i as f32, -(i as f32)))
        .collect();
    let expected = dft(&input);

    let planner = FftPlanner::<f32>::new();
    let fft = ScalarFftImpl::with_planner(planner);
    let mut data = input.clone();
    fft.fft(&mut data).unwrap();
    for (a, b) in data.iter().zip(expected.iter()) {
        assert!((a.re - b.re).abs() < 1e-3 && (a.im - b.im).abs() < 1e-3);
    }

    reset_alloc();
    fft.fft(&mut data).unwrap();
    assert_eq!(allocs(), 0);
}
