//! Basic usage example for kofft
//!
//! This example demonstrates the core features of the kofft library
//! including FFT, DCT, window functions, and more.

use kofft::cepstrum::real_cepstrum;
use kofft::czt::czt_f32;
use kofft::dct::dct2;
use kofft::dst::dst2;
use kofft::fft::{FftImpl, ScalarFftImpl};
use kofft::goertzel::goertzel_f32;
use kofft::hartley::dht;
use kofft::hilbert::hilbert_analytic;
use kofft::rfft::RealFftImpl;
use kofft::wavelet::haar_forward;
use kofft::window::{hamming, hann};
use kofft::Complex32;

fn main() {
    println!("=== kofft Basic Usage Example ===\n");

    // 1. Basic FFT
    println!("1. Fast Fourier Transform (FFT)");
    let fft = ScalarFftImpl::<f32>::default();

    let mut data = vec![
        Complex32::new(1.0, 0.0),
        Complex32::new(2.0, 0.0),
        Complex32::new(3.0, 0.0),
        Complex32::new(4.0, 0.0),
    ];

    println!(
        "   Input: {:?}",
        data.iter().map(|c| c.re).collect::<Vec<_>>()
    );

    fft.fft(&mut data).unwrap();
    println!(
        "   FFT: {:?}",
        data.iter()
            .map(|c| format!("{:.2}+{:.2}i", c.re, c.im))
            .collect::<Vec<_>>()
    );

    // Reuse the same FFT plan on another buffer
    let mut other = vec![
        Complex32::new(5.0, 0.0),
        Complex32::new(6.0, 0.0),
        Complex32::new(7.0, 0.0),
        Complex32::new(8.0, 0.0),
    ];
    fft.fft(&mut other).unwrap();

    fft.ifft(&mut data).unwrap();
    println!(
        "   IFFT: {:?}",
        data.iter().map(|c| c.re).collect::<Vec<_>>()
    );
    println!();

    // Strided FFT using a reusable scratch buffer
    let mut interleaved = vec![
        Complex32::new(1.0, 0.0),
        Complex32::zero(),
        Complex32::new(2.0, 0.0),
        Complex32::zero(),
        Complex32::new(3.0, 0.0),
        Complex32::zero(),
        Complex32::new(4.0, 0.0),
        Complex32::zero(),
    ];
    let mut scratch = vec![Complex32::zero(); interleaved.len() / 2];
    fft.fft_strided(&mut interleaved, 2, &mut scratch).unwrap();
    fft.ifft_strided(&mut interleaved, 2, &mut scratch).unwrap();
    println!();

    // 2. Real FFT (optimized for real input)
    println!("2. Real FFT");
    let mut real_input = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let mut real_output = vec![Complex32::zero(); real_input.len() / 2 + 1];
    let mut scratch = vec![Complex32::zero(); real_input.len() / 2];

    fft.rfft_with_scratch(&mut real_input, &mut real_output, &mut scratch)
        .unwrap();
    println!("   Real input: {:?}", real_input);
    println!(
        "   RFFT: {:?}",
        real_output
            .iter()
            .map(|c| format!("{:.2}+{:.2}i", c.re, c.im))
            .collect::<Vec<_>>()
    );
    println!();

    // 3. Discrete Cosine Transform (DCT)
    println!("3. Discrete Cosine Transform (DCT-II)");
    let dct_input = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let dct_result = dct2(&dct_input);
    println!("   Input: {:?}", dct_input);
    println!(
        "   DCT-II: {:?}",
        dct_result
            .iter()
            .map(|&x| format!("{:.2}", x))
            .collect::<Vec<_>>()
    );
    println!();

    // 4. Window Functions
    println!("4. Window Functions");
    let window_size = 8;
    let hann_window = hann(window_size);
    let hamming_window = hamming(window_size);

    println!(
        "   Hann window: {:?}",
        hann_window
            .iter()
            .map(|&x| format!("{:.3}", x))
            .collect::<Vec<_>>()
    );
    println!(
        "   Hamming window: {:?}",
        hamming_window
            .iter()
            .map(|&x| format!("{:.3}", x))
            .collect::<Vec<_>>()
    );
    println!();

    // 5. Haar Wavelet Transform
    println!("5. Haar Wavelet Transform");
    let wavelet_input = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let (avg, diff) = haar_forward(&wavelet_input).unwrap();

    println!("   Input: {:?}", wavelet_input);
    println!(
        "   Averages: {:?}",
        avg.iter().map(|&x| format!("{:.2}", x)).collect::<Vec<_>>()
    );
    println!(
        "   Differences: {:?}",
        diff.iter()
            .map(|&x| format!("{:.2}", x))
            .collect::<Vec<_>>()
    );
    println!();

    // 6. Goertzel Algorithm (single frequency detection)
    println!("6. Goertzel Algorithm");
    let sample_rate = 44100.0;
    let target_freq = 1000.0;
    let signal = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];

    let magnitude = goertzel_f32(&signal, sample_rate, target_freq).unwrap();
    println!("   Signal length: {}", signal.len());
    println!("   Sample rate: {} Hz", sample_rate);
    println!("   Target frequency: {} Hz", target_freq);
    println!("   Magnitude: {:.2}", magnitude);
    println!();

    // 7. Hartley Transform
    println!("7. Hartley Transform");
    let hartley_input = vec![1.0, 2.0, 3.0, 4.0];
    let hartley_result = dht(&hartley_input);
    println!("   Input: {:?}", hartley_input);
    println!(
        "   DHT: {:?}",
        hartley_result
            .iter()
            .map(|&x| format!("{:.2}", x))
            .collect::<Vec<_>>()
    );
    println!();

    // 8. Discrete Sine Transform (DST-II)
    println!("8. Discrete Sine Transform (DST-II)");
    let dst_input = vec![1.0, 2.0, 3.0, 4.0];
    let dst_result = dst2(&dst_input);
    println!("   Input: {:?}", dst_input);
    println!(
        "   DST-II: {:?}",
        dst_result
            .iter()
            .map(|&x| format!("{:.2}", x))
            .collect::<Vec<_>>()
    );
    println!();

    // 9. Hilbert Transform
    println!("9. Hilbert Transform");
    let hilbert_input = vec![1.0, 0.0, -1.0, 0.0];
    let hilbert_result = hilbert_analytic(&hilbert_input).unwrap();
    println!(
        "   Analytic signal: {:?}",
        hilbert_result
            .iter()
            .map(|c| format!("{:.2}+{:.2}i", c.re, c.im))
            .collect::<Vec<_>>()
    );
    println!();

    // 10. Chirp Z-Transform
    println!("10. Chirp Z-Transform");
    let czt_input = vec![1.0, 0.0, 0.0, 0.0];
    let czt_result = czt_f32(&czt_input, 4, (0.5, 0.0), (1.0, 0.0)).unwrap();
    println!(
        "   CZT: {:?}",
        czt_result
            .iter()
            .map(|&(re, im)| format!("{:.2}+{:.2}i", re, im))
            .collect::<Vec<_>>()
    );
    println!();

    // 11. Cepstrum Analysis
    println!("11. Cepstrum Analysis");
    let cep_input = vec![1.0, 2.0, 3.0, 4.0];
    let cep_result = real_cepstrum(&cep_input).unwrap();
    println!(
        "   Cepstrum: {:?}",
        cep_result
            .iter()
            .map(|&x| format!("{:.2}", x))
            .collect::<Vec<_>>()
    );
    println!();

    // 12. Performance comparison
    println!("12. Performance Comparison");
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
