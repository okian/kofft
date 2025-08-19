# React Spectrogram - Modern Audio Visualization PWA

A modern, responsive Progressive Web App for real-time audio spectrogram visualization with WebAssembly and WebGL support.

## ✨ Recent Major Updates

### 🎨 **Completely Redesigned Layout**
- **Responsive Design**: Fully adaptive layout that works seamlessly across desktop, tablet, and mobile devices
- **Mobile-First Approach**: Optimized touch interactions and mobile-specific UI patterns
- **Tablet Support**: Dedicated tablet layout with overlay panels and touch-friendly controls
- **Accessibility**: WCAG 2.1 AA compliant with proper ARIA labels, keyboard navigation, and screen reader support

### 🚀 **Performance Improvements**
- **Memory Leak Fixes**: Proper cleanup of animation frames and event listeners
- **Optimized Rendering**: Throttled updates (20 FPS on mobile, 60 FPS on desktop) for better performance
- **Responsive Canvas**: Dynamic canvas resizing with ResizeObserver for optimal rendering
- **Touch Optimization**: Reduced waveform bars on mobile for better performance

### 🎯 **Enhanced User Experience**
- **Mobile Overlay Panels**: Slide-up panels for metadata and playlist on mobile devices
- **Touch-Friendly Controls**: 44px minimum touch targets for all interactive elements
- **Smart Button Layout**: Context-aware button visibility based on screen size
- **Improved Visual Feedback**: Better hover states, loading indicators, and transitions

### 🔧 **Bug Fixes & Stability**
- **State Management**: Fixed inconsistencies in audio state handling
- **Error Handling**: Better error messages and graceful degradation
- **Memory Management**: Proper cleanup of audio resources and canvas contexts
- **Cross-Browser Support**: Improved compatibility across different browsers

## 🎵 Features

### Audio Input Sources
- **File Upload**: Drag & drop or file picker for audio files
- **Microphone Input**: Real-time live audio visualization
- **Multiple Formats**: Support for MP3, WAV, FLAC, M4A, and more
- **Playlist Management**: Queue multiple tracks with drag & drop reordering

### Spectrogram Visualization
- **Real-time Rendering**: Smooth 60 FPS spectrogram updates
- **Multiple Themes**: Dark, Light, Neon, and High Contrast themes
- **Interactive Tooltips**: Hover/touch to see frequency and intensity data
- **Responsive Canvas**: Automatically adapts to screen size and orientation

### Playback Controls
- **Waveform Seekbar**: Visual waveform representation for easy navigation
- **Transport Controls**: Play, pause, stop, previous, next
- **Volume Control**: Mute/unmute with visual feedback
- **Keyboard Shortcuts**: Full keyboard navigation support

### Advanced Features
- **Metadata Display**: Album art, track info, and technical details
- **Settings Panel**: Customizable spectrogram appearance and behavior
- **Snapshot Capture**: Save spectrogram images (Ctrl+Shift+S)
- **PWA Support**: Installable as a native app with offline capabilities

## 📱 Responsive Design

### Desktop (1024px+)
- Full sidebar layout with metadata and playlist panels
- All controls visible with optimal spacing
- High-resolution spectrogram with maximum detail

### Tablet (768px - 1024px)
- Adaptive layout with overlay panels
- Touch-optimized controls
- Balanced performance and usability

### Mobile (< 768px)
- Single-column layout optimized for touch
- Slide-up overlay panels for metadata and playlist
- Simplified controls with larger touch targets
- Performance-optimized rendering

## 🎨 Design System

### Color Themes
- **Dark Theme** (Default): Professional dark interface with vibrant spectrogram colors
- **Light Theme**: Clean light interface for bright environments
- **Neon Theme**: Retro-futuristic aesthetic with electric colors
- **High Contrast**: Accessibility-focused theme with maximum contrast

### Typography
- **Font**: Inter/Roboto for optimal readability
- **Hierarchy**: Clear typographic scale (18px, 14px, 12px)
- **Responsive**: Scaled appropriately for different screen sizes

