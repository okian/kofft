// Test intent: verifies memory usage behavior including edge cases.
use kofft::fft::{Complex32, ScalarFftImpl};
use kofft::stft::IstftStream;

#[test]
fn istft_stream_memory_capped() {
    let win_len = 4;
    let hop = 2;
    let window = vec![1.0f32; win_len];
    let fft = ScalarFftImpl::<f32>::default();
    let mut istft_stream =
        IstftStream::new(win_len, hop, &window, &fft).expect("Invariant: operation should succeed");
    let initial = istft_stream.buffer_len();
    let mut frame = vec![Complex32::new(0.0, 0.0); win_len];
    for _ in 0..1000 {
        istft_stream
            .push_frame(&mut frame)
            .expect("Invariant: operation should succeed");
    }
    assert_eq!(istft_stream.buffer_len(), initial);
}
