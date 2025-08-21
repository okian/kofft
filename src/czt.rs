//! Chirp Z-Transform (CZT) module
//! Arbitrary frequency resolution DFT
//! no_std + alloc compatible

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;

/// Unit complex number `(1 + 0j)` used as a neutral element for
/// iterative complex multiplication.
const UNIT_COMPLEX: (f32, f32) = (1.0, 0.0);
/// Zero complex number `(0 + 0j)` used to initialize output buffers.
const ZERO_COMPLEX: (f32, f32) = (0.0, 0.0);
/// Maximum number of frequency bins allowed to keep allocations bounded.
const MAX_BINS: usize = 1 << 20; // 1,048,576 bins
/// Minimum stable magnitude for complex parameters to avoid underflow.
const MIN_MAGNITUDE: f32 = 1.0e-12;
/// Maximum stable magnitude for complex parameters to avoid overflow.
const MAX_MAGNITUDE: f32 = 1.0e12;
/// Square of [`MIN_MAGNITUDE`] for cheap magnitude comparisons.
const MIN_MAG_SQ: f32 = MIN_MAGNITUDE * MIN_MAGNITUDE;
/// Square of [`MAX_MAGNITUDE`] for cheap magnitude comparisons.
const MAX_MAG_SQ: f32 = MAX_MAGNITUDE * MAX_MAGNITUDE;

/// Compute the squared magnitude of a complex tuple.
#[inline]
fn magnitude_squared(z: (f32, f32)) -> f32 {
    let (re, im) = z;
    re * re + im * im
}

/// Errors that can occur during CZT computation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CztError {
    /// One or more parameters are invalid (zero, NaN, or magnitude out of range).
    InvalidParameter,
}

/// Display implementation for [`CztError`] providing human-readable messages.
impl core::fmt::Display for CztError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            CztError::InvalidParameter => write!(f, "invalid parameter magnitude"),
        }
    }
}

/// Implement the standard error trait when the `std` feature is enabled so
/// errors can seamlessly integrate with typical Rust error handling.
#[cfg(feature = "std")]
impl std::error::Error for CztError {}

