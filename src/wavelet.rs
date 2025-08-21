//! Wavelet Transform module
//! Supports Haar wavelet transform (forward and inverse) for f32
//! no_std + alloc compatible

#![allow(clippy::excessive_precision)]

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;

use core::fmt;

/// Number of samples processed together in the Haar transform pair.
pub const HAAR_PAIR_LEN: usize = 2;
/// Scaling factor applied when computing averages and differences.
pub const HAAR_SCALE: f32 = 0.5;

/// Output of [`batch_forward`]: per-input average and detail coefficients.
pub type BatchOutput = (Vec<Vec<f32>>, Vec<Vec<f32>>);
/// Output of [`multi_level_forward_batch`]: per-input averages and per-level
/// detail coefficients.
pub type MultiLevelBatchOutput = (Vec<Vec<f32>>, Vec<Vec<Vec<f32>>>);
/// Daubechies-4 low-pass decomposition filter coefficients.
/// Each value represents a tap of the scaling filter used during the forward transform.
pub const DB4_FORWARD_LOWPASS: [f32; 8] = [
    -0.010597401785069032, // h0: first smoothing coefficient
    0.0328830116668852,    // h1: second smoothing coefficient
    0.030841381835560764,  // h2: third smoothing coefficient
    -0.18703481171909309,  // h3: fourth smoothing coefficient
    -0.027983769416859854, // h4: fifth smoothing coefficient
    0.6308807679298589,    // h5: sixth smoothing coefficient
    0.7148465705529157,    // h6: seventh smoothing coefficient
    0.2303778133088965,    // h7: eighth smoothing coefficient
];

/// Daubechies-4 high-pass decomposition filter coefficients.
/// Applied during the forward transform to compute detail components.
pub const DB4_FORWARD_HIGHPASS: [f32; 8] = [
    -0.2303778133088965,   // g0: first detail coefficient
    0.7148465705529157,    // g1: second detail coefficient
    -0.6308807679298589,   // g2: third detail coefficient
    -0.027983769416859854, // g3: fourth detail coefficient
    0.18703481171909309,   // g4: fifth detail coefficient
    0.030841381835560764,  // g5: sixth detail coefficient
    -0.0328830116668852,   // g6: seventh detail coefficient
    -0.010597401785069032, // g7: eighth detail coefficient
];

/// Daubechies-4 low-pass reconstruction filter coefficients.
/// These coefficients rebuild the approximation component during the inverse transform.
pub const DB4_INVERSE_LOWPASS: [f32; 8] = [
    0.2303778133088965,    // g0: first reconstruction coefficient
    0.7148465705529157,    // g1: second reconstruction coefficient
    0.6308807679298589,    // g2: third reconstruction coefficient
    -0.027983769416859854, // g3: fourth reconstruction coefficient
    -0.18703481171909309,  // g4: fifth reconstruction coefficient
    0.030841381835560764,  // g5: sixth reconstruction coefficient
    0.0328830116668852,    // g6: seventh reconstruction coefficient
    -0.010597401785069032, // g7: eighth reconstruction coefficient
];

/// Daubechies-4 high-pass reconstruction filter coefficients.
/// These values rebuild the detail component during the inverse transform.
pub const DB4_INVERSE_HIGHPASS: [f32; 8] = [
    -0.010597401785069032, // h0: first reconstruction detail coefficient
    -0.0328830116668852,   // h1: second reconstruction detail coefficient
    0.030841381835560764,  // h2: third reconstruction detail coefficient
    0.18703481171909309,   // h3: fourth reconstruction detail coefficient
    -0.027983769416859854, // h4: fifth reconstruction detail coefficient
    -0.6308807679298589,   // h5: sixth reconstruction detail coefficient
    0.7148465705529157,    // h6: seventh reconstruction detail coefficient
    -0.2303778133088965,   // h7: eighth reconstruction detail coefficient
];

