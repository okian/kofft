# End-to-End Testing Suite

This directory contains comprehensive end-to-end tests for the Kofft Spectrogram application using Playwright. The test suite covers functionality, visual regression, accessibility, cross-browser compatibility, and performance testing.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install --with-deps
```

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI (interactive mode)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug

# Show test report
npm run test:e2e:report
```

## 📁 Test Structure

```
tests/e2e/
├── README.md                    # This file
├── global-setup.ts             # Global test setup
├── global-teardown.ts          # Global test cleanup
├── utils/
│   └── test-helpers.ts         # Common test utilities
├── functionality.spec.ts       # Core functionality tests
├── visual-regression.spec.ts   # Visual regression tests
├── accessibility.spec.ts       # Accessibility compliance tests
├── cross-browser.spec.ts       # Cross-browser compatibility tests
├── performance.spec.ts         # Performance benchmarks
└── test-data/                  # Test audio files (generated)
```

## 🧪 Test Categories

### 1. Functionality Tests (`functionality.spec.ts`)

Tests core application functionality and user workflows:

- **App Initialization**: Page loading, WebAssembly initialization
- **Audio File Loading**: File upload, metadata extraction, error handling
- **Playback Controls**: Play, pause, stop, seeking, volume control
- **Settings & Configuration**: Theme switching, spectrogram settings
- **Keyboard Shortcuts**: All keyboard interactions
- **State Management**: State persistence across interactions

### 2. Visual Regression Tests (`visual-regression.spec.ts`)

Detects visual changes and layout shifts:

- **Initial Load States**: App loading, drop zone rendering
- **Responsive Design**: Desktop, tablet, mobile layouts
- **Component States**: Loading, error, success states
- **Interactive Elements**: Button hover, active states
- **Modal & Overlays**: Settings, metadata panels
- **Theme Variations**: Light/dark theme rendering
- **Spectrogram Visualization**: Canvas rendering, color schemes
- **Layout Consistency**: Spacing, typography, colors

### 3. Accessibility Tests (`accessibility.spec.ts`)

Ensures WCAG 2.1 AA compliance:

- **WCAG 2.1 AA Compliance**: Page titles, heading structure, alt text
- **Keyboard Navigation**: Tab navigation, Enter/Space/Escape keys
- **Screen Reader Support**: ARIA labels, roles, states
- **Semantic HTML**: Proper element usage, list/table structure
- **Error Handling**: Accessible error messages, loading states
- **Mobile Accessibility**: Touch targets, mobile navigation

### 4. Cross-Browser Tests (`cross-browser.spec.ts`)

Validates compatibility across browsers:

- **Browser-Specific Features**: WebAssembly, AudioContext, Canvas API
- **CSS Compatibility**: Grid, Flexbox, Custom Properties, Transforms
- **JavaScript Compatibility**: ES6+, Promises, Fetch API, localStorage
- **Event Handling**: Touch, keyboard, mouse events
- **Media Handling**: Audio/video elements, media queries
- **Performance & Memory**: Memory monitoring, performance timing
- **Security Features**: CSP, secure context
- **Browser-Specific Workarounds**: Safari, Firefox, Chrome features

### 5. Performance Tests (`performance.spec.ts`)

Measures application performance:

- **Load Time Performance**: Page load, WebAssembly load, spectrogram render
- **Memory Usage**: Memory monitoring, leak detection
- **CPU Performance**: Audio processing, spectrogram generation
- **Network Performance**: File uploads, multiple files
- **UI Responsiveness**: Heavy operations, rapid interactions
- **Large File Handling**: Large audio files, multiple large files
- **Concurrent Operations**: Multiple operations, rapid state changes
- **Performance Monitoring**: Metrics collection, WebAssembly tracking

## 🌐 Browser Support

The test suite runs on multiple browsers and devices:

- **Desktop**: Chrome, Firefox, Safari, Edge
- **Mobile**: Mobile Chrome, Mobile Safari
- **Viewports**: Desktop (1920x1080), Tablet (1024x768), Mobile (375x667)

## 🔧 Configuration

### Playwright Configuration (`playwright.config.ts`)

- **Parallel Execution**: Tests run in parallel for faster feedback
- **Retry Logic**: Failed tests retry automatically in CI
- **Multiple Reporters**: HTML, JSON, JUnit, Allure reports
- **Screenshots & Videos**: Captured on failure for debugging
- **Global Setup/Teardown**: Test environment management
- **Web Server**: Automatic dev server startup

