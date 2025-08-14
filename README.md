# kofft

[![Crates.io](https://img.shields.io/crates/v/kofft)](https://crates.io/crates/kofft)
[![Documentation](https://docs.rs/kofft/badge.svg)](https://docs.rs/kofft)
[![License](https://img.shields.io/crates/l/kofft)](https://github.com/kianostad/kofft/blob/main/LICENSE)
[![Rust Version](https://img.shields.io/badge/rust-1.70+-blue.svg)](https://www.rust-lang.org)
[![codecov](https://codecov.io/github/okian/kofft/graph/badge.svg?token=51ZZSPJFB9)](https://codecov.io/github/okian/kofft)

High-performance, `no_std`, MCU-friendly DSP library featuring FFT, DCT, DST, Hartley, Wavelet, STFT, and more. Stack-only, SIMD-optimized, and batch transforms for embedded and scientific Rust applications.

## Features

- **🚀 Zero-allocation stack-only APIs** for MCU/embedded systems
- **⚡ SIMD acceleration** (x86_64 AVX2 & SSE, AArch64 NEON, WebAssembly SIMD)
- **🧮 Radix-4 and mixed-radix FFTs** for power-of-two and composite sizes
- **🔧 Multiple transform types**: FFT, DCT (Types I-IV), DST (Types I-IV), Hartley, Wavelet, STFT, CZT, Goertzel
- **📊 Window functions**: Hann, Hamming, Blackman, Kaiser
- **🔄 Batch and multi-channel processing**
- **🌐 WebAssembly support**
- **📱 Parallel processing** (optional)

## Benchmarks

Latest benchmarks on an Intel Xeon Platinum 8370C show:

- 1024-point complex FFT: ~81 µs
- 4096-point complex FFT: ~1.0 ms
- 1,048,576-point real FFT: ~67 ms

See [benchmarks/latest.json](benchmarks/latest.json) for full results.

## Quick Start

### Add to Cargo.toml

```toml
[dependencies]
kofft = { version = "0.1.4", features = [
    # "x86_64",   # enable AVX2 on x86_64
    # "sse",      # enable SSE on x86_64 without AVX2
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
let mut scratch = vec![0.0; output.len()];
istft(&mut frames, &window, hop_size, &mut output, &mut scratch)?;
```

#### Streaming STFT/ISTFT

```rust
use kofft::stft::{StftStream, istft};
use kofft::window::hann;
use kofft::fft::Complex32;

let signal = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let window = hann(4);
let hop_size = 2;
let mut stream = StftStream::new(&signal, &window, hop_size)?;
let mut frames = Vec::new();
let mut frame = vec![Complex32::new(0.0, 0.0); window.len()];
while stream.next_frame(&mut frame)? {
    frames.push(frame.clone());
}
let mut output = vec![0.0; signal.len()];
let mut scratch = vec![0.0; output.len()];
istft(&mut frames, &window, hop_size, &mut output, &mut scratch)?;
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
kofft = { version = "0.1.4", features = [
    # "x86_64",   # AVX2 on x86_64
    # "aarch64",  # NEON on AArch64
    # "wasm",     # WebAssembly SIMD
    # "parallel", # Rayon-based parallel helpers
] }
```

### SIMD Acceleration

Enable one of the CPU-specific SIMD features above for better performance.
SIMD backends are also enabled automatically when compiling with the
appropriate `target-feature` flags (e.g., `RUSTFLAGS="-C target-feature=+avx2"`).

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
- **Wavelet Transform** – multi-level Haar, Daubechies, Symlets, Coiflets ([Wikipedia](https://en.wikipedia.org/wiki/Wavelet_transform))
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
use wavelet::{
    haar_forward_multi, haar_inverse_multi, db4_forward_multi, db4_inverse_multi,
};
let (approx, details) = haar_forward_multi(&input, 2);
let reconstructed = haar_inverse_multi(&approx, &details);
// Additional families, e.g. Daubechies-4
let (db4_a, db4_d) = db4_forward_multi(&input, 2);
let db4_recon = db4_inverse_multi(&db4_a, &db4_d);

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

| Platform | SIMD Support | Enable via |
|----------|-------------|-----------|
| x86_64   | AVX2/FMA    | `x86_64` feature or `-C target-feature=+avx2` |
| x86_64 (SSE) | SSE2 | `sse` feature or default `sse2` target |
| AArch64  | NEON        | `aarch64` feature or `-C target-feature=+neon` |
| WebAssembly | SIMD128   | `wasm` feature or `-C target-feature=+simd128` |
| Generic  | Scalar      | Default fallback |

Feature selection precedence: `x86_64` (AVX2) → `sse` → scalar fallback.

## Benchmark
<!-- BENCH_START -->
Last run: 2025-08-14T12:04:00.734481659+00:00 on local (Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz; rustc 1.87.0 (17067e9ac 2025-05-09); flags: ``)

| Library | Transform | Size (N) | Mode | Time/op | Ops/sec | Allocations | Date/Runner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| kofft | Complex | 1024 | Single | 0.081 ms | 12334.56 | 3 | 2025-08-14 local |
| kofft | Complex | 1024 | Parallel | 0.040 ms | 24846.57 | 3 | 2025-08-14 local |
| rustfft | Complex | 1024 | Single | 0.026 ms | 38292.17 | 1 | 2025-08-14 local |
| kofft | Real | 1024 | Single | 0.060 ms | 16627.59 | 4 | 2025-08-14 local |
| realfft | Real | 1024 | Single | 0.004 ms | 258933.20 | 0 | 2025-08-14 local |
| kofft | Complex | 2048 | Single | 0.075 ms | 13320.37 | 3 | 2025-08-14 local |
| kofft | Complex | 2048 | Parallel | 0.085 ms | 11782.59 | 3 | 2025-08-14 local |
| rustfft | Complex | 2048 | Single | 0.009 ms | 112917.80 | 1 | 2025-08-14 local |
| kofft | Real | 2048 | Single | 0.098 ms | 10237.41 | 4 | 2025-08-14 local |
| realfft | Real | 2048 | Single | 0.007 ms | 134102.19 | 0 | 2025-08-14 local |
| kofft | Complex | 4096 | Single | 1.046 ms | 955.65 | 3 | 2025-08-14 local |
| kofft | Complex | 4096 | Parallel | 2.799 ms | 357.33 | 4 | 2025-08-14 local |
| rustfft | Complex | 4096 | Single | 0.024 ms | 41382.16 | 1 | 2025-08-14 local |
| kofft | Real | 4096 | Single | 1.171 ms | 853.74 | 4 | 2025-08-14 local |
| realfft | Real | 4096 | Single | 0.015 ms | 64951.94 | 0 | 2025-08-14 local |
| kofft | Complex | 8192 | Single | 2.378 ms | 420.60 | 3 | 2025-08-14 local |
| kofft | Complex | 8192 | Parallel | 2.194 ms | 455.88 | 3 | 2025-08-14 local |
| rustfft | Complex | 8192 | Single | 0.036 ms | 28052.85 | 1 | 2025-08-14 local |
| kofft | Real | 8192 | Single | 1.225 ms | 816.26 | 4 | 2025-08-14 local |
| realfft | Real | 8192 | Single | 0.031 ms | 32217.53 | 0 | 2025-08-14 local |
| kofft | Complex | 16384 | Single | 3.120 ms | 320.51 | 3 | 2025-08-14 local |
| kofft | Complex | 16384 | Parallel | 3.706 ms | 269.86 | 3 | 2025-08-14 local |
| rustfft | Complex | 16384 | Single | 0.049 ms | 20264.66 | 1 | 2025-08-14 local |
| kofft | Real | 16384 | Single | 2.298 ms | 435.16 | 4 | 2025-08-14 local |
| realfft | Real | 16384 | Single | 0.027 ms | 36964.48 | 0 | 2025-08-14 local |
| kofft | Complex | 32768 | Single | 3.654 ms | 273.68 | 3 | 2025-08-14 local |
| kofft | Complex | 32768 | Parallel | 4.138 ms | 241.63 | 3 | 2025-08-14 local |
| rustfft | Complex | 32768 | Single | 0.105 ms | 9564.16 | 1 | 2025-08-14 local |
| kofft | Real | 32768 | Single | 3.871 ms | 258.33 | 4 | 2025-08-14 local |
| realfft | Real | 32768 | Single | 0.076 ms | 13146.31 | 0 | 2025-08-14 local |
| kofft | Complex | 65536 | Single | 4.232 ms | 236.32 | 3 | 2025-08-14 local |
| kofft | Complex | 65536 | Parallel | 2.834 ms | 352.88 | 3 | 2025-08-14 local |
| rustfft | Complex | 65536 | Single | 0.249 ms | 4015.79 | 1 | 2025-08-14 local |
| kofft | Real | 65536 | Single | 2.854 ms | 350.41 | 4 | 2025-08-14 local |
| realfft | Real | 65536 | Single | 0.140 ms | 7142.30 | 0 | 2025-08-14 local |
| kofft | Complex | 131072 | Single | 5.810 ms | 172.11 | 4 | 2025-08-14 local |
| kofft | Complex | 131072 | Parallel | 4.891 ms | 204.47 | 3 | 2025-08-14 local |
| rustfft | Complex | 131072 | Single | 1.374 ms | 728.06 | 1 | 2025-08-14 local |
| kofft | Real | 131072 | Single | 6.192 ms | 161.51 | 5 | 2025-08-14 local |
| realfft | Real | 131072 | Single | 0.554 ms | 1806.64 | 0 | 2025-08-14 local |
| kofft | Complex | 262144 | Single | 15.280 ms | 65.45 | 3 | 2025-08-14 local |
| kofft | Complex | 262144 | Parallel | 9.065 ms | 110.32 | 3 | 2025-08-14 local |
| rustfft | Complex | 262144 | Single | 7.525 ms | 132.88 | 1 | 2025-08-14 local |
| kofft | Real | 262144 | Single | 21.934 ms | 45.59 | 4 | 2025-08-14 local |
| realfft | Real | 262144 | Single | 0.733 ms | 1364.44 | 0 | 2025-08-14 local |
| kofft | Complex | 524288 | Single | 29.240 ms | 34.20 | 3 | 2025-08-14 local |
| kofft | Complex | 524288 | Parallel | 29.209 ms | 34.24 | 3 | 2025-08-14 local |
| rustfft | Complex | 524288 | Single | 14.538 ms | 68.78 | 1 | 2025-08-14 local |
| kofft | Real | 524288 | Single | 37.093 ms | 26.96 | 4 | 2025-08-14 local |
| realfft | Real | 524288 | Single | 1.982 ms | 504.63 | 0 | 2025-08-14 local |
| kofft | Complex | 1048576 | Single | 59.265 ms | 16.87 | 3 | 2025-08-14 local |
| kofft | Complex | 1048576 | Parallel | 60.507 ms | 16.53 | 4 | 2025-08-14 local |
| rustfft | Complex | 1048576 | Single | 30.361 ms | 32.94 | 1 | 2025-08-14 local |
| kofft | Real | 1048576 | Single | 66.946 ms | 14.94 | 4 | 2025-08-14 local |
| realfft | Real | 1048576 | Single | 4.361 ms | 229.31 | 0 | 2025-08-14 local |
<!-- BENCH_END -->

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

