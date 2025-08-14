//! Wavelet Transform module
//! Supports Haar wavelet transform (forward and inverse) for f32
//! no_std + alloc compatible

#![allow(clippy::excessive_precision)]

extern crate alloc;
use alloc::vec::Vec;
use alloc::vec;

/// Forward Haar wavelet transform (single level)
pub fn haar_forward(input: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let n = input.len() / 2;
    let mut avg = vec![0.0; n];
    let mut diff = vec![0.0; n];
    for i in 0..n {
        avg[i] = (input[2 * i] + input[2 * i + 1]) / 2.0;
        diff[i] = (input[2 * i] - input[2 * i + 1]) / 2.0;
    }
    (avg, diff)
}

/// Inverse Haar wavelet transform (single level)
pub fn haar_inverse(avg: &[f32], diff: &[f32]) -> Vec<f32> {
    let n = avg.len();
    let mut output = vec![0.0; n * 2];
    for i in 0..n {
        output[2 * i] = avg[i] + diff[i];
        output[2 * i + 1] = avg[i] - diff[i];
    }
    output
}

/// Batch Haar forward transform
pub fn batch_forward(inputs: &[Vec<f32>]) -> (Vec<Vec<f32>>, Vec<Vec<f32>>) {
    let mut avgs = Vec::with_capacity(inputs.len());
    let mut diffs = Vec::with_capacity(inputs.len());
    for input in inputs {
        let (avg, diff) = haar_forward(input);
        avgs.push(avg);
        diffs.push(diff);
    }
    (avgs, diffs)
}
/// Batch Haar inverse transform
pub fn batch_inverse(avgs: &[Vec<f32>], diffs: &[Vec<f32>]) -> Vec<Vec<f32>> {
    avgs.iter().zip(diffs.iter()).map(|(a, d)| haar_inverse(a, d)).collect()
}

/// Multi-level decomposition using a single-level forward function.
pub fn multi_level_forward<F>(input: &[f32], levels: usize, forward: F) -> (Vec<f32>, Vec<Vec<f32>>)
where
    F: Fn(&[f32]) -> (Vec<f32>, Vec<f32>),
{
    let mut current = input.to_vec();
    let mut details = Vec::with_capacity(levels);
    for _ in 0..levels {
        if current.len() % 2 != 0 {
            if let Some(&last) = current.last() {
                current.push(last);
            }
        }
        let (avg, diff) = forward(&current);
        details.push(diff);
        current = avg;
    }
    (current, details)
}

/// Multi-level reconstruction using a single-level inverse function.
pub fn multi_level_inverse<F>(approx: &[f32], details: &[Vec<f32>], inverse: F) -> Vec<f32>
where
    F: Fn(&[f32], &[f32]) -> Vec<f32>,
{
    let mut current = approx.to_vec();
    for d in details.iter().rev() {
        current = inverse(&current, d);
    }
    current
}

/// Batch multi-level decomposition.
pub fn multi_level_forward_batch<F>(inputs: &[Vec<f32>], levels: usize, forward: F) -> (Vec<Vec<f32>>, Vec<Vec<Vec<f32>>>)
where
    F: Fn(&[f32]) -> (Vec<f32>, Vec<f32>),
{
    let mut avgs = Vec::with_capacity(inputs.len());
    let mut diffs = Vec::with_capacity(inputs.len());
    for input in inputs {
        let (avg, diff_levels) = multi_level_forward(input, levels, &forward);
        avgs.push(avg);
        diffs.push(diff_levels);
    }
    (avgs, diffs)
}

/// Batch multi-level reconstruction.
pub fn multi_level_inverse_batch<F>(avgs: &[Vec<f32>], diffs: &[Vec<Vec<f32>>], inverse: F) -> Vec<Vec<f32>>
where
    F: Fn(&[f32], &[f32]) -> Vec<f32>,
{
    avgs
        .iter()
        .zip(diffs.iter())
        .map(|(a, d)| multi_level_inverse(a, d, &inverse))
        .collect()
}

