#![cfg(all(feature = "simd", feature = "wasm"))]

use kofft::fft::{Complex32, ScalarFftImpl};
use kofft::stft::{istft, IstftStream, StftStream};

#[test]
fn istft_stream_reconstructs_and_flushes() {
    let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let win_len = 4;
    let hop = 2;
    let window = vec![1.0f32; win_len];
    let fft = ScalarFftImpl::<f32>::default();

    let mut stft_stream = StftStream::new(&signal, &window, hop, &fft).unwrap();
    let mut istft_stream = IstftStream::new(win_len, hop, &window, &fft).unwrap();
    let mut frame = vec![Complex32::new(0.0, 0.0); win_len];
    let mut output_stream = Vec::new();
    let mut frames = Vec::new();

    while stft_stream.next_frame(&mut frame).unwrap() {
        frames.push(frame.clone());
        let out = istft_stream.push_frame(&frame).unwrap();
        output_stream.extend_from_slice(out);
    }
    let tail = istft_stream.flush();
    output_stream.extend_from_slice(tail);

    // Offline ISTFT reference
    let mut frames_offline = frames.clone();
    let mut output_offline = vec![0.0f32; signal.len() + win_len - hop];
    let mut scratch = vec![0.0f32; output_offline.len()];
    istft(
        &mut frames_offline,
        &window,
        hop,
        &mut output_offline,
        &mut scratch,
        &fft,
    )
    .unwrap();

    // Check main reconstruction
    assert_eq!(
        output_stream[..signal.len()],
        output_offline[..signal.len()]
    );

    // Flush should return final segment matching offline output
    assert_eq!(tail.len(), win_len - hop);
    assert_eq!(tail, &output_offline[signal.len()..]);
}

#[test]
fn istft_stream_new_checks_parameters() {
    let win_len = 4;
    let hop = 2;
    let valid_window = vec![1.0f32; win_len];
    let fft = ScalarFftImpl::<f32>::default();

    // Zero hop size
    assert!(matches!(
        IstftStream::new(win_len, 0, &valid_window, &fft),
        Err(kofft::fft::FftError::InvalidHopSize)
    ));

    // Mismatched window length
    let short_window = vec![1.0f32; win_len - 1];
    assert!(matches!(
        IstftStream::new(win_len, hop, &short_window, &fft),
        Err(kofft::fft::FftError::MismatchedLengths)
    ));
}
