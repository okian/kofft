use alloc::vec::Vec;
use core::f32;
use log::{debug, trace};

/// Linearly resample `input` from `src_rate` to `dst_rate`.
///
/// Returns a newly allocated `Vec<f32>` with the resampled signal.
/// If either rate is non-positive, non-finite, or input is empty,
/// an empty vector is returned.
pub fn linear_resample(input: &[f32], src_rate: f32, dst_rate: f32) -> Vec<f32> {
    debug!(
        "linear_resample: input_len={}, src_rate={}, dst_rate={}",
        input.len(),
        src_rate,
        dst_rate
    );

    if input.is_empty()
        || src_rate <= 0.0
        || dst_rate <= 0.0
        || !src_rate.is_finite()
        || !dst_rate.is_finite()
    {
        debug!("linear_resample: invalid parameters, returning empty vector");
        return Vec::new();
    }

    if (src_rate - dst_rate).abs() < f32::EPSILON {
        debug!("linear_resample: identical rates, returning input copy");
        return input.to_vec();
    }

    let ratio = dst_rate / src_rate;
    let out_len = (input.len() as f32 * ratio).ceil() as usize;
    let inv_ratio = 1.0 / ratio; // precompute reciprocal for faster loop
    let last = input.len() - 1;
    let mut output = Vec::with_capacity(out_len);

    for i in 0..out_len {
        let pos = i as f32 * inv_ratio;
        let idx = pos.floor() as usize;
        let frac = pos - idx as f32;
        let (s0, s1) = if idx >= last {
            let v = input[last];
            (v, v)
        } else {
            (input[idx], input[idx + 1])
        };
        trace!(
            "resample step: i={}, pos={}, idx={}, frac={}",
            i,
            pos,
            idx,
            frac
        );
        output.push(s0 + (s1 - s0) * frac);
    }
    debug!("linear_resample: produced {} samples", output.len());
    output
}
