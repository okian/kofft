use kofft::fft::{Complex32, FftError, FftImpl, ScalarFftImpl};

/// Small FFT length used for alignment tests.
const LEN: usize = 4;
/// Byte offset applied to create intentionally misaligned buffers.
const BYTE_OFFSET: usize = 1;

/// Ensure `fft` rejects buffers that are not properly aligned.
#[test]
fn fft_detects_misaligned_input() {
    use core::{mem, slice};

    let mut bytes = vec![0u8; LEN * mem::size_of::<Complex32>() + BYTE_OFFSET];
    let ptr = unsafe { bytes.as_mut_ptr().add(BYTE_OFFSET) } as *mut Complex32;
    let data = unsafe { slice::from_raw_parts_mut(ptr, LEN) };
    let fft = ScalarFftImpl::<f32>::default();
    assert_eq!(fft.fft(data), Err(FftError::InvalidValue));
}

/// Ensure `fft_split` reports an error when either buffer is misaligned.
#[test]
fn fft_split_detects_misaligned_buffers() {
    use core::{mem, slice};

    let mut re_bytes = vec![0u8; LEN * mem::size_of::<f32>() + BYTE_OFFSET];
    let mut im_bytes = vec![0u8; LEN * mem::size_of::<f32>() + BYTE_OFFSET];
    let re_ptr = unsafe { re_bytes.as_mut_ptr().add(BYTE_OFFSET) } as *mut f32;
    let im_ptr = unsafe { im_bytes.as_mut_ptr().add(BYTE_OFFSET) } as *mut f32;
    let re = unsafe { slice::from_raw_parts_mut(re_ptr, LEN) };
    let im = unsafe { slice::from_raw_parts_mut(im_ptr, LEN) };
    let fft = ScalarFftImpl::<f32>::default();
    assert_eq!(fft.fft_split(re, im), Err(FftError::InvalidValue));
}
