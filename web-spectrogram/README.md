# Web Spectrogram PWA

A React-powered Progressive Web App for visualising audio as a spectrogram. It extracts album art and metadata from audio files and displays them alongside a real-time spectrogram view.

## Features

- **React UI** with responsive layout that works across desktop and mobile browsers.
- **PWA support** with offline caching via Service Worker.
- **Album art extraction** using `music-metadata-browser`. Falls back to a generic vinyl image when no art is embedded.
- **Sidebar metadata** showing title, artist, album, year and track length.
- **Playback controls** pinned to the bottom of the screen.
- Placeholder **spectrogram canvas** ready for integration with the WASM renderer.

## Development

```bash
cd web-spectrogram
npm install
npm run dev
```

The application will be served at <http://localhost:5173> by default.

## Testing

```bash
npm test
```

Vitest runs unit tests and reports coverage. All new code must maintain at least 90% coverage.
