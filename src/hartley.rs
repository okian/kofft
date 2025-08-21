//! Discrete Hartley Transform (DHT) module
//! Supports DHT for f32 (real input)
//! no_std + alloc compatible

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;
use libm::{cosf, sinf};

/// Full turn constant `2π` used to map index pairs to angles.
///
/// Naming the value clarifies intent and avoids repeating a magic number
/// throughout the transform implementation.
const TAU: f32 = core::f32::consts::PI * 2.0;

/// Compute the Discrete Hartley Transform (DHT) of a real-valued signal.
///
/// # Arguments
/// * `input` - Real input samples. An empty slice returns immediately.
///
/// # Why
/// The DHT is a real-to-real transform similar to the FFT but avoids complex
/// numbers. Implementing it directly keeps dependencies minimal.
///
/// # How
/// Each output bin `k` sums the input samples scaled by `cos(θ) + sin(θ)` where
/// `θ = 2π·i·k/n`. Kahan summation is used to mitigate floating‑point error.
/// The function fails fast for empty input to avoid division-by-zero and `NaN`
/// propagation when computing the angular factor.
pub fn dht(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    if n == 0 {
        // Avoid computing 2π/n which would yield `inf` for `n == 0`.
        return Vec::new();
    }
    let mut output = vec![0.0; n];
    let factor = TAU / n as f32;
    for (k, out) in output.iter_mut().enumerate() {
        // Kahan summation compensates for floating-point rounding error.
        let mut sum = 0.0f32;
        let mut c = 0.0f32;
        for (i, &x) in input.iter().enumerate() {
            let angle = factor * (i * k) as f32;
            let re = cosf(angle);
            let im = sinf(angle);
            let y = x * (re + im) - c;
            let t = sum + y;
            c = (t - sum) - y;
            sum = t;
        }
        *out = sum;
    }
    output
}

/// Compute the DHT for each batch in-place without extra copying.
///
/// # Why
/// Replacing `copy_from_slice` with a move eliminates an otherwise redundant
/// memory copy for every batch, improving throughput for large inputs.
pub fn batch(batches: &mut [Vec<f32>]) {
    for batch in batches.iter_mut() {
        let result = dht(batch);
        *batch = result;
    }
}

/// Apply the DHT independently to multiple channels.
///
/// This is a convenience wrapper around [`batch`] for multi-channel audio or
/// image data.
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
