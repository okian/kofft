use kofft::visual::spectrogram::{self, Colormap as KColormap};
use wasm_bindgen::prelude::*;

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
}
