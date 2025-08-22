# Contributing to kofft

Thank you for your interest in contributing to kofft! This document provides guidelines and information for contributors.

## Code of Conduct

This project is committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and considerate in all interactions.

## Getting Started

### Prerequisites

- Rust 1.70 or later
- Git
- A text editor or IDE

### Setting Up the Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/kofft.git
   cd kofft
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/okian/kofft.git
   ```

### Building and Testing

Common development tasks are also available through the `xtask` utility:

```bash
cargo xtask build
cargo xtask test
cargo xtask clippy
cargo xtask fmt
```

```bash
# Build the project
cargo build

# Run all tests
cargo test

# Run tests with specific features
cargo test --features "std,parallel"

# Run tests for no_std
cargo test --no-default-features

# Check for warnings
cargo check

# Run clippy for linting
cargo clippy

# Format code
cargo fmt
```

### Updating Benchmarks

Refresh the benchmark data in the repository:

```bash
cargo xtask update-bench-readme
```

## Development Guidelines

### Code Style

- Follow Rust formatting standards (use `cargo fmt`)
- Follow Rust linting guidelines (use `cargo clippy`)
- Use meaningful variable and function names
- Add comments for complex algorithms
- Write comprehensive documentation

### Documentation

- All public APIs must be documented
- Include examples in documentation
- Update README.md for user-facing changes
- Update CHANGELOG.md for all changes

### Testing

- See [TESTING.md](TESTING.md) for detailed commands to format, lint, test, run
  specialized checks, and gather coverage.
- Write unit tests for all new functionality
- Include property-based tests for mathematical correctness
- Test both `std` and `no_std` features
- Test SIMD implementations on supported platforms
- Ensure tests pass on all target platforms

### Performance

- Benchmark new features against existing implementations
- Consider memory usage for embedded applications
- Optimize for both speed and memory efficiency
- Document performance characteristics

## Feature Development

### Adding New Transforms

1. Create a new module in `src/`
2. Implement both heap-based and stack-only APIs
3. Add comprehensive tests
4. Update documentation
5. Add examples to README.md

### SIMD Optimizations

1. Implement scalar version first
2. Add SIMD implementation with feature gates
3. Test on target platforms
4. Benchmark performance improvements
5. Document platform requirements

### Embedded/MCU Support

1. Ensure `no_std` compatibility
2. Provide stack-only APIs where possible
3. Test on embedded targets
4. Document memory requirements
5. Consider power consumption

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the guidelines above
3. Add tests for new functionality
4. Update documentation as needed
5. Ensure all tests pass
6. Submit a pull request

### Pull Request Checklist

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] README.md examples are updated (if applicable)
- [ ] Performance impact is considered
- [ ] Backward compatibility is maintained

## Issue Reporting

When reporting issues, please include:

- Rust version
- Operating system and architecture
- Steps to reproduce
- Expected vs actual behavior
- Error messages (if any)
- Minimal example code

## Release Process

1. Update version in `Cargo.toml`
2. Update `CHANGELOG.md` with release notes
3. Create a release tag
4. Publish to crates.io

## Areas for Contribution

### High Priority

- Additional wavelet transforms (Daubechies, etc.)
- More window functions
- Performance optimizations
- Better error handling
- More comprehensive benchmarks

### Medium Priority

- Additional SIMD implementations
- More transform types
- Better documentation
- Example applications
- Integration tests

### Low Priority

- Additional platforms
- Experimental features
- Performance profiling tools
- Documentation improvements

## Getting Help

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Check existing issues and pull requests
- Review the documentation

## License

By contributing to kofft, you agree that your contributions will be licensed under the same license as the project (MIT OR Apache-2.0).

Thank you for contributing to kofft! 