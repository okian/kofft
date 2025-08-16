#![cfg(target_arch = "wasm32")]

use kofft::visual::spectrogram::{
    color_from_magnitude_u8 as core_color_from_magnitude_u8, Colormap as KColormap,
};
use wasm_bindgen_test::wasm_bindgen_test;
use web_spectrogram::{
    color_from_magnitude_u8, compute_frame, reset_state, stft_magnitudes, Colormap,
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
