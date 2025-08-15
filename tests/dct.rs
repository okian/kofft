#![cfg(feature = "slow")]

use kofft::dct;

#[test]
fn dct2_matches_slow() {
    for n in 1..16 {
        let input: Vec<f32> = (0..n).map(|i| (i as f32 * 0.12345).sin()).collect();
        let fast = dct::dct2(&input);
        let slow = dct::slow::dct2(&input);
        for (a, b) in fast.iter().zip(slow.iter()) {
            assert!((a - b).abs() < 1e-4, "n={n}, fast={a}, slow={b}");
        }
    }
}
