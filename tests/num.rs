use kofft::num::{
    copy_from_complex, copy_to_complex, Complex32, Complex64, ComplexVec, SplitComplex,
};

/// Acceptable tolerance for floating-point comparisons in tests.
const EPSILON: f64 = 1e-9;

#[test]
fn complex_new_rejects_non_finite() {
    assert!(std::panic::catch_unwind(|| Complex64::new(f64::NAN, 0.0)).is_err());
    assert!(std::panic::catch_unwind(|| Complex64::new(f64::INFINITY, 0.0)).is_err());
}

#[test]
fn copy_functions_zero_length() {
    let input: [Complex32; 0] = [];
    let mut re = [];
    let mut im = [];
    copy_from_complex(&input, &mut re, &mut im);
    let mut out: [Complex32; 0] = [];
    copy_to_complex(&re, &im, &mut out);
}

#[test]
#[ignore = "extreme values overflow on some architectures"]
fn complex_mul_large_magnitude() {
    // Use values large enough to stress precision without overflowing f64.
    let a = Complex64::new(1.0e150, -1.0e150);
    let b = Complex64::new(-1.0e150, 1.0e150);
    let c = a.mul(b);
    assert!(c.re.is_finite() && c.im.is_finite());
}

#[test]
fn complex_vec_roundtrip_negative() {
    let data = [Complex32::new(-1.0, 2.0), Complex32::new(-3.5, -4.5)];
    let cv = ComplexVec::from_complex_vec(&data);
    let roundtrip = cv.to_complex_vec();
    for (orig, rt) in data.iter().zip(roundtrip.iter()) {
        assert!((orig.re - rt.re).abs() as f64 <= EPSILON);
        assert!((orig.im - rt.im).abs() as f64 <= EPSILON);
    }
}

#[test]
fn split_complex_copy_cycle() {
    let mut re = [1.0f32, -2.0f32];
    let mut im = [3.0f32, 4.0f32];
    {
        let sc = SplitComplex::new(&mut re, &mut im);
        let mut out = [Complex32::zero(); 2];
        sc.copy_to_complex(&mut out);
        assert_eq!(out[0], Complex32::new(1.0, 3.0));
        assert_eq!(out[1], Complex32::new(-2.0, 4.0));
    }
    let input = [Complex32::new(5.0, -6.0), Complex32::new(7.0, 8.0)];
    let sc = SplitComplex::copy_from_complex(&input, &mut re, &mut im);
    let mut out = [Complex32::zero(); 2];
    sc.copy_to_complex(&mut out);
    assert_eq!(input, out);
}
