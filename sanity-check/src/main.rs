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
    Rainbow,
}

#[derive(ValueEnum, Clone, Copy)]
enum SpectrogramMode {
    Unipolar,
    Bipolar,
}

#[derive(ValueEnum, Clone, Copy)]
enum PngDepth {
    Eight,
    Sixteen,
}

#[derive(ValueEnum, Clone, Copy, Debug, PartialEq)]
enum ScaleMode {
    Log,
    Linear,
}

const EXAMPLE_STR: &str = "Example:\n    sanity-check input.flac -s out.svg\n";

#[derive(Parser)]
#[command(about, long_about, after_help = EXAMPLE_STR)]
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

    /// Spectrogram rendering mode
    #[arg(long, value_enum, default_value_t = SpectrogramMode::Unipolar)]
    mode: SpectrogramMode,

    /// Frequency scaling mode
    #[arg(long, value_enum, default_value_t = ScaleMode::Log)]
    scale_mode: ScaleMode,

    /// Dynamic range in decibels
    #[arg(long, default_value_t = 80.0)]
    dynamic_range: f32,

    /// Optional path to save an SVG spectrogram
    #[arg(long, short = 's', help = "Optional path to save an SVG spectrogram")]
    svg_output: Option<PathBuf>,

    /// Draw a top time ruler
    #[arg(long, short = 't', help = "Draw a top time ruler")]
    time_ruler: bool,

    /// Draw a right-side frequency scale
    #[arg(long, short = 'f', help = "Draw a right-side frequency scale")]
    freq_scale: bool,

    /// Overlay waveform centered vertically
    #[arg(long, short = 'w', help = "Overlay waveform centered vertically")]
    waveform: bool,

    /// Draw status bar with time, frequency and amplitude
    #[arg(
        long,
        short = 'b',
        help = "Draw status bar with time, frequency and amplitude"
    )]
    status_bar: bool,

    /// Draw vertical time grid lines
    #[arg(long, help = "Draw vertical time grid lines")]
    grid_time: bool,

    /// Draw horizontal frequency grid lines
    #[arg(long, help = "Draw horizontal frequency grid lines")]
    grid_frequency: bool,
}

fn read_flac(path: &PathBuf) -> Result<(Vec<f32>, u32), Box<dyn Error>> {
    let mut reader = FlacReader::open(path)?;
    let sr = reader.streaminfo().sample_rate;
    let mut samples = Vec::new();
    for s in reader.samples() {
        let v: i32 = s?;
        samples.push(v as f32 / i32::MAX as f32);
    }
    Ok((samples, sr))
}

fn db_scale(value: f32, max: f32, dynamic_range: f32) -> f64 {
    let db = 20.0 * (value / max).max(1e-10).log10();
    ((db + dynamic_range) / dynamic_range).clamp(0.0, 1.0) as f64
}

fn rainbow_color(t: f64) -> [u16; 3] {
    const STOPS: [(f64, [u8; 3]); 6] = [
        (0.0, [0, 0, 0]),
        (0.25, [0, 0, 255]),
        (0.5, [0, 255, 255]),
        (0.75, [255, 255, 0]),
        (0.9, [255, 0, 0]),
        (1.0, [255, 255, 255]),
    ];
    let mut i = 0;
    while i + 1 < STOPS.len() && t > STOPS[i + 1].0 {
        i += 1;
    }
    let (t0, c0) = STOPS[i];
    let (t1, c1) = STOPS[(i + 1).min(STOPS.len() - 1)];
    let local = if t1 > t0 { (t - t0) / (t1 - t0) } else { 0.0 };
    let r = c0[0] as f64 + (c1[0] as f64 - c0[0] as f64) * local;
    let g = c0[1] as f64 + (c1[1] as f64 - c0[1] as f64) * local;
    let b = c0[2] as f64 + (c1[2] as f64 - c0[2] as f64) * local;
    [
        (r.round() as u16) * 257,
        (g.round() as u16) * 257,
        (b.round() as u16) * 257,
    ]
}

