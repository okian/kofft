//! Discrete Hartley Transform (DHT) module
//! Supports DHT for f32 (real input)
//! no_std + alloc compatible

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;
use libm::{cosf, sinf};

/// Discrete Hartley Transform (DHT)
#[cfg(feature = "std")]
pub fn dht(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0; n];
    let factor = 2.0 * core::f32::consts::PI / n as f32;
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            let angle = factor * (i * k) as f32;
            let re = cosf(angle);
            let im = sinf(angle);
            sum += x * (re + im);
        }
        *out = sum;
    }
    output
}

#[cfg(not(feature = "std"))]
pub fn dht(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0; n];
    let factor = 2.0 * core::f32::consts::PI / n as f32;
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            let angle = factor * (i * k) as f32;
            let re = cosf(angle);
            let im = sinf(angle);
            sum += x * (re + im);
        }
        *out = sum;
    }
    output
}

/// Batch DHT
pub fn batch(batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let out = dht(batch);
        batch.copy_from_slice(&out);
    }
}
/// Multi-channel DHT
pub fn multi_channel(channels: &mut [Vec<f32>]) {
    batch(channels)
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    #[test]
    fn test_dht_roundtrip() {
        let x = [1.0, 2.0, 3.0, 4.0];
        let y = dht(&x);
        let z = dht(&y);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / 4.0).abs() < 1e-5, "{} vs {}", a, b);
        }
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod batch_tests {
    use super::*;
    #[test]
    fn test_dht_batch() {
        let mut batches = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        batch(&mut batches);
        assert_eq!(batches.len(), 2);
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod coverage_tests {
    use super::*;
    use alloc::format;
    use proptest::prelude::*;

    #[test]
    fn test_dht_empty() {
        let x: [f32; 0] = [];
        let y = dht(&x);
        assert_eq!(y.len(), 0);
    }
    #[test]
    fn test_dht_single_element() {
        let x = [1.0];
        let y = dht(&x);
        assert_eq!(y.len(), 1);
    }
    #[test]
    fn test_dht_all_zeros() {
        let x = [0.0; 8];
        let y = dht(&x);
        for v in y {
            assert_eq!(v, 0.0);
        }
    }
    #[test]
    fn test_dht_all_ones() {
        let x = [1.0; 8];
        let y = dht(&x);
        // DHT of all-ones is not guaranteed to be all nonzero; check at least one is nonzero
        assert!(y.iter().any(|&v| v.abs() > 0.0));
    }
    #[test]
    fn test_dht_roundtrip() {
        let x = [1.0, 2.0, 3.0, 4.0];
        let y = dht(&x);
        let z = dht(&y);
        for (a, b) in x.iter().zip(z.iter()) {
            assert!((a - b / 4.0).abs() < 1e-4);
        }
    }
    proptest! {
        #[test]
        fn prop_dht_roundtrip(len in 2usize..16, ref signal in proptest::collection::vec(-1000.0f32..1000.0, 16)) {
            if len < 4 { return Ok(()); } // skip degenerate cases
            let x: Vec<f32> = signal.iter().take(len).cloned().collect();
            let y = dht(&x);
            let z = dht(&y);
            for (a, b) in x.iter().zip(z.iter()) {
                prop_assert!((a - b / (len as f32)).abs() < 1e-1);
            }
        }
    }
}
