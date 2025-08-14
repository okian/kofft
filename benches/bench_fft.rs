use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use std::{env, fs, process::Command};

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use once_cell::sync::Lazy;
use serde::Serialize;

use kofft::fft::{fft_parallel, Complex32, FftImpl, FftPlanner, ScalarFftImpl};
use kofft::rfft::RealFftImpl;
use realfft::RealFftPlanner as RustRealFftPlanner;
use rustfft::FftPlanner as RustFftPlanner;

// ---------------- Allocation tracking ----------------
struct CountingAllocator;

static ALLOCATIONS: AtomicUsize = AtomicUsize::new(0);
static CURRENT_BYTES: AtomicUsize = AtomicUsize::new(0);
static PEAK_BYTES: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let ptr = System.alloc(layout);
        if !ptr.is_null() {
            ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
            let new = CURRENT_BYTES.fetch_add(layout.size(), Ordering::Relaxed) + layout.size();
            update_peak(new);
        }
        ptr
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        System.dealloc(ptr, layout);
        CURRENT_BYTES.fetch_sub(layout.size(), Ordering::Relaxed);
    }
}

#[global_allocator]
static GLOBAL: CountingAllocator = CountingAllocator;

fn update_peak(new: usize) {
    let mut peak = PEAK_BYTES.load(Ordering::Relaxed);
    while new > peak {
        match PEAK_BYTES.compare_exchange(peak, new, Ordering::Relaxed, Ordering::Relaxed) {
            Ok(_) => break,
            Err(old) => peak = old,
        }
    }
}

fn reset_alloc() {
    ALLOCATIONS.store(0, Ordering::Relaxed);
    CURRENT_BYTES.store(0, Ordering::Relaxed);
    PEAK_BYTES.store(0, Ordering::Relaxed);
}

fn alloc_stats() -> (usize, usize) {
    (
        ALLOCATIONS.load(Ordering::Relaxed),
        PEAK_BYTES.load(Ordering::Relaxed),
    )
}

// ---------------- Result tracking ----------------
#[derive(Serialize, Clone)]
struct BenchRecord {
    library: String,
    transform: String,
    size: usize,
    mode: String,
    time_per_op_ns: f64,
    ops_per_sec: f64,
    allocations: usize,
    peak_bytes: usize,
}

#[derive(Serialize)]
struct BenchFile {
    env: EnvInfo,
    results: Vec<BenchRecord>,
}

#[derive(Serialize)]
struct EnvInfo {
    cpu: String,
    os: String,
    rustc: String,
    flags: String,
    date: String,
    runner: String,
}

static RESULTS: Lazy<Mutex<Vec<BenchRecord>>> = Lazy::new(|| Mutex::new(Vec::new()));

// ---------------- Benchmark helpers ----------------
fn bench_complex(c: &mut Criterion, size: usize) {
    let mut group = c.benchmark_group(format!("complex_{}", size));

    let mut input: Vec<Complex32> = (0..size).map(|i| Complex32::new(i as f32, 0.0)).collect();
    let mut data = input.clone();

    // kofft single-threaded
    let planner = FftPlanner::<f32>::new();
    let fft = ScalarFftImpl::with_planner(planner);
    let mut first = true;
    group.bench_function(BenchmarkId::new("kofft/single", size), |b| {
        b.iter_custom(|iters| {
            let mut total = Duration::ZERO;
            let mut alloc_total = 0;
            let mut peak = 0;
            for _ in 0..iters {
                data.copy_from_slice(&input);
                reset_alloc();
                let start = Instant::now();
                fft.fft(&mut data).unwrap();
                let dur = start.elapsed();
                let (a, p) = alloc_stats();
                alloc_total += a;
                if p > peak {
                    peak = p;
                }
                total += dur;
            }
            if first {
                let t = total.as_secs_f64() / iters as f64;
                RESULTS.lock().unwrap().push(BenchRecord {
                    library: "kofft".into(),
                    transform: "Complex".into(),
                    size,
                    mode: "Single".into(),
                    time_per_op_ns: t * 1e9,
                    ops_per_sec: 1.0 / t,
                    allocations: alloc_total / iters as usize,
                    peak_bytes: peak,
                });
                first = false;
            }
            total
        });
    });

    // kofft parallel (if enabled)
    #[cfg(feature = "parallel")]
    {
        let mut first_p = true;
        group.bench_function(BenchmarkId::new("kofft/parallel", size), |b| {
            b.iter_custom(|iters| {
                let mut total = Duration::ZERO;
                let mut alloc_total = 0;
                let mut peak = 0;
                for _ in 0..iters {
                    data.copy_from_slice(&input);
                    reset_alloc();
                    let start = Instant::now();
                    fft_parallel(&mut data).unwrap();
                    let dur = start.elapsed();
                    let (a, p) = alloc_stats();
                    alloc_total += a;
                    if p > peak {
                        peak = p;
                    }
                    total += dur;
                }
                if first_p {
                    let t = total.as_secs_f64() / iters as f64;
                    RESULTS.lock().unwrap().push(BenchRecord {
                        library: "kofft".into(),
                        transform: "Complex".into(),
                        size,
                        mode: "Parallel".into(),
                        time_per_op_ns: t * 1e9,
                        ops_per_sec: 1.0 / t,
                        allocations: alloc_total / iters as usize,
                        peak_bytes: peak,
                    });
                    first_p = false;
                }
                total
            });
        });
    }

    // rustfft single-threaded
    let mut rust_planner = RustFftPlanner::<f32>::new();
    let rust_fft = rust_planner.plan_fft_forward(size);
    let mut rust_input: Vec<rustfft::num_complex::Complex<f32>> = (0..size)
        .map(|i| rustfft::num_complex::Complex::new(i as f32, 0.0))
        .collect();
    let mut rust_data = rust_input.clone();
    let mut first_rust = true;
    group.bench_function(BenchmarkId::new("rustfft/single", size), |b| {
        b.iter_custom(|iters| {
            let mut total = Duration::ZERO;
            let mut alloc_total = 0;
            let mut peak = 0;
            for _ in 0..iters {
                rust_data.copy_from_slice(&rust_input);
                reset_alloc();
                let start = Instant::now();
                rust_fft.process(&mut rust_data);
                let dur = start.elapsed();
                let (a, p) = alloc_stats();
                alloc_total += a;
                if p > peak {
                    peak = p;
                }
                total += dur;
            }
            if first_rust {
                let t = total.as_secs_f64() / iters as f64;
                RESULTS.lock().unwrap().push(BenchRecord {
                    library: "rustfft".into(),
                    transform: "Complex".into(),
                    size,
                    mode: "Single".into(),
                    time_per_op_ns: t * 1e9,
                    ops_per_sec: 1.0 / t,
                    allocations: alloc_total / iters as usize,
                    peak_bytes: peak,
                });
                first_rust = false;
            }
            total
        });
    });

    group.finish();
}

