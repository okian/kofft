use clap::{Parser, ValueEnum};
use image::{ImageBuffer, Rgb};
use kofft::visual::spectrogram::{
    color_from_magnitude_u16, log_scale_bins, stft_magnitudes, Colormap,
};
use sanity_check::{read_audio, save_png, PngDepth};
use std::error::Error;
use std::io;
use std::path::PathBuf;

#[derive(ValueEnum, Clone, Copy, Debug)]
enum ScaleMode {
    Linear,
    Log,
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

#[derive(Parser, Debug)]
struct Args {
    /// Path to input audio file
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

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    let (samples, _sr) = read_audio(&args.input)?;
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
