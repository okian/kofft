use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use console_error_panic_hook;
use lofty::{
    prelude::{Accessor, AudioFile, ItemKey, TaggedFileExt},
    picture::{Picture, PictureType},
    probe::Probe,
};

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AudioMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub duration: Option<f64>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub bit_depth: Option<u16>,
    pub bitrate: Option<u32>,
    pub format: String,
    pub album_art: Option<Vec<u8>>,
    pub album_art_mime: Option<String>,
}

impl Default for AudioMetadata {
    fn default() -> Self {
        Self {
            title: None,
            artist: None,
            album: None,
            year: None,
            genre: None,
            duration: None,
            sample_rate: None,
            channels: None,
            bit_depth: None,
            bitrate: None,
            format: "unknown".to_string(),
            album_art: None,
            album_art_mime: None,
        }
    }
}

#[wasm_bindgen]
pub fn parse_metadata(bytes: &[u8]) -> Result<JsValue, JsValue> {
    let mut meta = AudioMetadata::default();
    let cursor = Cursor::new(bytes);
    let tagged_file = match Probe::new(cursor).guess_file_type() {
        Ok(probe) => match probe.read() {
            Ok(f) => f,
            Err(_e) => {
                return serde_wasm_bindgen::to_value(&meta)
                    .map_err(|e| JsValue::from_str(&format!("serde error: {e}")));
            }
        },
        Err(_e) => {
            return serde_wasm_bindgen::to_value(&meta)
                .map_err(|e| JsValue::from_str(&format!("serde error: {e}")));
        }
    };

    meta.format = format!("{:?}", tagged_file.file_type()).to_lowercase();

    let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

    if let Some(tag) = tag {
        meta.title = tag.title().map(|s| s.to_string());
        meta.artist = tag.artist().map(|s| s.to_string());
        meta.album = tag.album().map(|s| s.to_string());

        let mut year_found = None;
        for item in tag.get_items(&ItemKey::RecordingDate) {
            if let Some(text) = item.value().text() {
                if let Some(year_str) = text.get(0..4) {
                    if let Ok(year) = year_str.parse::<u32>() {
                        year_found = Some(year);
                        break;
                    }
                }
            }
        }
        if year_found.is_none() {
            for item in tag.get_items(&ItemKey::Year) {
                if let Some(text) = item.value().text() {
                    if let Ok(year) = text.parse::<u32>() {
                        year_found = Some(year);
                        break;
                    }
                }
            }
        }
        meta.year = year_found;
        meta.genre = tag.genre().map(|s| s.to_string());

        // Debug: Check if we have any pictures
        let pictures = tag.pictures();
        
        if let Some(pic) = pick_cover_picture(tag.pictures()) {
            meta.album_art = Some(pic.data().to_vec());
            meta.album_art_mime = Some(picture_mime(&pic).to_string());
        }
    }

    let props = tagged_file.properties();
    meta.duration = Some(props.duration().as_secs_f64());
    if let Some(sr) = props.sample_rate() { meta.sample_rate = Some(sr); }
    if let Some(ch) = props.channels().map(|c| c as u16) { meta.channels = Some(ch); }
    if let Some(bits) = props.bit_depth().map(|b| b as u16) { meta.bit_depth = Some(bits); }
    if let Some(br) = props.overall_bitrate() { meta.bitrate = Some(br); }

    serde_wasm_bindgen::to_value(&meta)
        .map_err(|e| JsValue::from_str(&format!("serde error: {e}")))
}

