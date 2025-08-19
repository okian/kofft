#![cfg(not(feature = "simd"))]
use kofft::fft::{Complex32, ScalarFftImpl};
use kofft::stft::{stft, StftStream};
use kofft::window::hann;

#[test]
fn stft_runs_without_simd() {
    let signal = [1.0, 2.0, 3.0, 4.0];
    let window = hann(2);
    let hop = 1;
    let fft = ScalarFftImpl::<f32>::default();
    let mut frames = vec![vec![]; signal.len()];
    stft(&signal, &window, hop, &mut frames, &fft).unwrap();
}

#[test]
fn stream_runs_without_simd() {
    let signal = [1.0, 2.0, 3.0, 4.0];
    let window = hann(2);
    let fft = ScalarFftImpl::<f32>::default();
    let mut stream = StftStream::new(&signal, &window, 1, &fft).unwrap();
    let mut buf = vec![Complex32::new(0.0, 0.0); window.len()];
    assert!(stream.next_frame(&mut buf).unwrap());
}
