use kofft::fft::{Complex32, ScalarFftImpl};
use kofft::stft::{IstftStream, StftStream};

#[test]
fn stft_stream_example_runs() {
    let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let window = [1.0, 1.0, 1.0, 1.0];
    let hop = 2;

    let mut stft_stream = StftStream::new(&signal, &window, hop);
    let fft = ScalarFftImpl::<f32>::default();
    let mut istft_stream = IstftStream::new(window.len(), hop, window.to_vec(), &fft);
    let mut frame = vec![Complex32::zero(); window.len()];
    let mut reconstructed = Vec::new();
    while stft_stream.next_frame(&mut frame).unwrap() {
        let out = istft_stream.push_frame(&frame);
        reconstructed.extend_from_slice(out);
    }
    let out = istft_stream.push_frame(&vec![Complex32::zero(); window.len()]);
    reconstructed.extend_from_slice(out);

    assert!(reconstructed.iter().all(|x| x.is_finite()));
}
