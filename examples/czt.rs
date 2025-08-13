//! Chirp Z-Transform example.
//!
//! Demonstrates computing the CZT of a real signal.

use kofft::czt::czt_f32;

fn main() {
    println!("=== CZT example ===\n");

    let signal = [1.0, 2.0, 3.0, 4.0];
    // DFT via CZT: w = exp(-j*2pi/8), a = 1
    let w = (
        (-2.0 * core::f32::consts::PI / 8.0).cos(),
        (-2.0 * core::f32::consts::PI / 8.0).sin(),
    );
    let a = (1.0, 0.0);

    let result = czt_f32(&signal, 8, w, a);
    for (k, (re, im)) in result.iter().enumerate() {
        println!("k={k}: {re:.3} + {im:.3}i");
    }
}