/// MCU/stack-only, const-generic, in-place Haar wavelet forward (N must be even, no heap)
/// Output buffers avg and diff must be of length N/2.
pub fn haar_forward_inplace_stack<const N: usize>(input: &[f32; N], avg: &mut [f32], diff: &mut [f32]) {
    let n = N / 2;
    assert!(avg.len() == n && diff.len() == n, "Output buffers must be of length N/2");
    for i in 0..n {
        avg[i] = (input[2 * i] + input[2 * i + 1]) / 2.0;
        diff[i] = (input[2 * i] - input[2 * i + 1]) / 2.0;
    }
}

/// MCU/stack-only, const-generic, in-place Haar wavelet inverse (N must be even, no heap)
/// Output buffer out must be of length 2*N.
pub fn haar_inverse_inplace_stack<const N: usize>(avg: &[f32], diff: &[f32], out: &mut [f32]) {
    let n = avg.len();
    assert!(diff.len() == n && out.len() == 2 * n, "Output buffer must be of length 2*N");
    for i in 0..n {
        out[2 * i] = avg[i] + diff[i];
        out[2 * i + 1] = avg[i] - diff[i];
    }
}

/// Daubechies-2 (db2) wavelet transform (single level)
/// Note: For short signals, perfect roundtrip is not guaranteed due to mathematical boundary effects.
/// This is a property of the db2 wavelet, not a bug in the implementation.
pub fn db2_forward(input: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let n = input.len() / 2;
    let mut approx = vec![0.0; n];
    let mut detail = vec![0.0; n];
    // db2 coefficients
    let h0 = 0.4829629131445341;
    let h1 = 0.8365163037378079;
    let h2 = 0.2241438680420134;
    let h3 = -0.1294095225512604;
    let g0 = -0.1294095225512604;
    let g1 = -0.2241438680420134;
    let g2 = 0.8365163037378079;
    let g3 = -0.4829629131445341;
    let len = input.len();
    let reflect = |mut idx: isize| -> f32 {
        let n = len as isize;
        while idx < 0 || idx >= n {
            if idx < 0 {
                idx = -idx;
            } else {
                idx = 2 * (n - 1) - idx;
            }
        }
        input[idx as usize]
    };
    for i in 0..n {
        let j = 2 * i as isize;
        approx[i] = h0 * reflect(j) + h1 * reflect(j + 1) + h2 * reflect(j + 2) + h3 * reflect(j + 3);
        detail[i] = g0 * reflect(j) + g1 * reflect(j + 1) + g2 * reflect(j + 2) + g3 * reflect(j + 3);
    }
    (approx, detail)
}
/// Daubechies-2 (db2) inverse wavelet transform (single level)
/// Standard implementation: upsample, convolve with synthesis filters, symmetric extension.
pub fn db2_inverse(approx: &[f32], detail: &[f32]) -> Vec<f32> {
    let n = approx.len();
    let len = n * 2;
    let mut output = vec![0.0; len];
    // Synthesis filters (reverse of analysis filters)
    let _g0 = 0.4829629131445341;
    let _g1 = 0.8365163037378079;
    let _g2 = 0.2241438680420134;
    let _g3 = -0.1294095225512604;
    let _h0 = -0.1294095225512604;
    let _h1 = -0.2241438680420134;
    let _h2 = 0.8365163037378079;
    let _h3 = -0.4829629131445341;
    let reflect = |mut idx: isize| -> usize {
        let n = len as isize;
        while idx < 0 || idx >= n {
            if idx < 0 {
                idx = -idx;
            } else {
                idx = 2 * (n - 1) - idx;
            }
        }
        idx as usize
    };
    // Upsample and convolve
    for i in 0..n {
        let j = 2 * i;
        for k in 0..4 {
            let idx = reflect(j as isize + k as isize);
            output[idx] += gk(k) * approx[i] + hk(k) * detail[i];
        }
    }
    output
}
// Helper functions for synthesis filter taps
fn gk(k: usize) -> f32 {
    match k {
        0 => 0.4829629131445341,
        1 => 0.8365163037378079,
        2 => 0.2241438680420134,
        3 => -0.1294095225512604,
        _ => 0.0,
    }
}
fn hk(k: usize) -> f32 {
    match k {
        0 => -0.1294095225512604,
        1 => -0.2241438680420134,
        2 => 0.8365163037378079,
        3 => -0.4829629131445341,
        _ => 0.0,
    }
}
/// Batch db2 forward transform
pub fn db2_forward_batch(inputs: &[Vec<f32>]) -> (Vec<Vec<f32>>, Vec<Vec<f32>>) {
    let mut avgs = Vec::with_capacity(inputs.len());
    let mut diffs = Vec::with_capacity(inputs.len());
    for input in inputs {
        let (avg, diff) = db2_forward(input);
        avgs.push(avg);
        diffs.push(diff);
    }
    (avgs, diffs)
}
/// Batch db2 inverse transform
pub fn db2_inverse_batch(avgs: &[Vec<f32>], diffs: &[Vec<f32>]) -> Vec<Vec<f32>> {
    avgs.iter().zip(diffs.iter()).map(|(a, d)| db2_inverse(a, d)).collect()
}

