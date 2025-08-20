use std::cell::RefCell;

use kofft::fft::{self, new_fft_impl, Complex32, FftImpl};
use kofft::visual::spectrogram::{self, Colormap as KColormap};
use kofft::window::hann;
use kofft::{dct, wavelet};
use wasm_bindgen::prelude::*;

pub mod seek_bar;
pub use seek_bar::{compute_seek_bar, SeekBar};

const WIN_LEN: usize = 1024;
const HOP: usize = WIN_LEN / 2;
const FLOOR_DB: f32 = -80.0;

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub enum Colormap {
    Fire,
    Legacy,
    Gray,
    Viridis,
    Plasma,
    Inferno,
    Rainbow,
}

impl From<Colormap> for KColormap {
    fn from(c: Colormap) -> Self {
        match c {
            Colormap::Fire => KColormap::Fire,
            Colormap::Legacy => KColormap::Legacy,
            Colormap::Gray => KColormap::Gray,
            Colormap::Viridis => KColormap::Viridis,
            Colormap::Plasma => KColormap::Plasma,
            Colormap::Inferno => KColormap::Inferno,
            Colormap::Rainbow => KColormap::Rainbow,
        }
    }
}

#[wasm_bindgen]
pub struct StftResult {
    mags: Vec<f32>,
    width: usize,
    height: usize,
    max_mag: f32,
}

