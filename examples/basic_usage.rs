//! Basic usage example for kofft
//! 
//! This example demonstrates the core features of the kofft library
//! including FFT, DCT, window functions, and more.

use kofft::{Complex32, FftPlanner};
use kofft::fft::{ScalarFftImpl, FftImpl};
use kofft::dct::dct2;
use kofft::window::{hann, hamming};
use kofft::wavelet::haar_forward;
use kofft::goertzel::goertzel_f32;

fn main() {
    println!("=== kofft Basic Usage Example ===\n");

    // 1. Basic FFT
    println!("1. Fast Fourier Transform (FFT)");
    let planner = FftPlanner::<f32>::new();
    let fft = ScalarFftImpl::with_planner(planner);
    
    let mut data = vec![
        Complex32::new(1.0, 0.0),
        Complex32::new(2.0, 0.0),
        Complex32::new(3.0, 0.0),
        Complex32::new(4.0, 0.0),
    ];
    
    println!("   Input: {:?}", data.iter().map(|c| c.re).collect::<Vec<_>>());
    
    fft.fft(&mut data).unwrap();
    println!("   FFT: {:?}", data.iter().map(|c| format!("{:.2}+{:.2}i", c.re, c.im)).collect::<Vec<_>>());

    // Reuse the same FFT plan on another buffer
    let mut other = vec![
        Complex32::new(5.0, 0.0),
        Complex32::new(6.0, 0.0),
        Complex32::new(7.0, 0.0),
        Complex32::new(8.0, 0.0),
    ];
    fft.fft(&mut other).unwrap();

    fft.ifft(&mut data).unwrap();
    println!("   IFFT: {:?}", data.iter().map(|c| c.re).collect::<Vec<_>>());
    println!();

    // 2. Real FFT (optimized for real input)
    println!("2. Real FFT");
    let mut real_input = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let mut real_output = vec![Complex32::zero(); real_input.len() / 2 + 1];
    
    fft.rfft(&mut real_input, &mut real_output).unwrap();
    println!("   Real input: {:?}", real_input);
    println!("   RFFT: {:?}", real_output.iter().map(|c| format!("{:.2}+{:.2}i", c.re, c.im)).collect::<Vec<_>>());
    println!();

    // 3. Discrete Cosine Transform (DCT)
    println!("3. Discrete Cosine Transform (DCT-II)");
    let dct_input = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let dct_result = dct2(&dct_input);
    println!("   Input: {:?}", dct_input);
    println!("   DCT-II: {:?}", dct_result.iter().map(|&x| format!("{:.2}", x)).collect::<Vec<_>>());
    println!();

    // 4. Window Functions
    println!("4. Window Functions");
    let window_size = 8;
    let hann_window = hann(window_size);
    let hamming_window = hamming(window_size);
    
    println!("   Hann window: {:?}", hann_window.iter().map(|&x| format!("{:.3}", x)).collect::<Vec<_>>());
    println!("   Hamming window: {:?}", hamming_window.iter().map(|&x| format!("{:.3}", x)).collect::<Vec<_>>());
    println!();

    // 5. Haar Wavelet Transform
    println!("5. Haar Wavelet Transform");
    let wavelet_input = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let (avg, diff) = haar_forward(&wavelet_input);
    
    println!("   Input: {:?}", wavelet_input);
    println!("   Averages: {:?}", avg.iter().map(|&x| format!("{:.2}", x)).collect::<Vec<_>>());
    println!("   Differences: {:?}", diff.iter().map(|&x| format!("{:.2}", x)).collect::<Vec<_>>());
    println!();

    // 6. Goertzel Algorithm (single frequency detection)
    println!("6. Goertzel Algorithm");
    let sample_rate = 44100.0;
    let target_freq = 1000.0;
    let signal = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    
    let magnitude = goertzel_f32(&signal, sample_rate, target_freq);
    println!("   Signal length: {}", signal.len());
    println!("   Sample rate: {} Hz", sample_rate);
    println!("   Target frequency: {} Hz", target_freq);
    println!("   Magnitude: {:.2}", magnitude);
    println!();

    // 7. Performance comparison
    println!("7. Performance Comparison");
    let large_input: Vec<Complex32> = (0..1024)
        .map(|i| Complex32::new((i as f32 * 0.1).sin(), 0.0))
        .collect();
    
    let mut large_data = large_input.clone();
    let start = std::time::Instant::now();
    fft.fft(&mut large_data).unwrap();
    let duration = start.elapsed();
    
    println!("   1024-point FFT completed in {:?}", duration);
    println!();

    println!("=== Example completed successfully! ===");
} 