/// Compute the Chirp Z-Transform (CZT) of a real-valued input signal.
///
/// # Parameters
/// - `input`: slice containing the real-valued samples to transform.
/// - `m`: number of frequency bins to compute.
/// - `w`: complex ratio between successive frequency bins (typically `exp(-j*2π/M)`).
/// - `a`: complex starting point for the transform (typically `1 + 0j`).
///
/// # Returns
/// `Ok` with a vector of complex tuples representing the transform output or
/// `Err` if parameters are invalid.
///
/// # Algorithm
/// The implementation iteratively updates powers of `w` and `a` to avoid
/// expensive nested exponentiation loops. For each output bin, we reuse the
/// previously computed power of `w` and update it in constant time.
pub fn czt_f32(
    input: &[f32],
    m: usize,
    w: (f32, f32),
    a: (f32, f32),
) -> Result<Vec<(f32, f32)>, CztError> {
    // Validate requested output bins to avoid excessive allocation.
    if m == 0 || m > MAX_BINS {
        return Err(CztError::InvalidParameter);
    }

    // Validate and extract `w` ensuring its magnitude is within safe bounds.
    let w_mag = magnitude_squared(w);
    if !w_mag.is_finite() || !(MIN_MAG_SQ..=MAX_MAG_SQ).contains(&w_mag) {
        return Err(CztError::InvalidParameter);
    }
    let (wr, wi) = w;

    // Extract and validate `a` by computing its reciprocal. Fail fast if the
    // magnitude is out of range to prevent division by zero or overflow.
    let a_mag = magnitude_squared(a);
    if !a_mag.is_finite() || !(MIN_MAG_SQ..=MAX_MAG_SQ).contains(&a_mag) {
        return Err(CztError::InvalidParameter);
    }
    let (ar, ai) = a;
    let a_inv_r = ar / a_mag;
    let a_inv_i = -ai / a_mag;

    // Prepare output buffer initialised to zero.
    let mut output = vec![ZERO_COMPLEX; m];

    // Precompute successive powers of `w` iteratively. `w_k` holds `w^k` for the
    // current bin and is updated in-place for the next bin.
    let mut w_k_r = UNIT_COMPLEX.0;
    let mut w_k_i = UNIT_COMPLEX.1;

    for out in output.iter_mut() {
        // `wnk` tracks the incremental power `w^{k*n}` for each input sample,
        // starting at `1` and multiplying by `w^k` each iteration.
        let mut wnk_r = UNIT_COMPLEX.0;
        let mut wnk_i = UNIT_COMPLEX.1;
        // `a_pow` tracks `a^{-n}` via repeated multiplication by `a^{-1}`.
        let mut a_pow_r = UNIT_COMPLEX.0;
        let mut a_pow_i = UNIT_COMPLEX.1;

        // Process every input sample, accumulating its contribution to the
        // current frequency bin.
        for &x in input {
            // Multiply current powers to obtain `a^{-n} * w^{k*n}`.
            let tr = a_pow_r * wnk_r - a_pow_i * wnk_i;
            let ti = a_pow_r * wnk_i + a_pow_i * wnk_r;
            // Accumulate the contribution scaled by the real sample `x`.
            out.0 += x * tr;
            out.1 += x * ti;

            // Update `w^{k*n}` by multiplying once by `w^k`.
            let wtr = wnk_r * w_k_r - wnk_i * w_k_i;
            let wti = wnk_r * w_k_i + wnk_i * w_k_r;
            wnk_r = wtr;
            wnk_i = wti;

            // Update `a^{-n}` by multiplying once by `a^{-1}`.
            let atr = a_pow_r * a_inv_r - a_pow_i * a_inv_i;
            let ati = a_pow_r * a_inv_i + a_pow_i * a_inv_r;
            a_pow_r = atr;
            a_pow_i = ati;
        }

        // Update `w^k` for the next bin using a single multiplication.
        let wkr = w_k_r * wr - w_k_i * wi;
        let wki = w_k_r * wi + w_k_i * wr;
        w_k_r = wkr;
        w_k_i = wki;
    }

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Simple two-sample input used across tests.
    const INPUT: [f32; 2] = [1.0, 1.0];
    /// Scaling factor used to create out-of-range magnitudes.
    const SCALE: f32 = 10.0;

    /// Ensure the transform rejects zero `m`.
    #[test]
    fn rejects_zero_m() {
        assert_eq!(
            czt_f32(&INPUT, 0, UNIT_COMPLEX, UNIT_COMPLEX).unwrap_err(),
            CztError::InvalidParameter
        );
    }

    /// Ensure the transform rejects excessively large `m`.
    #[test]
    fn rejects_large_m() {
        assert_eq!(
            czt_f32(&INPUT, MAX_BINS + 1, UNIT_COMPLEX, UNIT_COMPLEX).unwrap_err(),
            CztError::InvalidParameter
        );
    }

    /// Reject `w` values with magnitude below the stability threshold.
    #[test]
    fn rejects_small_w() {
        let bad_w = (MIN_MAGNITUDE / SCALE, 0.0);
        assert_eq!(
            czt_f32(&INPUT, 1, bad_w, UNIT_COMPLEX).unwrap_err(),
            CztError::InvalidParameter
        );
    }

    /// Reject `w` values with magnitude above the stability threshold.
    #[test]
    fn rejects_large_w() {
        let bad_w = (MAX_MAGNITUDE * SCALE, 0.0);
        assert_eq!(
            czt_f32(&INPUT, 1, bad_w, UNIT_COMPLEX).unwrap_err(),
            CztError::InvalidParameter
        );
    }

    /// Reject `a` values with magnitude below the stability threshold.
    #[test]
    fn rejects_small_a() {
        let bad_a = (MIN_MAGNITUDE / SCALE, 0.0);
        assert_eq!(
            czt_f32(&INPUT, 1, UNIT_COMPLEX, bad_a).unwrap_err(),
            CztError::InvalidParameter
        );
    }

    /// Reject `a` values with magnitude above the stability threshold.
    #[test]
    fn rejects_large_a() {
        let bad_a = (MAX_MAGNITUDE * SCALE, 0.0);
        assert_eq!(
            czt_f32(&INPUT, 1, UNIT_COMPLEX, bad_a).unwrap_err(),
            CztError::InvalidParameter
        );
    }

    /// Basic correctness check for valid parameters.
    #[test]
    fn computes_basic_transform() {
        let out = czt_f32(&INPUT, 1, UNIT_COMPLEX, UNIT_COMPLEX).unwrap();
        assert!((out[0].0 - 2.0).abs() < 1e-6);
        assert!((out[0].1).abs() < 1e-6);
    }
}
