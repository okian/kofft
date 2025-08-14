# kofft

[![Crates.io](https://img.shields.io/crates/v/kofft)](https://crates.io/crates/kofft)
[![Documentation](https://docs.rs/kofft/badge.svg)](https://docs.rs/kofft)
[![License](https://img.shields.io/crates/l/kofft)](https://github.com/kianostad/kofft/blob/main/LICENSE)
[![Rust Version](https://img.shields.io/badge/rust-1.70+-blue.svg)](https://www.rust-lang.org)
[![codecov](https://codecov.io/github/okian/kofft/graph/badge.svg?token=51ZZSPJFB9)](https://codecov.io/github/okian/kofft)

High-performance, `no_std`, MCU-friendly DSP library featuring FFT, DCT, DST, Hartley, Wavelet, STFT, and more. Stack-only, SIMD-optimized, and batch transforms for embedded and scientific Rust applications.

## Features

- **🚀 Zero-allocation stack-only APIs** for MCU/embedded systems
- **⚡ SIMD acceleration** (x86_64 AVX2, AArch64 NEON, WebAssembly SIMD)
- **🔧 Multiple transform types**: FFT, DCT (Types I-IV), DST (Types I-IV), Hartley, Wavelet, STFT, CZT, Goertzel
- **📊 Window functions**: Hann, Hamming, Blackman, Kaiser
- **🔄 Batch and multi-channel processing**
- **🌐 WebAssembly support**
- **📱 Parallel processing** (optional)

## Quick Start

### Add to Cargo.toml

```toml
[dependencies]
kofft = { version = "0.1.1", features = [
    # "x86_64",   # enable AVX2 on x86_64
    # "aarch64",  # enable NEON on AArch64
    # "wasm",     # enable WebAssembly SIMD
    # "parallel", # enable Rayon-based parallel helpers
] }
```

### Basic Usage

For an overview of the Fast Fourier Transform (FFT), see [Wikipedia](https://en.wikipedia.org/wiki/Fast_Fourier_transform).

```rust
use kofft::{Complex32, FftPlanner};
use kofft::fft::{ScalarFftImpl, FftImpl};

// Create FFT instance with planner (caches twiddle factors)
let planner = FftPlanner::<f32>::new();
let fft = ScalarFftImpl::with_planner(planner);

// Prepare data
let mut data = vec![
    Complex32::new(1.0, 0.0),
    Complex32::new(2.0, 0.0),
    Complex32::new(3.0, 0.0),
    Complex32::new(4.0, 0.0),
];

// Compute FFT
fft.fft(&mut data)?;

// Compute inverse FFT
fft.ifft(&mut data)?;
```

### Parallel FFT

Enable the `parallel` feature to automatically split large transforms across
threads via [Rayon](https://crates.io/crates/rayon). Use the `fft_parallel` and
`ifft_parallel` helpers which safely fall back to single-threaded execution when
Rayon is not available.

```rust
use kofft::fft::{fft_parallel, ifft_parallel, Complex32};

let mut data = vec![Complex32::new(1.0, 0.0); 1 << 14];
fft_parallel(&mut data)?;
ifft_parallel(&mut data)?;
```

## Embedded/MCU Usage (No Heap)

All stack-only APIs require you to provide output buffers. This enables `no_std` operation without any heap allocation.

### FFT (Stack-Only)

```rust
use kofft::fft::{Complex32, fft_inplace_stack};

// 8-point FFT (power-of-two only for stack APIs)
let mut buf: [Complex32; 8] = [
    Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0),
    Complex32::new(3.0, 0.0), Complex32::new(4.0, 0.0),
    Complex32::new(5.0, 0.0), Complex32::new(6.0, 0.0),
    Complex32::new(7.0, 0.0), Complex32::new(8.0, 0.0),
];

fft_inplace_stack(&mut buf)?;
```

### DCT-I (Stack-Only)

```rust
use kofft::dct::dct1_inplace_stack;

let input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let mut output: [f32; 8] = [0.0; 8];

dct1_inplace_stack(&input, &mut output);
```

### DCT-II (Stack-Only)

```rust
use kofft::dct::dct2_inplace_stack;

let input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let mut output: [f32; 8] = [0.0; 8];

dct2_inplace_stack(&input, &mut output);
```

### DST-II (Stack-Only)

```rust
use kofft::dst::dst2_inplace_stack;

let input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let mut output: [f32; 8] = [0.0; 8];

dst2_inplace_stack(&input, &mut output);
```

### DST-IV (Stack-Only)

```rust
use kofft::dst::dst4_inplace_stack;

let input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let mut output: [f32; 8] = [0.0; 8];

dst4_inplace_stack(&input, &mut output);
```

### Haar Wavelet (Stack-Only)

```rust
use kofft::wavelet::{haar_forward_inplace_stack, haar_inverse_inplace_stack};

// Forward transform
let input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let mut avg = [0.0; 4];
let mut diff = [0.0; 4];

haar_forward_inplace_stack(&input, &mut avg[..], &mut diff[..]);

// Inverse transform
let mut out = [0.0; 8];
haar_inverse_inplace_stack(&avg[..], &diff[..], &mut out[..]);
```

### Window Functions (Stack-Only)

```rust
use kofft::window::{hann_inplace_stack, hamming_inplace_stack, blackman_inplace_stack};

let mut hann: [f32; 8] = [0.0; 8];
hann_inplace_stack(&mut hann);

let mut hamming: [f32; 8] = [0.0; 8];
hamming_inplace_stack(&mut hamming);

let mut blackman: [f32; 8] = [0.0; 8];
blackman_inplace_stack(&mut blackman);
```

## Desktop/Standard Library Usage

With the `std` feature (enabled by default), you get heap-based APIs for more flexibility.

### FFT with Standard Library

```rust
use kofft::fft::{Complex32, ScalarFftImpl, FftImpl};

let fft = ScalarFftImpl::<f32>::default();

// Heap-based FFT
let mut data = vec![
    Complex32::new(1.0, 0.0),
    Complex32::new(2.0, 0.0),
    Complex32::new(3.0, 0.0),
    Complex32::new(4.0, 0.0),
];

fft.fft(&mut data)?;

// Or create new vector
let result = fft.fft_vec(&data)?;
```

### Real FFT (Optimized for Real Input)

```rust
use kofft::fft::{ScalarFftImpl, FftImpl};
use kofft::rfft::RealFftImpl;

let fft = ScalarFftImpl::<f32>::default();
let mut input = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let mut output = vec![Complex32::zero(); input.len() / 2 + 1];

fft.rfft(&mut input, &mut output)?;
```

Stack-only helpers avoid heap allocation:

```rust
use kofft::rfft::{irfft_stack, rfft_stack};
use kofft::Complex32;

let input = [1.0f32, 2.0, 3.0, 4.0];
let mut freq = [Complex32::new(0.0, 0.0); 3];
rfft_stack(&input, &mut freq)?;
let mut time = [0.0f32; 4];
irfft_stack(&freq, &mut time)?;
```

### STFT (Short-Time Fourier Transform)

For background on STFT, see [Wikipedia](https://en.wikipedia.org/wiki/Short-time_Fourier_transform).

```rust
use kofft::stft::{stft, istft};
use kofft::window::hann;

let signal = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let window = hann(4);
let hop_size = 2;

let mut frames = vec![vec![]; (signal.len() + hop_size - 1) / hop_size];
stft(&signal, &window, hop_size, &mut frames)?;

let mut output = vec![0.0; signal.len()];
istft(&frames, &window, hop_size, &mut output)?;
```

### Batch Processing

```rust
use kofft::fft::{ScalarFftImpl, FftImpl};

let fft = ScalarFftImpl::<f32>::default();
let mut batches = vec![
    vec![Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0)],
    vec![Complex32::new(3.0, 0.0), Complex32::new(4.0, 0.0)],
];

fft.batch(&mut batches)?;
```

## Examples

Run the included examples with:

```bash
cargo run --example basic_usage
cargo run --example stft_usage
cargo run --example ndfft_usage
cargo run --example embedded_example
cargo run --example benchmark
cargo run --example rfft_usage
```

## Advanced Features

Enable optional features in `Cargo.toml`:

```toml
[dependencies]
kofft = { version = "0.1.1", features = [
    # "x86_64",   # AVX2 on x86_64
    # "aarch64",  # NEON on AArch64
    # "wasm",     # WebAssembly SIMD
    # "parallel", # Rayon-based parallel helpers
] }
```

### SIMD Acceleration

Enable one of the CPU-specific SIMD features above for better performance.

### Parallel Processing

Enable the `parallel` feature (using Rayon) as shown above:

```rust
use kofft::stft::parallel;

let signal = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let window = vec![1.0, 1.0, 1.0, 1.0];
let hop_size = 2;

let mut frames = vec![vec![]; (signal.len() + hop_size - 1) / hop_size];
parallel(&signal, &window, hop_size, &mut frames)?;
```

### Additional Transforms

- **DCT** – Discrete Cosine Transform ([Wikipedia](https://en.wikipedia.org/wiki/Discrete_cosine_transform))
- **DST** – Discrete Sine Transform ([Wikipedia](https://en.wikipedia.org/wiki/Discrete_sine_transform))
- **Hartley Transform** – ([Wikipedia](https://en.wikipedia.org/wiki/Discrete_Hartley_transform))
- **Wavelet Transform** – ([Wikipedia](https://en.wikipedia.org/wiki/Wavelet_transform))
- **Goertzel Algorithm** – ([Wikipedia](https://en.wikipedia.org/wiki/Goertzel_algorithm))
- **Chirp Z-Transform** – ([Wikipedia](https://en.wikipedia.org/wiki/Chirp_Z-transform))
- **Hilbert Transform** – ([Wikipedia](https://en.wikipedia.org/wiki/Hilbert_transform))
- **Cepstrum** – ([Wikipedia](https://en.wikipedia.org/wiki/Cepstrum))

```rust
use kofft::{dct, dst, hartley, wavelet, goertzel, czt, hilbert, cepstrum};

// DCT variants
let dct2_result = dct::dct2(&input);
let dct3_result = dct::dct3(&input);
let dct4_result = dct::dct4(&input);

// DST variants
let dst1_result = dst::dst1(&input);
let dst2_result = dst::dst2(&input);
let dst3_result = dst::dst3(&input);

// Hartley Transform
let hartley_result = hartley::dht(&input);

// Wavelet Transform
let (avg, diff) = wavelet::haar_forward(&input);
let reconstructed = wavelet::haar_inverse(&avg, &diff);

// Goertzel Algorithm (single frequency detection)
let magnitude = goertzel::goertzel_f32(&input, 44100.0, 1000.0);

// Chirp Z-Transform
let czt_result = czt::czt_f32(&input, 64, (0.5, 0.0), (1.0, 0.0));

// Hilbert Transform
let hilbert_result = hilbert::hilbert_analytic(&input);

// Cepstrum
let cepstrum_result = cepstrum::real_cepstrum(&input);
```

## Complete MCU Example

```rust
#![no_std]
use kofft::fft::{Complex32, fft_inplace_stack};
use kofft::dct::dct2_inplace_stack;
use kofft::window::hann_inplace_stack;

#[entry]
fn main() -> ! {
    // FFT example
    let mut fft_buf: [Complex32; 8] = [
        Complex32::new(1.0, 0.0), Complex32::new(2.0, 0.0),
        Complex32::new(3.0, 0.0), Complex32::new(4.0, 0.0),
        Complex32::new(5.0, 0.0), Complex32::new(6.0, 0.0),
        Complex32::new(7.0, 0.0), Complex32::new(8.0, 0.0),
    ];
    fft_inplace_stack(&mut fft_buf).unwrap();

    // DCT example
    let dct_input: [f32; 8] = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let mut dct_output: [f32; 8] = [0.0; 8];
    dct2_inplace_stack(&dct_input, &mut dct_output);

    // Window function example
    let mut window: [f32; 8] = [0.0; 8];
    hann_inplace_stack(&mut window);

    loop {
        // Your application logic here
    }
}
```

## Performance Notes

- **Stack-only APIs**: No heap allocation, suitable for MCUs with limited RAM
- **SIMD acceleration**: 2-4x speedup on supported platforms
- **Parallel FFT**: Enable the `parallel` feature to scale across CPU cores
- **Power-of-two sizes**: Most efficient for FFT operations
- **Memory usage**: Stack usage scales with transform size (e.g., 8-point FFT uses ~64 bytes for `Complex32`)

## Platform Support

| Platform | SIMD Support | Features |
|----------|-------------|----------|
| x86_64   | AVX2/FMA    | `x86_64` feature |
| AArch64  | NEON        | `aarch64` feature |
| WebAssembly | SIMD128   | `wasm` feature |
| Generic  | Scalar      | Default fallback |

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or <https://www.apache.org/licenses/LICENSE-2.0>)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or <https://opensource.org/licenses/MIT>)

at your option.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Documentation

- [API Documentation](https://docs.rs/kofft)
- [Repository](https://github.com/kianostad/kofft)
- [Crates.io](https://crates.io/crates/kofft)

