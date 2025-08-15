use crate::num::{Complex, Float};

#[inline(always)]
pub(crate) fn fft2<T: Float>(data: &mut [Complex<T>; 2]) {
    let a = data[0];
    let b = data[1];
    data[0] = a.add(b);
    data[1] = a.sub(b);
}

#[inline(always)]
pub(crate) fn fft4<T: Float>(data: &mut [Complex<T>; 4]) {
    let a0 = data[0];
    let a1 = data[1];
    let a2 = data[2];
    let a3 = data[3];

    let b0 = a0.add(a2);
    let b1 = a1.add(a3);
    let b2 = a0.sub(a2);
    let b3 = a1.sub(a3);

    data[0] = b0.add(b1);
    data[2] = b0.sub(b1);
    let j = Complex::new(T::zero(), -T::one());
    let t = b3.mul(j);
    data[1] = b2.add(t);
    data[3] = b2.sub(t);
}

#[inline(always)]
pub(crate) fn fft8<T: Float>(data: &mut [Complex<T>; 8]) {
    let mut even: [Complex<T>; 4] = core::array::from_fn(|i| data[2 * i]);
    let mut odd: [Complex<T>; 4] = core::array::from_fn(|i| data[2 * i + 1]);
    fft4(&mut even);
    fft4(&mut odd);
    let n_f = T::from_f32(8.0);
    for k in 0..4 {
        let k_f = T::from_f32(k as f32);
        let angle = -T::from_f32(2.0) * T::pi() * k_f / n_f;
        let tw = Complex::expi(angle);
        let t = odd[k].mul(tw);
        data[k] = even[k].add(t);
        data[k + 4] = even[k].sub(t);
    }
}

#[inline(always)]
pub(crate) fn fft16<T: Float>(data: &mut [Complex<T>; 16]) {
    let mut even: [Complex<T>; 8] = core::array::from_fn(|i| data[2 * i]);
    let mut odd: [Complex<T>; 8] = core::array::from_fn(|i| data[2 * i + 1]);
    fft8(&mut even);
    fft8(&mut odd);
    let n_f = T::from_f32(16.0);
    for k in 0..8 {
        let k_f = T::from_f32(k as f32);
        let angle = -T::from_f32(2.0) * T::pi() * k_f / n_f;
        let tw = Complex::expi(angle);
        let t = odd[k].mul(tw);
        data[k] = even[k].add(t);
        data[k + 8] = even[k].sub(t);
    }
}
