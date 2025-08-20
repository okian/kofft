use std::cell::RefCell;

use console_error_panic_hook;
use js_sys::{Array, Uint32Array};
use kofft::fft::{self, new_fft_impl, Complex32, FftImpl};
use kofft::visual::spectrogram::{self, Colormap as KColormap};
use kofft::window::hann;
use kofft::{dct, fuzzy, resample, wavelet};
use wasm_bindgen::prelude::*;
use web_sys::console;

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
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

#[wasm_bindgen]
pub fn resample_audio(input: &[f32], src_rate: f32, dst_rate: f32) -> Result<Vec<f32>, JsValue> {
    resample::linear_resample(input, src_rate, dst_rate)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// FFT window length used for streaming spectrogram frames.
const WIN_LEN: usize = 1024;
/// Hop size between successive frames.
const HOP: usize = 512;

#[wasm_bindgen]
pub enum Colormap {
    Rainbow,
    Fire,
}

impl From<Colormap> for KColormap {
    fn from(cmap: Colormap) -> Self {
        match cmap {
            Colormap::Rainbow => KColormap::Rainbow,
            Colormap::Fire => KColormap::Fire,
        }
    }
}

#[wasm_bindgen]
pub fn reset_state() {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        *state = State::new();
    });
}

#[wasm_bindgen]
pub fn set_colormap(cmap: &str) {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.cmap = match cmap {
            "fire" => KColormap::Fire,
            _ => KColormap::Rainbow,
        };
    });
}

#[wasm_bindgen]
pub fn compute_frame(samples: &[f32]) -> Vec<u8> {
    STATE.with(|state| {
        let mut state = state.borrow_mut();

        if samples.len() < WIN_LEN {
            return Vec::new();
        }

        // Apply window
        let mut windowed = Vec::with_capacity(WIN_LEN);
        for (i, &sample) in samples.iter().take(WIN_LEN).enumerate() {
            windowed.push(sample * state.window[i]);
        }

        // Compute FFT
        let mut spectrum = vec![Complex32::new(0.0, 0.0); WIN_LEN];
        for (i, &sample) in windowed.iter().enumerate() {
            spectrum[i] = Complex32::new(sample, 0.0);
        }
        state.fft.fft(&mut spectrum).unwrap();

        // Compute magnitudes
        let mut magnitudes = Vec::with_capacity(WIN_LEN / 2);
        for i in 0..WIN_LEN / 2 {
            let mag = ((spectrum[i].re * spectrum[i].re + spectrum[i].im * spectrum[i].im)
                / WIN_LEN as f32)
                .sqrt();
            magnitudes.push(mag);
            state.max_mag = state.max_mag.max(mag);
        }

        // Convert to colors
        let mut colors = Vec::with_capacity(WIN_LEN / 2 * 4);
        for &mag in &magnitudes {
            let color = spectrogram::color_from_magnitude_u8(mag, state.max_mag, -60.0, state.cmap);
            colors.extend_from_slice(&[color[0], color[1], color[2], 255]);
        }

        colors
    })
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
            max_mag: 0.0,
        }
    }
}

/// Number of milliseconds in one second. Used for converting window lengths.
const MS_PER_SEC: f32 = 1000.0;

/// Generate an amplitude envelope for seekbar visualisation.
/// Returns an array of amplitude values in the range `0.0..=1.0`.
#[wasm_bindgen]
pub fn generate_amplitude_envelope(
    audio_data: &[f32],
    sample_rate: u32,
    target_bars: usize,
    window_ms: u32,
    smoothing_samples: usize,
) -> Vec<f32> {
    if audio_data.is_empty() || target_bars == 0 {
        console::warn_1(&"generate_amplitude_envelope: empty input".into());
        return vec![0.0; target_bars];
    }

    // Calculate window size in samples and guard against zero-length windows.
    let window_samples = (sample_rate as f32 * window_ms as f32 / MS_PER_SEC) as usize;
    if window_samples == 0 {
        console::warn_1(&"generate_amplitude_envelope: window length < 1 sample".into());
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
            let start = if i >= smoothing_samples / 2 {
                i - smoothing_samples / 2
            } else {
                0
            };
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
    } else {
        console::warn_1(&"generate_amplitude_envelope: zero maximum amplitude".into());
    }

    envelope
}

/// Size of the FFT window used for per-bar amplitude analysis.
/// Chosen as a power of two for FFT efficiency and to match the JS fallback.
const BAR_FFT_SIZE: usize = 1024;
/// Maximum number of bars allowed to prevent excessive allocations.
pub(crate) const MAX_BARS: usize = 10_000;

