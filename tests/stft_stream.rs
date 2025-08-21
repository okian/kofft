#![cfg(all(feature = "simd", feature = "wasm"))]

use kofft::fft::{Complex32, FftError, ScalarFftImpl};
use kofft::stft::StftStream;

/// Ensure the stream advances and then reports completion on further calls.
#[test]
fn stream_start_stop_sequence() {
    let signal = [1.0f32, 2.0, 3.0, 4.0];
    let window = vec![1.0f32; 2];
    let fft = ScalarFftImpl::<f32>::default();
    let mut stream = StftStream::new(&signal, &window, 1, &fft).unwrap();
    let mut buf = vec![Complex32::new(0.0, 0.0); window.len()];
    assert!(stream.next_frame(&mut buf).unwrap());
    assert!(stream.next_frame(&mut buf).unwrap());
    assert!(stream.next_frame(&mut buf).unwrap());
    assert!(stream.next_frame(&mut buf).unwrap());
    assert!(!stream.next_frame(&mut buf).unwrap());
    assert!(!stream.next_frame(&mut buf).unwrap());
}

/// Calling with an undersized buffer should return a length error.
#[test]
fn stream_buffer_underrun() {
    let signal = [1.0f32, 2.0, 3.0, 4.0];
    let window = vec![1.0f32; 2];
    let fft = ScalarFftImpl::<f32>::default();
    let mut stream = StftStream::new(&signal, &window, 1, &fft).unwrap();
    let mut short = vec![Complex32::new(0.0, 0.0); 1];
    assert!(matches!(
        stream.next_frame(&mut short),
        Err(FftError::MismatchedLengths)
    ));
}
