use kofft::fft;
use wasm_bindgen::prelude::*;

/// Width of each bar in pixels.
const BAR_WIDTH_PX: usize = 5;
/// Gap between bars in pixels.
const BAR_GAP_PX: usize = 4;

/// Holds the normalized height of each seek bar.
#[wasm_bindgen]
#[derive(Clone)]
pub struct SeekBar {
    bars: Vec<f32>,
}

#[wasm_bindgen]
impl SeekBar {
    /// Returns the normalized heights (0.0 - 1.0) of all bars.
    #[wasm_bindgen(getter)]
    pub fn bars(&self) -> Vec<f32> {
        self.bars.clone()
    }

    /// Number of bars in the seek bar.
    #[wasm_bindgen(getter)]
    pub fn count(&self) -> usize {
        self.bars.len()
    }
}

/// Compute number of bars that fit in the provided width.
fn bar_count(width_px: f32) -> usize {
    ((width_px as usize) + BAR_GAP_PX) / (BAR_WIDTH_PX + BAR_GAP_PX)
}

/// Compute the maximum FFT magnitude for the given sample segment.
fn segment_amplitude(segment: &[f32]) -> f32 {
    let mut re = segment.to_vec();
    let mut im = vec![0.0; re.len()];
    if fft::fft_split(&mut re, &mut im).is_err() {
        return 0.0;
    }
    re.iter()
        .zip(&im)
        .map(|(r, i)| (r * r + i * i).sqrt())
        .fold(0.0, f32::max)
}

/// Compute normalized bar heights for the seek bar.
#[wasm_bindgen]
pub fn compute_seek_bar(samples: &[f32], width_px: f32, scale: f32) -> SeekBar {
    let count = bar_count(width_px);
    if count == 0 {
        return SeekBar { bars: Vec::new() };
    }
    let seg_len = (samples.len() + count - 1) / count;
    let mut bars = Vec::with_capacity(count);
    for i in 0..count {
        let start = i * seg_len;
        let end = usize::min(start + seg_len, samples.len());
        let amp = if start < end {
            segment_amplitude(&samples[start..end])
        } else {
            0.0
        };
        bars.push(amp);
    }
    if let Some(max) = bars
        .iter()
        .cloned()
        .fold(None::<f32>, |a, b| Some(a.map_or(b, |m| m.max(b))))
    {
        if max > 0.0 {
            for b in &mut bars {
                *b = (*b / max).powf(scale);
            }
        }
    }
    SeekBar { bars }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // Verify bar count formula and gap handling.
    fn count_matches_width() {
        assert_eq!(bar_count(0.0), 0);
        assert_eq!(bar_count(13.0), 1); // width too small for two bars
        assert_eq!(bar_count(14.0), 2); // exact fit for two bars
    }

    #[test]
    // Ensure amplitude calculation spans entire sample slice and normalization.
    fn amplitudes_cover_entire_track() {
        let mut samples = vec![0.0f32; 8];
        samples.extend(vec![1.0f32; 8]);
        let res = compute_seek_bar(&samples, 14.0, 1.0);
        let bars = res.bars();
        assert_eq!(bars.len(), 2);
        assert!(bars[0] < 1e-6);
        assert!((bars[1] - 1.0).abs() < 1e-6);
    }

    #[test]
    // Scaling parameter should exponentiate normalized values.
    fn scaling_is_applied() {
        let mut samples = vec![0.5f32; 8];
        samples.extend(vec![1.0f32; 8]);
        let res = compute_seek_bar(&samples, 14.0, 2.0);
        let bars = res.bars();
        assert_eq!(bars.len(), 2);
        assert!((bars[0] - 0.25).abs() < 1e-6);
        assert!((bars[1] - 1.0).abs() < 1e-6);
    }
}
