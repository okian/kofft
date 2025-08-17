# Web Spectrogram PWA

A Progressive Web App for visualising audio as a spectrogram using WebAssembly and plain JavaScript.

## Development

```bash
cargo xtask web-spectrogram
```

This builds the WASM package and serves the app at <http://localhost:3000>.

## Testing

```bash
node --test --experimental-test-coverage web-spectrogram/tests/app.test.mjs
cargo test -p web-spectrogram
```

All new code must maintain at least 90% coverage.
