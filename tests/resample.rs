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

    println!("linear: {:?}, nearest: {:?}", linear_time, nearest_time);

    // Ensure the linear resampler is within 2x of the naive nearest neighbour
    assert!(linear_time <= nearest_time * 2);
}
