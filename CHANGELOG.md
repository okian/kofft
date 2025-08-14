# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of kofft DSP library
- FFT (Fast Fourier Transform) with scalar and SIMD implementations
- DCT (Discrete Cosine Transform) variants: DCT-II, DCT-III, DCT-IV
- DST (Discrete Sine Transform) variants: DST-II, DST-III, DST-IV
- Hartley Transform
- Haar Wavelet Transform
- STFT (Short-Time Fourier Transform) and ISTFT
- Goertzel Algorithm for single frequency detection
- Chirp Z-Transform (CZT)
- Hilbert Transform
- Real Cepstrum
- Window functions: Hann, Hamming, Blackman, Kaiser
- Stack-only APIs for embedded/MCU usage
- SIMD acceleration for x86_64 (AVX2), AArch64 (NEON), and WebAssembly
- Added SSE feature for x86_64 as fallback when AVX2 is unavailable
- Parallel processing support with Rayon
- Batch and multi-channel processing
- Real FFT optimization for real input signals
- Comprehensive test suite with property-based testing

### Features
- `no_std` support for embedded systems
- Zero-allocation stack-only APIs
- Platform-specific SIMD optimizations
- Parallel processing capabilities
- Comprehensive documentation and examples

### Changed
- Exposed the STFT module and added hop-size validation and streaming helpers
- Hardened FFT helpers with stride checks, new error cases, and a radix-4 path
- Verified matrix dimensions for multi-dimensional FFT utilities

## [0.1.0] - 2024-12-19

### Added
- Initial release
- Core DSP algorithms and transforms
- Embedded-friendly APIs
- SIMD acceleration
- Comprehensive documentation

### Technical Details
- Rust edition: 2021
- Minimum Rust version: 1.70
- License: MIT OR Apache-2.0
- Dependencies: libm (0.2), rayon (optional, 1.7)
- Features: std, parallel, sse, x86_64, aarch64, wasm
