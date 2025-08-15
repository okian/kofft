use kofft::fft_kernels::{fft16, fft2, fft4, fft8};
use kofft::Complex32;

fn dft(input: &[Complex32]) -> Vec<Complex32> {
    let n = input.len();
    let mut output = vec![Complex32::zero(); n];
    for k in 0..n {
        let mut sum = Complex32::zero();
        for (n_idx, x) in input.iter().enumerate() {
            let angle = -2.0 * core::f32::consts::PI * (k * n_idx) as f32 / n as f32;
            let tw = Complex32::new(angle.cos(), angle.sin());
            sum = sum.add(x.mul(tw));
        }
        output[k] = sum;
    }
    output
}

fn check_kernel(n: usize, f: fn(&mut [Complex32])) {
    let mut data: Vec<Complex32> = (0..n)
        .map(|i| Complex32::new(i as f32, -(i as f32) * 0.5))
        .collect();
    let expected = dft(&data);
    f(&mut data);
    for (a, b) in data.iter().zip(expected.iter()) {
        assert!((a.re - b.re).abs() < 1e-2);
        assert!((a.im - b.im).abs() < 1e-2);
    }
}

#[test]
fn test_fft2_kernel() {
    check_kernel(2, fft2::<f32>);
}

#[test]
fn test_fft4_kernel() {
    check_kernel(4, fft4::<f32>);
}

#[test]
fn test_fft8_kernel() {
    check_kernel(8, fft8::<f32>);
}

#[test]
fn test_fft16_kernel() {
    check_kernel(16, fft16::<f32>);
}