fn bench_real(c: &mut Criterion, size: usize) {
    let mut group = c.benchmark_group(format!("real_{}", size));

    let mut input: Vec<f32> = (0..size).map(|i| i as f32).collect();
    let mut output = vec![Complex32::new(0.0, 0.0); size / 2 + 1];
    let mut scratch = vec![Complex32::new(0.0, 0.0); size / 2];

    // kofft real
    let planner = FftPlanner::<f32>::new();
    let fft = ScalarFftImpl::with_planner(planner);
    let mut first = true;
    group.bench_function(BenchmarkId::new("kofft/single", size), |b| {
        b.iter_custom(|iters| {
            let mut total = Duration::ZERO;
            let mut alloc_total = 0;
            let mut peak = 0;
            for _ in 0..iters {
                reset_alloc();
                let start = Instant::now();
                fft.rfft_with_scratch(&mut input, &mut output, &mut scratch)
                    .unwrap();
                let dur = start.elapsed();
                let (a, p) = alloc_stats();
                alloc_total += a;
                if p > peak {
                    peak = p;
                }
                total += dur;
            }
            if first {
                let t = total.as_secs_f64() / iters as f64;
                RESULTS.lock().unwrap().push(BenchRecord {
                    library: "kofft".into(),
                    transform: "Real".into(),
                    size,
                    mode: "Single".into(),
                    time_per_op_ns: t * 1e9,
                    ops_per_sec: 1.0 / t,
                    allocations: alloc_total / iters as usize,
                    peak_bytes: peak,
                });
                first = false;
            }
            total
        });
    });

    // realfft crate
    let mut planner = RustRealFftPlanner::<f32>::new();
    let rfft = planner.plan_fft_forward(size);
    let mut in_data = input.clone();
    let mut out_data = rfft.make_output_vec();
    let mut first_realfft = true;
    group.bench_function(BenchmarkId::new("realfft/single", size), |b| {
        b.iter_custom(|iters| {
            let mut total = Duration::ZERO;
            let mut alloc_total = 0;
            let mut peak = 0;
            for _ in 0..iters {
                in_data.copy_from_slice(&input);
                reset_alloc();
                let start = Instant::now();
                rfft.process(&mut in_data, &mut out_data).unwrap();
                let dur = start.elapsed();
                let (a, p) = alloc_stats();
                alloc_total += a;
                if p > peak {
                    peak = p;
                }
                total += dur;
            }
            if first_realfft {
                let t = total.as_secs_f64() / iters as f64;
                RESULTS.lock().unwrap().push(BenchRecord {
                    library: "realfft".into(),
                    transform: "Real".into(),
                    size,
                    mode: "Single".into(),
                    time_per_op_ns: t * 1e9,
                    ops_per_sec: 1.0 / t,
                    allocations: alloc_total / iters as usize,
                    peak_bytes: peak,
                });
                first_realfft = false;
            }
            total
        });
    });

    group.finish();
}

fn save_results() {
    let cpu = Command::new("sh")
        .arg("-c")
        .arg("grep 'model name' /proc/cpuinfo | head -n1 | cut -d: -f2")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default()
        .trim()
        .to_string();
    let os = Command::new("uname")
        .arg("-srmo")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default()
        .trim()
        .to_string();
    let rustc = Command::new("rustc")
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default()
        .trim()
        .to_string();
    let flags = env::var("RUSTFLAGS").unwrap_or_default();
    let date = chrono::Utc::now().to_rfc3339();
    let runner = env::var("RUNNER_NAME").unwrap_or_else(|_| "local".to_string());

    let file = BenchFile {
        env: EnvInfo {
            cpu,
            os,
            rustc,
            flags,
            date: date.clone(),
            runner,
        },
        results: RESULTS.lock().unwrap().clone(),
    };
    let json = serde_json::to_string_pretty(&file).unwrap();
    fs::create_dir_all("benchmarks").unwrap();
    fs::write("benchmarks/latest.json", json).unwrap();
}

fn main_bench(c: &mut Criterion) {
    let sizes: Vec<usize> = (10..=20).map(|p| 1usize << p).collect();
    for size in sizes {
        bench_complex(c, size);
        bench_real(c, size);
    }
    save_results();
}

criterion_group!(benches, main_bench);
criterion_main!(benches);
