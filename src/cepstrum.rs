//! Cepstrum module
//! Real cepstrum for f32 (log-magnitude of FFT, then IFFT)
//! no_std + alloc compatible

extern crate alloc;
use crate::fft::{Complex32, FftError, FftImpl, ScalarFftImpl};
use alloc::vec;
use alloc::vec::Vec;
use libm::{floorf, log10f, logf, powf, sqrtf};

#[cfg(not(feature = "std"))]
use libm::{floorf, log10f, logf, powf, sqrtf};

/// Compute the real cepstrum of a real input signal
pub fn real_cepstrum(input: &[f32]) -> Result<Vec<f32>, FftError> {
    if input.is_empty() {
        return Err(FftError::EmptyInput);
    }
    if !input.len().is_power_of_two() {
        return Err(FftError::NonPowerOfTwoNoStd);
    }
    let n = input.len();
    let mut freq = vec![Complex32::zero(); n];
    for (i, &x) in input.iter().enumerate() {
        freq[i] = Complex32::new(x, 0.0);
    }
    let fft = ScalarFftImpl::<f32>::default();
    fft.fft(&mut freq)?;
    for c in freq.iter_mut() {
        let mag = sqrtf(c.re * c.re + c.im * c.im);
        c.re = logf(mag + 1e-12); // avoid log(0)
        c.im = 0.0;
    }
    fft.ifft(&mut freq)?;
    Ok(freq.iter().map(|c| c.re).collect())
}

/// Compute Mel filterbank energies (triangular filters)
pub fn mel_filterbank(fft_mags: &[f32], sample_rate: f32, num_filters: usize) -> Vec<f32> {
    let n_fft = fft_mags.len();
    let f_min = 0.0;
    let f_max = sample_rate / 2.0;
    let mel_min = 2595.0 * log10f(1.0 + f_min / 700.0);
    let mel_max = 2595.0 * log10f(1.0 + f_max / 700.0);
    let mut mel_points = vec![0.0; num_filters + 2];
    for (i, mel_point) in mel_points.iter_mut().enumerate() {
        *mel_point = mel_min + (mel_max - mel_min) * i as f32 / (num_filters + 1) as f32;
        *mel_point = 700.0 * (powf(10.0, *mel_point / 2595.0) - 1.0);
    }
    let mut bins = vec![0usize; num_filters + 2];
    for (i, &f) in mel_points.iter().enumerate() {
        bins[i] = floorf(f * (n_fft as f32 + 1.0) / sample_rate) as usize;
    }
    let mut energies = vec![0.0; num_filters];
    for (m_idx, energy) in energies.iter_mut().enumerate() {
        let m = m_idx + 1;
        if bins[m] == bins[m - 1] || bins[m + 1] == bins[m] {
            continue;
        }
        for k in bins[m - 1]..bins[m] {
            if let Some(&fft_val) = fft_mags.get(k) {
                *energy += (k - bins[m - 1]) as f32 / (bins[m] - bins[m - 1]) as f32 * fft_val;
            }
        }
        for k in bins[m]..bins[m + 1] {
            if let Some(&fft_val) = fft_mags.get(k) {
                *energy += (bins[m + 1] - k) as f32 / (bins[m + 1] - bins[m]) as f32 * fft_val;
            }
        }
    }
    energies
}

/// Compute MFCCs from a power spectrum (fft_mags), sample rate, and number of coefficients
pub fn mfcc(
    fft_mags: &[f32],
    sample_rate: f32,
    num_mel: usize,
    num_coeffs: usize,
) -> Result<Vec<f32>, FftError> {
    let mel_energies = mel_filterbank(fft_mags, sample_rate, num_mel);
    if num_coeffs > mel_energies.len() {
        return Err(FftError::InvalidValue);
    }
    let log_mel: Vec<f32> = mel_energies.iter().map(|&x| logf(x + 1e-12)).collect();
    let dct = crate::dct::dct2(&log_mel);
    Ok(dct[..num_coeffs].to_vec())
}

/// Batch MFCC computation
pub fn mfcc_batch(
    batch: &[Vec<f32>],
    sample_rate: f32,
    num_mel: usize,
    num_coeffs: usize,
) -> Result<Vec<Vec<f32>>, FftError> {
    batch
        .iter()
        .map(|frame| mfcc(frame, sample_rate, num_mel, num_coeffs))
        .collect()
}

#[cfg(all(feature = "internal-tests", test))]
mod tests {
    use super::*;
    #[test]
    fn test_real_cepstrum() {
        let x = [1.0, 2.0, 3.0, 4.0];
        let cep = real_cepstrum(&x).unwrap();
        assert_eq!(cep.len(), x.len());
    }

    #[test]
    fn test_real_cepstrum_errors() {
        assert_eq!(real_cepstrum(&[]).unwrap_err(), FftError::EmptyInput);
        let x = [1.0, 2.0, 3.0];
        assert_eq!(real_cepstrum(&x).unwrap_err(), FftError::NonPowerOfTwoNoStd);
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod mfcc_tests {
    use super::*;
    #[test]
    fn test_mfcc_batch() {
        let frames = vec![vec![1.0; 32], vec![0.5; 32]];
        let mfccs = mfcc_batch(&frames, 16000.0, 8, 4).unwrap();
        assert_eq!(mfccs.len(), 2);
        assert_eq!(mfccs[0].len(), 4);
    }

    #[test]
    fn test_mfcc_error() {
        let frame = vec![1.0; 32];
        assert_eq!(
            mfcc(&frame, 16000.0, 8, 20).unwrap_err(),
            FftError::InvalidValue
        );
    }
}

#[cfg(all(feature = "internal-tests", test))]
mod mel_tests {
    use super::*;
    #[test]
    fn test_mel_filterbank_zero_width() {
        let mags = vec![1.0; 8];
        let energies = mel_filterbank(&mags, 8000.0, 40);
        assert_eq!(energies.len(), 40);
        assert!(energies.iter().all(|e| e.is_finite()));
    }
}
