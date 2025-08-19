use alloc::vec::Vec;
use core::cmp;
use core::f32;
use core::fmt;

/// Errors that can occur during resampling.
#[derive(Debug, Clone, PartialEq)]
pub enum ResampleError {
    /// The input slice was empty.
    EmptyInput,
    /// The source sample rate was non-positive.
    InvalidSrcRate,
    /// The destination sample rate was non-positive.
    InvalidDstRate,
}

impl fmt::Display for ResampleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ResampleError::EmptyInput => write!(f, "input slice is empty"),
            ResampleError::InvalidSrcRate => {
                write!(f, "source sample rate must be positive")
            }
            ResampleError::InvalidDstRate => {
                write!(f, "destination sample rate must be positive")
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for ResampleError {}

/// Linearly resample `input` from `src_rate` to `dst_rate`.
///
/// Returns a newly allocated `Vec<f32>` with the resampled signal.
///
/// # Errors
///
/// Returns [`ResampleError`] if the input is empty or either rate is non-positive.
pub fn linear_resample(
    input: &[f32],
    src_rate: f32,
    dst_rate: f32,
) -> Result<Vec<f32>, ResampleError> {
    if src_rate <= 0.0 {
        return Err(ResampleError::InvalidSrcRate);
    }
    if dst_rate <= 0.0 {
        return Err(ResampleError::InvalidDstRate);
    }
    if input.is_empty() {
        return Err(ResampleError::EmptyInput);
    }

    if (src_rate - dst_rate).abs() < f32::EPSILON {
        return Ok(input.to_vec());
    }

    let ratio = dst_rate / src_rate;
    let out_len = (input.len() as f32 * ratio).ceil() as usize;
    let mut output = Vec::with_capacity(out_len);

    for i in 0..out_len {
        let pos = i as f32 / ratio;
        let idx = pos.floor() as usize;
        let frac = pos - idx as f32;
        let last = input.len() - 1;
        let s0 = input[cmp::min(idx, last)];
        let s1 = input[cmp::min(idx + 1, last)];
        output.push(s0 + (s1 - s0) * frac);
    }
    Ok(output)
}
