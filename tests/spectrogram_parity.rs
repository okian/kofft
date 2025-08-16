use assert_cmd::prelude::*;
use hound::{SampleFormat, WavSpec, WavWriter};
use std::error::Error;
use std::f32::consts::PI;
use std::process::Command;
use tempfile::tempdir;

#[test]
fn spectrograms_match() -> Result<(), Box<dyn Error>> {
    let tmp = tempdir()?;
    let wav_path = tmp.path().join("input.wav");
    let spec = WavSpec {
        channels: 1,
        sample_rate: 8_000,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };
    let mut writer = WavWriter::create(&wav_path, spec)?;
    for i in 0..8_000 {
        let sample = (2.0 * PI * 440.0 * i as f32 / 8_000.0).sin();
        writer.write_sample((sample * i16::MAX as f32) as i16)?;
    }
    writer.finalize()?;

    let out1 = tmp.path().join("ex.png");
    let out2 = tmp.path().join("sanity.png");

    Command::new("cargo")
        .args([
            "run",
            "--quiet",
            "--example",
            "spectrogram",
            "--",
            wav_path.to_str().unwrap(),
            out1.to_str().unwrap(),
            "--floor",
            "-120",
            "--palette",
            "fire",
        ])
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .assert()
        .success();

    Command::new("cargo")
        .args([
            "run",
            "-p",
            "sanity-check",
            "--quiet",
            "--",
            wav_path.to_str().unwrap(),
            out2.to_str().unwrap(),
            "--colormap",
            "fire",
            "--win-len",
            "1024",
            "--scale-mode",
            "linear",
            "--dynamic-range",
            "120",
            "--png-depth",
            "eight",
        ])
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .assert()
        .success();

    let img1 = image::open(&out1)?.to_rgb8();
    let img2 = image::open(&out2)?.to_rgb8();
    assert_eq!(img1.as_raw(), img2.as_raw());
    Ok(())
}
