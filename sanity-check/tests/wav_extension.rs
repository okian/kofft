use hound::{SampleFormat, WavSpec, WavWriter};
use sanity_check::read_audio;

#[test]
fn detects_wav_extension_case_insensitive() {
    let tmp = tempfile::tempdir().unwrap();
    let path = tmp.path().join("case.WAV");
    let spec = WavSpec {
        channels: 1,
        sample_rate: 8000,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };
    let mut writer = WavWriter::create(&path, spec).unwrap();
    writer.write_sample(0i16).unwrap();
    writer.finalize().unwrap();
    let (_samples, sr) = read_audio(&path).unwrap();
    assert_eq!(sr, 8000);
}
