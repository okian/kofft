use kofft::fft::ScalarFftImpl;
use kofft::stft::{istft, stft};

#[test]
fn stft_istft_roundtrip() {
    let signal = vec![1.0f32, 2.0, 3.0, 4.0];
    let window = vec![1.0; signal.len()];
    let hop = window.len();
    let fft = ScalarFftImpl::<f32>::default();
    let mut frames = vec![vec![]; 1];
    stft(&signal, &window, hop, &mut frames, &fft).unwrap();
    let mut out = vec![0.0; signal.len()];
    let mut scratch = vec![0.0; signal.len()];
    istft(&mut frames, &window, hop, &mut out, &mut scratch, &fft).unwrap();
    for (a, b) in signal.iter().zip(out.iter()) {
        assert!((a - b).abs() < 1e-6);
    }
}
