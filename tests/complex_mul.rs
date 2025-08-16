use kofft::num::{Complex32, Complex64};

#[test]
fn complex32_mul_produces_expected_result() {
    let a = Complex32::new(1.0, 2.0);
    let b = Complex32::new(3.0, 4.0);
    let c = a.mul(b);
    assert!((c.re + 5.0).abs() < 1e-6);
    assert!((c.im - 10.0).abs() < 1e-6);
}

#[test]
fn complex64_mul_produces_expected_result() {
    let a = Complex64::new(1.0, -2.0);
    let b = Complex64::new(-3.0, 4.0);
    let c = a.mul(b);
    assert!((c.re - 5.0).abs() < 1e-12);
    assert!((c.im - 10.0).abs() < 1e-12);
}
