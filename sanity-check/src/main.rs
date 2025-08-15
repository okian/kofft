use clap::{Parser, ValueEnum};
use claxon::FlacReader;
use image::{Rgb, RgbImage};
use indicatif::ProgressBar;
use kofft::fft::ScalarFftImpl;
use kofft::stft::stft;
use kofft::window::hann;
use num_complex::Complex32;
use rustfft::FftPlanner;
use std::error::Error;
use std::path::PathBuf;

/// Compare kofft STFT with rustfft on a FLAC file and save heatmaps.
#[derive(ValueEnum, Clone)]
enum ColorMap {
    Gray,
    Viridis,
    Plasma,
}

#[derive(Parser)]
struct Args {
    /// Path to input FLAC file
    input: PathBuf,

    /// Color map for the output PNG
    #[arg(long, value_enum, default_value_t = ColorMap::Gray)]
    colormap: ColorMap,
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

fn map_color(value: f32, max: f32, cmap: &ColorMap) -> [u8; 3] {
    // Scale magnitude to decibels for better visual contrast
    let min_db = -80.0_f32;
    let db = 20.0 * (value / max).max(1e-10).log10();
    let t = ((db - min_db) / -min_db).clamp(0.0, 1.0) as f64;
    match cmap {
        ColorMap::Gray => {
            let g = (t * 255.0).round() as u8;
            [g, g, g]
        }
        ColorMap::Viridis => {
            let c = colorous::VIRIDIS.eval_continuous(t);
            [c.r, c.g, c.b]
        }
        ColorMap::Plasma => {
            let c = colorous::PLASMA.eval_continuous(t);
            [c.r, c.g, c.b]
        }
    }
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
    let bar = ProgressBar::new(frames as u64);
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
        bar.inc(1);
    }
    bar.finish_and_clear();

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
    let mut img_kofft = RgbImage::new(width as u32, height as u32);
    let mut img_ref = RgbImage::new(width as u32, height as u32);
    let max_val = kofft_mag
        .iter()
        .flat_map(|v| v.iter())
        .chain(rust_mag.iter().flat_map(|v| v.iter()))
        .cloned()
        .fold(0.0f32, f32::max);
    let heatmap_bar = ProgressBar::new(width as u64);
    let max_val = if max_val > 0.0 { max_val } else { 1.0 };

    for (x, (kf, rf)) in kofft_mag.iter().zip(rust_mag.iter()).enumerate() {
        for y in 0..height {
            let col1 = map_color(kf[y], max_val, &args.colormap);
            let col2 = map_color(rf[y], max_val, &args.colormap);
            img_kofft.put_pixel(x as u32, y as u32, Rgb(col1));
            img_ref.put_pixel(x as u32, y as u32, Rgb(col2));
        }
        heatmap_bar.inc(1);
    }
    heatmap_bar.finish_and_clear();
    img_kofft.save("kofft_spectrogram.png")?;
    img_ref.save("reference_spectrogram.png")?;
    println!("Saved kofft_spectrogram.png and reference_spectrogram.png");
    Ok(())
}
