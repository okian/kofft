# React Spectrogram PWA

A modern, responsive Progressive Web App (PWA) for real-time audio visualization with waterfall spectrogram display. Built with React, TypeScript, WebAssembly, and WebGL.

## Features

### 🎵 Audio Support
- **Multiple Input Sources**: File upload, microphone input, and hybrid mode
- **Format Support**: MP3, WAV, FLAC, OGG, WebM, AAC, M4A
- **Playlist Management**: Drag-and-drop reordering, track removal
- **Metadata Extraction**: ID3 tags, album art, technical details

### 📊 Spectrogram Visualization
- **Real-time Rendering**: WebGL-powered spectrogram with 60 FPS updates
- **Multiple Themes**: Dark, Light, Neon, and High Contrast modes
- **Interactive Display**: Hover tooltips with frequency, time, and intensity data
- **Customizable Settings**: Amplitude scale, frequency scale, resolution, refresh rate
- **Color Maps**: Multiple colormap options for different visualization styles

### 🎛️ Playback Controls
- **Transport Controls**: Play, pause, stop, previous, next
- **Waveform Seek Bar**: Visual timeline with click-to-seek functionality
- **Volume Control**: Slider with mute toggle
- **Keyboard Shortcuts**: Full keyboard navigation support

### 📱 Responsive Design
- **Mobile-First**: Optimized for touch devices
- **Adaptive Layout**: Collapsible sidebars, mobile modals
- **PWA Features**: Installable, offline-capable, service worker
- **Cross-Platform**: Works on desktop, tablet, and mobile

### 🔧 Advanced Features
- **WebAssembly Integration**: High-performance audio processing with Rust/WASM
- **Snapshot Capture**: Save spectrogram images
- **Settings Persistence**: User preferences saved locally
- **Accessibility**: WCAG AA compliant, keyboard navigation

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Framer Motion
- **State Management**: Zustand
- **Audio Processing**: WebAssembly (Rust), Web Audio API
- **Graphics**: WebGL, Canvas API
- **Testing**: Vitest, React Testing Library
- **PWA**: Vite PWA Plugin, Service Worker

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Rust (for WASM compilation)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd react-spectrogram
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build WebAssembly module**
   ```bash
   npm run wasm:build
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

### Development Commands

```bash
# Development
npm run dev              # Start development server
npm run wasm:watch       # Watch and rebuild WASM module

# Building
npm run build           # Build for production
npm run preview         # Preview production build

# Testing
npm run test            # Run tests
npm run test:ui         # Run tests with UI
npm run test:coverage   # Generate coverage report

# Linting
npm run lint            # Check for linting errors
npm run lint:fix        # Fix linting errors
npm run type-check      # TypeScript type checking
```

## Project Structure

```
src/
├── components/          # React components
│   ├── layout/         # Layout components (Header, Footer, Panels)
│   ├── spectrogram/    # Spectrogram visualization components
│   └── ui/            # Reusable UI components
├── hooks/              # Custom React hooks
├── stores/             # Zustand state stores
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── wasm/               # WebAssembly modules (built)
└── test/               # Test setup and utilities
```

## Architecture

### State Management
The app uses Zustand for state management with three main stores:

- **AudioStore**: Manages audio playback, playlist, and microphone state
- **UIStore**: Handles UI state like panel visibility and screen size
- **SettingsStore**: Manages spectrogram settings and theme preferences

### Component Architecture
Components are organized by responsibility:

- **Layout Components**: Header, Footer, Sidebar panels
- **Spectrogram Components**: Canvas, Legend, Tooltip
- **Audio Components**: Controls, waveform, metadata
- **UI Components**: Buttons, modals, forms

### WebAssembly Integration
The app integrates with the `kofft` DSP library via WebAssembly for:

- Audio metadata extraction
- FFT computation for spectrogram generation
- Waveform analysis
- Real-time audio processing

## Testing

The project includes comprehensive testing:

- **Unit Tests**: Component testing with React Testing Library
- **Integration Tests**: End-to-end functionality testing
- **Mock Coverage**: WebGL, AudioContext, and browser APIs

Run tests with:
```bash
npm run test
```

## Deployment

### Build for Production
```bash
npm run build
```

### PWA Features
The app is configured as a PWA with:

- Service worker for offline functionality
- Web app manifest for installation
- Responsive design for all devices
- Fast loading with code splitting

### Environment Variables
Create a `.env` file for environment-specific configuration:

```env
VITE_APP_TITLE=Spectrogram PWA
VITE_APP_DESCRIPTION=Real-time audio visualization
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- **Design Inspiration**: Adobe Audition, Bauhaus design principles
- **Audio Processing**: `kofft` DSP library
- **Icons**: Lucide React
- **UI Framework**: Tailwind CSS

## Roadmap

- [ ] Advanced audio effects and filters
- [ ] Multi-track recording and mixing
- [ ] Export functionality (CSV, JSON data)
- [ ] Plugin system for custom visualizations
- [ ] Collaborative features
- [ ] Mobile app versions (React Native)

## Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation
- Review the test examples
