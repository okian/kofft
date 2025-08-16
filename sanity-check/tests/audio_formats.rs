use sanity_check::read_audio;
use std::f32::consts::PI;
use std::io::Write;

use base64::{engine::general_purpose, Engine as _};

const TEST_FLAC_B64: &str = include_str!("fixtures/test.flac.b64");
const TEST_MP3_B64: &str = include_str!("fixtures/test.mp3.b64");
const TEST_STEREO_FLAC_B64: &str = include_str!("fixtures/test_stereo.flac.b64");

fn write_fixture(data: &str, suffix: &str) -> tempfile::NamedTempFile {
    let bytes = general_purpose::STANDARD.decode(data.trim()).unwrap();
    let mut file = tempfile::Builder::new().suffix(suffix).tempfile().unwrap();
    file.write_all(&bytes).unwrap();
    file
}

#[test]
fn read_flac_and_mp3() {
    let flac = write_fixture(TEST_FLAC_B64, ".flac");
    let (samples_flac, sr_flac) = read_audio(flac.path()).unwrap();
    assert_eq!(sr_flac, 44100);
    assert_eq!(samples_flac.len(), 44100);

    let mp3 = write_fixture(TEST_MP3_B64, ".mp3");
    let (samples_mp3, sr_mp3) = read_audio(mp3.path()).unwrap();
    assert_eq!(sr_mp3, 44100);
    assert_eq!(samples_mp3.len(), 46080);
}

#[test]
fn mixes_stereo_to_mono() {
    let stereo = write_fixture(TEST_STEREO_FLAC_B64, ".flac");
    let (samples, sr) = read_audio(stereo.path()).unwrap();
    assert_eq!(sr, 44100);
    assert_eq!(samples.len(), 44100);
}

#[test]
fn wav_matches_hound() {
    use hound::{SampleFormat, WavSpec, WavWriter};
    let tmp = tempfile::tempdir().unwrap();
    let path = tmp.path().join("gen.wav");
    let spec = WavSpec {
        channels: 1,
        sample_rate: 8000,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };
    let mut writer = WavWriter::create(&path, spec).unwrap();
    for i in 0..8000 {
        let sample = (2.0 * PI * 440.0 * i as f32 / 8000.0).sin();
        writer
            .write_sample((sample * i16::MAX as f32) as i16)
            .unwrap();
    }
    writer.finalize().unwrap();

    let mut reader = hound::WavReader::open(&path).unwrap();
    let h_samples: Vec<f32> = reader
        .samples::<i16>()
        .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
        .collect::<Result<_, _>>()
        .unwrap();
    let (s_samples, sr) = read_audio(&path).unwrap();
    assert_eq!(sr, 8000);
    assert_eq!(s_samples.len(), h_samples.len());
    for (a, b) in s_samples.iter().zip(h_samples.iter()) {
        assert!((a - b).abs() < 1e-4);
    }
}
