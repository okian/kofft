//! Cepstrum module
//! Real cepstrum for f32 (log-magnitude of FFT, then IFFT)
//! no_std + alloc compatible

extern crate alloc;
use alloc::vec::Vec;
use alloc::vec;
use crate::fft::{ScalarFftImpl, Complex32, FftImpl};
use libm::{sqrtf, powf, floorf, logf, log10f};

#[cfg(not(feature = "std"))]
use libm::{sqrtf, logf, log10f, powf, floorf};

/// Compute the real cepstrum of a real input signal
pub fn real_cepstrum(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut freq = vec![Complex32::zero(); n];
    for (i, &x) in input.iter().enumerate() {
        freq[i] = Complex32::new(x, 0.0);
    }
    ScalarFftImpl::<f32>::default().fft(&mut freq).unwrap();
    for c in freq.iter_mut() {
        let mag = sqrtf(c.re * c.re + c.im * c.im);
        c.re = logf(mag + 1e-12); // avoid log(0)
        c.im = 0.0;
    }
    ScalarFftImpl::<f32>::default().ifft(&mut freq).unwrap();
    freq.iter().map(|c| c.re).collect()
}

/// Compute Mel filterbank energies (triangular filters)
pub fn mel_filterbank(fft_mags: &[f32], sample_rate: f32, num_filters: usize) -> Vec<f32> {
    let n_fft = fft_mags.len();
    let f_min = 0.0;
    let f_max = sample_rate / 2.0;
    let mel_min = 2595.0 * log10f((1.0 + f_min / 700.0) as f32);
    let mel_max = 2595.0 * log10f((1.0 + f_max / 700.0) as f32);
    let mut mel_points = vec![0.0; num_filters + 2];
    for i in 0..num_filters + 2 {
        mel_points[i] = mel_min + (mel_max - mel_min) * i as f32 / (num_filters + 1) as f32;
        mel_points[i] = 700.0 * (powf(10.0, mel_points[i] / 2595.0) - 1.0);
    }
    let mut bins = vec![0usize; num_filters + 2];
    for (i, &f) in mel_points.iter().enumerate() {
        bins[i] = floorf(f * (n_fft as f32 + 1.0) / sample_rate) as usize;
    }
    let mut energies = vec![0.0; num_filters];
    for m in 1..=num_filters {
        for k in bins[m - 1]..bins[m] {
            if k < n_fft {
                energies[m - 1] += (k - bins[m - 1]) as f32 / (bins[m] - bins[m - 1]) as f32 * fft_mags[k];
            }
        }
        for k in bins[m]..bins[m + 1] {
            if k < n_fft {
                energies[m - 1] += (bins[m + 1] - k) as f32 / (bins[m + 1] - bins[m]) as f32 * fft_mags[k];
            }
        }
    }
    energies
}

/// Compute MFCCs from a power spectrum (fft_mags), sample rate, and number of coefficients
pub fn mfcc(fft_mags: &[f32], sample_rate: f32, num_mel: usize, num_coeffs: usize) -> Vec<f32> {
    let mel_energies = mel_filterbank(fft_mags, sample_rate, num_mel);
    let log_mel: Vec<f32> = mel_energies.iter().map(|&x| logf(x + 1e-12)).collect();
    crate::dct::dct2(&log_mel)[..num_coeffs].to_vec()
}

/// Batch MFCC computation
pub fn mfcc_batch(batch: &[Vec<f32>], sample_rate: f32, num_mel: usize, num_coeffs: usize) -> Vec<Vec<f32>> {
    batch.iter().map(|frame| mfcc(frame, sample_rate, num_mel, num_coeffs)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_real_cepstrum() {
        let x = [1.0, 2.0, 3.0, 4.0];
        let cep = real_cepstrum(&x);
        assert_eq!(cep.len(), x.len());
    }
}

#[cfg(test)]
mod mfcc_tests {
    use super::*;
    #[test]
    fn test_mfcc_batch() {
        let frames = vec![vec![1.0; 32], vec![0.5; 32]];
        let mfccs = mfcc_batch(&frames, 16000.0, 8, 4);
        assert_eq!(mfccs.len(), 2);
        assert_eq!(mfccs[0].len(), 4);
    }
} 