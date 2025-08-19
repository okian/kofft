//! Demonstrates enabling verbose logging for kofft.
use kofft::fft::ScalarFftImpl;
use kofft::stft::stft;
use kofft::window::hann;

fn main() {
    env_logger::builder()
        .filter_level(log::LevelFilter::Debug)
        .init();

    let signal = vec![1.0, 2.0, 3.0, 4.0];
    let window = hann(2);
    let hop = 1;
    let mut frames = vec![vec![]; 4];
    let fft = ScalarFftImpl::<f32>::default();

    stft(&signal, &window, hop, &mut frames, &fft).unwrap();
}