fn map_color(value: f32, max: f32, cmap: &ColorMap, dynamic_range: f32) -> [u16; 3] {
    let t = db_scale(value, max, dynamic_range);
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
        ColorMap::Rainbow => rainbow_color(t),
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

fn map_bin_to_pixel(bin: usize, max_bin: usize, scale: ScaleMode) -> usize {
    match scale {
        ScaleMode::Linear => bin,
        ScaleMode::Log => {
            if max_bin == 0 {
                0
            } else {
                let log_max = (max_bin as f32 + 1.0).ln();
                let pos = (bin as f32 + 1.0).ln();
                (max_bin as f32 * pos / log_max).floor() as usize
            }
        }
    }
}

fn log_scale_bins(values: &[f32], max_bin: usize) -> Vec<f32> {
    let mut accum = vec![0.0f32; max_bin + 1];
    let mut counts = vec![0u32; max_bin + 1];
    for (bin, &v) in values.iter().enumerate() {
        let y = map_bin_to_pixel(bin, max_bin, ScaleMode::Log);
        accum[y] += v;
        counts[y] += 1;
    }
    for (a, c) in accum.iter_mut().zip(counts.iter()) {
        if *c > 0 {
            *a /= *c as f32;
        }
    }
    accum
}

fn generate_heatmap(
    magnitudes: &[Vec<f32>],
    cmap: &ColorMap,
    mode: SpectrogramMode,
    scale: ScaleMode,
    dynamic_range: f32,
) -> ImageBuffer<Rgb<u16>, Vec<u16>> {
    let win_len = magnitudes[0].len();
    let width = magnitudes.len();
    let height = match mode {
        SpectrogramMode::Unipolar => win_len / 2,
        SpectrogramMode::Bipolar => win_len,
    };
    let mut img: ImageBuffer<Rgb<u16>, _> = ImageBuffer::new(width as u32, height as u32);
    let max_val = magnitudes
        .iter()
        .flat_map(|v| v.iter().copied())
        .fold(0.0f32, f32::max)
        .max(1.0);
    for (x, frame) in magnitudes.iter().enumerate() {
        match mode {
            SpectrogramMode::Unipolar => {
                let bins = match scale {
                    ScaleMode::Linear => frame[..height].to_vec(),
                    ScaleMode::Log => log_scale_bins(&frame[..height], height - 1),
                };
                for (y, v) in bins.into_iter().enumerate() {
                    let col = map_color(v, max_val, cmap, dynamic_range);
                    img.put_pixel(x as u32, y as u32, Rgb(col));
                }
            }
            SpectrogramMode::Bipolar => {
                let center = win_len / 2;
                match scale {
                    ScaleMode::Linear => {
                        for (k, &v) in frame.iter().enumerate() {
                            let y = if k <= center { center - k } else { k };
                            let col = map_color(v, max_val, cmap, dynamic_range);
                            img.put_pixel(x as u32, y as u32, Rgb(col));
                        }
                    }
                    ScaleMode::Log => {
                        let pos = log_scale_bins(&frame[..=center], center);
                        let neg = log_scale_bins(&frame[center..], center);
                        for (y, v) in pos.iter().enumerate() {
                            let col = map_color(*v, max_val, cmap, dynamic_range);
                            img.put_pixel(x as u32, (center - y) as u32, Rgb(col));
                        }
                        for (y, v) in neg.iter().enumerate() {
                            if y == 0 {
                                continue;
                            }
                            let col = map_color(*v, max_val, cmap, dynamic_range);
                            img.put_pixel(x as u32, (center + y) as u32, Rgb(col));
                        }
                    }
                }
            }
        }
    }
    img
}

fn smooth_heatmap(img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>) {
    let src = img.clone();
    let (w, h) = img.dimensions();
    for y in 0..h {
        for x in 0..w {
            let mut sum = [0u32; 3];
            let mut count = 0u32;
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    let nx = x as i32 + dx;
                    let ny = y as i32 + dy;
                    if nx >= 0 && ny >= 0 && nx < w as i32 && ny < h as i32 {
                        let p = src.get_pixel(nx as u32, ny as u32);
                        sum[0] += p[0] as u32;
                        sum[1] += p[1] as u32;
                        sum[2] += p[2] as u32;
                        count += 1;
                    }
                }
            }
            img.put_pixel(
                x,
                y,
                Rgb([
                    (sum[0] / count) as u16,
                    (sum[1] / count) as u16,
                    (sum[2] / count) as u16,
                ]),
            );
        }
    }
}