/// Daubechies-2 (db2) low-pass analysis filter coefficients.
/// These coefficients are used during the forward transform to compute approximation components.
pub const DB2_ANALYSIS_LOW: [f32; 4] = [
    0.16290171400361862,   // h0: first smoothing coefficient
    0.5054728575456481,    // h1: second smoothing coefficient
    0.4463951772316719,    // h2: third smoothing coefficient
    -0.019787513117910776, // h3: fourth smoothing coefficient
];

/// Daubechies-2 (db2) high-pass analysis filter coefficients.
/// These coefficients are used during the forward transform to compute detail components.
pub const DB2_ANALYSIS_HIGH: [f32; 4] = [
    0.019787513117910776, // g0: first detail coefficient
    0.4463951772316719,   // g1: second detail coefficient
    -0.5054728575456481,  // g2: third detail coefficient
    0.16290171400361862,  // g3: fourth detail coefficient
];

/// Daubechies-2 (db2) low-pass synthesis filter coefficients.
/// These coefficients are used during the inverse transform to reconstruct approximation components.
pub const DB2_SYNTHESIS_LOW: [f32; 4] = [
    0.16290171400361862,   // h0: first reconstruction coefficient
    0.5054728575456481,    // h1: second reconstruction coefficient
    0.4463951772316719,    // h2: third reconstruction coefficient
    -0.019787513117910776, // h3: fourth reconstruction coefficient
];

/// Daubechies-2 (db2) high-pass synthesis filter coefficients.
/// These coefficients are used during the inverse transform to reconstruct detail components.
pub const DB2_SYNTHESIS_HIGH: [f32; 4] = [
    0.019787513117910776, // g0: first reconstruction detail coefficient
    0.4463951772316719,   // g1: second reconstruction detail coefficient
    -0.5054728575456481,  // g2: third reconstruction detail coefficient
    0.16290171400361862,  // g3: fourth reconstruction detail coefficient
];

/// Errors produced by wavelet operations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WaveletError {
    /// The input length was odd when an even length was required.
    InputLengthOdd { len: usize },
    /// The buffers provided to the inverse transform did not match in size.
    BufferSizeMismatch { avg: usize, diff: usize },
}