/// Compute per-bar amplitudes using an RMS/FFT pipeline.
///
/// The incoming audio is first resampled so that `num_bars` windows of
/// `BAR_FFT_SIZE` samples evenly cover the entire track.  This guarantees that
/// the final bar always contains the track's last sample.  Each window is
/// Hann-windowed, transformed with an FFT and converted to an RMS magnitude.
/// The resulting amplitudes are normalised to the range `0.0..=1.0`.
#[wasm_bindgen]
pub fn compute_bar_amplitudes(audio_data: &[f32], num_bars: usize) -> Vec<f32> {
    if num_bars == 0 {
        console::warn_1(&"compute_bar_amplitudes: zero bars".into());
        return Vec::new();
    }

    // Clamp number of bars to a sane upper bound to avoid excessive allocations.
    let clamped_bars = if num_bars > MAX_BARS {
        console::warn_1(
            &format!(
                "compute_bar_amplitudes: clamping num_bars {} to {}",
                num_bars, MAX_BARS
            )
            .into(),
        );
        MAX_BARS
    } else {
        num_bars
    };

    if audio_data.is_empty() {
        console::warn_1(&"compute_bar_amplitudes: empty input".into());
        return vec![0.0; clamped_bars];
    }

    // Resample so every bar spans exactly BAR_FFT_SIZE samples.
    let target_len = match BAR_FFT_SIZE.checked_mul(clamped_bars) {
        Some(len) => len,
        None => {
            console::error_1(&"compute_bar_amplitudes: length overflow".into());
            return vec![0.0; clamped_bars];
        }
    };

    let resampled =
        match resample::linear_resample(audio_data, audio_data.len() as f32, target_len as f32) {
            Ok(data) => data,
            Err(e) => {
                console::error_1(&format!("compute_bar_amplitudes: resample failed: {e}").into());
                return vec![0.0; num_bars];
            }
        };

    if resampled.len() != target_len {
        console::error_1(
            &format!(
                "compute_bar_amplitudes: resampled length {} != {}",
                resampled.len(),
                target_len
            )
            .into(),
        );
        return vec![0.0; num_bars];
    }

    // Pre-allocate reusable buffers to avoid repeated allocations.
    let window = hann(BAR_FFT_SIZE);
    let mut fft_buf = vec![Complex32::new(0.0, 0.0); BAR_FFT_SIZE];
    let mut fft = new_fft_impl();

    let mut amplitudes = Vec::with_capacity(clamped_bars);

    for bar in 0..clamped_bars {
        let start = bar * BAR_FFT_SIZE;
        let slice = &resampled[start..start + BAR_FFT_SIZE];

        // Apply window and load into complex buffer.
        for (i, sample) in slice.iter().enumerate() {
            fft_buf[i].re = *sample * window[i];
            fft_buf[i].im = 0.0;
        }

        // Perform FFT in-place and log on failure.
        if fft.fft(&mut fft_buf).is_err() {
            console::error_1(&format!("compute_bar_amplitudes: FFT failed at bar {bar}").into());
            amplitudes.push(0.0);
            continue;
        }

        // Convert spectrum to RMS magnitude using Parseval's theorem.
        let energy: f32 = fft_buf.iter().map(|c| c.re * c.re + c.im * c.im).sum();
        let rms = (energy / BAR_FFT_SIZE as f32).sqrt();
        amplitudes.push(rms);
    }

    // Normalise to 0.0..1.0 to simplify downstream rendering.
    if let Some(max) = amplitudes
        .iter()
        .cloned()
        .fold(None, |acc, v| Some(acc.map_or(v, |m| m.max(v))))
    {
        if max > 0.0 {
            for amp in &mut amplitudes {
                *amp /= max;
            }
        } else {
            console::warn_1(&"compute_bar_amplitudes: zero maximum amplitude".into());
        }
    } else {
        console::warn_1(&"compute_bar_amplitudes: no amplitudes computed".into());
    }

    amplitudes
}

/// Generate waveform data for visualization (legacy function for compatibility)
/// Returns an array of amplitude values (0.0 to 1.0) representing the audio waveform
#[wasm_bindgen]
pub fn generate_waveform(audio_data: &[f32], num_bars: usize) -> Vec<f32> {
    // Use the new amplitude envelope function with default parameters
    generate_amplitude_envelope(audio_data, 44100, num_bars, 20, 3)
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert_eq!(empty.len(), 0);
        let frame = compute_frame(&vec![1.0; WIN_LEN]);
        assert_eq!(frame.len(), (WIN_LEN / 2) * 4);
        let frame2 = compute_frame(&vec![1.0; HOP]);
        assert_eq!(frame2.len(), 0);
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
    fn compute_bar_amplitudes_constant_signal() {
        // A constant signal should yield identical normalised amplitudes.
        let data = vec![0.5; BAR_FFT_SIZE * 4];
        let amps = compute_bar_amplitudes(&data, 4);
        assert_eq!(amps.len(), 4);
        for amp in amps {
            assert!((amp - 1.0).abs() < 1e-6);
        }
    }

    #[test]
    fn compute_bar_amplitudes_empty_input() {
        // Empty audio or zero bars should yield a zero-filled vector without panicking.
        let amps = compute_bar_amplitudes(&[], 5);
        assert_eq!(amps, vec![0.0; 5]);
        let amps = compute_bar_amplitudes(&[1.0, 2.0], 0);
        assert!(amps.is_empty());
    }

    #[test]
    fn compute_bar_amplitudes_overflow_safe() {
        // An excessively large bar count must be clamped and not panic.
        let bars = usize::MAX / BAR_FFT_SIZE + 1;
        let amps = compute_bar_amplitudes(&[0.0; 10], bars);
        assert_eq!(amps.len(), MAX_BARS);
        assert!(amps.iter().all(|&a| a == 0.0));
    }
}
