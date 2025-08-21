use alloc::vec;
use alloc::vec::Vec;
use core::cmp;
use core::f32;
use core::fmt;

/// Absolute tolerance used when validating sample rates.
///
/// Extremely small positive rates are effectively equivalent to zero and lead
/// to unstable ratios.  A named constant documents this boundary and avoids
/// sprinkling `f32::EPSILON` throughout the code base.
const RATE_EPSILON: f32 = f32::EPSILON;

/// Relative tolerance used when comparing source and destination rates.
///
/// Resampling is skipped when the absolute difference between `src_rate` and
/// `dst_rate` is less than or equal to `src_rate * RATE_REL_TOL`, preventing
/// unnecessary work for nearly identical rates while still avoiding floating
/// point noise.
const RATE_REL_TOL: f32 = 1e-6;

/// Minimum number of channels accepted by the resampler.
///
/// A value of zero channels is nonsensical for audio processing and would lead
/// to division by zero in length calculations, so we enforce a documented
/// constant for clarity and fail fast if the caller provides an invalid count.
const MIN_CHANNELS: usize = 1;

/// Errors that can occur during resampling.
#[derive(Debug, Clone, PartialEq)]
pub enum ResampleError {
    /// The input slice was empty.
    EmptyInput,
    /// The source sample rate was non-positive or non-finite.
    InvalidSrcRate,
    /// The destination sample rate was non-positive or non-finite.
    InvalidDstRate,
    /// The channel count was zero.
    InvalidChannels,
    /// The input length was not a multiple of the channel count.
    MisalignedChannels,
}

impl fmt::Display for ResampleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ResampleError::EmptyInput => write!(f, "input slice is empty"),
            ResampleError::InvalidSrcRate => {
                write!(f, "source sample rate must be finite and positive")
            }
            ResampleError::InvalidDstRate => {
                write!(f, "destination sample rate must be finite and positive")
            }
            ResampleError::InvalidChannels => {
                write!(f, "channel count must be at least {}", MIN_CHANNELS)
            }
            ResampleError::MisalignedChannels => {
                write!(f, "input length must be a multiple of the channel count")
            }
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for ResampleError {}

/// Linearly resample `input` from `src_rate` to `dst_rate` for a single
/// channel of audio samples.
///
/// This is a convenience wrapper around [`linear_resample_channels`] that
/// assumes exactly one channel.  It performs no additional allocations beyond
/// the final output buffer and therefore avoids per-iteration pushes inside the
/// interpolation loop.
///
/// # Errors
///
/// Propagates any [`ResampleError`] produced by
/// [`linear_resample_channels`].
pub fn linear_resample(
    input: &[f32],
    src_rate: f32,
    dst_rate: f32,
) -> Result<Vec<f32>, ResampleError> {
    linear_resample_channels(input, src_rate, dst_rate, MIN_CHANNELS)
}

/// Linearly resample interleaved multi-channel `input` from `src_rate` to
/// `dst_rate`.
///
/// The function operates on frames of interleaved audio where samples for each
/// channel appear sequentially.  It first validates the sample rates and channel
/// count, then allocates the exact output buffer size and fills it in place to
/// avoid redundant allocations or reallocations.
///
/// # Errors
///
/// Returns [`ResampleError`] if any of the following conditions hold:
///
/// - `src_rate` or `dst_rate` are non‑positive,
/// - `channels` is zero,
/// - `input` is empty,
/// - `input.len()` is not a multiple of `channels`.
pub fn linear_resample_channels(
    input: &[f32],
    src_rate: f32,
    dst_rate: f32,
    channels: usize,
) -> Result<Vec<f32>, ResampleError> {
    if !src_rate.is_finite() || src_rate <= RATE_EPSILON {
        return Err(ResampleError::InvalidSrcRate);
    }
    if !dst_rate.is_finite() || dst_rate <= RATE_EPSILON {
        return Err(ResampleError::InvalidDstRate);
    }
    if input.is_empty() {
        return Err(ResampleError::EmptyInput);
    }
    if channels < MIN_CHANNELS {
        return Err(ResampleError::InvalidChannels);
    }
    if input.len() % channels != 0 {
        return Err(ResampleError::MisalignedChannels);
    }

    // Skip processing when the source and destination rates are effectively
    // identical under a relative tolerance.  This guards against doing expensive
    // work for minute differences caused by floating point rounding.
    let abs_diff = (src_rate - dst_rate).abs();
    if abs_diff <= src_rate * RATE_REL_TOL {
        return Ok(input.to_vec());
    }

    let frames = input.len() / channels;
    let ratio = dst_rate / src_rate;
    let out_frames = (frames as f32 * ratio).ceil() as usize;
    let mut output = vec![0.0; out_frames * channels];
    let last = frames - 1;

    for ch in 0..channels {
        for i in 0..out_frames {
            let pos = i as f32 / ratio;
            let idx = cmp::min(pos.floor() as usize, last);
            let frac = pos - idx as f32;
            let next = cmp::min(idx + 1, last);
            let s0 = input[idx * channels + ch];
            let s1 = input[next * channels + ch];
            output[i * channels + ch] = s0 + (s1 - s0) * frac;
        }
    }

    Ok(output)
}
