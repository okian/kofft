use kofft::wavelet::{batch_forward, haar_forward_multi, WaveletError};

#[test]
/// Validates that batch forward rejects empty input collections.
fn batch_forward_empty_error() {
    match batch_forward(&[]) {
        Err(WaveletError::EmptyInput) => {}
        other => panic!("unexpected result: {:?}", other),
    }
}

#[test]
/// Ensures multi-level forward fails on empty input slices.
fn multi_level_forward_empty_error() {
    match haar_forward_multi(&[], 1) {
        Err(WaveletError::EmptyInput) => {}
        other => panic!("unexpected result: {:?}", other),
    }
}

#[test]
/// Ensures an error is raised when requested levels exceed what the data allows.
fn multi_level_forward_invalid_level() {
    let input = [1.0f32, 2.0];
    match haar_forward_multi(&input, 2) {
        Err(WaveletError::InvalidLevels { requested, max }) => {
            assert_eq!((requested, max), (2, 1));
        }
        other => panic!("unexpected result: {:?}", other),
    }
}
