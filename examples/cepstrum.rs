//! Real cepstrum example.

use kofft::cepstrum::real_cepstrum;

fn main() {
    println!("=== Cepstrum example ===\n");
    let signal = [1.0f32, 2.0, 3.0, 4.0];
    let cep = real_cepstrum(&signal);
    println!("Real cepstrum: {:?}", cep);
}
