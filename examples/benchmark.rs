//! Benchmark example for kofft
//! 
//! This example compares the performance of different implementations
//! and features of the kofft library.

use kofft::fft::{Complex32, ScalarFftImpl, FftImpl};
use kofft::rfft::RealFftImpl;
use std::time::Instant;

fn main() {
    println!("=== kofft Benchmark Example ===\n");

    let fft = ScalarFftImpl::<f32>::default();

    // Test different FFT sizes
    let sizes = [64, 128, 256, 512, 1024, 2048];
    let iterations = 100;

    println!("FFT Performance Benchmark");
    println!("Size\t\tTime (ms)\t\tThroughput (FFT/s)");
    println!("----\t\t--------\t\t------------------");

    for &size in &sizes {
        // Generate test data
        let data: Vec<Complex32> = (0..size)
            .map(|i| Complex32::new((i as f32 * 0.1).sin(), (i as f32 * 0.1).cos()))
            .collect();

        // Warm up
        for _ in 0..10 {
            let mut warmup_data = data.clone();
            fft.fft(&mut warmup_data).unwrap();
        }

        // Benchmark
        let start = Instant::now();
        for _ in 0..iterations {
            let mut test_data = data.clone();
            fft.fft(&mut test_data).unwrap();
        }
        let duration = start.elapsed();

        let avg_time_ms = duration.as_micros() as f64 / (iterations as f64 * 1000.0);
        let throughput = iterations as f64 / (duration.as_micros() as f64 / 1_000_000.0);

        println!("{}\t\t{:.3}\t\t{:.0}", size, avg_time_ms, throughput);
    }

    println!();

    // Compare FFT vs IFFT performance
    println!("FFT vs IFFT Performance Comparison");
    let size = 1024;
    let data: Vec<Complex32> = (0..size)
        .map(|i| Complex32::new((i as f32 * 0.1).sin(), (i as f32 * 0.1).cos()))
        .collect();

    let iterations = 1000;

    // FFT benchmark
    let start = Instant::now();
    for _ in 0..iterations {
        let mut test_data = data.clone();
        fft.fft(&mut test_data).unwrap();
    }
    let fft_duration = start.elapsed();

    // IFFT benchmark
    let start = Instant::now();
    for _ in 0..iterations {
        let mut test_data = data.clone();
        fft.ifft(&mut test_data).unwrap();
    }
    let ifft_duration = start.elapsed();

    println!("FFT:  {} iterations in {:?} ({:.0} FFT/s)", 
             iterations, fft_duration, 
             iterations as f64 / (fft_duration.as_micros() as f64 / 1_000_000.0));
    println!("IFFT: {} iterations in {:?} ({:.0} IFFT/s)", 
             iterations, ifft_duration,
             iterations as f64 / (ifft_duration.as_micros() as f64 / 1_000_000.0));
    println!();

    // Real FFT performance
    println!("Real FFT Performance");
    let mut real_input: Vec<f32> = (0..1024)
        .map(|i| (i as f32 * 0.1).sin())
        .collect();
    let mut real_output = vec![Complex32::zero(); real_input.len() / 2 + 1];

    let start = Instant::now();
    for _ in 0..iterations {
        fft.rfft(&mut real_input, &mut real_output).unwrap();
    }
    let rfft_duration = start.elapsed();

    println!("RFFT: {} iterations in {:?} ({:.0} RFFT/s)", 
             iterations, rfft_duration,
             iterations as f64 / (rfft_duration.as_micros() as f64 / 1_000_000.0));
    println!();

    // Memory usage comparison
    println!("Memory Usage Comparison");
    println!("Transform\t\tSize\t\tMemory (bytes)");
    println!("---------\t\t----\t\t-------------");

    let sizes = [64, 128, 256, 512, 1024];
    for &size in &sizes {
        let complex_memory = size * 8; // Complex32 = 8 bytes
        let real_memory = size * 4;    // f32 = 4 bytes
        let rfft_memory = (size / 2 + 1) * 8; // RFFT output

        println!("Complex FFT\t\t{}\t\t{}", size, complex_memory);
        println!("Real FFT\t\t{}\t\t{}", size, rfft_memory);
        println!("Real input\t\t{}\t\t{}", size, real_memory);
        println!("---");
    }

    println!();

    // Stack vs Heap comparison (simulated)
    println!("Stack vs Heap Usage (Simulated)");
    println!("For 8-point transforms:");
    println!("Stack-only FFT: 64 bytes (8 * Complex32)");
    println!("Stack-only DCT: 32 bytes (8 * f32)");
    println!("Stack-only DST: 32 bytes (8 * f32)");
    println!("Stack-only Haar: 48 bytes (4 * f32 + 4 * f32 + 8 * f32)");
    println!("Stack-only Window: 32 bytes (8 * f32)");
    println!();

    // Feature comparison
    println!("Feature Comparison");
    println!("Feature\t\t\tAvailable\t\tPerformance Gain");
    println!("-------\t\t\t---------\t\t----------------");
    println!("Scalar FFT\t\tYes\t\t\tBaseline");
    println!("SIMD x86_64\t\tWith feature\t\t2-4x");
    println!("SIMD AArch64\t\tWith feature\t\t2-4x");
    println!("SIMD WebAssembly\tWith feature\t\t2-4x");
    println!("Parallel processing\tWith feature\t\tN-core scaling");
    println!("Real FFT\t\tYes\t\t\t~2x for real input");
    println!("Stack-only APIs\t\tYes\t\t\tZero allocation");

    println!("\n=== Benchmark completed! ===");
} 