# Web Spectrogram

The `web-spectrogram` crate provides a small HTTPS server for the demo
application. It serves static files with the headers required for
`SharedArrayBuffer` and WebAssembly threads.

## Running the demo

```sh
npm start
```

This launches an Express server on <https://localhost:8443> with a
self-signed certificate. The server sets the following headers on all
responses:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Resource-Policy: same-origin`

Accept the certificate in your browser and ensure that any additional
resources are served over HTTPS with compatible COOP/COEP or appropriate
CORS/CORP settings.
