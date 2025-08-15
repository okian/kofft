use kofft::fft::{Complex32, FftImpl, ScalarFftImpl};

fn slow_dft(input: &[Complex32]) -> Vec<Complex32> {
    let n = input.len();
    let mut out = vec![Complex32::new(0.0, 0.0); n];
    for k in 0..n {
        let mut sum = Complex32::new(0.0, 0.0);
        for j in 0..n {
            let angle = -2.0 * core::f32::consts::PI * (j * k) as f32 / n as f32;
            let w = Complex32::new(angle.cos(), angle.sin());
            sum = sum.add(input[j].mul(w));
        }
        out[k] = sum;
    }
    out
}

#[test]
fn small_fft_kernels_match_dft() {
    let sizes = [2usize, 4, 8, 16];
    for &n in &sizes {
        let mut data: Vec<Complex32> = (0..n)
            .map(|i| Complex32::new(i as f32, -(i as f32)))
            .collect();
        let expected = slow_dft(&data);
        let fft = ScalarFftImpl::<f32>::default();
        fft.fft(&mut data).unwrap();
        for (a, b) in data.iter().zip(expected.iter()) {
            assert!((a.re - b.re).abs() < 1e-3, "n={} re", n);
            assert!((a.im - b.im).abs() < 1e-3, "n={} im", n);
        }
    }
}