### Interactive Elements
- **Buttons**: Consistent 44px minimum touch targets
- **Sliders**: Touch-friendly with visual feedback
- **Panels**: Smooth slide animations with backdrop blur
- **Focus States**: Clear focus indicators for keyboard navigation

## ♿ Accessibility Features

### Screen Reader Support
- Proper ARIA labels and roles throughout the interface
- Semantic HTML structure
- Keyboard navigation for all interactive elements

### Visual Accessibility
- High contrast mode support
- Reduced motion preferences respected
- Color-blind friendly theme options
- Scalable text and controls

### Keyboard Shortcuts
- **Space** or **K**: Play/Pause
- **J**: 10 seconds back
- **L**: 10 seconds forward
- **←/→** or **</>** or **,/.**: Previous/Next track
- **M**: Toggle metadata panel
- **P**: Toggle playlist panel
- **S**: Open settings
- **Ctrl+Shift+S**: Take snapshot
- **↑/↓**: Volume up/down
- **Esc**: Close panels

## 🚀 Performance Optimizations

### Rendering Performance
- **WebGL Acceleration**: Hardware-accelerated spectrogram rendering
- **Frame Rate Control**: Adaptive frame rates based on device capability
- **Memory Management**: Efficient cleanup of audio buffers and canvas contexts
- **Lazy Loading**: On-demand loading of audio data and metadata

### Mobile Optimizations
- **Touch Performance**: Optimized touch event handling
- **Battery Efficiency**: Reduced processing on mobile devices
- **Memory Usage**: Smaller audio buffers and reduced canvas resolution
- **Network Efficiency**: Compressed audio loading and caching

## 🛠️ Technical Stack

### Frontend
- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Type-safe development with comprehensive type definitions
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Zustand**: Lightweight state management
- **Vite**: Fast build tool and development server

### Audio Processing
- **WebAssembly**: High-performance audio processing with Rust
- **Web Audio API**: Real-time audio analysis and playback
- **WebGL**: Hardware-accelerated spectrogram rendering
- **Lofty**: Audio metadata extraction and parsing

### PWA Features
- **Service Worker**: Offline functionality and caching
- **Manifest**: Native app installation
- **Push Notifications**: Real-time updates (future)
- **Background Sync**: Offline data synchronization (future)

## 📦 Installation & Development

### Prerequisites
- Node.js 18+ 
- Rust (for WASM compilation)
- wasm-pack

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd react-spectrogram

# Install dependencies
npm install

# Build WASM module
npm run wasm:build

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Development Scripts
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run test`: Run test suite
- `npm run wasm:build`: Build WASM module
- `npm run wasm:watch`: Watch WASM changes

## 🧪 Testing

### Test Coverage
- **Unit Tests**: Component and utility function testing
- **Integration Tests**: End-to-end functionality testing
- **Accessibility Tests**: Screen reader and keyboard navigation
- **Performance Tests**: Rendering and memory usage validation

### Test Commands
```bash
npm test              # Run all tests
npm run test:ui       # Run tests with UI
npm run test:coverage # Generate coverage report
```

## 🌐 Browser Support

### Supported Browsers
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### Required Features
- WebAssembly support
- Web Audio API
- WebGL 2.0
- ES2020 features
- CSS Grid and Flexbox

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Maintain accessibility standards
- Add comprehensive tests
- Update documentation
- Follow the existing code style

## 🐛 Known Issues & Limitations

### Current Limitations
- Large audio files (>100MB) may cause performance issues
- Some audio formats require additional codecs
- WebGL performance varies by device capability
- Mobile browsers have audio context limitations

### Planned Improvements
- **Advanced Audio Analysis**: More detailed frequency analysis
- **Export Features**: Data export in various formats
- **Plugin System**: Extensible spectrogram algorithms
- **Cloud Integration**: Audio file storage and sharing
- **Collaboration**: Real-time collaborative features

## 📞 Support

For questions, issues, or contributions:
- Open an issue on GitHub
- Check the documentation
- Review existing discussions

---

**Built with ❤️ using modern web technologies for the best audio visualization experience.**
