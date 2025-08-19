#![cfg(target_arch = "wasm32")]

use kofft::visual::spectrogram::{
    color_from_magnitude_u8 as core_color_from_magnitude_u8, Colormap as KColormap,
};
use kofft::{dct, fft, wavelet};
use wasm_bindgen_test::wasm_bindgen_test;
use web_spectrogram::{
    color_from_magnitude_u8, compute_frame, dct2, fft_split, haar_forward, haar_inverse,
    reset_state, stft_magnitudes, Colormap,
};

const WIN_LEN: usize = 1024;
const HOP: usize = WIN_LEN / 2;

#[wasm_bindgen_test]
fn color_mapping_for_sample_magnitude() {
    let mag = 0.25;
    let max_mag = 1.0;
    let floor_db = -60.0;
    let wasm_color = color_from_magnitude_u8(mag, max_mag, floor_db, Colormap::Viridis);
    let core_color = core_color_from_magnitude_u8(mag, max_mag, floor_db, KColormap::Viridis);
    assert_eq!(wasm_color, core_color.to_vec());
}

#[wasm_bindgen_test]
fn frame_synchronization_when_seeking_or_pausing() {
    reset_state();
    let full = compute_frame(&vec![1.0; WIN_LEN]);

    reset_state();
    let partial = compute_frame(&vec![1.0; HOP]);
    assert!(partial.is_empty());
    let resumed = compute_frame(&vec![1.0; HOP]);
    assert_eq!(full, resumed);

    reset_state();
    let after_seek = compute_frame(&vec![1.0; WIN_LEN]);
    assert_eq!(full, after_seek);
}

#[wasm_bindgen_test]
fn stft_output_stable_for_sine_wave() {
    let k = 5; // frequency bin
    let samples: Vec<f32> = (0..WIN_LEN)
        .map(|n| (2.0 * std::f32::consts::PI * k as f32 * n as f32 / WIN_LEN as f32).sin())
        .collect();
    let res = stft_magnitudes(&samples, WIN_LEN, HOP).unwrap();
    assert_eq!(res.width(), 1);
    let mags = res.mags();
    let height = res.height();
    let max_idx = mags[..height]
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
        .unwrap()
        .0;
    assert_eq!(max_idx, k);
}

#[wasm_bindgen_test]
fn fft_wrapper_matches_core() {
    let re = vec![1.0, 0.0, 0.0, 0.0];
    let im = vec![0.0; 4];
    let res = fft_split(&re, &im).unwrap();
    let mut r = re.clone();
    let mut i = im.clone();
    fft::fft_split(&mut r, &mut i).unwrap();
    assert_eq!(res.re(), r);
    assert_eq!(res.im(), i);
}

#[wasm_bindgen_test]
fn dct2_wrapper_matches_core() {
    let input = vec![1.0, 2.0, 3.0, 4.0];
    let w = dct2(&input);
    let c = dct::dct2(&input);
    assert_eq!(w, c);
}

#[wasm_bindgen_test]
fn haar_wrapper_matches_core() {
    let input = vec![1.0, 2.0, 3.0, 4.0];
    let wasm_res = haar_forward(&input);
    let (avg, diff) = wavelet::haar_forward(&input);
    assert_eq!(wasm_res.avg(), avg);
    assert_eq!(wasm_res.diff(), diff);
    let back = haar_inverse(&wasm_res.avg(), &wasm_res.diff());
    let core_back = wavelet::haar_inverse(&avg, &diff);
    assert_eq!(back, core_back);
}