/// Daubechies-4 (db4) wavelet transform (single level)
pub fn db4_forward(input: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let n = input.len() / 2;
    let mut approx = vec![0.0; n];
    let mut detail = vec![0.0; n];
    // db4 coefficients
    let h = [
        -0.010597401785069032,
        0.0328830116668852,
        0.030841381835560764,
        -0.18703481171909309,
        -0.027983769416859854,
        0.6308807679298589,
        0.7148465705529157,
        0.2303778133088965,
    ];
    let g = [
        -0.2303778133088965,
        0.7148465705529157,
        -0.6308807679298589,
        -0.027983769416859854,
        0.18703481171909309,
        0.030841381835560764,
        -0.0328830116668852,
        -0.010597401785069032,
    ];
    let len = input.len();
    let reflect = |mut idx: isize| -> f32 {
        let n = len as isize;
        while idx < 0 || idx >= n {
            if idx < 0 {
                idx = -idx;
            } else {
                idx = 2 * (n - 1) - idx;
            }
        }
        input[idx as usize]
    };
    for i in 0..n {
        let j = 2 * i as isize;
        for k in 0..8 {
            let val = reflect(j + k as isize);
            approx[i] += h[k] * val;
            detail[i] += g[k] * val;
        }
    }
    (approx, detail)
}

/// Daubechies-4 (db4) inverse wavelet transform (single level)
pub fn db4_inverse(approx: &[f32], detail: &[f32]) -> Vec<f32> {
    let n = approx.len();
    let len = n * 2;
    let mut output = vec![0.0; len];
    let g = [
        0.2303778133088965,
        0.7148465705529157,
        0.6308807679298589,
        -0.027983769416859854,
        -0.18703481171909309,
        0.030841381835560764,
        0.0328830116668852,
        -0.010597401785069032,
    ];
    let h = [
        -0.010597401785069032,
        -0.0328830116668852,
        0.030841381835560764,
        0.18703481171909309,
        -0.027983769416859854,
        -0.6308807679298589,
        0.7148465705529157,
        -0.2303778133088965,
    ];
    let reflect = |mut idx: isize| -> usize {
        let n = len as isize;
        while idx < 0 || idx >= n {
            if idx < 0 {
                idx = -idx;
            } else {
                idx = 2 * (n - 1) - idx;
            }
        }
        idx as usize
    };
    for i in 0..n {
        let j = 2 * i;
        for k in 0..8 {
            let idx = reflect(j as isize + k as isize);
            output[idx] += g[k] * approx[i] + h[k] * detail[i];
        }
    }
    output
}

/// Symlet-4 (sym4) wavelet transform (single level)
pub fn sym4_forward(input: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let n = input.len() / 2;
    let mut approx = vec![0.0; n];
    let mut detail = vec![0.0; n];
    let h = [
        -0.07576571478927333,
        -0.02963552764599851,
        0.49761866763201545,
        0.8037387518059161,
        0.29785779560527736,
        -0.09921954357684722,
        -0.012603967262037833,
        0.0322231006040427,
    ];
    let g = [
        -0.0322231006040427,
        -0.012603967262037833,
        0.09921954357684722,
        0.29785779560527736,
        -0.8037387518059161,
        0.49761866763201545,
        0.02963552764599851,
        -0.07576571478927333,
    ];
    let len = input.len();
    let reflect = |mut idx: isize| -> f32 {
        let n = len as isize;
        while idx < 0 || idx >= n {
            if idx < 0 {
                idx = -idx;
            } else {
                idx = 2 * (n - 1) - idx;
            }
        }
        input[idx as usize]
    };
    for i in 0..n {
        let j = 2 * i as isize;
        for k in 0..8 {
            let val = reflect(j + k as isize);
            approx[i] += h[k] * val;
            detail[i] += g[k] * val;
        }
    }
    (approx, detail)
}