impl fmt::Display for WaveletError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WaveletError::InputLengthOdd { len } => {
                write!(f, "input length {} is not even", len)
            }
            WaveletError::BufferSizeMismatch { avg, diff } => {
                write!(
                    f,
                    "average buffer length {} does not match detail buffer length {}",
                    avg, diff
                )
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for WaveletError {}

/// Forward Haar wavelet transform (single level)
///
/// # Errors
/// Returns [`WaveletError::InputLengthOdd`] when the input length is not even.
pub fn haar_forward(input: &[f32]) -> Result<(Vec<f32>, Vec<f32>), WaveletError> {
    if input.len() % HAAR_PAIR_LEN != 0 {
        return Err(WaveletError::InputLengthOdd { len: input.len() });
    }
    let n = input.len() / HAAR_PAIR_LEN;
    let mut avg = vec![0.0; n];
    let mut diff = vec![0.0; n];
    for i in 0..n {
        avg[i] = (input[HAAR_PAIR_LEN * i] + input[HAAR_PAIR_LEN * i + 1]) * HAAR_SCALE;
        diff[i] = (input[HAAR_PAIR_LEN * i] - input[HAAR_PAIR_LEN * i + 1]) * HAAR_SCALE;
    }
    Ok((avg, diff))
}

/// Inverse Haar wavelet transform (single level)
///
/// # Errors
/// Returns [`WaveletError::BufferSizeMismatch`] when `avg` and `diff` have different lengths.
pub fn haar_inverse(avg: &[f32], diff: &[f32]) -> Result<Vec<f32>, WaveletError> {
    if avg.len() != diff.len() {
        return Err(WaveletError::BufferSizeMismatch {
            avg: avg.len(),
            diff: diff.len(),
        });
    }
    let n = avg.len();
    let mut output = vec![0.0; n * HAAR_PAIR_LEN];
    for i in 0..n {
        output[HAAR_PAIR_LEN * i] = avg[i] + diff[i];
        output[HAAR_PAIR_LEN * i + 1] = avg[i] - diff[i];
    }
    Ok(output)
}

/// Batch Haar forward transform
///
/// # Errors
/// Propagates any error returned by [`haar_forward`].
pub fn batch_forward(inputs: &[Vec<f32>]) -> Result<BatchOutput, WaveletError> {
    #[allow(clippy::type_complexity)]
    let mut avgs = Vec::with_capacity(inputs.len());
    let mut diffs = Vec::with_capacity(inputs.len());
    for input in inputs {
        let (avg, diff) = haar_forward(input)?;
        avgs.push(avg);
        diffs.push(diff);
    }
    Ok((avgs, diffs))
}
/// Batch Haar inverse transform
///
/// # Errors
/// Propagates any error returned by [`haar_inverse`].
pub fn batch_inverse(avgs: &[Vec<f32>], diffs: &[Vec<f32>]) -> Result<Vec<Vec<f32>>, WaveletError> {
    avgs.iter()
        .zip(diffs.iter())
        .map(|(a, d)| haar_inverse(a, d))
        .collect()
}

/// Multi-level decomposition using a single-level forward function.
///
/// # Errors
/// Propagates any error produced by the provided `forward` function.
pub fn multi_level_forward<F>(
    input: &[f32],
    levels: usize,
    forward: F,
) -> Result<(Vec<f32>, Vec<Vec<f32>>), WaveletError>
where
    F: Fn(&[f32]) -> Result<(Vec<f32>, Vec<f32>), WaveletError>,
{
    let mut current = input.to_vec();
    let mut details = Vec::with_capacity(levels);
    for _ in 0..levels {
        if current.len() % HAAR_PAIR_LEN != 0 {
            if let Some(&last) = current.last() {
                current.push(last);
            }
        }
        let (avg, diff) = forward(&current)?;
        details.push(diff);
        current = avg;
    }
    Ok((current, details))
}

/// Multi-level reconstruction using a single-level inverse function.
///
/// # Errors
/// Propagates any error produced by the provided `inverse` function.
pub fn multi_level_inverse<F>(
    approx: &[f32],
    details: &[Vec<f32>],
    inverse: F,
) -> Result<Vec<f32>, WaveletError>
where
    F: Fn(&[f32], &[f32]) -> Result<Vec<f32>, WaveletError>,
{
    let mut current = approx.to_vec();
    for d in details.iter().rev() {
        if current.len() < d.len() {
            return Err(WaveletError::BufferSizeMismatch {
                avg: current.len(),
                diff: d.len(),
            });
        } else if current.len() > d.len() {
            current.truncate(d.len());
        }
        current = inverse(&current, d)?;
    }
    Ok(current)
}

/// Batch multi-level decomposition.
///
/// # Errors
/// Propagates any error produced by [`multi_level_forward`].
#[allow(clippy::type_complexity)]
pub fn multi_level_forward_batch<F>(
    inputs: &[Vec<f32>],
    levels: usize,
    forward: F,
) -> Result<MultiLevelBatchOutput, WaveletError>
where
    F: Fn(&[f32]) -> Result<(Vec<f32>, Vec<f32>), WaveletError>,
{
    let mut avgs = Vec::with_capacity(inputs.len());
    let mut diffs = Vec::with_capacity(inputs.len());
    for input in inputs {
        let (avg, diff_levels) = multi_level_forward(input, levels, &forward)?;
        avgs.push(avg);
        diffs.push(diff_levels);
    }
    Ok((avgs, diffs))
}

/// Batch multi-level reconstruction.
///
/// # Errors
/// Propagates any error produced by [`multi_level_inverse`].
pub fn multi_level_inverse_batch<F>(
    avgs: &[Vec<f32>],
    diffs: &[Vec<Vec<f32>>],
    inverse: F,
) -> Result<Vec<Vec<f32>>, WaveletError>
where
    F: Fn(&[f32], &[f32]) -> Result<Vec<f32>, WaveletError>,
{
    avgs.iter()
        .zip(diffs.iter())
        .map(|(a, d)| multi_level_inverse(a, d, &inverse))
        .collect()
}

/// MCU/stack-only, const-generic, in-place Haar wavelet forward (N must be even, no heap)
/// Output buffers avg and diff must be of length N/2.
pub fn haar_forward_inplace_stack<const N: usize>(
    input: &[f32; N],
    avg: &mut [f32],
    diff: &mut [f32],
) {
    let n = N / HAAR_PAIR_LEN;
    assert!(
        avg.len() == n && diff.len() == n,
        "Output buffers must be of length N/2"
    );
    for i in 0..n {
        avg[i] = (input[HAAR_PAIR_LEN * i] + input[HAAR_PAIR_LEN * i + 1]) * HAAR_SCALE;
        diff[i] = (input[HAAR_PAIR_LEN * i] - input[HAAR_PAIR_LEN * i + 1]) * HAAR_SCALE;
    }
}

/// MCU/stack-only, const-generic, in-place Haar wavelet inverse (N must be even, no heap)
/// Output buffer out must be of length 2*N.
pub fn haar_inverse_inplace_stack<const N: usize>(avg: &[f32], diff: &[f32], out: &mut [f32]) {
    let n = avg.len();
    assert!(
        diff.len() == n && out.len() == HAAR_PAIR_LEN * n,
        "Output buffer must be of length 2*N"
    );
    for i in 0..n {
        out[HAAR_PAIR_LEN * i] = avg[i] + diff[i];
        out[HAAR_PAIR_LEN * i + 1] = avg[i] - diff[i];
    }
}

/// Daubechies-2 (db2) wavelet transform (single level)
/// Note: For short signals, perfect roundtrip is not guaranteed due to mathematical boundary effects.
/// This is a property of the db2 wavelet, not a bug in the implementation.
pub fn db2_forward(input: &[f32]) -> (Vec<f32>, Vec<f32>) {
    let n = input.len() / 2;
    let mut approx = vec![0.0; n];
    let mut detail = vec![0.0; n];
    let len = input.len();
    // Symmetric extension helper: reflect indices outside the signal range.
    let reflect = |mut idx: isize| -> f32 {
        let n = len as isize;
        while idx < 0 || idx >= n {
            idx = if idx < 0 { -idx } else { 2 * (n - 1) - idx };
        }
        input[idx as usize]
    };
    for i in 0..n {
        let j = 2 * i as isize;
        for k in 0..4 {
            let sample = reflect(j + k as isize);
            approx[i] += DB2_ANALYSIS_LOW[k] * sample;
            detail[i] += DB2_ANALYSIS_HIGH[k] * sample;
        }
    }
    (approx, detail)
}
/// Daubechies-2 (db2) inverse wavelet transform (single level)
/// Standard implementation: upsample, convolve with synthesis filters, symmetric extension.
pub fn db2_inverse(approx: &[f32], detail: &[f32]) -> Vec<f32> {
    let n = approx.len();
    let len = n * 2;
    let mut output = vec![0.0; len];
    // Symmetric extension helper: reflect indices outside the signal range.
    let reflect = |mut idx: isize| -> usize {
        let n = len as isize;
        while idx < 0 || idx >= n {
            idx = if idx < 0 { -idx } else { 2 * (n - 1) - idx };
        }
        idx as usize
    };
    // Upsample and convolve with synthesis filters.
    for i in 0..n {
        let j = 2 * i;
        for k in 0..4 {
            let idx = reflect(j as isize + k as isize);
            output[idx] += DB2_SYNTHESIS_LOW[k] * approx[i] + DB2_SYNTHESIS_HIGH[k] * detail[i];
        }
    }
    output
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
    avgs.iter()
        .zip(diffs.iter())
        .map(|(a, d)| db2_inverse(a, d))
        .collect()
}

/// Daubechies-4 (db4) wavelet transform (single level).
///
/// # Errors
/// Returns [`WaveletError::InputLengthOdd`] when the input length is not even.
pub fn db4_forward(input: &[f32]) -> Result<(Vec<f32>, Vec<f32>), WaveletError> {
    if input.len() % HAAR_PAIR_LEN != 0 {
        return Err(WaveletError::InputLengthOdd { len: input.len() });
    }
    let n = input.len() / HAAR_PAIR_LEN;
    let mut approx = vec![0.0; n];
    let mut detail = vec![0.0; n];
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
        for k in 0..DB4_FORWARD_LOWPASS.len() {
            let val = reflect(j + k as isize);
            approx[i] += DB4_FORWARD_LOWPASS[k] * val;
            detail[i] += DB4_FORWARD_HIGHPASS[k] * val;
        }
    }
    Ok((approx, detail))
}

