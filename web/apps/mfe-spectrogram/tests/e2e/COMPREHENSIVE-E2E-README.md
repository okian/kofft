# Comprehensive End-to-End Testing Suite for Kofft Spectrogram

This directory contains a comprehensive end-to-end testing suite for the Kofft Spectrogram application, designed to validate all aspects of the application including component behavior, user interactions, cross-component effects, integration flows, robustness, and edge cases.

## 🎯 Overview

The testing suite is built on the requirements specified in the user query and covers:

1. **Component Behavior** - Settings, options, valid/invalid inputs, defaults, persistence
2. **User Interaction Scenarios** - Mouse, keyboard, touch, navigation, rapid actions
3. **Cross-Component Effects** - State propagation, dependencies, side effects
4. **Integration & Flow Testing** - Complete workflows, persistence, error recovery
5. **Robustness & Resilience** - Network conditions, browser compatibility, memory management
6. **Property-Based Testing** - Arbitrary inputs, edge cases, automated test generation
7. **Snapshot Testing** - Visual regression detection, consistent outputs
8. **Chaos Testing** - Random failures, rapid state changes, concurrent operations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Git
- Rust toolchain (for WASM compilation)

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install --with-deps

# Generate test data
npm run test:e2e:setup
```

### Running Tests

```bash
# Run all comprehensive E2E tests
npm run test:e2e:comprehensive