fn spectrogram_description(width: usize, height: usize, cmap: &ColorMap) -> String {
    let cmap_name = match cmap {
        ColorMap::Gray => "Gray",
        ColorMap::Viridis => "Viridis",
        ColorMap::Plasma => "Plasma",
        ColorMap::Inferno => "Inferno",
        ColorMap::Rainbow => "Rainbow",
    };
    format!(
        "Spectrogram Visualization: X-axis time frames, Y-axis frequency bins, colors show magnitude in dB using {} colormap, resolution {}x{} pixels, layout includes axis labels, color bar, and grid lines.",
        cmap_name, width, height
    )
}

fn draw_line(
    img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>,
    mut x0: i32,
    mut y0: i32,
    x1: i32,
    y1: i32,
    color: Rgb<u16>,
) {
    let dx = (x1 - x0).abs();
    let dy = -(y1 - y0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx + dy;
    loop {
        if x0 >= 0 && y0 >= 0 && x0 < img.width() as i32 && y0 < img.height() as i32 {
            img.put_pixel(x0 as u32, y0 as u32, color);
        }
        if x0 == x1 && y0 == y1 {
            break;
        }
        let e2 = 2 * err;
        if e2 >= dy {
            err += dy;
            x0 += sx;
        }
        if e2 <= dx {
            err += dx;
            y0 += sy;
        }
    }
}

fn draw_axes(img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>) {
    let w = img.width() as i32 - 1;
    let h = img.height() as i32 - 1;
    let c = Rgb([65535, 65535, 65535]);
    draw_line(img, 0, 0, w, 0, c);
    draw_line(img, 0, h, w, h, c);
    draw_line(img, 0, 0, 0, h, c);
    draw_line(img, w, 0, w, h, c);
}

fn draw_filled_rect(
    img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    color: Rgb<u16>,
) {
    let x0 = x.max(0) as u32;
    let y0 = y.max(0) as u32;
    let x1 = (x + width as i32).min(img.width() as i32) as u32;
    let y1 = (y + height as i32).min(img.height() as i32) as u32;
    for yy in y0..y1 {
        for xx in x0..x1 {
            img.put_pixel(xx, yy, color);
        }
    }
}

fn draw_char(img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>, x: i32, y: i32, ch: char, scale: u32) {
    let pattern = match ch {
        '0' => ["###", "# #", "# #", "# #", "###"],
        '1' => ["  #", "  #", "  #", "  #", "  #"],
        '2' => ["###", "  #", "###", "#  ", "###"],
        '3' => ["###", "  #", "###", "  #", "###"],
        '4' => ["# #", "# #", "###", "  #", "  #"],
        '5' => ["###", "#  ", "###", "  #", "###"],
        '6' => ["###", "#  ", "###", "# #", "###"],
        '7' => ["###", "  #", "  #", "  #", "  #"],
        '8' => ["###", "# #", "###", "# #", "###"],
        '9' => ["###", "# #", "###", "  #", "###"],
        't' => ["###", " # ", " # ", " # ", " # "],
        's' => ["###", "#  ", "###", "  #", "###"],
        'f' => ["###", "#  ", "## ", "#  ", "#  "],
        'H' => ["# #", "# #", "###", "# #", "# #"],
        'z' => ["###", "  #", " # ", "#  ", "###"],
        'a' => ["###", "  #", "###", "# #", "###"],
        ':' => ["   ", " # ", "   ", " # ", "   "],
        '.' => ["   ", "   ", "   ", "   ", " # "],
        ' ' => ["   ", "   ", "   ", "   ", "   "],
        _ => ["???", "???", "???", "???", "???"],
    };
    let scale = scale as i32;
    for (dy, row) in pattern.iter().enumerate() {
        for (dx, c) in row.chars().enumerate() {
            if c == '#' {
                let px0 = x + dx as i32 * scale;
                let py0 = y + dy as i32 * scale;
                for sy in 0..scale {
                    for sx in 0..scale {
                        let px = px0 + sx;
                        let py = py0 + sy;
                        if px >= 0 && py >= 0 && px < img.width() as i32 && py < img.height() as i32
                        {
                            img.put_pixel(px as u32, py as u32, Rgb([65535, 65535, 65535]));
                        }
                    }
                }
            }
        }
    }
}

fn draw_text(img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>, x: i32, y: i32, text: &str, scale: u32) {
    let mut cx = x;
    let adv = 4 * scale as i32;
    for ch in text.chars() {
        draw_char(img, cx, y, ch, scale);
        cx += adv;
    }
}

fn draw_time_grid(
    img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>,
    sample_rate: u32,
    hop: usize,
    enabled: bool,
) {
    if !enabled {
        return;
    }
    let width = img.width();
    let height = img.height();
    let seconds = width as f32 * hop as f32 / sample_rate as f32;
    let px_per_sec = width as f32 / seconds.max(1.0);
    for s in 0..=seconds.ceil() as u32 {
        let x = (s as f32 * px_per_sec) as i32;
        if x < width as i32 {
            draw_line(img, x, 0, x, height as i32 - 1, Rgb([32768, 32768, 32768]));
        }
    }
}

fn draw_frequency_grid(
    img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>,
    sample_rate: u32,
    mode: SpectrogramMode,
    enabled: bool,
) {
    if !enabled {
        return;
    }
    let height = img.height();
    let width = img.width();
    let nyquist = sample_rate as f32 / 2.0;
    match mode {
        SpectrogramMode::Unipolar => {
            let px_per_hz = height as f32 / nyquist.max(1.0);
            for f in (0..=nyquist as u32).step_by(1000) {
                let y = (f as f32 * px_per_hz) as i32;
                if y < height as i32 {
                    draw_line(img, 0, y, width as i32 - 1, y, Rgb([32768, 32768, 32768]));
                }
            }
        }
        SpectrogramMode::Bipolar => {
            let center = height as i32 / 2;
            let px_per_hz = (height as f32 / 2.0) / nyquist.max(1.0);
            for f in (0..=nyquist as u32).step_by(1000) {
                let offset = (f as f32 * px_per_hz) as i32;
                let y_pos = center - offset;
                let y_neg = center + offset;
                if y_pos >= 0 {
                    draw_line(
                        img,
                        0,
                        y_pos,
                        width as i32 - 1,
                        y_pos,
                        Rgb([32768, 32768, 32768]),
                    );
                }
                if f != 0 && y_neg < height as i32 {
                    draw_line(
                        img,
                        0,
                        y_neg,
                        width as i32 - 1,
                        y_neg,
                        Rgb([32768, 32768, 32768]),
                    );
                }
            }
        }
    }
}

fn draw_time_ruler(
    img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>,
    sample_rate: u32,
    hop: usize,
    enabled: bool,
) {
    if !enabled {
        return;
    }
    let scale = 2;
    let width = img.width();
    let seconds = width as f32 * hop as f32 / sample_rate as f32;
    let px_per_sec = width as f32 / seconds.max(1.0);
    for s in 0..=seconds.ceil() as u32 {
        let x = (s as f32 * px_per_sec) as i32;
        if x < width as i32 {
            draw_line(img, x, 0, x, 5 * scale, Rgb([65535, 65535, 65535]));
            let text = format!("{}s", s);
            draw_text(img, x, 6 * scale + 1, &text, scale as u32);
        }
    }
}

fn draw_frequency_scale(
    img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>,
    sample_rate: u32,
    mode: SpectrogramMode,
    scale_mode: ScaleMode,
    enabled: bool,
) {
    if !enabled {
        return;
    }
    let scale = 2;
    let height = img.height();
    let width = img.width();
    let nyquist = sample_rate as f32 / 2.0;
    match mode {
        SpectrogramMode::Unipolar => match scale_mode {
            ScaleMode::Linear => {
                let px_per_hz = height as f32 / nyquist.max(1.0);
                for f in (0..=nyquist as u32).step_by(1000) {
                    let y = (f as f32 * px_per_hz) as i32;
                    if y < height as i32 {
                        draw_line(
                            img,
                            width as i32 - 1 - 5 * scale,
                            y,
                            width as i32 - 1,
                            y,
                            Rgb([65535, 65535, 65535]),
                        );
                        let text = format!("{}Hz", f);
                        let text_y = (y - 6 * scale).max(0);
                        draw_text(img, width as i32 - 60 * scale, text_y, &text, scale as u32);
                    }
                }
            }
            ScaleMode::Log => {
                let log_max = (nyquist + 1.0).ln();
                for f in (0..=nyquist as u32).step_by(1000) {
                    let y =
                        (((f as f32 + 1.0).ln() / log_max) * (height as f32 - 1.0)).round() as i32;
                    if y < height as i32 {
                        draw_line(
                            img,
                            width as i32 - 1 - 5 * scale,
                            y,
                            width as i32 - 1,
                            y,
                            Rgb([65535, 65535, 65535]),
                        );
                        let text = format!("{}Hz", f);
                        let text_y = (y - 6 * scale).max(0);
                        draw_text(img, width as i32 - 60 * scale, text_y, &text, scale as u32);
                    }
                }
            }
        },
        SpectrogramMode::Bipolar => match scale_mode {
            ScaleMode::Linear => {
                let center = height as i32 / 2;
                let px_per_hz = (height as f32 / 2.0) / nyquist.max(1.0);
                for f in (0..=nyquist as u32).step_by(1000) {
                    let offset = (f as f32 * px_per_hz) as i32;
                    let y_pos = center - offset;
                    let y_neg = center + offset;
                    if y_pos >= 0 {
                        draw_line(
                            img,
                            width as i32 - 1 - 5 * scale,
                            y_pos,
                            width as i32 - 1,
                            y_pos,
                            Rgb([65535, 65535, 65535]),
                        );
                        let text = format!("{}Hz", f);
                        let text_y = (y_pos - 6 * scale).max(0);
                        draw_text(img, width as i32 - 60 * scale, text_y, &text, scale as u32);
                    }
                    if f != 0 && y_neg < height as i32 {
                        draw_line(
                            img,
                            width as i32 - 1 - 5 * scale,
                            y_neg,
                            width as i32 - 1,
                            y_neg,
                            Rgb([65535, 65535, 65535]),
                        );
                        let text = format!("-{}Hz", f);
                        let text_y = (y_neg - 6 * scale).max(0);
                        draw_text(img, width as i32 - 60 * scale, text_y, &text, scale as u32);
                    }
                }
            }
            ScaleMode::Log => {
                let center = height as i32 / 2;
                let log_max = (nyquist + 1.0).ln();
                for f in (0..=nyquist as u32).step_by(1000) {
                    let offset = (((f as f32 + 1.0).ln() / log_max) * center as f32).round() as i32;
                    let y_pos = center - offset;
                    let y_neg = center + offset;
                    if y_pos >= 0 {
                        draw_line(
                            img,
                            width as i32 - 1 - 5 * scale,
                            y_pos,
                            width as i32 - 1,
                            y_pos,
                            Rgb([65535, 65535, 65535]),
                        );
                        let text = format!("{}Hz", f);
                        let text_y = (y_pos - 6 * scale).max(0);
                        draw_text(img, width as i32 - 60 * scale, text_y, &text, scale as u32);
                    }
                    if f != 0 && y_neg < height as i32 {
                        draw_line(
                            img,
                            width as i32 - 1 - 5 * scale,
                            y_neg,
                            width as i32 - 1,
                            y_neg,
                            Rgb([65535, 65535, 65535]),
                        );
                        let text = format!("-{}Hz", f);
                        let text_y = (y_neg - 6 * scale).max(0);
                        draw_text(img, width as i32 - 60 * scale, text_y, &text, scale as u32);
                    }
                }
            }
        },
    }
}

fn draw_waveform(
    img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>,
    samples: &[f32],
    hop: usize,
    enabled: bool,
) {
    if !enabled {
        return;
    }
    let mid = img.height() as f32 / 2.0;
    let width = img.width() as usize;
    for x in 0..width {
        let idx = x * hop;
        let sample = samples.get(idx).copied().unwrap_or(0.0);
        let y = (mid - sample * (mid - 1.0)).clamp(0.0, img.height() as f32 - 1.0);
        img.put_pixel(x as u32, y as u32, Rgb([65535, 65535, 65535]));
    }
}

fn draw_status_bar(img: &mut ImageBuffer<Rgb<u16>, Vec<u16>>, text: &str, enabled: bool) {
    if !enabled {
        return;
    }
    let scale = 2;
    let h = img.height() as i32;
    let bar_h = 16 * scale;
    draw_filled_rect(img, 0, h - bar_h, img.width(), bar_h as u32, Rgb([0, 0, 0]));
    draw_text(img, 0, h - bar_h + scale, text, scale as u32);
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    let (samples, sample_rate) = read_flac(&args.input)?;

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

    // save heatmaps for visual inspection
    let width = frames;
    let height = match args.mode {
        SpectrogramMode::Unipolar => win_len / 2,
        SpectrogramMode::Bipolar => win_len,
    };
    let mut img_kofft = generate_heatmap(
        &kofft_mag,
        &args.colormap,
        args.mode,
        args.scale_mode,
        args.dynamic_range,
    );
    let mut img_ref = generate_heatmap(
        &rust_mag,
        &args.colormap,
        args.mode,
        args.scale_mode,
        args.dynamic_range,
    );

    smooth_heatmap(&mut img_kofft);
    smooth_heatmap(&mut img_ref);
    draw_axes(&mut img_kofft);

    draw_time_grid(&mut img_kofft, sample_rate, hop, args.grid_time);
    draw_frequency_grid(&mut img_kofft, sample_rate, args.mode, args.grid_frequency);
    draw_time_ruler(&mut img_kofft, sample_rate, hop, args.time_ruler);
    draw_frequency_scale(
        &mut img_kofft,
        sample_rate,
        args.mode,
        args.scale_mode,
        args.freq_scale,
    );
    draw_waveform(&mut img_kofft, &samples, hop, args.waveform);
    let center_frame = width / 2;
    let freq_bin = match args.mode {
        SpectrogramMode::Unipolar => height / 2,
        SpectrogramMode::Bipolar => 0,
    };
    let time = center_frame as f32 * hop as f32 / sample_rate as f32;
    let freq = match args.mode {
        SpectrogramMode::Unipolar => freq_bin as f32 * sample_rate as f32 / win_len as f32,
        SpectrogramMode::Bipolar => 0.0,
    };
    let raw_amp = kofft_mag[center_frame][freq_bin];
    let amp = 20.0 * raw_amp.max(1e-10).log10();
    let status = format!("t:{:.2}s f:{:.1}Hz a:{:.2}dB", time, freq, amp);
    draw_status_bar(&mut img_kofft, &status, args.status_bar);
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
    fn db_scaling_respects_bounds() {
        let max = 1.0;
        let dr = 80.0;
        let high = db_scale(max, max, dr);
        let low = db_scale(max * 10f32.powf(-dr / 20.0), max, dr);
        assert!((high - 1.0).abs() < 1e-6);
        assert!(low.abs() < 1e-6);
    }

    #[test]
    fn log_scale_bins_average_correctly() {
        let frame: Vec<f32> = (1..=8).map(|x| x as f32).collect();
        let scaled = log_scale_bins(&frame, 7);
        // bins 5 and 6 map to index 6
        assert!((scaled[6] - (6.0 + 7.0) / 2.0).abs() < 1e-6);
    }

    #[test]
    fn rainbow_gradient_interpolates() {
        let c = rainbow_color(0.375); // between blue and cyan
        assert_eq!(c[0], 0);
        assert_eq!(c[2], 65535);
        assert!(c[1] > 0 && c[1] < 65535);
    }
}
