use kofft::fft::{fft8, fft8_simd, Complex32};
#[cfg(target_arch = "x86_64")]
use kofft::fft::{fft8_avx512dq, fft8_avx512f};

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
fn simd_dispatch_matches_scalar() {
    let mut data: Vec<Complex32> = (0..8)
        .map(|i| Complex32::new((i as f32).sin(), (i as f32).cos()))
        .collect();
    let mut expected = data.clone();
    fft8(&mut expected);
    fft8_simd(&mut data);
    for (a, b) in data.iter().zip(expected.iter()) {
        assert!((a.re - b.re).abs() < 1e-2);
        assert!((a.im - b.im).abs() < 1e-2);
    }
}

#[cfg(target_arch = "x86_64")]
#[test]
fn avx512_kernels_match_scalar() {
    let mut data: Vec<Complex32> = (0..8)
        .map(|i| Complex32::new((i as f32).sin(), (i as f32).cos()))
        .collect();
    let mut expected = data.clone();
    fft8(&mut expected);
    unsafe {
        let mut t1 = data.clone();
        fft8_avx512f(&mut t1);
        for (a, b) in t1.iter().zip(expected.iter()) {
            assert!((a.re - b.re).abs() < 1e-2);
            assert!((a.im - b.im).abs() < 1e-2);
        }
        let mut t2 = data;
        fft8_avx512dq(&mut t2);
        for (a, b) in t2.iter().zip(expected.iter()) {
            assert!((a.re - b.re).abs() < 1e-2);
            assert!((a.im - b.im).abs() < 1e-2);
        }
    }
}
