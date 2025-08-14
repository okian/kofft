//! Compare scalar and SIMD FFT performance.
//!
//! Build with architecture-specific features and CPU flags, e.g.:
//! `RUSTFLAGS="-C target-cpu=native" cargo run --release --example simd_speedup --features x86_64`

use std::time::Instant;

use kofft::fft::{new_fft_impl, Complex32, FftImpl, ScalarFftImpl};

fn main() {
    let size = 1 << 14;
    let data: Vec<Complex32> = (0..size)
        .map(|i| Complex32::new(i as f32, 0.0))
        .collect();

    // Scalar implementation
    let mut scalar_data = data.clone();
    let scalar = ScalarFftImpl::<f32>::default();
    let start = Instant::now();
    scalar.fft(&mut scalar_data).unwrap();
    let scalar_time = start.elapsed();

    // Best available implementation (SIMD when enabled)
    let mut simd_data = data.clone();
    let simd = new_fft_impl();
    let start = Instant::now();
    simd.fft(&mut simd_data).unwrap();
    let simd_time = start.elapsed();

    println!("Scalar FFT: {:?}", scalar_time);
    println!("SIMD FFT:   {:?}", simd_time);
    if simd_time.as_nanos() > 0 {
        println!("Speedup: {:.2}x", scalar_time.as_secs_f64() / simd_time.as_secs_f64());
    }
}

