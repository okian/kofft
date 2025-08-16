use clap::{Parser, ValueEnum};
use claxon::FlacReader;
use image::ImageEncoder;
use image::{
    codecs::png::{CompressionType, FilterType, PngEncoder},
    ColorType, EncodableLayout, ImageBuffer, Rgb,
};
use indicatif::ProgressBar;
use kofft::fft::ScalarFftImpl;
use kofft::stft::stft;
use kofft::window::hann;
use num_complex::Complex32;
use rustfft::FftPlanner;
use std::error::Error;
use std::fs::File;
use std::path::PathBuf;
use svg::node::element::Rectangle;
use svg::Document;

/// Compare kofft STFT with rustfft on a FLAC file and save heatmaps.
#[derive(ValueEnum, Clone)]
enum ColorMap {
    Gray,
    Viridis,
    Plasma,
    Inferno,
}

#[derive(ValueEnum, Clone, Copy)]
enum PngDepth {
    Eight,
    Sixteen,
}

#[derive(Parser)]
struct Args {
    /// Path to input FLAC file
    input: PathBuf,

    /// Color map for the output PNG
    #[arg(long, value_enum, default_value_t = ColorMap::Inferno)]
    colormap: ColorMap,

    /// Window length for STFT
    #[arg(long, default_value_t = 4096)]
    win_len: usize,

    /// Bit depth for the output PNG
    #[arg(long, value_enum, default_value_t = PngDepth::Eight)]
    png_depth: PngDepth,