#[wasm_bindgen]
impl StftResult {
    #[wasm_bindgen(getter)]
    pub fn mags(&self) -> Vec<f32> {
        self.mags.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> usize {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> usize {
        self.height
    }

    #[wasm_bindgen(getter)]
    pub fn max_mag(&self) -> f32 {
        self.max_mag
    }
}

#[wasm_bindgen]
pub fn stft_magnitudes(samples: &[f32], win_len: usize, hop: usize) -> Result<StftResult, JsValue> {
    let (mags, max_mag) = spectrogram::stft_magnitudes(samples, win_len, hop)
        .map_err(|e| JsValue::from_str(&format!("{e:?}")))?;
    let height = win_len / 2;
    let width = mags.len();
    let mut flat = Vec::with_capacity(width * height);
    for frame in mags.iter() {
        flat.extend_from_slice(&frame[..height]);
    }
    Ok(StftResult {
        mags: flat,
        width,
        height,
        max_mag,
    })
}

#[wasm_bindgen]
pub fn magnitude_to_db(mag: f32, max_mag: f32, floor_db: f32) -> f32 {
    spectrogram::magnitude_to_db(mag, max_mag, floor_db)
}

#[wasm_bindgen]
pub fn db_scale(mag: f32, max_mag: f32, dynamic_range: f32) -> f32 {
    spectrogram::db_scale(mag, max_mag, dynamic_range)
}

#[wasm_bindgen]
pub fn map_color_u8(t: f32, cmap: Colormap) -> Vec<u8> {
    spectrogram::map_color_u8(t, cmap.into()).to_vec()
}

#[wasm_bindgen]
pub fn color_from_magnitude_u8(mag: f32, max_mag: f32, floor_db: f32, cmap: Colormap) -> Vec<u8> {
    spectrogram::color_from_magnitude_u8(mag, max_mag, floor_db, cmap.into()).to_vec()
}

#[wasm_bindgen]
pub struct FftResult {
    re: Vec<f32>,
    im: Vec<f32>,
}

#[wasm_bindgen]
impl FftResult {
    #[wasm_bindgen(getter)]
    pub fn re(&self) -> Vec<f32> {
        self.re.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn im(&self) -> Vec<f32> {
        self.im.clone()
    }
}

#[wasm_bindgen]
pub fn fft_split(re: &[f32], im: &[f32]) -> Result<FftResult, JsValue> {
    if re.len() != im.len() {
        return Err(JsValue::from_str("input length mismatch"));
    }
    let mut re_vec = re.to_vec();
    let mut im_vec = im.to_vec();
    fft::fft_split(&mut re_vec, &mut im_vec).map_err(|e| JsValue::from_str(&format!("{e:?}")))?;
    Ok(FftResult {
        re: re_vec,
        im: im_vec,
    })
}

#[wasm_bindgen]
pub fn dct2(input: &[f32]) -> Vec<f32> {
    dct::dct2(input)
}

#[wasm_bindgen]
pub struct HaarResult {
    avg: Vec<f32>,
    diff: Vec<f32>,
}

#[wasm_bindgen]
impl HaarResult {
    #[wasm_bindgen(getter)]
    pub fn avg(&self) -> Vec<f32> {
        self.avg.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn diff(&self) -> Vec<f32> {
        self.diff.clone()
    }
}

#[wasm_bindgen]
pub fn haar_forward(input: &[f32]) -> HaarResult {
    let (avg, diff) = wavelet::haar_forward(input);
    HaarResult { avg, diff }
}

#[wasm_bindgen]
pub fn haar_inverse(avg: &[f32], diff: &[f32]) -> Vec<f32> {
    wavelet::haar_inverse(avg, diff)
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::new());
}

struct State {
    buf: Vec<f32>,
    fft: Box<dyn FftImpl<f32>>,
    window: Vec<f32>,
    cmap: KColormap,
    max_mag: f32,
}

impl State {
    fn new() -> Self {
        Self {
            buf: Vec::new(),
            fft: new_fft_impl(),
            window: hann(WIN_LEN),
            cmap: KColormap::Rainbow,
            max_mag: 1e-12,
        }
    }

    fn compute_frame(&mut self, samples: &[f32]) -> Vec<u8> {
        self.buf.extend_from_slice(samples);
        if self.buf.len() < WIN_LEN {
            return Vec::new();
        }
        let mut frame = vec![Complex32::new(0.0, 0.0); WIN_LEN];
        for (f, (&s, &w)) in frame.iter_mut().zip(self.buf.iter().zip(&self.window)) {
            *f = Complex32::new(s * w, 0.0);
        }
        let _ = self.fft.fft(&mut frame);
        let half = WIN_LEN / 2;
        let mut row = Vec::with_capacity(half * 4);
        for c in &frame[..half] {
            let mag = (c.re * c.re + c.im * c.im).sqrt();
            if mag > self.max_mag {
                self.max_mag = mag;
            }
            let [r, g, b] =
                spectrogram::color_from_magnitude_u8(mag, self.max_mag, FLOOR_DB, self.cmap);
            row.extend_from_slice(&[r, g, b, 255]);
        }
        self.buf.drain(0..HOP);
        row
    }
}

#[wasm_bindgen]
pub fn compute_frame(samples: &[f32]) -> Vec<u8> {
    STATE.with(|s| s.borrow_mut().compute_frame(samples))
}

#[wasm_bindgen]
pub fn set_colormap(name: &str) {
    STATE.with(|s| {
        s.borrow_mut().cmap = KColormap::parse(name);
    });
}

#[wasm_bindgen]
pub fn reset_state() {
    STATE.with(|s| *s.borrow_mut() = State::new());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stft_wrapper_matches_core() {
        let samples: Vec<f32> = (0..8).map(|i| i as f32).collect();
        let win_len = 4;
        let hop = 2;
        let res = stft_magnitudes(&samples, win_len, hop).unwrap();
        let (core, max_mag) = spectrogram::stft_magnitudes(&samples, win_len, hop).unwrap();
        assert_eq!(res.max_mag(), max_mag);
        assert_eq!(res.width(), core.len());
        assert_eq!(res.height(), win_len / 2);
        let mut flat = Vec::new();
        for frame in core.iter() {
            flat.extend_from_slice(&frame[..win_len / 2]);
        }
        assert_eq!(res.mags(), flat);
    }

    #[test]
    fn magnitude_to_db_wrapper_matches_core() {
        let mag = 0.5;
        let max_mag = 1.0;
        let floor_db = -120.0;
        let w = magnitude_to_db(mag, max_mag, floor_db);
        let c = spectrogram::magnitude_to_db(mag, max_mag, floor_db);
        assert!((w - c).abs() < 1e-6);
    }

    #[test]
    fn db_scale_wrapper_matches_core() {
        let mag = 0.5;
        let max_mag = 1.0;
        let dynamic_range = 60.0;
        let w = db_scale(mag, max_mag, dynamic_range);
        let c = spectrogram::db_scale(mag, max_mag, dynamic_range);
        assert!((w - c).abs() < 1e-6);
    }

    #[test]
    fn color_wrappers_match_core() {
        let mag = 0.25;
        let max_mag = 1.0;
        let floor_db = -60.0;
        let w = color_from_magnitude_u8(mag, max_mag, floor_db, Colormap::Viridis);
        let c = spectrogram::color_from_magnitude_u8(mag, max_mag, floor_db, KColormap::Viridis);
        assert_eq!(w, c.to_vec());
        for cmap in [
            Colormap::Fire,
            Colormap::Legacy,
            Colormap::Gray,
            Colormap::Viridis,
            Colormap::Plasma,
            Colormap::Inferno,
            Colormap::Rainbow,
        ] {
            let w2 = map_color_u8(0.5, cmap);
            let c2 = spectrogram::map_color_u8(0.5, cmap.into());
            assert_eq!(w2, c2.to_vec());
        }
    }

    #[test]
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

    #[test]
    fn dct2_wrapper_matches_core() {
        let input = vec![1.0, 2.0, 3.0, 4.0];
        let w = dct2(&input);
        let c = dct::dct2(&input);
        assert_eq!(w, c);
    }

    #[test]
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

    #[test]
    fn streaming_compute_frame_and_colormap() {
        reset_state();
        let empty = compute_frame(&vec![0.0; HOP]);
        assert!(empty.is_empty());
        let frame = compute_frame(&vec![1.0; WIN_LEN]);
        assert_eq!(frame.len(), (WIN_LEN / 2) * 4);
        let frame2 = compute_frame(&vec![1.0; HOP]);
        assert_eq!(frame2.len(), (WIN_LEN / 2) * 4);
        for chunk in frame.chunks_exact(4) {
            assert_eq!(chunk[3], 255);
        }
        // default colormap should be rainbow
        reset_state();
        let default_frame = compute_frame(&vec![1.0; WIN_LEN]);
        reset_state();
        set_colormap("rainbow");
        let rainbow_frame = compute_frame(&vec![1.0; WIN_LEN]);
        reset_state();
        set_colormap("fire");
        let fire_frame = compute_frame(&vec![1.0; WIN_LEN]);
        assert_eq!(default_frame, rainbow_frame);
        assert_ne!(default_frame, fire_frame);
    }

    #[test]
    fn reset_clears_buffer() {
        reset_state();
        let _ = compute_frame(&vec![1.0; WIN_LEN]);
        reset_state();
        let empty = compute_frame(&vec![0.0; HOP]);
        assert!(empty.is_empty());
    }
}
