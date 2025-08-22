// Test intent: verifies small kernels behavior including edge cases.
use kofft::fft::{fft16, fft8, Complex32, ScalarFftImpl};

fn dft(input: &[Complex32]) -> Vec<Complex32> {
    let n = input.len();
    let mut output = vec![Complex32::zero(); n];
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = Complex32::zero();
        for (n_idx, x) in input.iter().enumerate() {
            let angle = -2.0 * core::f32::consts::PI * (k * n_idx) as f32 / n as f32;
            let tw = Complex32::new(angle.cos(), angle.sin());
            sum = sum.add(x.mul(tw));
        }
        *out = sum;
    }
    output
}

#[test]
fn stockham_small_kernels() {
    let fft = ScalarFftImpl::<f32>::default();
    for &n in &[2usize, 4, 8, 16] {
        let mut data: Vec<Complex32> = (0..n)
            .map(|i| Complex32::new(i as f32, -(i as f32) * 0.5))
            .collect();
        let expected = dft(&data);
        fft.stockham_fft(&mut data)
            .expect("Invariant: operation should succeed");
        for (a, b) in data.iter().zip(expected.iter()) {
            assert!((a.re - b.re).abs() < 1e-2);
            assert!((a.im - b.im).abs() < 1e-2);
        }
    }
}

#[test]
fn direct_fft8_16_kernels() {
    // Test fft8
    let mut data: Vec<Complex32> = (0..8)
        .map(|i| Complex32::new((i as f32).sin(), (i as f32).cos()))
        .collect();
    let expected = dft(&data);
    fft8(&mut data);
    for (a, b) in data.iter().zip(expected.iter()) {
        assert!((a.re - b.re).abs() < 1e-2);
        assert!((a.im - b.im).abs() < 1e-2);
    }

    // Test fft16
    let mut data: Vec<Complex32> = (0..16)
        .map(|i| Complex32::new((i as f32).sin(), (i as f32).cos()))
        .collect();
    let expected = dft(&data);
    fft16(&mut data);
    for (a, b) in data.iter().zip(expected.iter()) {
        assert!((a.re - b.re).abs() < 1e-2);
        assert!((a.im - b.im).abs() < 1e-2);
    }
}