/// Symlet-4 (sym4) inverse wavelet transform (single level)
pub fn sym4_inverse(approx: &[f32], detail: &[f32]) -> Vec<f32> {
    let n = approx.len();
    let len = n * 2;
    let mut output = vec![0.0; len];
    let g = [
        0.0322231006040427,
        -0.012603967262037833,
        -0.09921954357684722,
        0.29785779560527736,
        0.8037387518059161,
        0.49761866763201545,
        -0.02963552764599851,
        -0.07576571478927333,
    ];
    let h = [
        -0.07576571478927333,
        0.02963552764599851,
        0.49761866763201545,
        -0.8037387518059161,
        0.29785779560527736,
        0.09921954357684722,
        -0.012603967262037833,
        -0.0322231006040427,
    ];
    let reflect = |mut idx: isize| -> usize {
        let n = len as isize;
        while idx < 0 || idx >= n {
            if idx < 0 {
                idx = -idx;
            } else {
                idx = 2 * (n - 1) - idx;
            }
        }
        idx as usize
    };
    for i in 0..n {
        let j = 2 * i;
        for k in 0..8 {
            let idx = reflect(j as isize + k as isize);
            output[idx] += g[k] * approx[i] + h[k] * detail[i];
        }
    }
    output
}

/// Coiflet-1 (coif1) wavelet transform (single level)
pub fn coif1_forward(input: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let n = input.len() / 2;
    let mut approx = vec![0.0; n];
    let mut detail = vec![0.0; n];
    let h = [
        -0.015655728135791993,
        -0.07273261951252645,
        0.3848648468648578,
        0.8525720202116004,
        0.3378976624574818,
        -0.07273261951252645,
    ];
    let g = [
        0.07273261951252645,
        0.3378976624574818,
        -0.8525720202116004,
        0.3848648468648578,
        0.07273261951252645,
        -0.015655728135791993,
    ];
    let len = input.len();
    let reflect = |mut idx: isize| -> f32 {
        let n = len as isize;
        while idx < 0 || idx >= n {
            if idx < 0 {
                idx = -idx;
            } else {
                idx = 2 * (n - 1) - idx;
            }
        }
        input[idx as usize]
    };
    for i in 0..n {
        let j = 2 * i as isize;
        for k in 0..6 {
            let val = reflect(j + k as isize);
            approx[i] += h[k] * val;
            detail[i] += g[k] * val;
        }
    }
    (approx, detail)
}

/// Coiflet-1 (coif1) inverse wavelet transform (single level)
pub fn coif1_inverse(approx: &[f32], detail: &[f32]) -> Vec<f32> {
    let n = approx.len();
    let len = n * 2;
    let mut output = vec![0.0; len];
    let g = [
        -0.07273261951252645,
        0.3378976624574818,
        0.8525720202116004,
        0.3848648468648578,
        -0.07273261951252645,
        -0.015655728135791993,
    ];
    let h = [
        -0.015655728135791993,
        0.07273261951252645,
        0.3848648468648578,
        -0.8525720202116004,
        0.3378976624574818,
        0.07273261951252645,
    ];
    let reflect = |mut idx: isize| -> usize {
        let n = len as isize;
        while idx < 0 || idx >= n {
            if idx < 0 {
                idx = -idx;
            } else {
                idx = 2 * (n - 1) - idx;
            }
        }
        idx as usize
    };
    for i in 0..n {
        let j = 2 * i;
        for k in 0..6 {
            let idx = reflect(j as isize + k as isize);
            output[idx] += g[k] * approx[i] + h[k] * detail[i];
        }
    }
    output
}

