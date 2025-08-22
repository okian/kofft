use kofft::wavelet::{
    db4_forward, db4_forward_multi, db4_inverse, db4_inverse_multi, haar_forward_multi,
    haar_inverse_multi, WaveletError,
};

#[test]
/// Ensures even-length signals round-trip accurately over the maximum supported level using Haar.
fn haar_multi_roundtrip_even() {
    const LEVELS: usize = 1;
    let input = vec![1.0, 2.0, 3.0, 4.0];
    let (avg, details) = haar_forward_multi(&input, LEVELS).unwrap();
    let recon = haar_inverse_multi(&avg, &details).unwrap();
    assert_eq!(recon, input);
}

#[test]
/// Verifies odd-length Haar inputs reconstruct to the original prefix and do not error.
fn haar_multi_roundtrip_odd() {
    const LEVELS: usize = 1;
    let input = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let (avg, details) = haar_forward_multi(&input, LEVELS).unwrap();
    let mut recon = haar_inverse_multi(&avg, &details).unwrap();
    recon.truncate(input.len());
    assert_eq!(recon, input);
}

#[test]
/// Stress-tests deep Haar decompositions to ensure excessive levels are rejected.
fn haar_multi_roundtrip_extreme_depth() {
    const REQUESTED: usize = 10;
    let input = vec![1.0, 2.0];
    match haar_forward_multi(&input, REQUESTED) {
        Err(WaveletError::InvalidLevels { requested, max }) => {
            assert_eq!(requested, REQUESTED);
            assert_eq!(max, 1);
        }
        other => panic!("unexpected result: {:?}", other),
    }
}

#[test]
/// Confirms db4 rejects odd-length inputs with a precise error.
fn db4_forward_odd_length_error() {
    let input = vec![1.0, 2.0, 3.0];
    match db4_forward(&input) {
        Err(WaveletError::InputLengthOdd { len }) => assert_eq!(len, 3),
        other => panic!("unexpected result: {:?}", other),
    }
}

#[test]
/// Ensures db4 inverse validates buffer sizes before processing.
fn db4_inverse_mismatch_error() {
    let a = vec![0.0; 2];
    let d = vec![0.0; 1];
    match db4_inverse(&a, &d) {
        Err(WaveletError::BufferSizeMismatch { avg, diff }) => assert_eq!((avg, diff), (2, 1)),
        other => panic!("unexpected result: {:?}", other),
    }
}

#[test]
/// Validates db4 multi-level round-trip for odd-length signals with trimming.
fn db4_multi_roundtrip_odd() {
    const LEVELS: usize = 1;
    let input = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let (avg, details) = db4_forward_multi(&input, LEVELS).unwrap();
    let mut recon = db4_inverse_multi(&avg, &details).unwrap();
    recon.truncate(input.len());
    let (mut max_err, mut max_val) = (0.0f32, 0.0f32);
    for (a, b) in input.iter().zip(recon.iter()) {
        let err = (a - b).abs();
        if err > max_err {
            max_err = err;
        }
        if a.abs() > max_val {
            max_val = a.abs();
        }
    }
    assert!(
        max_err < max_val,
        "max error {} >= max val {}",
        max_err,
        max_val
    );
}

#[test]
/// Validates db4 multi-level round-trip for even-length signals.
fn db4_multi_roundtrip_even() {
    const LEVELS: usize = 1;
    let input = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let (avg, details) = db4_forward_multi(&input, LEVELS).unwrap();
    let recon = db4_inverse_multi(&avg, &details).unwrap();
    let (mut max_err, mut max_val) = (0.0f32, 0.0f32);
    for (a, b) in input.iter().zip(recon.iter()) {
        let err = (a - b).abs();
        if err > max_err {
            max_err = err;
        }
        if a.abs() > max_val {
            max_val = a.abs();
        }
    }
    assert!(
        max_err < max_val,
        "max error {} >= max val {}",
        max_err,
        max_val
    );
}
