use std::{
    collections::HashMap,
    env,
    fs,
    process::Command,
    sync::Mutex,
    time::{Duration, Instant},
};

use criterion::{criterion_main, BenchmarkId, Criterion};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

use kofft::dct;
use kofft::dct::slow as dct_slow;
use kofft::dst;

// ---- Slow DST implementations (naive) ----
mod dst_slow {
    pub fn dst2(input: &[f32]) -> Vec<f32> {
        let n = input.len();
        let mut output = vec![0.0; n];
        let factor = std::f32::consts::PI / n as f32;
        for (k, out) in output.iter_mut().enumerate() {
            let mut sum = 0.0;
            for (i, &x) in input.iter().enumerate() {
                sum += x * (factor * (i as f32 + 0.5) * (k as f32 + 1.0)).sin();
            }
            *out = sum;
        }
        output
    }

    pub fn dst3(input: &[f32]) -> Vec<f32> {
        let n = input.len();
        let mut output = vec![0.0; n];
        let factor = std::f32::consts::PI / n as f32;
        for (k, out) in output.iter_mut().enumerate() {
            let mut sum = input[0] / 2.0;
            for (i, &x) in input.iter().enumerate().skip(1) {
                sum += x * (factor * (k as f32 + 0.5) * i as f32).sin();
            }
            *out = sum;
        }
        output
    }

    pub fn dst4(input: &[f32]) -> Vec<f32> {
        let n = input.len();
        let mut output = vec![0.0; n];
        let factor = std::f32::consts::PI / n as f32;
        for (k, out) in output.iter_mut().enumerate() {
            let mut sum = 0.0;
            for (i, &x) in input.iter().enumerate() {
                sum += x * (factor * (i as f32 + 0.5) * (k as f32 + 0.5)).sin();
            }
            *out = sum;
        }
        output
    }
}

// ---- Benchmark result recording ----
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

fn bench_transform<F>(
    group: &mut criterion::BenchmarkGroup<'_, criterion::measurement::WallTime>,
    transform: &str,
    mode: &str,
    size: usize,
    func: F,
)
where
    F: Fn(&[f32]) -> Vec<f32>,
{
    let data: Vec<f32> = (0..size).map(|i| i as f32).collect();
    let mut first = true;
    group.bench_function(BenchmarkId::new(mode, size), |b| {
        b.iter_custom(|iters| {
            let mut total = Duration::ZERO;
            for _ in 0..iters {
                let start = Instant::now();
                let _ = func(&data);
                total += start.elapsed();
            }
            if first {
                let t = total.as_secs_f64() / iters as f64;
                RESULTS.lock().unwrap().push(BenchRecord {
                    library: "kofft".into(),
                    transform: transform.into(),
                    size,
                    mode: mode.into(),
                    time_per_op_ns: t * 1e9,
                    ops_per_sec: 1.0 / t,
                    allocations: 0,
                    peak_bytes: 0,
                    prev_time_per_op_ns: None,
                    change_vs_prev: None,
                    best: false,
                });
                first = false;
            }
            total
        });
    });
}

fn bench_dct2(c: &mut Criterion) {
    let mut group = c.benchmark_group("dct2");
    for &size in &[64usize, 256, 1024] {
        bench_transform(&mut group, "DCT-II", "fast", size, dct::dct2);
        bench_transform(&mut group, "DCT-II", "slow", size, dct_slow::dct2);
    }
    group.finish();
}

fn bench_dct3(c: &mut Criterion) {
    let mut group = c.benchmark_group("dct3");
    for &size in &[64usize, 256, 1024] {
        bench_transform(&mut group, "DCT-III", "fast", size, dct::dct3);
        bench_transform(&mut group, "DCT-III", "slow", size, dct_slow::dct3);
    }
    group.finish();
}

fn bench_dct4(c: &mut Criterion) {
    let mut group = c.benchmark_group("dct4");
    for &size in &[64usize, 256, 1024] {
        bench_transform(&mut group, "DCT-IV", "fast", size, dct::dct4);
        bench_transform(&mut group, "DCT-IV", "slow", size, dct_slow::dct4);
    }
    group.finish();
}

fn bench_dst2(c: &mut Criterion) {
    let mut group = c.benchmark_group("dst2");
    for &size in &[64usize, 256, 1024] {
        bench_transform(&mut group, "DST-II", "fast", size, dst::dst2);
        bench_transform(&mut group, "DST-II", "slow", size, dst_slow::dst2);
    }
    group.finish();
}

fn bench_dst3(c: &mut Criterion) {
    let mut group = c.benchmark_group("dst3");
    for &size in &[64usize, 256, 1024] {
        bench_transform(&mut group, "DST-III", "fast", size, dst::dst3);
        bench_transform(&mut group, "DST-III", "slow", size, dst_slow::dst3);
    }
    group.finish();
}

fn bench_dst4(c: &mut Criterion) {
    let mut group = c.benchmark_group("dst4");
    for &size in &[64usize, 256, 1024] {
        bench_transform(&mut group, "DST-IV", "fast", size, dst::dst4);
        bench_transform(&mut group, "DST-IV", "slow", size, dst_slow::dst4);
    }
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
    bench_dct2(c);
    bench_dct3(c);
    bench_dct4(c);
    bench_dst2(c);
    bench_dst3(c);
    bench_dst4(c);
    save_results();
}
criterion::criterion_group!(benches, main_bench);
criterion_main!(benches);