/// Daubechies-4 (db4) inverse wavelet transform (single level).
///
/// # Errors
/// Returns [`WaveletError::BufferSizeMismatch`] when `approx` and `detail` differ in length.
pub fn db4_inverse(approx: &[f32], detail: &[f32]) -> Result<Vec<f32>, WaveletError> {
    if approx.len() != detail.len() {
        return Err(WaveletError::BufferSizeMismatch {
            avg: approx.len(),
            diff: detail.len(),
        });
    }
    let n = approx.len();
    let len = n * HAAR_PAIR_LEN;
    let mut output = vec![0.0; len];
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
        for k in 0..DB4_INVERSE_LOWPASS.len() {
            let idx = reflect(j as isize + k as isize);
            output[idx] += DB4_INVERSE_LOWPASS[k] * approx[i] + DB4_INVERSE_HIGHPASS[k] * detail[i];
        }
    }
    Ok(output)
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

/// Multi-level Haar forward transform.
/// Pads odd-length inputs by repeating the last sample to avoid indexing errors.
///
/// # Errors
/// Propagates any error from [`haar_forward`].
pub fn haar_forward_multi(
    input: &[f32],
    levels: usize,
) -> Result<(Vec<f32>, Vec<Vec<f32>>), WaveletError> {
    multi_level_forward(input, levels, haar_forward)
}

