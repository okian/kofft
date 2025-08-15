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
    // Load inputs
    let x0 = input[0];
    let x1 = input[1];
    let x2 = input[2];
    let x3 = input[3];
    let x4 = input[4];
    let x5 = input[5];
    let x6 = input[6];
    let x7 = input[7];

    // FFT4 on even indices (0,2,4,6)
    let a0 = x0.add(x4);
    let a1 = x0.sub(x4);
    let a2 = x2.add(x6);
    let a3 = x2.sub(x6);
    let w1 = Complex::new(T::zero(), -T::one());
    let t = a3.mul(w1);
    let e0 = a0.add(a2);
    let e2 = a0.sub(a2);
    let e1 = a1.add(t);
    let e3 = a1.sub(t);

    // FFT4 on odd indices (1,3,5,7)
    let b0 = x1.add(x5);
    let b1 = x1.sub(x5);
    let b2 = x3.add(x7);
    let b3 = x3.sub(x7);
    let t = b3.mul(w1);
    let o0 = b0.add(b2);
    let o2 = b0.sub(b2);
    let o1 = b1.add(t);
    let o3 = b1.sub(t);

    // Twiddle multiplication and final butterflies
    let s = T::from_f32(0.70710677); // sqrt(2)/2
    let t0 = o0; // twiddle W0 = 1
    let t1 = o1.mul(Complex::new(s, -s));
    let t2 = o2.mul(w1);
    let t3 = o3.mul(Complex::new(-s, -s));

    input[0] = e0.add(t0);
    input[4] = e0.sub(t0);
    input[1] = e1.add(t1);
    input[5] = e1.sub(t1);
    input[2] = e2.add(t2);
    input[6] = e2.sub(t2);
    input[3] = e3.add(t3);
    input[7] = e3.sub(t3);
}

#[inline(always)]
pub fn fft16<T: Float>(input: &mut [Complex<T>]) {
    debug_assert_eq!(input.len(), 16);
    // Load inputs
    let x0 = input[0];
    let x1 = input[1];
    let x2 = input[2];
    let x3 = input[3];
    let x4 = input[4];
    let x5 = input[5];
    let x6 = input[6];
    let x7 = input[7];
    let x8 = input[8];
    let x9 = input[9];
    let x10 = input[10];
    let x11 = input[11];
    let x12 = input[12];
    let x13 = input[13];
    let x14 = input[14];
    let x15 = input[15];

    let w1 = Complex::new(T::zero(), -T::one());
    let s = T::from_f32(0.70710677); // sqrt(2)/2

    // FFT8 on even indices (0,2,4,6,8,10,12,14)
    // First 4-point FFT on [x0,x4,x8,x12]
    let a0 = x0.add(x8);
    let a1 = x0.sub(x8);
    let a2 = x4.add(x12);
    let a3 = x4.sub(x12);
    let t = a3.mul(w1);
    let ea0 = a0.add(a2);
    let ea2 = a0.sub(a2);
    let ea1 = a1.add(t);
    let ea3 = a1.sub(t);
    // Second 4-point FFT on [x2,x6,x10,x14]
    let b0 = x2.add(x10);
    let b1 = x2.sub(x10);
    let b2 = x6.add(x14);
    let b3 = x6.sub(x14);
    let t = b3.mul(w1);
    let eb0 = b0.add(b2);
    let eb2 = b0.sub(b2);
    let eb1 = b1.add(t);
    let eb3 = b1.sub(t);
    // Combine to get even FFT8 results
    let t0 = eb0; // W0 = 1
    let t1 = eb1.mul(Complex::new(s, -s));
    let t2 = eb2.mul(w1);
    let t3 = eb3.mul(Complex::new(-s, -s));
    let e0 = ea0.add(t0);
    let e4 = ea0.sub(t0);
    let e1 = ea1.add(t1);
    let e5 = ea1.sub(t1);
    let e2 = ea2.add(t2);
    let e6 = ea2.sub(t2);
    let e3 = ea3.add(t3);
    let e7 = ea3.sub(t3);

    // FFT8 on odd indices (1,3,5,7,9,11,13,15)
    // First 4-point FFT on [x1,x5,x9,x13]
    let c0 = x1.add(x9);
    let c1 = x1.sub(x9);
    let c2 = x5.add(x13);
    let c3 = x5.sub(x13);
    let t = c3.mul(w1);
    let oa0 = c0.add(c2);
    let oa2 = c0.sub(c2);
    let oa1 = c1.add(t);
    let oa3 = c1.sub(t);
    // Second 4-point FFT on [x3,x7,x11,x15]
    let d0 = x3.add(x11);
    let d1 = x3.sub(x11);
    let d2 = x7.add(x15);
    let d3 = x7.sub(x15);
    let t = d3.mul(w1);
    let ob0 = d0.add(d2);
    let ob2 = d0.sub(d2);
    let ob1 = d1.add(t);
    let ob3 = d1.sub(t);
    // Combine to get odd FFT8 results
    let t0 = ob0;
    let t1 = ob1.mul(Complex::new(s, -s));
    let t2 = ob2.mul(w1);
    let t3 = ob3.mul(Complex::new(-s, -s));
    let o0 = oa0.add(t0);
    let o4 = oa0.sub(t0);
    let o1 = oa1.add(t1);
    let o5 = oa1.sub(t1);
    let o2 = oa2.add(t2);
    let o6 = oa2.sub(t2);
    let o3 = oa3.add(t3);
    let o7 = oa3.sub(t3);

    // Twiddle multiplication for stage 2 (size 16)
    let c1 = T::from_f32(0.9238795);
    let s1 = T::from_f32(-0.38268343);
    let c2 = T::from_f32(0.70710677);
    let s2 = T::from_f32(-0.70710677);
    let c3 = T::from_f32(0.38268343);
    let s3 = T::from_f32(-0.9238795);
    let c4 = T::zero();
    let s4 = T::from_f32(-1.0);

    let t0 = o0; // W0 = 1
    let t1 = o1.mul(Complex::new(c1, s1));
    let t2 = o2.mul(Complex::new(c2, s2));
    let t3 = o3.mul(Complex::new(c3, s3));
    let t4 = o4.mul(Complex::new(c4, s4));
    let t5 = o5.mul(Complex::new(-c3, s3));
    let t6 = o6.mul(Complex::new(-c2, s2));
    let t7 = o7.mul(Complex::new(-c1, s1));

    input[0] = e0.add(t0);
    input[8] = e0.sub(t0);
    input[1] = e1.add(t1);
    input[9] = e1.sub(t1);
    input[2] = e2.add(t2);
    input[10] = e2.sub(t2);
    input[3] = e3.add(t3);
    input[11] = e3.sub(t3);
    input[4] = e4.add(t4);
    input[12] = e4.sub(t4);
    input[5] = e5.add(t5);
    input[13] = e5.sub(t5);
    input[6] = e6.add(t6);
    input[14] = e6.sub(t6);
    input[7] = e7.add(t7);
    input[15] = e7.sub(t7);
}
