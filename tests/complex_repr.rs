use kofft::num::{Complex32, Complex64};

#[test]
fn complex_repr_c_transmutable() {
    use core::mem::{align_of, size_of, transmute};

    // Verify size and alignment match an array of two floats
    assert_eq!(size_of::<Complex32>(), size_of::<[f32; 2]>());
    assert_eq!(align_of::<Complex32>(), align_of::<[f32; 2]>());
    assert_eq!(size_of::<Complex64>(), size_of::<[f64; 2]>());
    assert_eq!(align_of::<Complex64>(), align_of::<[f64; 2]>());

    // Transmute from an array to Complex32 safely
    let arr = [1.0_f32, 2.0_f32];
    let c: Complex32 = unsafe { transmute(arr) };
    assert_eq!(c.re, 1.0);
    assert_eq!(c.im, 2.0);
}
