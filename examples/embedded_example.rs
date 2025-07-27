//! Embedded/MCU example for kofft
//! 
//! This example demonstrates how to use kofft in a no_std environment
//! with stack-only APIs suitable for microcontrollers.

use kofft::fft::{Complex32, fft_inplace_stack};
use kofft::dct::dct2_inplace_stack;
use kofft::dst::dst2_inplace_stack;
use kofft::wavelet::{haar_forward_inplace_stack, haar_inverse_inplace_stack};
use kofft::window::{hann_inplace_stack, hamming_inplace_stack};

fn main() {
    println!("=== kofft Embedded Example ===\n");
    
    // This function demonstrates various DSP operations using stack-only APIs
    // that are suitable for embedded systems with limited RAM.
    
    // 1. FFT Example (8-point, power-of-two)
    println!("1. FFT Example");
    let mut fft_data: [Complex32; 8] = [
        Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0),
        Complex32::new(3.0, 0.0), Complex32::new(4.0, 0.0),
        Complex32::new(5.0, 0.0), Complex32::new(6.0, 0.0),
        Complex32::new(7.0, 0.0), Complex32::new(8.0, 0.0),
    ];
    
    // Compute FFT in-place
    if let Ok(()) = fft_inplace_stack(&mut fft_data) {
        println!("   FFT completed successfully");
        // In a real application, you would process the frequency domain data here
    }
    
    // 2. DCT-II Example
    println!("2. DCT-II Example");
    let dct_input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let mut dct_output: [f32; 8] = [0.0; 8];
    
    dct2_inplace_stack(&dct_input, &mut dct_output);
    println!("   DCT-II completed");
    
    // 3. DST-II Example
    println!("3. DST-II Example");
    let dst_input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let mut dst_output: [f32; 8] = [0.0; 8];
    
    dst2_inplace_stack(&dst_input, &mut dst_output);
    println!("   DST-II completed");
    
    // 4. Haar Wavelet Transform
    println!("4. Haar Wavelet Transform");
    let wavelet_input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let mut avg: [f32; 4] = [0.0; 4];
    let mut diff: [f32; 4] = [0.0; 4];
    
    // Forward transform
    haar_forward_inplace_stack(&wavelet_input, &mut avg[..], &mut diff[..]);
    
    // Inverse transform
    let mut reconstructed: [f32; 8] = [0.0; 8];
    haar_inverse_inplace_stack::<8>(&avg[..], &diff[..], &mut reconstructed[..]);
    println!("   Haar wavelet transform completed");
    
    // 5. Window Functions
    println!("5. Window Functions");
    let mut hann_window: [f32; 8] = [0.0; 8];
    hann_inplace_stack(&mut hann_window);
    
    let mut hamming_window: [f32; 8] = [0.0; 8];
    hamming_inplace_stack(&mut hamming_window);
    println!("   Window functions generated");
    
    // 6. Signal Processing Pipeline Example
    println!("6. Signal Processing Pipeline");
    // This demonstrates a typical embedded DSP pipeline:
    // 1. Apply window function to input signal
    // 2. Compute FFT
    // 3. Process in frequency domain
    // 4. Compute IFFT
    
    let mut signal: [Complex32; 8] = [
        Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0),
        Complex32::new(3.0, 0.0), Complex32::new(4.0, 0.0),
        Complex32::new(5.0, 0.0), Complex32::new(6.0, 0.0),
        Complex32::new(7.0, 0.0), Complex32::new(8.0, 0.0),
    ];
    
    // Apply window function (multiply signal by window)
    for i in 0..8 {
        signal[i].re *= hann_window[i];
    }
    
    // Compute FFT
    if let Ok(()) = fft_inplace_stack(&mut signal) {
        // Process in frequency domain
        // For example, apply a simple low-pass filter
        for i in 4..8 {
            signal[i].re *= 0.1; // Attenuate high frequencies
            signal[i].im *= 0.1;
        }
        
        // Compute IFFT
        if let Ok(()) = fft_inplace_stack(&mut signal) {
            println!("   Signal processing pipeline completed");
        }
    }
    
    // 7. Memory Usage Summary
    println!("7. Memory Usage Summary");
    println!("   Total stack usage for this example:");
    println!("   - FFT data: 8 * 8 bytes = 64 bytes");
    println!("   - DCT/DST buffers: 2 * 8 * 4 bytes = 64 bytes");  
    println!("   - Wavelet buffers: 4 * 4 bytes + 8 * 4 bytes = 48 bytes");
    println!("   - Window buffers: 2 * 8 * 4 bytes = 64 bytes");
    println!("   - Signal processing: 8 * 8 bytes = 64 bytes");
    println!("   Total: ~304 bytes of stack memory");
    
    println!("\n=== Embedded example completed! ===");
    println!("\nIn a real embedded application, you would:");
    println!("- Process data in real-time");
    println!("- Use interrupts for timing");
    println!("- Implement power management");
    println!("- Add error handling");
    println!("- Consider using DMA for large data transfers");
} 