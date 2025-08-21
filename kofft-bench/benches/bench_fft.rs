use std::alloc::{GlobalAlloc, Layout, System};
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use std::{env, fs, process::Command};

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

#[cfg(feature = "parallel")]
use kofft::fft::fft_parallel;
use kofft::fft::{Complex32, FftImpl, FftPlanner, FftStrategy, ScalarFftImpl};
use kofft::rfft::{rfft_packed, RealFftImpl, RfftPlanner};
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
#[derive(Serialize, Deserialize, Clone)]
struct BenchRecord {
    library: String,
    transform: String,
    size: usize,
    mode: String,
    time_per_op_ns: f64,
    ops_per_sec: f64,
    allocations: usize,
    peak_bytes: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    prev_time_per_op_ns: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    change_vs_prev: Option<f64>,
    best: bool,
}

#[derive(Serialize, Deserialize)]
struct BenchFile {
    env: EnvInfo,
    results: Vec<BenchRecord>,
}

#[derive(Serialize, Deserialize)]
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

    let input: Vec<Complex32> = (0..size).map(|i| Complex32::new(i as f32, 0.0)).collect();
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
                    prev_time_per_op_ns: None,
                    change_vs_prev: None,
                    best: false,
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
                        prev_time_per_op_ns: None,
                        change_vs_prev: None,
                        best: false,
                    });
                    first_p = false;
                }
                total
            });
        });
    }

    // fft_with_strategy benchmarks
    let mut run_strategy = |mode_label: &str, strategy: FftStrategy| {
        let bench_label = format!("kofft/{}", mode_label.to_lowercase());
        let mut first_s = true;
        group.bench_function(BenchmarkId::new(bench_label, size), |b| {
            b.iter_custom(|iters| {
                let mut total = Duration::ZERO;
                let mut alloc_total = 0;
                let mut peak = 0;
                for _ in 0..iters {
                    data.copy_from_slice(&input);
                    reset_alloc();
                    let start = Instant::now();
                    fft.fft_with_strategy(&mut data, strategy).unwrap();
                    let dur = start.elapsed();
                    let (a, p) = alloc_stats();
                    alloc_total += a;
                    if p > peak {
                        peak = p;
                    }
                    total += dur;
                }
                if first_s {
                    let t = total.as_secs_f64() / iters as f64;
                    RESULTS.lock().unwrap().push(BenchRecord {
                        library: "kofft".into(),
                        transform: "Complex".into(),
                        size,
                        mode: mode_label.into(),
                        time_per_op_ns: t * 1e9,
                        ops_per_sec: 1.0 / t,
                        allocations: alloc_total / iters as usize,
                        peak_bytes: peak,
                        prev_time_per_op_ns: None,
                        change_vs_prev: None,
                        best: false,
                    });
                    first_s = false;
                }
                total
            });
        });
    };
    run_strategy("Radix2", FftStrategy::Radix2);
    run_strategy("Radix4", FftStrategy::Radix4);
    run_strategy("SplitRadix", FftStrategy::SplitRadix);
    run_strategy("Auto", FftStrategy::Auto);

    // rustfft single-threaded
    let mut rust_planner = RustFftPlanner::<f32>::new();
    let rust_fft = rust_planner.plan_fft_forward(size);
    let rust_input: Vec<rustfft::num_complex::Complex<f32>> = (0..size)
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
                    prev_time_per_op_ns: None,
                    change_vs_prev: None,
                    best: false,
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
    let input_template = input.clone();

    // kofft real direct
    let planner = FftPlanner::<f32>::new();
    let fft = ScalarFftImpl::with_planner(planner);
    let mut first = true;
    group.bench_function(BenchmarkId::new("kofft/direct", size), |b| {
        b.iter_custom(|iters| {
            let mut total = Duration::ZERO;
            let mut alloc_total = 0;
            let mut peak = 0;
            for _ in 0..iters {
                input.copy_from_slice(&input_template);
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
                    mode: "Direct".into(),
                    time_per_op_ns: t * 1e9,
                    ops_per_sec: 1.0 / t,
                    allocations: alloc_total / iters as usize,
                    peak_bytes: peak,
                    prev_time_per_op_ns: None,
                    change_vs_prev: None,
                    best: false,
                });
                first = false;
            }
            total
        });
    });

    // kofft packed (legacy)
    let mut first_packed = true;
    group.bench_function(BenchmarkId::new("kofft/packed", size), |b| {
        b.iter_custom(|iters| {
            let mut total = Duration::ZERO;
            let mut alloc_total = 0;
            let mut peak = 0;
            let mut planner = RfftPlanner::<f32>::new().unwrap();
            for _ in 0..iters {
                input.copy_from_slice(&input_template);
                reset_alloc();
                let start = Instant::now();
                rfft_packed(&mut planner, &fft, &mut input, &mut output, &mut scratch).unwrap();
                let dur = start.elapsed();
                let (a, p) = alloc_stats();
                alloc_total += a;
                if p > peak {
                    peak = p;
                }
                total += dur;
            }
            if first_packed {
                let t = total.as_secs_f64() / iters as f64;
                RESULTS.lock().unwrap().push(BenchRecord {
                    library: "kofft".into(),
                    transform: "Real".into(),
                    size,
                    mode: "Packed".into(),
                    time_per_op_ns: t * 1e9,
                    ops_per_sec: 1.0 / t,
                    allocations: alloc_total / iters as usize,
                    peak_bytes: peak,
                    prev_time_per_op_ns: None,
                    change_vs_prev: None,
                    best: false,
                });
                first_packed = false;
            }
            total
        });
    });

    // realfft crate
    let mut planner = RustRealFftPlanner::<f32>::new();
    let rfft = planner.plan_fft_forward(size);
    let mut in_data = input_template.clone();
    let mut out_data = rfft.make_output_vec();
    let mut first_realfft = true;
    group.bench_function(BenchmarkId::new("realfft/single", size), |b| {
        b.iter_custom(|iters| {
            let mut total = Duration::ZERO;
            let mut alloc_total = 0;
            let mut peak = 0;
            for _ in 0..iters {
                in_data.copy_from_slice(&input_template);
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
                    prev_time_per_op_ns: None,
                    change_vs_prev: None,
                    best: false,
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

    let prev = fs::read("../benchmarks/latest.json")
        .ok()
        .and_then(|d| serde_json::from_slice::<BenchFile>(&d).ok());

    let mut results = RESULTS.lock().unwrap().clone();
    let mut prev_map = HashMap::new();
    if let Some(p) = &prev {
        for r in &p.results {
            prev_map.insert(
                (
                    r.library.clone(),
                    r.transform.clone(),
                    r.size,
                    r.mode.clone(),
                ),
                r.time_per_op_ns,
            );
        }
    }

    for r in &mut results {
        if let Some(prev_time) = prev_map.get(&(
            r.library.clone(),
            r.transform.clone(),
            r.size,
            r.mode.clone(),
        )) {
            r.prev_time_per_op_ns = Some(*prev_time);
            r.change_vs_prev = Some((*prev_time - r.time_per_op_ns) / *prev_time * 100.0);
        }
    }

    let mut best_map: HashMap<(String, usize), f64> = HashMap::new();
    for r in &results {
        let key = (r.transform.clone(), r.size);
        let entry = best_map.entry(key).or_insert(r.time_per_op_ns);
        if r.time_per_op_ns < *entry {
            *entry = r.time_per_op_ns;
        }
    }
    for r in &mut results {
        let key = (r.transform.clone(), r.size);
        if let Some(best) = best_map.get(&key) {
            if (r.time_per_op_ns - *best).abs() < f64::EPSILON {
                r.best = true;
            }
        }
    }

    results.sort_by(|a, b| {
        a.transform
            .cmp(&b.transform)
            .then_with(|| a.size.cmp(&b.size))
            .then_with(|| a.time_per_op_ns.partial_cmp(&b.time_per_op_ns).unwrap())
    });

    let file = BenchFile {
        env: EnvInfo {
            cpu,
            os,
            rustc,
            flags,
            date: date.clone(),
            runner,
        },
        results,
    };
    let json = serde_json::to_string_pretty(&file).unwrap();
    fs::create_dir_all("../benchmarks").unwrap();
    if prev.is_some() {
        let _ = fs::rename("../benchmarks/latest.json", "../benchmarks/previous.json");
    }
    fs::write("../benchmarks/latest.json", json).unwrap();
}

fn main_bench(c: &mut Criterion) {
    let sizes: Vec<usize> = env::var("KOFFT_BENCH_POWERS")
        .ok()
        .map(|s| {
            s.split(',')
                .filter_map(|p| p.trim().parse::<u32>().ok())
                .map(|p| 1usize << p)
                .collect()
        })
        .unwrap_or_else(|| (10..=20).map(|p| 1usize << p).collect());
    for size in sizes {
        bench_complex(c, size);
        bench_real(c, size);
    }
    save_results();
}

criterion_group!(benches, main_bench);
criterion_main!(benches);