# Run specific test categories
npm run test:e2e:component-behavior
npm run test:e2e:user-interactions
npm run test:e2e:cross-component
npm run test:e2e:integration
npm run test:e2e:robustness
npm run test:e2e:property-based
npm run test:e2e:snapshot
npm run test:e2e:chaos

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
├── README.md                           # This file
├── comprehensive-e2e.spec.ts           # Main comprehensive test suite
├── comprehensive-playwright.config.ts  # Enhanced Playwright configuration
├── global-setup.ts                     # Global test setup
├── global-teardown.ts                  # Global test cleanup
├── utils/
│   ├── enhanced-test-helpers.ts        # Enhanced test utilities
│   ├── test-data-generator.ts          # Test data generation
│   └── test-helpers.ts                 # Basic test utilities
├── test-data/                          # Generated test audio files
└── test-results/                       # Test artifacts and reports
```

## 🧪 Test Categories

### 1. Component Behavior Testing

Tests all component settings, options, and configurations:

#### Valid Settings
- **Theme Options**: All 6 supported themes (japanese-a-light, japanese-a-dark, japanese-b-light, japanese-b-dark, bauhaus-light, bauhaus-dark)
- **Amplitude Scales**: linear, logarithmic, db
- **Frequency Scales**: linear, logarithmic
- **Resolutions**: low, medium, high
- **Refresh Rates**: 30, 60 FPS
- **LUT Modes**: builtin, custom, file
- **Seekbar Configurations**: live, frequency, waveform modes

#### Invalid Settings
- **Malformed Inputs**: Invalid JSON, extreme values, non-numeric inputs
- **Invalid Themes**: Unsupported theme values
- **Invalid Scales**: Non-existent scale options
- **Corrupted Data**: Malformed localStorage, sessionStorage

#### Missing Settings
- **Default Behavior**: Application behavior with no settings
- **Fallback Values**: Graceful degradation when settings are missing
- **Empty States**: Handling of empty/null inputs

#### State Persistence
- **localStorage**: Settings persistence across sessions
- **sessionStorage**: Temporary state management
- **Audio Preferences**: Volume, mute state, playback preferences
- **Cross-Browser**: Persistence across different browsers

### 2. User Interaction Scenarios

Comprehensive testing of all user interaction patterns:

#### Mouse Interactions
- **Click Events**: All clickable elements, rapid clicking
- **Hover Events**: Tooltips, hover states, visual feedback
- **Drag & Drop**: File uploads, volume slider, seekbar
- **Context Menus**: Right-click interactions
- **Double Clicks**: Rapid repeated actions

#### Keyboard Shortcuts
- **Playback Controls**: Space (play/pause), Arrow keys (seek)
- **Volume Controls**: Arrow Up/Down, M (mute)
- **Navigation**: Tab, Enter, Escape
- **Help & Settings**: H (help), S (settings)
- **Rapid Input**: Multiple key presses, key combinations

#### Touch Interactions
- **Tap Events**: Touch targets, tap accuracy
- **Swipe Gestures**: Horizontal/vertical swiping
- **Pinch to Zoom**: Multi-touch gestures
- **Touch Feedback**: Visual feedback for touch events
- **Mobile Navigation**: Touch-based navigation patterns

#### Navigation Scenarios
- **Panel Switching**: Settings, metadata, playlist panels
- **Browser Navigation**: Back/forward, refresh, new tabs
- **Mid-Action Interruption**: Closing modals, switching tabs
- **State Preservation**: Maintaining state during navigation

### 3. Cross-Component Effects

Tests how components interact and affect each other:

#### State Propagation
- **Audio State**: Playback state across all components
- **Settings Changes**: Theme changes affecting all UI elements
- **Data Flow**: Audio data flowing through spectrogram, seekbar, controls
- **Event Broadcasting**: Cross-component event communication

#### Component Dependencies
- **Audio Context**: Dependencies on audio availability
- **WebAssembly**: WASM module dependencies
- **Canvas Rendering**: WebGL/Canvas dependencies
- **State Synchronization**: Keeping components in sync

#### Side Effects
- **Unintended Changes**: Settings changes not affecting unrelated components
- **Memory Leaks**: Component cleanup and resource management
- **Performance Impact**: Heavy operations not blocking UI
- **Error Isolation**: Errors not propagating to unrelated components

### 4. Integration & Flow Testing

End-to-end workflow testing:

#### Complete Workflows
- **Audio Processing**: Upload → Process → Play → Visualize
- **Settings Management**: Open → Configure → Save → Persist
- **Playlist Management**: Add → Reorder → Remove → Play
- **Multi-File Handling**: Multiple files → Switch → Compare

#### Persistence Testing
- **Settings Persistence**: All settings across reloads
- **Audio Preferences**: Volume, mute, playback position
- **User Preferences**: Theme, layout, accessibility settings
- **Cross-Session**: Persistence across browser sessions

#### Error Recovery
- **Corrupted Data**: Recovery from invalid localStorage
- **Network Errors**: Handling of network failures
- **File Errors**: Invalid file handling and recovery
- **WASM Errors**: WebAssembly loading failures

### 5. Robustness & Resilience

Testing application stability under various conditions:

#### Network Conditions
- **Slow Network**: 3G, 2G, dial-up simulation
- **Offline Mode**: Application behavior without network
- **Intermittent Connectivity**: Network dropouts and recovery
- **High Latency**: Delayed network responses

#### Browser Compatibility
- **Cross-Browser**: Chrome, Firefox, Safari, Edge
- **Mobile Browsers**: iOS Safari, Android Chrome
- **Tablet Browsers**: iPad Safari, Android tablets
- **Different Viewports**: Desktop, tablet, mobile, small mobile

#### Memory Management
- **Large Files**: Handling of large audio files (10MB+)
- **Multiple Files**: Memory usage with multiple loaded files
- **Memory Leaks**: Long-running operations and cleanup
- **Garbage Collection**: Proper resource cleanup

#### Accessibility
- **Screen Readers**: ARIA labels, semantic HTML
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG 2.1 AA compliance
- **Reduced Motion**: Respecting user motion preferences

### 6. Property-Based Testing

Automated test generation using fast-check:

#### Arbitrary Input Generation
- **Settings Values**: Random valid/invalid settings combinations
- **Audio Parameters**: Random frequencies, amplitudes, durations
- **User Interactions**: Random click positions, key sequences
- **File Characteristics**: Random file sizes, formats, metadata

#### Edge Case Discovery
- **Boundary Values**: Min/max values, zero, negative values
- **Extreme Inputs**: Very large numbers, special characters
- **Invalid Combinations**: Mutually exclusive settings
- **Race Conditions**: Concurrent operations and timing

#### Automated Test Generation
- **Test Data**: Automatically generated test files
- **Scenarios**: Random test scenario generation
- **Configurations**: Random application configurations
- **User Behaviors**: Random user interaction patterns

### 7. Snapshot Testing

Visual regression and consistency testing:

#### Visual Regression
- **Component States**: Loading, error, success states
- **Theme Variations**: All theme combinations
- **Responsive Design**: Different viewport sizes
- **Animation States**: Before/after animations

#### Layout Consistency
- **Spacing**: Consistent margins, padding, gaps
- **Typography**: Font sizes, weights, colors
- **Alignment**: Element alignment and positioning
- **Responsiveness**: Layout changes across breakpoints

#### Visual Quality
- **Rendering**: Canvas/WebGL rendering quality
- **Color Accuracy**: Color reproduction and contrast
- **Animation Smoothness**: Frame rate and smoothness
- **Visual Artifacts**: Glitches, artifacts, rendering issues

### 8. Chaos Testing

Testing application resilience under adverse conditions:

#### Random Failures
- **Network Failures**: Random network timeouts and errors
- **Component Failures**: Random component crashes
- **Resource Failures**: Memory, CPU, storage failures
- **Timing Issues**: Random delays and race conditions

#### Rapid State Changes
- **Settings Changes**: Rapid configuration changes
- **Audio Switching**: Rapid file switching
- **UI Interactions**: Rapid clicking and navigation
- **Data Updates**: Rapid data updates and refreshes

#### Concurrent Operations
- **Multiple Uploads**: Simultaneous file uploads
- **Parallel Playback**: Multiple audio streams
- **Cross-Tab Operations**: Operations across multiple tabs
- **Background Tasks**: Heavy operations in background

## 🔧 Configuration

### Playwright Configuration

The comprehensive configuration (`comprehensive-playwright.config.ts`) includes:

- **Multiple Browsers**: Chrome, Firefox, Safari, Edge
- **Mobile Devices**: iOS, Android, tablets
- **Performance Testing**: Specialized performance configuration
- **Visual Regression**: Screenshot comparison setup
- **Accessibility Testing**: A11y testing configuration
- **Property-Based Testing**: fast-check integration
- **Custom Fixtures**: Enhanced test utilities and helpers

### Test Data Generation

The test data generator (`test-data-generator.ts`) creates:

- **Audio Files**: WAV, MP3 files with various characteristics
- **Invalid Files**: Corrupted, empty, wrong format files
- **Test Settings**: Valid, invalid, edge case configurations
- **User Interactions**: Mouse, keyboard, touch interaction patterns
- **Test Scenarios**: Complete workflow scenarios

### Enhanced Test Helpers

The enhanced test helpers (`enhanced-test-helpers.ts`) provide:

- **Performance Monitoring**: Memory usage, timing measurements
- **Accessibility Testing**: ARIA checks, keyboard navigation
- **Visual Testing**: Screenshot capture and comparison
- **Property-Based Testing**: Arbitrary data generation
- **State Management**: Save/restore application state
- **Network Simulation**: Slow network, offline mode simulation

## 📊 Reporting

### Test Reports

The testing suite generates multiple report formats:

- **HTML Reports**: Interactive test reports with screenshots and videos
- **JSON Reports**: Machine-readable test results
- **JUnit Reports**: CI/CD integration
- **Allure Reports**: Advanced test analytics
- **Performance Reports**: Performance metrics and trends
- **Accessibility Reports**: A11y compliance reports

### Artifacts

Test artifacts are preserved for debugging:

- **Screenshots**: Captured on test failures and visual regression
- **Videos**: Recorded for failed tests and user journeys
- **Traces**: Detailed execution traces for debugging
- **Performance Metrics**: Load times, memory usage, CPU performance
- **Test Data**: Generated test files and configurations

## 🚀 CI/CD Integration

### GitHub Actions

The testing suite integrates with CI/CD pipelines:

```yaml
name: Comprehensive E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
        viewport: [desktop, tablet, mobile]
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run test:e2e:setup
      - run: npm run test:e2e:comprehensive
      
      - uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ matrix.browser }}-${{ matrix.viewport }}
          path: test-results/