### Test Helpers (`utils/test-helpers.ts`)

Common utilities for test operations:

- `waitForAppLoad()`: Wait for app and WebAssembly initialization
- `uploadAudioFile()`: Upload test audio files
- `takeScreenshot()`: Capture screenshots for visual regression
- `checkAccessibility()`: Basic accessibility validation
- `testKeyboardNavigation()`: Keyboard interaction testing
- `testResponsiveBehavior()`: Responsive design testing
- `testAudioPlayback()`: Audio functionality testing
- `testVolumeControls()`: Volume control testing
- `testSettingsPanel()`: Settings panel testing
- `testKeyboardShortcuts()`: Shortcut testing
- `testErrorHandling()`: Error scenario testing

## 📊 CI/CD Integration

### GitHub Actions Workflow (`.github/workflows/e2e-tests.yml`)

The E2E tests are automatically run on:

- **Push to main**: Full test suite including performance benchmarks
- **Pull Requests**: All tests except performance (to save resources)
- **Manual trigger**: Via workflow dispatch

### Parallel Execution

Tests are distributed across multiple jobs:

1. **Setup**: Environment preparation and caching
2. **Install Dependencies**: Node.js setup and Playwright installation
3. **Browser-Specific Tests**: Parallel execution across browsers
4. **Specialized Tests**: Visual regression, accessibility, performance
5. **Report Generation**: Combined test reports
6. **Notifications**: PR comments with results

### Caching Strategy

- **Node modules**: Cached for faster installs
- **Playwright browsers**: Cached to avoid re-downloading
- **Test artifacts**: Preserved for debugging

## 📈 Reporting

### Test Reports

- **HTML Reports**: Interactive test reports with screenshots and videos
- **JUnit Reports**: CI integration and test analytics
- **JSON Reports**: Programmatic access to test results
- **Allure Reports**: Advanced test reporting and analytics

### Artifacts

- **Screenshots**: Captured on test failures
- **Videos**: Recorded for failed tests
- **Traces**: Detailed execution traces for debugging
- **Performance Metrics**: Load times, memory usage, CPU performance

## 🛠️ Development

### Adding New Tests

1. **Create Test File**: Add new `.spec.ts` file in `tests/e2e/`
2. **Use Test Helpers**: Leverage existing utilities in `utils/test-helpers.ts`
3. **Follow Naming**: Use descriptive test names and group related tests
4. **Add Data Attributes**: Use `data-testid` attributes for reliable element selection

### Test Data

Test audio files are automatically generated in `test-data/`:

- `test-silence.wav`: 1-second silence for basic testing
- `test-audio.mp3`: Placeholder MP3 file
- Invalid files for error testing

### Best Practices

1. **Isolation**: Each test should be independent and not rely on others
2. **Reliability**: Use stable selectors and wait for elements properly
3. **Performance**: Keep tests fast and efficient
4. **Maintainability**: Write readable, well-documented tests
5. **Coverage**: Ensure comprehensive test coverage

### Debugging

```bash
# Run specific test file
npx playwright test functionality.spec.ts

# Run specific test
npx playwright test -g "should load the application"

# Debug mode
npx playwright test --debug

# Show browser
npx playwright test --headed

# Generate trace
npx playwright test --trace on
```

## 🔍 Troubleshooting

### Common Issues

1. **WebAssembly Loading**: Ensure WASM module is properly initialized
2. **Audio Context**: Handle browser autoplay policies
3. **File Uploads**: Use proper file paths and formats
4. **Timing Issues**: Add appropriate waits for async operations
5. **Browser Differences**: Handle browser-specific behaviors

### Performance Issues

1. **Memory Leaks**: Monitor memory usage in performance tests
2. **Slow Tests**: Optimize test execution and reduce timeouts
3. **Flaky Tests**: Add proper waits and retry logic
4. **Resource Usage**: Clean up resources in teardown

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAssembly Documentation](https://webassembly.org/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

## 🤝 Contributing

When adding new tests:

1. Follow existing patterns and conventions
2. Add appropriate documentation
3. Ensure tests are reliable and fast
4. Update this README if adding new test categories
5. Test across multiple browsers
6. Consider accessibility implications

## 📄 License

This testing suite is part of the Kofft project and follows the same license terms.
