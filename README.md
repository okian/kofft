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
- **🧮 Split-radix FFTs** for power-of-two sizes, with radix-2/4 and mixed-radix support
- **🔧 Multiple transform types and modules**: FFT, NDFFT (n-dimensional), DCT (Types I-IV), DST (Types I-IV), Hartley, Hilbert transform, Cepstrum, Wavelet, STFT, CZT, Goertzel
- **📊 Window functions**: Hann, Hamming, Blackman, Kaiser
- **🔄 Batch and multi-channel processing**
- **🌐 WebAssembly support**
- **📱 Parallel processing** (optional)
- **🎵 Hybrid song identification**: fast metadata lookup with BLAKE3 fallback
- **💾 Waveform caching (opt-in)**: SQLite-backed waveform snapshots for faster startup

## Benchmarks

See [benchmarks](benchmarks/README.md) for detailed benchmark results and data.

## Waveform Caching

The optional `waveform-cache` feature stores per-track waveform snapshots in a
SQLite database. Loading a cached waveform avoids recomputation and can reduce
startup latency, at the cost of additional disk usage proportional to the
number of tracks. Each entry stores the waveform samples for a track in the
`waveform_samples` table:

```
CREATE TABLE waveform_samples (
    track_id TEXT PRIMARY KEY,
    samples  BLOB NOT NULL
);
```

Because caching increases storage requirements, the feature is **not enabled by
default**. Opt in by enabling the `waveform-cache` Cargo feature when compiling
`kofft` if faster startups are worth the space trade-off.
## Song Identification

`kofft` includes an optional `media::index` module for lightweight song lookup.
It first tries to match a file by its name or metadata and only computes a
hash if needed. When hashing is required, a fast BLAKE3 digest is used to
confirm identity or add a new entry. This hybrid strategy avoids unnecessary
hashing while still reliably identifying duplicate audio files.

## Quick Start

### Add to Cargo.toml

```toml
[dependencies]
kofft = { version = "0.1.5", features = [
    # "x86_64",             # AVX/SSE on x86_64
    # "sse",                # force SSE2-only backend
    # "aarch64",            # NEON on 64-bit ARM
    # "wasm",               # WebAssembly SIMD128
    # "avx2",               # AVX2-specific code paths
    # "avx512",             # AVX-512 code paths
    # "parallel",           # Rayon-based parallel helpers
    # "simd",               # portable SIMD FFT implementations
    # "soa",                # structure-of-arrays complex vectors
    # "precomputed-twiddles", # embed precomputed twiddle factors (requires std)
    # "compile-time-rfft",  # precompute real FFT tables at compile time
    # "slow",               # include naive reference algorithms
    # "internal-tests",     # enable proptest/rand for internal tests
    # "verbose-logging",    # emit debug logs for troubleshooting
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

## Verbose Logging

Enable detailed `log::debug!` output for troubleshooting by compiling with the
`verbose-logging` feature and supplying a logger implementation:

```toml
[dependencies]
kofft = { version = "0.1.5", features = ["verbose-logging"] }
env_logger = "0.11"
```

Run your application with a logger enabled:

```bash
RUST_LOG=kofft=debug cargo run --features verbose-logging --example verbose_logging
```

### Parallel FFT

Enable the `parallel` feature to automatically split large transforms across
threads via [Rayon](https://crates.io/crates/rayon). Use the `fft_parallel` and
`ifft_parallel` helpers which safely fall back to single-threaded execution when
Rayon is not available.

By default, kofft parallelizes an FFT when each CPU core would process at least
`max(L1_cache_bytes / size_of::<Complex32>(), per_core_work)` elements. The
defaults assume a 32&nbsp;KiB L1 cache and require roughly 4,096 points per core.
The heuristic scales with the number of detected cores (via
[`num_cpus`](https://crates.io/crates/num_cpus)) and can be tuned using the
`KOFFT_PAR_FFT_THRESHOLD`, `KOFFT_PAR_FFT_CACHE_BYTES`, or
`KOFFT_PAR_FFT_PER_CORE_WORK` environment variables, or by calling
`kofft::fft::set_parallel_fft_threshold`, `set_parallel_fft_l1_cache`, or
`set_parallel_fft_per_core_work` at runtime.

```rust
use kofft::fft::{fft_parallel, ifft_parallel, Complex32};