```

### Parallel Execution

Tests are distributed across multiple jobs:

1. **Setup**: Environment preparation and caching
2. **Browser-Specific Tests**: Parallel execution across browsers
3. **Specialized Tests**: Visual regression, accessibility, performance
4. **Property-Based Tests**: Automated test generation
5. **Chaos Tests**: Resilience and stability testing
6. **Report Generation**: Combined test reports and analytics

## 🛠️ Development

### Adding New Tests

1. **Create Test File**: Add new `.spec.ts` file in appropriate category
2. **Use Enhanced Helpers**: Leverage existing utilities in `enhanced-test-helpers.ts`
3. **Follow Naming**: Use descriptive test names and group related tests
4. **Add Data Attributes**: Use `data-testid` attributes for reliable element selection
5. **Include Edge Cases**: Test both happy path and error scenarios
6. **Add Documentation**: Document test purpose and expected behavior

### Test Data

Test data is automatically generated:

```typescript
import { testDataGenerator } from './utils/test-data-generator';

// Generate specific test files
testDataGenerator.generateWAVFile('custom-test.wav', {
  duration: 5.0,
  frequency: 880,
  format: 'sine'
});

// Generate all test data
testDataGenerator.generateAllTestData();
```

### Best Practices

1. **Isolation**: Each test should be independent and not rely on others
2. **Reliability**: Use stable selectors and wait for elements properly
3. **Performance**: Keep tests fast and efficient
4. **Maintainability**: Write readable, well-documented tests
5. **Coverage**: Ensure comprehensive test coverage
6. **Edge Cases**: Test boundary conditions and error scenarios
7. **Accessibility**: Include accessibility testing in all user interaction tests
8. **Visual Regression**: Include visual testing for UI changes

### Debugging

```bash
# Run specific test file
npx playwright test comprehensive-e2e.spec.ts

