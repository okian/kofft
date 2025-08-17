use clap::ValueEnum;
use hound::WavReader;
use image::{
    codecs::png::{CompressionType, FilterType, PngEncoder},
    ColorType, EncodableLayout, ImageBuffer, ImageEncoder, Rgb,
};
use std::error::Error;
use std::fs::File;
use std::io;
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::default::{get_codecs, get_probe};

#[derive(ValueEnum, Clone, Copy, Debug)]
pub enum PngDepth {
    Eight,
    Sixteen,
}

pub fn read_audio(path: &Path) -> Result<(Vec<f32>, u32), Box<dyn Error>> {
    if path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("wav"))
    {
        return read_wav(path);
    }
    let file = File::open(path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let probed = get_probe().format(
        &hint,
        mss,
        &FormatOptions::default(),
        &MetadataOptions::default(),
    )?;
    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "no supported audio tracks"))?;
    let params = track.codec_params.clone();
    let n_frames = params.n_frames;
    let mut decoder = get_codecs().make(&params, &DecoderOptions::default())?;
    let sample_rate = params
        .sample_rate
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "unknown sample rate"))?;
    let channels = params
        .channels
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "unknown channel count"))?
        .count();

    let mut samples = Vec::new();
    let mut sample_buf: Option<SampleBuffer<f32>> = None;

    loop {
        match format.next_packet() {
            Ok(packet) => {
                let decoded = decoder.decode(&packet)?;
                let frames = decoded.frames() as usize;
                let buf = sample_buf.get_or_insert_with(|| {
                    SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded.spec())
                });
                buf.copy_interleaved_ref(decoded);
                let slice = &buf.samples()[..frames * channels];
                if channels == 1 {
                    samples.extend_from_slice(slice);
                } else {
                    for frame in slice.chunks(channels) {
                        let sum: f32 = frame.iter().sum();
                        samples.push(sum / channels as f32);
                    }
                }
            }
            Err(SymphoniaError::IoError(err)) if err.kind() == io::ErrorKind::UnexpectedEof => {
                break;
            }
            Err(SymphoniaError::ResetRequired) => {
                decoder.reset();
            }
            Err(e) => return Err(Box::new(e)),
        }
    }

    if let Some(n) = n_frames {
        samples.truncate(n as usize);
    }
    Ok((samples, sample_rate))
}

fn read_wav(path: &Path) -> Result<(Vec<f32>, u32), Box<dyn Error>> {
    let mut reader = WavReader::open(path)?;
    let spec = reader.spec();
    let samples: Vec<f32> = reader
        .samples::<i16>()
        .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
        .collect::<Result<_, _>>()?;
    Ok((samples, spec.sample_rate))
}

pub fn save_png(
    img: &ImageBuffer<Rgb<u16>, Vec<u16>>,
    path: &Path,
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

pub fn save_svg(img: &ImageBuffer<Rgb<u16>, Vec<u16>>, path: &Path) -> Result<(), Box<dyn Error>> {
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