let mut data = vec![Complex32::new(1.0, 0.0); 1 << 14];
fft_parallel(&mut data)?;
ifft_parallel(&mut data)?;
```

## Cargo Feature Flags

The crate exposes several Cargo features. Refer to [`Cargo.toml`](Cargo.toml) for the canonical list and definitions.

- `std` – enable the Rust standard library (default)
- `parallel` – Rayon-based parallel helpers
- Architecture backends:
  - `x86_64` – AVX/SSE on x86_64 CPUs
  - `sse` – force SSE2-only backend
  - `aarch64` – NEON on 64-bit ARM
  - `wasm` – WebAssembly SIMD128
  - `avx2` – AVX2-specific code paths
  - `avx512` – AVX-512 code paths
- Miscellaneous:
  - `simd` – portable SIMD FFT implementations
  - `soa` – structure-of-arrays complex vectors for SIMD
  - `precomputed-twiddles` – embed precomputed FFT twiddle factors (requires `std`)
  - `compile-time-rfft` – generate real FFT tables at compile time
  - `slow` – include naive reference algorithms
  - `internal-tests` – enable proptest and rand for internal testing

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

## Sanity Check Utility

The workspace provides a `sanity-check` binary for comparing spectrograms
between `kofft` and `rustfft`. It can optionally emit an SVG file using
`--svg-output`:

```bash
cargo run -r -p sanity-check -- input.flac --svg-output=spec.svg
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
use kofft::fft::ScalarFftImpl;

let signal = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let window = hann(4);
let hop_size = 2;
let fft = ScalarFftImpl::<f32>::default();

let mut frames = vec![vec![]; (signal.len() + hop_size - 1) / hop_size];
stft(&signal, &window, hop_size, &mut frames, &fft)?;

let mut output = vec![0.0; signal.len()];
let mut scratch = vec![0.0; output.len()];
istft(&mut frames, &window, hop_size, &mut output, &mut scratch, &fft)?;
```

#### Streaming STFT/ISTFT

```rust
use kofft::stft::{StftStream, istft};
use kofft::window::hann;
use kofft::fft::{Complex32, ScalarFftImpl};

let signal = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
let window = hann(4);
let hop_size = 2;
let fft = ScalarFftImpl::<f32>::default();
let mut stream = StftStream::new(&signal, &window, hop_size, &fft)?;
let mut frames = Vec::new();
let mut frame = vec![Complex32::new(0.0, 0.0); window.len()];
while stream.next_frame(&mut frame)? {
    frames.push(frame.clone());
}
let mut output = vec![0.0; signal.len()];
let mut scratch = vec![0.0; output.len()];
istft(&mut frames, &window, hop_size, &mut output, &mut scratch, &fft)?;
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
cargo run --example dct_usage --release
cargo run --example spectrogram -- <input.wav> <output.png>
```

The `spectrogram` example reads a WAV file and writes a yellow→purple spectrogram image.

`dct_usage` compares a naive DCT-II against a planner that caches cosine
values and reports the average runtime of each approach, demonstrating the
benefit of reusing planning data.

## Advanced Features

Enable architecture-specific features in `Cargo.toml`:

```toml
[dependencies]
kofft = { version = "0.1.4", features = [
    # "x86_64",   # x86_64 AVX/SSE backends
    # "aarch64",  # AArch64 NEON backend
    # "wasm",     # WebAssembly SIMD128 backend
    # "parallel", # Rayon-based parallel helpers
] }
```

### SIMD Acceleration

The `x86_64`, `aarch64`, and `wasm` features activate optimized backends for
their respective architectures. When the corresponding CPU or Wasm SIMD
extensions are available (e.g., AVX2, NEON, or `simd128`), `kofft` will
automatically select the best implementation.
SIMD backends are also enabled automatically when compiling with the
appropriate `target-feature` flags (e.g., `RUSTFLAGS="-C target-feature=+avx2"`).

To opt into additional optional features for local builds, set the
`KOFFT_FEATURES` environment variable. Any features listed there are appended
to those detected by the `xtask` utility:

```bash
KOFFT_FEATURES="simd compile-time-rfft" cargo xtask test
```

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


## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or <https://www.apache.org/licenses/LICENSE-2.0>)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or <https://opensource.org/licenses/MIT>)

at your option.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development tasks

Common development commands are exposed via the `xtask` binary:

```bash
cargo xtask build        # Build the project with auto-detected features
cargo xtask test         # Run tests with matching features
cargo xtask clippy       # Run clippy lints
cargo xtask fmt          # Format the codebase
cargo xtask analyze      # Run fmt and clippy together
cargo xtask benchmark    # Execute benchmarks
cargo xtask bench-libs   # Run criterion benches across libraries
cargo xtask update-bench-readme  # Refresh benchmark README data
cargo xtask sanity -- <path-to-flac>  # Run the sanity check example
```

## Documentation

- [API Documentation](https://docs.rs/kofft)
- [Repository](https://github.com/kianostad/kofft)
- [Crates.io](https://crates.io/crates/kofft)
- [React Spectrogram Demo](react-spectrogram/README.md)


