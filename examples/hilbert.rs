//! Hilbert transform example demonstrating analytic signal construction.

use kofft::hilbert::hilbert_analytic;

fn main() {
    println!("=== Hilbert transform example ===\n");
    let signal = [1.0f32, 0.0, -1.0, 0.0];
    let analytic = hilbert_analytic(&signal);
    println!("Analytic signal: {:?}", analytic);
}
