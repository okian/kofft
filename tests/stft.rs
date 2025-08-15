use kofft::fft::{FftError, ScalarFftImpl};
use kofft::stft::stft;
use kofft::window::hann;

#[test]
fn stft_errors_on_insufficient_frames() {
    let signal = vec![0.0; 10];
    let window = hann(4);
    let hop = 4;
    let fft = ScalarFftImpl::<f32>::default();
    let mut frames = vec![vec![]; 2]; // required = 3
    let result = stft(&signal, &window, hop, &mut frames, &fft);
    assert!(matches!(result, Err(FftError::MismatchedLengths)));
}