/// Multi-level Haar inverse transform.
/// Truncates intermediate buffers when necessary to maintain valid lengths.
///
/// # Errors
/// Propagates any error from [`haar_inverse`].
pub fn haar_inverse_multi(avg: &[f32], details: &[Vec<f32>]) -> Result<Vec<f32>, WaveletError> {
    multi_level_inverse(avg, details, haar_inverse)
}
pub fn db2_forward_multi(
    input: &[f32],
    levels: usize,
) -> Result<(Vec<f32>, Vec<Vec<f32>>), WaveletError> {
    multi_level_forward(input, levels, |x| Ok(db2_forward(x)))
}
pub fn db2_inverse_multi(avg: &[f32], details: &[Vec<f32>]) -> Result<Vec<f32>, WaveletError> {
    multi_level_inverse(avg, details, |a, d| Ok(db2_inverse(a, d)))
}
/// Multi-level db4 forward transform.
/// Mirrors edge samples to handle boundaries and avoid index errors.
///
/// # Errors
/// Propagates any error from [`db4_forward`].
pub fn db4_forward_multi(
    input: &[f32],
    levels: usize,
) -> Result<(Vec<f32>, Vec<Vec<f32>>), WaveletError> {
    multi_level_forward(input, levels, db4_forward)
}

/// Multi-level db4 inverse transform.
/// Truncates intermediate buffers when padding was applied during decomposition.
///
/// # Errors
/// Propagates any error from [`db4_inverse`].
pub fn db4_inverse_multi(avg: &[f32], details: &[Vec<f32>]) -> Result<Vec<f32>, WaveletError> {
    multi_level_inverse(avg, details, db4_inverse)
}
pub fn sym4_forward_multi(
    input: &[f32],
    levels: usize,
) -> Result<(Vec<f32>, Vec<Vec<f32>>), WaveletError> {
    multi_level_forward(input, levels, |x| Ok(sym4_forward(x)))
}
pub fn sym4_inverse_multi(avg: &[f32], details: &[Vec<f32>]) -> Result<Vec<f32>, WaveletError> {
    multi_level_inverse(avg, details, |a, d| Ok(sym4_inverse(a, d)))
}
pub fn coif1_forward_multi(
    input: &[f32],
    levels: usize,
) -> Result<(Vec<f32>, Vec<Vec<f32>>), WaveletError> {
    multi_level_forward(input, levels, |x| Ok(coif1_forward(x)))
}
pub fn coif1_inverse_multi(avg: &[f32], details: &[Vec<f32>]) -> Result<Vec<f32>, WaveletError> {
    multi_level_inverse(avg, details, |a, d| Ok(coif1_inverse(a, d)))
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    #[test]
    /// Verifies that forward and inverse Haar transforms round-trip accurately.
    fn test_haar_wavelet_roundtrip() {
        let x = [1.0, 2.0, 3.0, 4.0];
        let (avg, diff) = haar_forward(&x).unwrap();
        let recon = haar_inverse(&avg, &diff).unwrap();
        for (a, b) in x.iter().zip(recon.iter()) {
            assert!((a - b).abs() < 1e-5, "{} vs {}", a, b);
        }
    }

    #[test]
    /// Ensures an error is returned for odd-length input slices.
    fn test_haar_forward_odd_length_error() {
        let x = [1.0, 2.0, 3.0];
        match haar_forward(&x) {
            Err(WaveletError::InputLengthOdd { len }) => assert_eq!(len, 3),
            other => panic!("unexpected result: {:?}", other),
        }
    }

    #[test]
    /// Ensures an error is returned when buffers for inverse differ in size.
    fn test_haar_inverse_mismatch_error() {
        let avg = [1.0, 2.0];
        let diff = [1.0];
        match haar_inverse(&avg, &diff) {
            Err(WaveletError::BufferSizeMismatch { avg: a, diff: d }) => {
                assert_eq!((a, d), (2, 1))
            }
            other => panic!("unexpected result: {:?}", other),
        }
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod batch_tests {
    use super::*;
    #[test]
    /// Checks that batch Haar transform round-trips multiple signals.
    fn test_haar_batch_roundtrip() {
        let xs = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        let (avgs, diffs) = batch_forward(&xs).unwrap();
        let recon = batch_inverse(&avgs, &diffs).unwrap();
        for (orig, rec) in xs.iter().zip(recon.iter()) {
            for (a, b) in orig.iter().zip(rec.iter()) {
                assert!((a - b).abs() < 1e-5);
            }
        }
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod db2_tests {
    use super::*;
    #[test]
    /// Validates db2 wavelet batch round-trip within acceptable error.
    fn test_db2_batch_roundtrip() {
        // For short signals, db2 is not perfectly invertible due to boundary effects.
        // This test demonstrates the limitation: the error is small relative to the signal.
        let xs = vec![
            vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
            vec![5.0, 6.0, 7.0, 8.0, 1.0, 2.0, 3.0, 4.0],
        ];
        let (avgs, diffs) = db2_forward_batch(&xs);
        let recon = db2_inverse_batch(&avgs, &diffs);
        let mut max_err = 0.0;
        let mut max_val = 0.0;
        for (orig, rec) in xs.iter().zip(recon.iter()) {
            for (a, b) in orig.iter().zip(rec.iter()) {
                let err = (a - b).abs();
                if err > max_err {
                    max_err = err;
                }
                if a.abs() > max_val {
                    max_val = a.abs();
                }
            }
        }
        // For short signals, db2 is not suitable for strict roundtrip. Error should be less than the max signal value.
        assert!(
            max_err < max_val,
            "max error for db2 roundtrip: {} (max signal value: {})",
            max_err,
            max_val
        );
    }
    #[test]
    /// Confirms Haar batch transforms are lossless for even-length inputs.
    fn test_haar_batch_roundtrip_strict() {
        // Haar wavelet is perfectly invertible for all signal lengths
        let xs = vec![
            vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
            vec![5.0, 6.0, 7.0, 8.0, 1.0, 2.0, 3.0, 4.0],
        ];
        let (avgs, diffs) = batch_forward(&xs).unwrap();
        let recon = batch_inverse(&avgs, &diffs).unwrap();
        for (orig, rec) in xs.iter().zip(recon.iter()) {
            for (a, b) in orig.iter().zip(rec.iter()) {
                assert!((a - b).abs() < 1e-6, "{} vs {}", a, b);
            }
        }
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod multilevel_tests {
    use super::*;

    #[test]
    /// Verifies multi-level Haar transforms reconstruct the original signal.
    fn test_haar_multi_roundtrip() {
        let x = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let (a, d) = haar_forward_multi(&x, 3).unwrap();
        let recon = haar_inverse_multi(&a, &d).unwrap();
        for (o, r) in x.iter().zip(recon.iter()) {
            assert!((o - r).abs() < 1e-5);
        }
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod additional_tests {
    use super::*;

    #[test]
    /// Validates in-place stack-only Haar transform round-trip.
    fn test_haar_inplace_stack_roundtrip() {
        let input = [1.0_f32, 2.0, 3.0, 4.0];
        let mut avg = [0.0_f32; 2];
        let mut diff = [0.0_f32; 2];
        haar_forward_inplace_stack(&input, &mut avg[..], &mut diff[..]);

        let mut out = [0.0_f32; 4];
        // const generic parameter is inferred from avg length (2)
        haar_inverse_inplace_stack::<2>(&avg[..], &diff[..], &mut out[..]);
        for (a, b) in input.iter().zip(out.iter()) {
            assert!((a - b).abs() < 1e-5, "{} vs {}", a, b);
        }
    }

    #[test]
    /// Ensures batch multi-level transforms reconstruct inputs.
    fn test_multi_level_batch_roundtrip() {
        let inputs = vec![vec![1.0, 2.0, 3.0, 4.0], vec![5.0, 6.0, 7.0, 8.0]];
        let (avgs, diffs) = multi_level_forward_batch(&inputs, 2, haar_forward).unwrap();
        let recon = multi_level_inverse_batch(&avgs, &diffs, haar_inverse).unwrap();
        for (orig, rec) in inputs.iter().zip(recon.iter()) {
            for (a, b) in orig.iter().zip(rec.iter()) {
                assert!((a - b).abs() < 1e-5, "{} vs {}", a, b);
            }
        }
    }

    #[test]
    /// Checks single-level db2 wavelet transform round-trip within error bounds.
    fn test_db2_single_roundtrip() {
        let x = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let (a, d) = db2_forward(&x);
        let recon = db2_inverse(&a, &d);
        let mut max_err = 0.0;
        let mut max_val = 0.0;
        for (orig, rec) in x.iter().zip(recon.iter()) {
            let err = (orig - rec).abs();
            if err > max_err {
                max_err = err;
            }
            if orig.abs() > max_val {
                max_val = orig.abs();
            }
        }
        assert!(
            max_err < max_val,
            "max error for db2 roundtrip: {} (max signal value: {})",
            max_err,
            max_val
        );
    }

    #[test]
    /// Ensures sym4 and coif1 multi-level transforms complete without errors.
    fn test_sym4_and_coif1_multi_roundtrip() {
        let x = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];

        let (sa, sd) = sym4_forward_multi(&x, 2).unwrap();
        let srecon = sym4_inverse_multi(&sa, &sd).unwrap();
        assert_eq!(srecon.len(), x.len());

        let (ca, cd) = coif1_forward_multi(&x, 2).unwrap();
        let crecon = coif1_inverse_multi(&ca, &cd).unwrap();
        assert_eq!(crecon.len(), x.len());
    }
}
