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

/// Errors that can occur during CZT computation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CztError {
    /// The `a` parameter has zero magnitude which would cause a division by zero.
    InvalidParameter,
}

/// Display implementation for [`CztError`] providing human-readable messages.
impl core::fmt::Display for CztError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            CztError::InvalidParameter => write!(f, "parameter causes division by zero"),
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
    // Extract and validate `a` by computing its reciprocal. Fail fast if the
    // magnitude is zero to prevent division by zero and undefined behaviour.
    let (ar, ai) = a;
    let denom = ar * ar + ai * ai;
    if denom == 0.0 {
        return Err(CztError::InvalidParameter);
    }
    let a_inv_r = ar / denom;
    let a_inv_i = -ai / denom;

    // Prepare output buffer initialised to zero.
    let mut output = vec![ZERO_COMPLEX; m];

    // Precompute successive powers of `w` iteratively. `w_k` holds `w^k` for the
    // current bin and is updated in-place for the next bin.
    let (wr, wi) = w;
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