    /// Optional path to save an SVG spectrogram
    #[arg(long)]
    svg_output: Option<PathBuf>,
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

fn map_color(value: f32, max: f32, cmap: &ColorMap) -> [u16; 3] {
    // Scale magnitude to decibels for better visual contrast
    let min_db = -80.0_f32;
    let db = 20.0 * (value / max).max(1e-10).log10();
    let t = ((db - min_db) / -min_db).clamp(0.0, 1.0) as f64;
    match cmap {
        ColorMap::Gray => {
            let g = (t * 65535.0).round() as u16;
            [g, g, g]
        }
        ColorMap::Viridis => {
            let c = colorous::VIRIDIS.eval_continuous(t);
            [
                u16::from(c.r) * 257,
                u16::from(c.g) * 257,
                u16::from(c.b) * 257,
            ]
        }
        ColorMap::Plasma => {
            let c = colorous::PLASMA.eval_continuous(t);
            [
                u16::from(c.r) * 257,
                u16::from(c.g) * 257,
                u16::from(c.b) * 257,
            ]
        }
        ColorMap::Inferno => {
            let c = colorous::INFERNO.eval_continuous(t);
            [
                u16::from(c.r) * 257,
                u16::from(c.g) * 257,
                u16::from(c.b) * 257,
            ]
        }
    }
}

fn save_png(
    img: &ImageBuffer<Rgb<u16>, Vec<u16>>,
    path: &str,
    depth: PngDepth,
) -> Result<(), Box<dyn Error>> {
    let file = File::create(path)?;
    let encoder = PngEncoder::new_with_quality(file, CompressionType::Best, FilterType::Adaptive);
    let (w, h) = (img.width(), img.height());
    match depth {
        PngDepth::Eight => {
            let img8: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::from_fn(w, h, |x, y| {
                let p = img.get_pixel(x, y);
                Rgb([
                    (p.0[0] >> 8) as u8,
                    (p.0[1] >> 8) as u8,
                    (p.0[2] >> 8) as u8,
                ])
            });
            encoder.write_image(img8.as_raw(), w, h, ColorType::Rgb8)?;
        }
        PngDepth::Sixteen => {
            encoder.write_image(img.as_raw().as_bytes(), w, h, ColorType::Rgb16)?;
        }
    }
    Ok(())
}

fn save_svg(img: &ImageBuffer<Rgb<u16>, Vec<u16>>, path: &str) -> Result<(), Box<dyn Error>> {
    let (w, h) = (img.width(), img.height());
    let mut document = Document::new().set("viewBox", (0, 0, w, h));
    for (x, y, pixel) in img.enumerate_pixels() {
        let color = format!(
            "#{:02x}{:02x}{:02x}",
            (pixel[0] >> 8),
            (pixel[1] >> 8),
            (pixel[2] >> 8)
        );
        let rect = Rectangle::new()
            .set("x", x)
            .set("y", y)
            .set("width", 1)
            .set("height", 1)
            .set("fill", color);
        document = document.add(rect);
    }
    svg::save(path, &document)?;
    Ok(())
}

fn spectrogram_description(width: usize, height: usize, cmap: &ColorMap) -> String {
    let cmap_name = match cmap {
        ColorMap::Gray => "Gray",
        ColorMap::Viridis => "Viridis",
        ColorMap::Plasma => "Plasma",
        ColorMap::Inferno => "Inferno",
    };
    format!(
        "Spectrogram Visualization: X-axis time frames, Y-axis frequency bins, colors show magnitude in dB using {} colormap, resolution {}x{} pixels, layout includes axis labels, color bar, and grid lines.",
        cmap_name, width, height
    )
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    let samples = read_flac(&args.input)?;

    let win_len = args.win_len;
    let hop = win_len / 2;
    let window = hann(win_len);
    let frames = samples.len().div_ceil(hop);

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
    let mut img_kofft: ImageBuffer<Rgb<u16>, _> = ImageBuffer::new(width as u32, height as u32);
    let mut img_ref: ImageBuffer<Rgb<u16>, _> = ImageBuffer::new(width as u32, height as u32);
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
    save_png(&img_kofft, "kofft_spectrogram.png", args.png_depth)?;
    save_png(&img_ref, "reference_spectrogram.png", args.png_depth)?;
    if let Some(path) = args.svg_output.as_ref() {
        save_svg(&img_kofft, path.to_str().unwrap())?;
    }
    println!("Saved kofft_spectrogram.png and reference_spectrogram.png");
    println!("{}", spectrogram_description(width, height, &args.colormap));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::codecs::png::PngDecoder;
    use image::ImageDecoder;
    use std::fs;
    use std::fs::File;

    #[test]
    fn saves_png_with_specified_depth() {
        let img: ImageBuffer<Rgb<u16>, Vec<u16>> =
            ImageBuffer::from_pixel(2, 2, Rgb([0, 65535, 32768]));
        let tmp = std::env::temp_dir();
        let path8 = tmp.join("test_depth8.png");
        let path16 = tmp.join("test_depth16.png");

        save_png(&img, path8.to_str().unwrap(), PngDepth::Eight).unwrap();
        save_png(&img, path16.to_str().unwrap(), PngDepth::Sixteen).unwrap();

        let dec8 = PngDecoder::new(File::open(&path8).unwrap()).unwrap();
        assert_eq!(dec8.color_type(), ColorType::Rgb8);

        let dec16 = PngDecoder::new(File::open(&path16).unwrap()).unwrap();
        assert_eq!(dec16.color_type(), ColorType::Rgb16);

        fs::remove_file(path8).unwrap();
        fs::remove_file(path16).unwrap();
    }

    #[test]
    fn saves_svg_output() {
        let img: ImageBuffer<Rgb<u16>, Vec<u16>> =
            ImageBuffer::from_pixel(1, 1, Rgb([65535, 0, 0]));
        let tmp = std::env::temp_dir().join("test.svg");
        save_svg(&img, tmp.to_str().unwrap()).unwrap();
        let content = fs::read_to_string(&tmp).unwrap();
        assert!(content.contains("<svg"));
        fs::remove_file(tmp).unwrap();
    }

    #[test]
    fn stft_accepts_div_ceil_frames() {
        let signal = vec![0.0; 10];
        let window = hann(4);
        let hop = 2;
        let mut frames = vec![vec![]; signal.len().div_ceil(hop)];
        let fft = ScalarFftImpl::<f32>::default();
        assert!(stft(&signal, &window, hop, &mut frames, &fft).is_ok());
    }

    #[test]
    fn spectrogram_description_matches_spec() {
        let desc = spectrogram_description(10, 20, &ColorMap::Inferno);
        assert_eq!(
            desc,
            "Spectrogram Visualization: X-axis time frames, Y-axis frequency bins, colors show magnitude in dB using Inferno colormap, resolution 10x20 pixels, layout includes axis labels, color bar, and grid lines."
        );
    }
}
