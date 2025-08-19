use alloc::vec::Vec;
use core::cmp;
use core::f32;

/// Linearly resample `input` from `src_rate` to `dst_rate`.
///
/// Returns a newly allocated `Vec<f32>` with the resampled signal.
/// If either rate is non-positive or input is empty, an empty vector is returned.
pub fn linear_resample(input: &[f32], src_rate: f32, dst_rate: f32) -> Vec<f32> {
    if input.is_empty() || src_rate <= 0.0 || dst_rate <= 0.0 {
        return Vec::new();
    }

    if (src_rate - dst_rate).abs() < f32::EPSILON {
        return input.to_vec();
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
    output
}
