use kofft::fft::{fft16, fft8, Complex32};

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

fn run_kernels() {
    for &n in &[8usize, 16] {
        let mut data: Vec<Complex32> = (0..n)
            .map(|i| Complex32::new((i as f32).sin(), (i as f32).cos()))
            .collect();
        let expected = dft(&data);
        match n {
            8 => fft8(&mut data),
            16 => fft16(&mut data),
            _ => unreachable!(),
        }
        for (a, b) in data.iter().zip(expected.iter()) {
            assert!((a.re - b.re).abs() < 1e-2);
            assert!((a.im - b.im).abs() < 1e-2);
        }
    }
}

#[cfg(feature = "simd")]
#[test]
fn kernels_with_simd() {
    run_kernels();
}

#[cfg(not(feature = "simd"))]
#[test]
fn kernels_without_simd() {
    run_kernels();
}
