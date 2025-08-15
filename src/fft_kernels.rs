use crate::num::{Complex, Float};

#[inline(always)]
pub fn fft2<T: Float>(input: &mut [Complex<T>]) {
    debug_assert_eq!(input.len(), 2);
    let a = input[0];
    let b = input[1];
    input[0] = a.add(b);
    input[1] = a.sub(b);
}

#[inline(always)]
pub fn fft4<T: Float>(input: &mut [Complex<T>]) {
    debug_assert_eq!(input.len(), 4);
    let a0 = input[0];
    let a1 = input[1];
    let a2 = input[2];
    let a3 = input[3];
    let even0 = a0.add(a2);
    let even1 = a0.sub(a2);
    let odd0 = a1.add(a3);
    let odd1 = a1.sub(a3);
    let w1 = Complex::new(T::zero(), -T::one());
    let t1 = odd1.mul(w1);
    input[0] = even0.add(odd0);
    input[2] = even0.sub(odd0);
    input[1] = even1.add(t1);
    input[3] = even1.sub(t1);
}

#[inline(always)]
pub fn fft8<T: Float>(input: &mut [Complex<T>]) {
    debug_assert_eq!(input.len(), 8);
    let mut even = [Complex::zero(); 4];
    let mut odd = [Complex::zero(); 4];
    for i in 0..4 {
        even[i] = input[2 * i];
        odd[i] = input[2 * i + 1];
    }
    fft4(&mut even);
    fft4(&mut odd);
    let s = T::from_f32(0.70710677); // sqrt(2)/2
    let twiddles = [
        Complex::new(T::one(), T::zero()),
        Complex::new(s, -s),
        Complex::new(T::zero(), -T::one()),
        Complex::new(-s, -s),
    ];
    for k in 0..4 {
        let t = odd[k].mul(twiddles[k]);
        input[k] = even[k].add(t);
        input[k + 4] = even[k].sub(t);
    }
}

#[inline(always)]
pub fn fft16<T: Float>(input: &mut [Complex<T>]) {
    debug_assert_eq!(input.len(), 16);
    let mut even = [Complex::zero(); 8];
    let mut odd = [Complex::zero(); 8];
    for i in 0..8 {
        even[i] = input[2 * i];
        odd[i] = input[2 * i + 1];
    }
    fft8(&mut even);
    fft8(&mut odd);
    let c1 = T::from_f32(0.9238795);
    let s1 = T::from_f32(-0.38268343);
    let c2 = T::from_f32(0.70710677);
    let s2 = T::from_f32(-0.70710677);
    let c3 = T::from_f32(0.38268343);
    let s3 = T::from_f32(-0.9238795);
    let c4 = T::zero();
    let s4 = T::from_f32(-1.0);
    let twiddles = [
        Complex::new(T::one(), T::zero()),
        Complex::new(c1, s1),
        Complex::new(c2, s2),
        Complex::new(c3, s3),
        Complex::new(c4, s4),
        Complex::new(-c3, s3),
        Complex::new(-c2, s2),
        Complex::new(-c1, s1),
    ];
    for k in 0..8 {
        let t = odd[k].mul(twiddles[k]);
        input[k] = even[k].add(t);
        input[k + 8] = even[k].sub(t);
    }
}