/// Generate amplitude envelope for seekbar visualization
/// Returns an array of amplitude values (0.0 to 1.0) representing the audio envelope
#[wasm_bindgen]
pub fn generate_amplitude_envelope(
    audio_data: &[f32], 
    sample_rate: u32,
    target_bars: usize,
    window_ms: u32,
    smoothing_samples: usize
) -> Vec<f32> {
    if audio_data.is_empty() || target_bars == 0 {
        return vec![0.0; target_bars];
    }

    // Calculate window size in samples
    let window_samples = (sample_rate as f32 * window_ms as f32 / 1000.0) as usize;
    if window_samples == 0 {
        return vec![0.0; target_bars];
    }

    // Split audio into windows and compute RMS for each
    let num_windows = (audio_data.len() + window_samples - 1) / window_samples;
    let mut window_rms = Vec::with_capacity(num_windows);

    for i in 0..num_windows {
        let start = i * window_samples;
        let end = ((i + 1) * window_samples).min(audio_data.len());
        
        if start >= audio_data.len() {
            window_rms.push(0.0);
            continue;
        }

        let chunk = &audio_data[start..end];
        if chunk.is_empty() {
            window_rms.push(0.0);
            continue;
        }

        // Compute RMS (Root Mean Square) for amplitude
        let sum_squares: f32 = chunk.iter().map(|&x| x * x).sum();
        let rms = (sum_squares / chunk.len() as f32).sqrt();
        window_rms.push(rms);
    }

    // Apply smoothing if requested
    if smoothing_samples > 1 && window_rms.len() > smoothing_samples {
        let mut smoothed = Vec::with_capacity(window_rms.len());
        
        for i in 0..window_rms.len() {
            let start = if i >= smoothing_samples / 2 { i - smoothing_samples / 2 } else { 0 };
            let end = (i + smoothing_samples / 2 + 1).min(window_rms.len());
            let window = &window_rms[start..end];
            
            let avg = window.iter().sum::<f32>() / window.len() as f32;
            smoothed.push(avg);
        }
        window_rms = smoothed;
    }

    // Downsample to target number of bars
    let mut envelope = Vec::with_capacity(target_bars);
    
    if window_rms.len() <= target_bars {
        // Upsample by interpolation
        for i in 0..target_bars {
            let window_index = (i as f32 * window_rms.len() as f32 / target_bars as f32) as usize;
            let window_index = window_index.min(window_rms.len() - 1);
            envelope.push(window_rms[window_index]);
        }
    } else {
        // Downsample by averaging
        let samples_per_bar = (window_rms.len() + target_bars - 1) / target_bars;
        
        for i in 0..target_bars {
            let start = i * samples_per_bar;
            let end = ((i + 1) * samples_per_bar).min(window_rms.len());
            
            if start >= window_rms.len() {
                envelope.push(0.0);
                continue;
            }
            
            let chunk = &window_rms[start..end];
            let avg = chunk.iter().sum::<f32>() / chunk.len() as f32;
            envelope.push(avg);
        }
    }

    // Normalize to 0.0-1.0 range
    let max_val = envelope.iter().fold(0.0f32, |a, &b| a.max(b));
    if max_val > 0.0 {
        for val in &mut envelope {
            *val = (*val / max_val).min(1.0);
        }
    }

    envelope
}

/// Generate waveform data for visualization (legacy function for compatibility)
/// Returns an array of amplitude values (0.0 to 1.0) representing the audio waveform
#[wasm_bindgen]
pub fn generate_waveform(audio_data: &[f32], num_bars: usize) -> Vec<f32> {
    // Use the new amplitude envelope function with default parameters
    generate_amplitude_envelope(audio_data, 44100, num_bars, 20, 3)
}

fn pick_cover_picture<'a>(pics: impl IntoIterator<Item = &'a Picture>) -> Option<&'a Picture> {
    let mut pics_iter = pics.into_iter();
    // First try to find a cover front picture
    if let Some(cover_front) = pics_iter.find(|p| p.pic_type() == PictureType::CoverFront) {
        return Some(cover_front);
    }
    // If no cover front, try to find any picture
    pics_iter.next()
}

fn picture_mime(pic: &Picture) -> &str {
    if let Some(m) = pic.mime_type() {
        let mime_str = m.as_str();
        if !mime_str.is_empty() {
            return mime_str;
        }
    }
    let d = pic.data();
    if d.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "image/jpeg"
    } else if d.starts_with(&[0x89, b'P', b'N', b'G']) {
        "image/png"
    } else if d.len() > 12 && &d[0..4] == b"RIFF" && &d[8..12] == b"WEBP" {
        "image/webp"
    } else {
        "application/octet-stream"
    }
}