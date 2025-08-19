use kofft::resample::linear_resample;
use std::time::Instant;

fn naive_nearest(input: &[f32], src_rate: f32, dst_rate: f32) -> Vec<f32> {
    let ratio = src_rate / dst_rate;
    let out_len = (input.len() as f32 / ratio).ceil() as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let idx = (i as f32 * ratio).round() as usize;
        out.push(*input.get(idx).unwrap_or(&0.0));
    }
    out
}

fn mse(a: &[f32], b: &[f32]) -> f32 {
    let len = a.len().min(b.len());
    let mut err = 0.0;
    for i in 0..len {
        let d = a[i] - b[i];
        err += d * d;
    }
    err / len as f32
}

#[test]
fn linear_has_lower_error_than_nearest() {
    let src_rate = 44_100.0;
    let dst_rate = 48_000.0;
    let freq = 1_000.0;
    let duration = 0.1; // seconds
    let len = (src_rate * duration) as usize;
    let input: Vec<f32> = (0..len)
        .map(|i| (2.0 * std::f32::consts::PI * freq * i as f32 / src_rate).sin())
        .collect();
    let expected: Vec<f32> = (0..(dst_rate * duration) as usize)
        .map(|i| (2.0 * std::f32::consts::PI * freq * i as f32 / dst_rate).sin())
        .collect();

    let linear = linear_resample(&input, src_rate, dst_rate);
    let nearest = naive_nearest(&input, src_rate, dst_rate);

    let err_linear = mse(&linear, &expected);
    let err_nearest = mse(&nearest, &expected);

    assert!(err_linear < err_nearest);
}

#[test]
fn linear_resample_handles_trailing_sample() {
    let input = vec![0.0, 1.0, 0.0];
    let output = linear_resample(&input, 3.0, 6.0);
    assert_eq!(output.last().copied(), input.last().copied());
}

#[test]
fn benchmark_linear_resampler() {
    let src_rate = 44_100.0;
    let dst_rate = 48_000.0;
    let input = vec![0.0f32; (src_rate * 2.0) as usize];

    let start = Instant::now();
    let _ = linear_resample(&input, src_rate, dst_rate);
    let linear_time = start.elapsed();

    let start = Instant::now();
    let _ = naive_nearest(&input, src_rate, dst_rate);
    let nearest_time = start.elapsed();

    let linear_ms = linear_time.as_secs_f64() * 1_000.0;
    let nearest_ms = nearest_time.as_secs_f64() * 1_000.0;

    // Ensure the linear resampler is within 3x of the naive nearest neighbour
    assert!(
        linear_ms <= nearest_ms * 3.0,
        "linear: {:.3}ms, nearest: {:.3}ms",
        linear_ms,
        nearest_ms
    );
}
