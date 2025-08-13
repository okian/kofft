use crate::fft::{Complex32, FftError, FftImpl, ScalarFftImpl};
use alloc::{vec, vec::Vec};

pub fn stft(
    signal: &[f32],
    window: &[f32],
    hop: usize,
    output: &mut [Vec<Complex32>],
) -> Result<(), FftError> {
    let win_len = window.len();
    let fft = ScalarFftImpl::<f32>::default();
    for (frame_idx, frame) in output.iter_mut().enumerate() {
        let start = frame_idx * hop;
        frame.clear();
        for i in 0..win_len {
            let x = if start + i < signal.len() {
                signal[start + i] * window[i]
            } else {
                0.0
            };
            frame.push(Complex32::new(x, 0.0));
        }
        fft.fft(frame)?;
    }
    Ok(())
}

pub fn istft(
    frames: &[Vec<Complex32>],
    window: &[f32],
    hop: usize,
    output: &mut [f32],
) -> Result<(), FftError> {
    let win_len = window.len();
    let fft = ScalarFftImpl::<f32>::default();
    let mut norm = vec![0.0f32; output.len()];
    for (frame_idx, frame) in frames.iter().enumerate() {
        let start = frame_idx * hop;
        let mut time_buf = frame.clone();
        fft.ifft(&mut time_buf)?;
        for i in 0..win_len {
            if start + i < output.len() {
                output[start + i] += time_buf[i].re * window[i];
                norm[start + i] += window[i] * window[i];
            }
        }
    }
    for i in 0..output.len() {
        if norm[i] > 1e-8 {
            output[i] /= norm[i];
        }
    }
    Ok(())
}

pub struct StftStream<'a> {
    signal: &'a [f32],
    window: &'a [f32],
    hop: usize,
    pos: usize,
    fft: ScalarFftImpl<f32>,
}

impl<'a> StftStream<'a> {
    pub fn new(signal: &'a [f32], window: &'a [f32], hop: usize) -> Self {
        Self {
            signal,
            window,
            hop,
            pos: 0,
            fft: ScalarFftImpl::<f32>::default(),
        }
    }

    pub fn next_frame(&mut self, out: &mut [Complex32]) -> Result<bool, FftError> {
        let win_len = self.window.len();
        if self.pos >= self.signal.len() {
            return Ok(false);
        }
        for i in 0..win_len {
            let x = if self.pos + i < self.signal.len() {
                self.signal[self.pos + i] * self.window[i]
            } else {
                0.0
            };
            out[i] = Complex32::new(x, 0.0);
        }
        self.fft.fft(out)?;
        self.pos += self.hop;
        Ok(true)
    }
}

pub struct IstftStream<'a> {
    win_len: usize,
    hop: usize,
    window: Vec<f32>,
    fft: &'a ScalarFftImpl<f32>,
    buffer: Vec<f32>,
    pos: usize,
}

impl<'a> IstftStream<'a> {
    pub fn new(win_len: usize, hop: usize, window: Vec<f32>, fft: &'a ScalarFftImpl<f32>) -> Self {
        let buffer = vec![0.0f32; win_len + hop * 2];
        Self {
            win_len,
            hop,
            window,
            fft,
            buffer,
            pos: 0,
        }
    }

    pub fn push_frame(&mut self, frame: &[Complex32]) -> &[f32] {
        let mut time = frame.to_vec();
        self.fft.ifft(&mut time).unwrap();
        for i in 0..self.win_len {
            let val = time[i].re * self.window[i];
            if self.pos + i >= self.buffer.len() {
                self.buffer.resize(self.pos + self.win_len, 0.0);
            }
            self.buffer[self.pos + i] += val;
        }
        let out_start = self.pos;
        let out_end = out_start + self.hop;
        self.pos += self.hop;
        &self.buffer[out_start..out_end]
    }
}
