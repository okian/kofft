use clap::{Parser, ValueEnum};
use hound::WavReader;
use image::{
    codecs::png::{CompressionType, FilterType, PngEncoder},
    ColorType, EncodableLayout, ImageBuffer, ImageEncoder, Rgb,
};
use kofft::visual::spectrogram::{
    color_from_magnitude_u16, log_scale_bins, stft_magnitudes, Colormap,
};
use std::error::Error;
use std::fs::File;
use std::io;
use std::path::PathBuf;

#[derive(ValueEnum, Clone, Copy, Debug)]
enum ScaleMode {
    Linear,
    Log,
}

#[derive(ValueEnum, Clone, Copy, Debug)]
enum PngDepth {
    Eight,
    Sixteen,
}

#[derive(Parser, Debug)]
struct Args {
    /// Path to input WAV file
    input: PathBuf,
    /// Path to output PNG file
    output: PathBuf,
    /// Colour map for output
    #[arg(long, value_enum, default_value_t = ColorArg::Inferno)]
    colormap: ColorArg,
    /// Window length for STFT
    #[arg(long, default_value_t = 1024)]
    win_len: usize,
    /// Frequency scaling mode
    #[arg(long, value_enum, default_value_t = ScaleMode::Linear)]
    scale_mode: ScaleMode,
    /// Dynamic range in dB
    #[arg(long, default_value_t = 120.0)]
    dynamic_range: f32,
    /// Bit depth for PNG
    #[arg(long, value_enum, default_value_t = PngDepth::Eight)]
    png_depth: PngDepth,
}

#[derive(ValueEnum, Clone, Copy, Debug)]
enum ColorArg {
    Fire,
    Legacy,
    Gray,
    Viridis,
    Plasma,
    Inferno,
    Rainbow,
}

impl From<ColorArg> for Colormap {
    fn from(c: ColorArg) -> Self {
        match c {
            ColorArg::Fire => Colormap::Fire,
            ColorArg::Legacy => Colormap::Legacy,
            ColorArg::Gray => Colormap::Gray,
            ColorArg::Viridis => Colormap::Viridis,
            ColorArg::Plasma => Colormap::Plasma,
            ColorArg::Inferno => Colormap::Inferno,
            ColorArg::Rainbow => Colormap::Rainbow,
        }
    }
}

fn read_wav(path: &PathBuf) -> Result<(Vec<f32>, u32), Box<dyn Error>> {
    let mut reader = WavReader::open(path)?;
    let spec = reader.spec();
    let samples: Result<Vec<f32>, _> = reader
        .samples::<i16>()
        .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
        .collect();
    Ok((samples?, spec.sample_rate))
}

fn save_png(
    img: &ImageBuffer<Rgb<u16>, Vec<u16>>,
    path: &PathBuf,
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

fn save_svg(img: &ImageBuffer<Rgb<u16>, Vec<u16>>, path: &PathBuf) -> Result<(), Box<dyn Error>> {
    use svg::node::element::Rectangle;
    use svg::Document;
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

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    let (samples, _sr) = read_wav(&args.input)?;
    let hop = args.win_len / 2;
    let (mags, max_mag) = stft_magnitudes(&samples, args.win_len, hop)
        .map_err(|e| io::Error::other(format!("{e:?}")))?;
    let height = args.win_len / 2;
    let width = mags.len();
    let mut img: ImageBuffer<Rgb<u16>, _> = ImageBuffer::new(width as u32, height as u32);
    let palette: Colormap = args.colormap.into();
    for (x, frame) in mags.iter().enumerate() {
        let bins = match args.scale_mode {
            ScaleMode::Linear => frame.clone(),
            ScaleMode::Log => log_scale_bins(&frame[..height], height - 1),
        };
        for (y, v) in bins.iter().enumerate() {
            let c = color_from_magnitude_u16(*v, max_mag, -args.dynamic_range, palette);
            img.put_pixel(x as u32, (height - 1 - y) as u32, Rgb(c));
        }
    }
    save_png(&img, &args.output, args.png_depth)?;
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

        save_png(&img, &path8, PngDepth::Eight).unwrap();
        save_png(&img, &path16, PngDepth::Sixteen).unwrap();

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
        save_svg(&img, &tmp).unwrap();
        let content = fs::read_to_string(&tmp).unwrap();
        assert!(content.contains("<svg"));
        fs::remove_file(tmp).unwrap();
    }
}
