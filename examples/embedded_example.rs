//! Embedded/MCU example for kofft
//!
//! This example demonstrates how to use kofft in a no_std environment
//! with stack-only APIs suitable for microcontrollers.

use kofft::dct::dct2_inplace_stack;
use kofft::dst::dst2_inplace_stack;
use kofft::fft::{fft_inplace_stack, Complex32};
use kofft::wavelet::{haar_forward_inplace_stack, haar_inverse_inplace_stack};
use kofft::window::{hamming_inplace_stack, hann_inplace_stack};

#[cfg(feature = "std")]
macro_rules! log {
    ($($arg:tt)*) => { println!($($arg)*); };
}

#[cfg(not(feature = "std"))]
macro_rules! log {
    ($($arg:tt)*) => {
        // Replace with defmt::info! or another logging mechanism on embedded targets
    };
}

// The `log!` macro above prints messages on std targets and becomes a no-op
// on bare `no_std` targets.

fn main() {
    log!("=== kofft Embedded Example ===\n");

    // This function demonstrates various DSP operations using stack-only APIs
    // that are suitable for embedded systems with limited RAM.

    // 1. FFT Example (8-point, power-of-two)
    log!("1. FFT Example");
    let mut fft_data: [Complex32; 8] = [
        Complex32::new(1.0, 0.0),
        Complex32::new(2.0, 0.0),
        Complex32::new(3.0, 0.0),
        Complex32::new(4.0, 0.0),
        Complex32::new(5.0, 0.0),
        Complex32::new(6.0, 0.0),
        Complex32::new(7.0, 0.0),
        Complex32::new(8.0, 0.0),
    ];

    // Compute FFT in-place
    if let Ok(()) = fft_inplace_stack(&mut fft_data) {
        log!("   FFT completed successfully");
        // In a real application, you would process the frequency domain data here
    }

    // 2. DCT-II Example
    log!("2. DCT-II Example");
    let dct_input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let mut dct_output: [f32; 8] = [0.0; 8];

    dct2_inplace_stack(&dct_input, &mut dct_output).unwrap();
    log!("   DCT-II completed");

    // 3. DST-II Example
    log!("3. DST-II Example");
    let dst_input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let mut dst_output: [f32; 8] = [0.0; 8];

    dst2_inplace_stack(&dst_input, &mut dst_output).unwrap();
    log!("   DST-II completed");

    // 4. Haar Wavelet Transform
    log!("4. Haar Wavelet Transform");
    let wavelet_input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let mut avg: [f32; 4] = [0.0; 4];
    let mut diff: [f32; 4] = [0.0; 4];

    // Forward transform
    haar_forward_inplace_stack(&wavelet_input, &mut avg[..], &mut diff[..]);

    // Inverse transform
    let mut reconstructed: [f32; 8] = [0.0; 8];
    haar_inverse_inplace_stack::<8>(&avg[..], &diff[..], &mut reconstructed[..]);
    log!("   Haar wavelet transform completed");

    // 5. Window Functions
    log!("5. Window Functions");
    let mut hann_window: [f32; 8] = [0.0; 8];
    hann_inplace_stack(&mut hann_window);

    let mut hamming_window: [f32; 8] = [0.0; 8];
    hamming_inplace_stack(&mut hamming_window);
    log!("   Window functions generated");

    // 6. Signal Processing Pipeline Example
    log!("6. Signal Processing Pipeline");
    // This demonstrates a typical embedded DSP pipeline:
    // 1. Apply window function to input signal
    // 2. Compute FFT
    // 3. Process in frequency domain
    // 4. Compute IFFT

    let mut signal: [Complex32; 8] = [
        Complex32::new(1.0, 0.0),
        Complex32::new(2.0, 0.0),
        Complex32::new(3.0, 0.0),
        Complex32::new(4.0, 0.0),
        Complex32::new(5.0, 0.0),
        Complex32::new(6.0, 0.0),
        Complex32::new(7.0, 0.0),
        Complex32::new(8.0, 0.0),
    ];

    // Apply window function (multiply signal by window)
    for (sig, w) in signal.iter_mut().zip(hann_window.iter()) {
        sig.re *= *w;
    }

    // Compute FFT
    if let Ok(()) = fft_inplace_stack(&mut signal) {
        // Process in frequency domain
        // For example, apply a simple low-pass filter
        for bin in signal.iter_mut().skip(4) {
            bin.re *= 0.1; // Attenuate high frequencies
            bin.im *= 0.1;
        }

        // Compute IFFT
        if let Ok(()) = fft_inplace_stack(&mut signal) {
            log!("   Signal processing pipeline completed");
        }
    }

    // 7. Memory Usage Summary
    log!("7. Memory Usage Summary");
    log!("   Total stack usage for this example:");
    log!("   - FFT data: 8 * 8 bytes = 64 bytes");
    log!("   - DCT/DST buffers: 2 * 8 * 4 bytes = 64 bytes");
    log!("   - Wavelet buffers: 4 * 4 bytes + 8 * 4 bytes = 48 bytes");
    log!("   - Window buffers: 2 * 8 * 4 bytes = 64 bytes");
    log!("   - Signal processing: 8 * 8 bytes = 64 bytes");
    log!("   Total: ~304 bytes of stack memory");

    log!("\n=== Embedded example completed! ===");
    log!("\nIn a real embedded application, you would:");
    log!("- Process data in real-time");
    log!("- Use interrupts for timing");
    log!("- Implement power management");
    log!("- Add error handling");
    log!("- Consider using DMA for large data transfers");
}
