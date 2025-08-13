//! Goertzel algorithm example.
//!
//! Detects the magnitude of a target frequency in a signal.

use kofft::goertzel::goertzel_f32;

fn main() {
    println!("=== Goertzel example ===\n");

    let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let sample_rate = 8000.0;
    let target_freq = 1000.0;

    let magnitude = goertzel_f32(&signal, sample_rate, target_freq);
    println!("Magnitude at {target_freq} Hz: {magnitude:.3}");
}
