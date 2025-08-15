use clap::Parser;
use claxon::FlacReader;
use image::{GrayImage, Luma};
use kofft::fft::ScalarFftImpl;
use kofft::stft::stft;
use kofft::window::hann;
use num_complex::Complex32;
use rustfft::FftPlanner;
use std::error::Error;
use std::path::PathBuf;

/// Compare kofft STFT with rustfft on a FLAC file and save heatmaps.
#[derive(Parser)]
struct Args {
    /// Path to input FLAC file
    input: PathBuf,
}

fn read_flac(path: &PathBuf) -> Result<Vec<f32>, Box<dyn Error>> {
    let mut reader = FlacReader::open(path)?;
    let mut samples = Vec::new();
    for s in reader.samples() {
        let v: i32 = s?;
        samples.push(v as f32 / i32::MAX as f32);
    }
    Ok(samples)
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    let samples = read_flac(&args.input)?;

    let win_len = 1024usize;
    let hop = win_len / 2;
    let window = hann(win_len);
    let frames = samples.len().saturating_sub(win_len) / hop + 1;

    // kofft STFT
    let mut kofft_frames = vec![vec![]; frames];
    let fft = ScalarFftImpl::<f32>::default();
    stft(&samples, &window, hop, &mut kofft_frames, &fft).unwrap();
    let kofft_mag: Vec<Vec<f32>> = kofft_frames
        .iter()
        .map(|f| {
            f.iter()
                .map(|c| (c.re * c.re + c.im * c.im).sqrt())
                .collect()
        })
        .collect();

    // rustfft STFT
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(win_len);
    let mut rust_mag: Vec<Vec<f32>> = Vec::with_capacity(frames);
    for frame in 0..frames {
        let start = frame * hop;
        let mut buffer: Vec<Complex32> = (0..win_len)
            .map(|i| {
                let x = if start + i < samples.len() {
                    samples[start + i] * window[i]
                } else {
                    0.0
                };
                Complex32::new(x, 0.0)
            })
            .collect();
        fft.process(&mut buffer);
        rust_mag.push(buffer.iter().map(|c| c.norm()).collect());
    }

    // compute max difference
    let mut max_diff = 0.0f32;
    for (a, b) in kofft_mag.iter().zip(rust_mag.iter()) {
        for (x, y) in a.iter().zip(b.iter()) {
            let diff = (x - y).abs();
            if diff > max_diff {
                max_diff = diff;
            }
        }
    }
    println!("Max difference between spectrograms: {:.6}", max_diff);

    // save heatmaps for visual inspection (use first half of spectrum)
    let height = win_len / 2;
    let width = frames;
    let mut img_kofft = GrayImage::new(width as u32, height as u32);
    let mut img_ref = GrayImage::new(width as u32, height as u32);
    let max_val = kofft_mag
        .iter()
        .flat_map(|v| v.iter())
        .chain(rust_mag.iter().flat_map(|v| v.iter()))
        .cloned()
        .fold(0.0f32, f32::max);
    for (x, (kf, rf)) in kofft_mag.iter().zip(rust_mag.iter()).enumerate() {
        for y in 0..height {
            let v1 = (kf[y] / max_val * 255.0).min(255.0) as u8;
            let v2 = (rf[y] / max_val * 255.0).min(255.0) as u8;
            img_kofft.put_pixel(x as u32, y as u32, Luma([v1]));
            img_ref.put_pixel(x as u32, y as u32, Luma([v2]));
        }
    }
    img_kofft.save("kofft_spectrogram.png")?;
    img_ref.save("reference_spectrogram.png")?;
    println!("Saved kofft_spectrogram.png and reference_spectrogram.png");
    Ok(())
}
