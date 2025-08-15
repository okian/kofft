//! Demonstrates DCT-II planner reuse and timing differences.
//!
//! Run with: `cargo run --example dct_usage --release`
//! The first timing recomputes the cosine table each iteration.
//! The second timing reuses a precomputed table for faster execution.
//!
//! See `benchmarks/latest.json` for up-to-date transform benchmarks.

use std::hint::black_box;
use std::time::Instant;

/// Naive DCT-II implementation that recomputes cosines each call.
fn dct2_naive(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0f32; n];
    let factor = std::f32::consts::PI / n as f32;
    for k in 0..n {
        let mut sum = 0.0;
        for i in 0..n {
            sum += input[i] * (factor * (i as f32 + 0.5) * k as f32).cos();
        }
        output[k] = sum;
    }
    output
}

/// Planner that caches cosine values for DCT-II.
struct Dct2Planner {
    cos_table: Vec<Vec<f32>>,
}

impl Dct2Planner {
    fn new(n: usize) -> Self {
        let factor = std::f32::consts::PI / n as f32;
        let mut cos_table = vec![vec![0.0f32; n]; n];
        for k in 0..n {
            for i in 0..n {
                cos_table[k][i] = (factor * (i as f32 + 0.5) * k as f32).cos();
            }
        }
        Self { cos_table }
    }

    fn dct2(&self, input: &[f32]) -> Vec<f32> {
        let n = input.len();
        let mut output = vec![0.0f32; n];
        for k in 0..n {
            let mut sum = 0.0;
            for i in 0..n {
                sum += input[i] * self.cos_table[k][i];
            }
            output[k] = sum;
        }
        output
    }
}

fn main() {
    let n = 1024;
    let input: Vec<f32> = (0..n).map(|x| x as f32).collect();
    let iterations = 50;

    // Naive implementation
    let start = Instant::now();
    for _ in 0..iterations {
        black_box(dct2_naive(&input));
    }
    let naive = start.elapsed().as_secs_f64() / iterations as f64;
    println!("Naive DCT-II: {:.6} s per run", naive);

    // Planner-based implementation
    let planner = Dct2Planner::new(n);
    let start = Instant::now();
    for _ in 0..iterations {
        black_box(planner.dct2(&input));
    }
    let planned = start.elapsed().as_secs_f64() / iterations as f64;
    println!("Planned DCT-II: {:.6} s per run", planned);
}