# Run specific test
npx playwright test -g "should handle rapid clicking"

# Debug mode
npx playwright test --debug

# Show browser
npx playwright test --headed

# Generate trace
npx playwright test --trace on

# Show report
npx playwright show-report
```

## 📈 Performance Monitoring

### Metrics Collection

The testing suite collects comprehensive performance metrics:

- **Load Times**: Page load, WebAssembly load, spectrogram render
- **Memory Usage**: Heap size, memory leaks, garbage collection
- **CPU Performance**: Audio processing, spectrogram generation
- **Network Performance**: File uploads, API calls, data transfer
- **UI Responsiveness**: Frame rate, interaction latency
- **Resource Usage**: CPU, memory, network, storage

### Performance Budgets

Performance budgets are enforced:

- **Page Load**: < 3 seconds
- **WebAssembly Load**: < 2 seconds
- **Spectrogram Render**: < 1 second
- **Memory Usage**: < 100MB for typical usage
- **CPU Usage**: < 50% during normal operation
- **Network Requests**: < 10 requests per page load

### Performance Testing

```bash
# Run performance tests
npm run test:e2e:performance

# Generate performance report
npm run test:e2e:performance-report

# Compare performance across versions
npm run test:e2e:performance-compare
```

## 🔍 Troubleshooting

### Common Issues

1. **WebAssembly Loading**: Ensure WASM module is properly initialized
2. **Audio Context**: Handle browser autoplay policies
3. **File Uploads**: Use proper file paths and formats
4. **Timing Issues**: Add appropriate waits for async operations
5. **Browser Differences**: Handle browser-specific behaviors
6. **Memory Issues**: Monitor memory usage and cleanup
7. **Network Issues**: Handle network timeouts and errors
8. **Visual Regression**: Update baseline screenshots when UI changes

### Performance Issues

1. **Memory Leaks**: Monitor memory usage in performance tests
2. **Slow Tests**: Optimize test execution and reduce timeouts
3. **Flaky Tests**: Add proper waits and retry logic
4. **Resource Usage**: Clean up resources in teardown
5. **Network Throttling**: Use network throttling for realistic testing
6. **Browser Performance**: Monitor browser-specific performance issues

### Debugging Tools

- **Playwright Inspector**: Interactive debugging with `--debug`
- **Trace Viewer**: Detailed execution traces with `--trace`
- **Screenshots**: Visual debugging with automatic screenshots
- **Videos**: Video recordings for failed tests
- **Console Logs**: Browser console logs for debugging
- **Performance Profiler**: Performance analysis tools

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [fast-check Documentation](https://fast-check.dev/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAssembly Documentation](https://webassembly.org/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [WebGL Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

## 🤝 Contributing

When adding new tests:

1. Follow existing patterns and conventions
2. Add appropriate documentation
3. Ensure tests are reliable and fast
4. Update this README if adding new test categories
5. Test across multiple browsers
6. Consider accessibility implications
7. Include performance monitoring
8. Add visual regression testing
9. Test edge cases and error scenarios
10. Ensure proper cleanup and resource management

## 📄 License

This testing suite is part of the Kofft project and follows the same license terms.

---

This comprehensive E2E testing suite ensures the Kofft Spectrogram application is robust, reliable, and user-friendly across all scenarios and edge cases.
