# Testing kofft

This guide explains how to verify that the project builds, lints and passes all tests.

## Formatting

Format the entire workspace to keep code style consistent:

```bash
cargo fmt --all
```

## Linting

Run Clippy across all targets and features to catch common mistakes:

```bash
cargo clippy --all-targets --all-features
```

## Running the test suite

Execute all tests with every feature enabled:

```bash
cargo test --all-features
```

### Specialized tests

Some tests require explicit invocation. For example, the spectrogram parity
check compares the output of the `spectrogram` example with the `sanity-check`
binary:

```bash
cargo test --test spectrogram_parity
```

## Coverage

To measure test coverage, run Tarpaulin for the entire workspace:

```bash
cargo tarpaulin --all-features --workspace
```

Aim for at least **50% line coverage** when adding or modifying code.
