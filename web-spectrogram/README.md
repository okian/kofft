# Web Spectrogram PWA

A lightweight Progressive Web App for visualising audio as a spectrogram using plain JavaScript and WebAssembly. No React or build tooling is required.

## Usage

From the repository root, build the WebAssembly package and serve the PWA:

```bash
cargo xtask web-spectrogram
```

This compiles the WebAssembly with `wasm-pack` and hosts the app at `http://localhost:3000`.

## Rebuilding WebAssembly

To regenerate the WebAssembly package without starting the server:

```bash
wasm-pack build web-spectrogram --target web
```

## Testing

Generate the WebAssembly package and run Node's built-in test runner with coverage (minimum 90% line coverage for `spectrogram.mjs`):

```bash
wasm-pack build web-spectrogram --target web
node --test --experimental-test-coverage --test-coverage-lines=90 --test-coverage-include='web-spectrogram/spectrogram.mjs' web-spectrogram/tests/main.test.mjs
```