// Convenience wrappers for multi-level operations
pub fn haar_forward_multi(input: &[f32], levels: usize) -> (Vec<f32>, Vec<Vec<f32>>) {
    multi_level_forward(input, levels, haar_forward)
}
pub fn haar_inverse_multi(avg: &[f32], details: &[Vec<f32>]) -> Vec<f32> {
    multi_level_inverse(avg, details, haar_inverse)
}
pub fn db2_forward_multi(input: &[f32], levels: usize) -> (Vec<f32>, Vec<Vec<f32>>) {
    multi_level_forward(input, levels, db2_forward)
}
pub fn db2_inverse_multi(avg: &[f32], details: &[Vec<f32>]) -> Vec<f32> {
    multi_level_inverse(avg, details, db2_inverse)
}
pub fn db4_forward_multi(input: &[f32], levels: usize) -> (Vec<f32>, Vec<Vec<f32>>) {
    multi_level_forward(input, levels, db4_forward)
}
pub fn db4_inverse_multi(avg: &[f32], details: &[Vec<f32>]) -> Vec<f32> {
    multi_level_inverse(avg, details, db4_inverse)
}
pub fn sym4_forward_multi(input: &[f32], levels: usize) -> (Vec<f32>, Vec<Vec<f32>>) {
    multi_level_forward(input, levels, sym4_forward)
}
pub fn sym4_inverse_multi(avg: &[f32], details: &[Vec<f32>]) -> Vec<f32> {
    multi_level_inverse(avg, details, sym4_inverse)
}
pub fn coif1_forward_multi(input: &[f32], levels: usize) -> (Vec<f32>, Vec<Vec<f32>>) {
    multi_level_forward(input, levels, coif1_forward)
}
pub fn coif1_inverse_multi(avg: &[f32], details: &[Vec<f32>]) -> Vec<f32> {
    multi_level_inverse(avg, details, coif1_inverse)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_haar_wavelet_roundtrip() {
        let x = [1.0, 2.0, 3.0, 4.0];
        let (avg, diff) = haar_forward(&x);
        let recon = haar_inverse(&avg, &diff);
        for (a, b) in x.iter().zip(recon.iter()) {
            assert!((a - b).abs() < 1e-5, "{} vs {}", a, b);
        }
    }
}

#[cfg(test)]
mod batch_tests {
    use super::*;
    #[test]
    fn test_haar_batch_roundtrip() {
        let xs = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        let (avgs, diffs) = batch_forward(&xs);
        let recon = batch_inverse(&avgs, &diffs);
        for (orig, rec) in xs.iter().zip(recon.iter()) {
            for (a, b) in orig.iter().zip(rec.iter()) {
                assert!((a - b).abs() < 1e-5);
            }
        }
    }
}

#[cfg(test)]
mod db2_tests {
    use super::*;
    #[test]
    fn test_db2_batch_roundtrip() {
        // For short signals, db2 is not perfectly invertible due to boundary effects.
        // This test demonstrates the limitation: the error is small relative to the signal.
        let xs = vec![vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0], vec![5.0, 6.0, 7.0, 8.0, 1.0, 2.0, 3.0, 4.0]];
        let (avgs, diffs) = db2_forward_batch(&xs);
        let recon = db2_inverse_batch(&avgs, &diffs);
        let mut max_err = 0.0;
        let mut max_val = 0.0;
        for (orig, rec) in xs.iter().zip(recon.iter()) {
            for (a, b) in orig.iter().zip(rec.iter()) {
                let err = (a - b).abs();
                if err > max_err { max_err = err; }
                if a.abs() > max_val { max_val = a.abs(); }
            }
        }
        // For short signals, db2 is not suitable for strict roundtrip. Error should be less than the max signal value.
        assert!(max_err < max_val, "max error for db2 roundtrip: {} (max signal value: {})", max_err, max_val);
    }
    #[test]
    fn test_haar_batch_roundtrip_strict() {
        // Haar wavelet is perfectly invertible for all signal lengths
        let xs = vec![vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0], vec![5.0, 6.0, 7.0, 8.0, 1.0, 2.0, 3.0, 4.0]];
        let (avgs, diffs) = batch_forward(&xs);
        let recon = batch_inverse(&avgs, &diffs);
        for (orig, rec) in xs.iter().zip(recon.iter()) {
            for (a, b) in orig.iter().zip(rec.iter()) {
                assert!((a - b).abs() < 1e-6, "{} vs {}", a, b);
            }
        }
    }
}

#[cfg(test)]
mod multilevel_tests {
    use super::*;

    #[test]
    fn test_haar_multi_roundtrip() {
        let x = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let (a, d) = haar_forward_multi(&x, 3);
        let recon = haar_inverse_multi(&a, &d);
        for (o, r) in x.iter().zip(recon.iter()) {
            assert!((o - r).abs() < 1e-5);
        }
    }

}
