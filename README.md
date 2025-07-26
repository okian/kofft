# kofft: Embedded/MCU-Optimized DSP/FFT Library

## MCU/Stack-Only Usage (No Heap, No Alloc)

All stack-only, const-generic DSP APIs in this crate require the user to provide all output buffers. This is a limitation of Rust const generics: you cannot allocate `[T; N]` for arbitrary `N` inside a function. You must declare all buffers in your own stack frame and pass them to the function.

### FFT (in-place, stack-only)
```rust
let mut buf: [Complex32; 8] = [
    Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0),
    Complex32::new(3.0, 0.0), Complex32::new(4.0, 0.0),
    Complex32::new(5.0, 0.0), Complex32::new(6.0, 0.0),
    Complex32::new(7.0, 0.0), Complex32::new(8.0, 0.0),
];
kofft::fft::fft_inplace_stack(&mut buf)?;
```

### DCT-II (stack-only, user-provided output)
```rust
let input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let mut output: [f32; 8] = [0.0; 8];
kofft::dct::dct2_inplace_stack(&input, &mut output);
```

### DST-II (stack-only, user-provided output)
```rust
let input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let mut output: [f32; 8] = [0.0; 8];
kofft::dst::dst2_inplace_stack(&input, &mut output);
```

### Haar Wavelet (stack-only, user-provided output as slices)
```rust
let input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let mut avg = [0.0; 4];
let mut diff = [0.0; 4];
kofft::wavelet::haar_forward_inplace_stack(&input, &mut avg[..], &mut diff[..]);
// avg and diff must be of length N/2
```

### Haar Inverse (stack-only, user-provided output as slice)
```rust
let avg: [f32; 4] = [1.0, 2.0, 3.0, 4.0];
let diff: [f32; 4] = [5.0, 6.0, 7.0, 8.0];
let mut out = [0.0; 8];
kofft::wavelet::haar_inverse_inplace_stack(&avg[..], &diff[..], &mut out[..]);
// out must be of length 2*N
```

### Window Functions (unchanged)
```rust
let mut hann: [f32; 8] = [0.0; 8];
kofft::window::hann_inplace_stack(&mut hann);
let mut hamming: [f32; 8] = [0.0; 8];
kofft::window::hamming_inplace_stack(&mut hamming);
let mut blackman: [f32; 8] = [0.0; 8];
kofft::window::blackman_inplace_stack(&mut blackman);
```

---

## Notes for Embedded/MCU Users
- All stack-only APIs use const generics: the size is known at compile time, so no heap is needed.
- Only power-of-two sizes are supported for FFT stack-only APIs.
- All transforms are in-place: the input buffer is overwritten with the result.
- No `alloc`, no `Vec`, no heap required for these APIs.
- Suitable for Cortex-M, STM32, Zephyr RTOS, and any `no_std` environment.
- For batch/multi-channel or non-power-of-two, enable the `alloc` feature and use heap-based APIs (not recommended for MCUs).

---

## Example: Minimal MCU Project
```rust
#![no_std]
use kofft::fft::{Complex32, fft_inplace_stack};

#[entry]
fn main() -> ! {
    let mut buf: [Complex32; 8] = [
        Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0),
        Complex32::new(3.0, 0.0), Complex32::new(4.0, 0.0),
        Complex32::new(5.0, 0.0), Complex32::new(6.0, 0.0),
        Complex32::new(7.0, 0.0), Complex32::new(8.0, 0.0),
    ];
    fft_inplace_stack(&mut buf).unwrap();
    loop {}
}
```

---

## RAM Usage
- Stack usage is proportional to the transform size (e.g., 8-point FFT uses 8x8 bytes = 64 bytes for `Complex32`).
- No heap is used for stack-only APIs.

---

## For More
- See the source for additional transforms and batch/multi-channel APIs (heap required).
- For questions or MCU-specific integration help, open an issue or discussion! 