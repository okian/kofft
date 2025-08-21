import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

/**
 * Comprehensive test data generator for the Kofft Spectrogram application
 * Generates various types of test audio files, settings configurations, and edge cases
 */
export class TestDataGenerator {
  private testDataDir: string;

  constructor() {
    this.testDataDir = path.join(__dirname, 'test-data');
    this.ensureTestDataDirectory();
  }

  private ensureTestDataDirectory() {
    try {
      mkdirSync(this.testDataDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  /**
   * Generate WAV file with specific characteristics
   */
  generateWAVFile(filename: string, options: {
    duration?: number;
    sampleRate?: number;
    channels?: number;
    frequency?: number;
    amplitude?: number;
    format?: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise' | 'silence';
  } = {}) {
    const {
      duration = 1.0,
      sampleRate = 44100,
      channels = 1,
      frequency = 440,
      amplitude = 0.5,
      format = 'sine'
    } = options;

    const numSamples = Math.floor(duration * sampleRate);
    const audioData = new Float32Array(numSamples * channels);

    // Generate audio data based on format
    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      let sample = 0;

      switch (format) {
        case 'sine':
          sample = amplitude * Math.sin(2 * Math.PI * frequency * time);
          break;
        case 'square':
          sample = amplitude * (Math.sin(2 * Math.PI * frequency * time) > 0 ? 1 : -1);
          break;
        case 'sawtooth':
          sample = amplitude * (2 * (frequency * time - Math.floor(frequency * time + 0.5)));
          break;
        case 'triangle':
          const phase = (frequency * time) % 1;
          sample = amplitude * (phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase);
          break;
        case 'noise':
          sample = amplitude * (Math.random() * 2 - 1);
          break;
        case 'silence':
          sample = 0;
          break;
      }

      // Apply to all channels
      for (let ch = 0; ch < channels; ch++) {
        audioData[i * channels + ch] = sample;
      }
    }

    // Convert to WAV format
    const wavData = this.convertToWAV(audioData, sampleRate, channels);
    const filePath = path.join(this.testDataDir, filename);
    writeFileSync(filePath, wavData);

    return filePath;
  }

  /**
   * Convert Float32Array to WAV format
   */
  private convertToWAV(audioData: Float32Array, sampleRate: number, channels: number): Buffer {
    const buffer = Buffer.alloc(44 + audioData.length * 2); // 44 bytes header + 16-bit samples
    
    // WAV header
    let offset = 0;
    
    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(36 + audioData.length * 2, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;
    
    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // fmt chunk size
    buffer.writeUInt16LE(1, offset); offset += 2; // PCM format
    buffer.writeUInt16LE(channels, offset); offset += 2;
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(sampleRate * channels * 2, offset); offset += 4; // byte rate
    buffer.writeUInt16LE(channels * 2, offset); offset += 2; // block align
    buffer.writeUInt16LE(16, offset); offset += 2; // bits per sample
    
    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(audioData.length * 2, offset); offset += 4;
    
    // Convert float samples to 16-bit integers
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      buffer.writeInt16LE(Math.round(sample * 32767), offset);
      offset += 2;
    }
    
    return buffer;
  }

  /**
   * Generate MP3 file (simplified - creates a basic MP3 structure)
   */
  generateMP3File(filename: string, options: {
    duration?: number;
    sampleRate?: number;
    channels?: number;
    frequency?: number;
    amplitude?: number;
  } = {}) {
    const {
      duration = 1.0,
      sampleRate = 44100,
      channels = 1,
      frequency = 440,
      amplitude = 0.5
    } = options;

    // Generate WAV first, then "convert" to MP3 (simplified)
    const wavFilename = filename.replace('.mp3', '.wav');
    this.generateWAVFile(wavFilename, { duration, sampleRate, channels, frequency, amplitude });
    
    // For testing purposes, we'll create a mock MP3 file
    // In a real implementation, you would use a proper MP3 encoder
    const mockMP3Data = Buffer.from([
      0xFF, 0xFB, 0x90, 0x44, // MP3 sync word
      ...Buffer.alloc(1000).fill(0) // Mock MP3 data
    ]);
    
    const filePath = path.join(this.testDataDir, filename);
    writeFileSync(filePath, mockMP3Data);
    
    return filePath;
  }

  /**
   * Generate test audio files with various characteristics
   */
  generateTestAudioFiles() {
    const files = [];

    // Basic test files
    files.push(this.generateWAVFile('test-silence.wav', { format: 'silence', duration: 1.0 }));
    files.push(this.generateWAVFile('test-sine-440.wav', { frequency: 440, duration: 2.0 }));
    files.push(this.generateWAVFile('test-sine-1000.wav', { frequency: 1000, duration: 1.5 }));
    
    // Different formats
    files.push(this.generateWAVFile('test-square.wav', { format: 'square', frequency: 440, duration: 1.0 }));
    files.push(this.generateWAVFile('test-sawtooth.wav', { format: 'sawtooth', frequency: 440, duration: 1.0 }));
    files.push(this.generateWAVFile('test-triangle.wav', { format: 'triangle', frequency: 440, duration: 1.0 }));
    files.push(this.generateWAVFile('test-noise.wav', { format: 'noise', duration: 1.0 }));
    
    // Different sample rates
    files.push(this.generateWAVFile('test-22050.wav', { sampleRate: 22050, frequency: 440, duration: 1.0 }));
    files.push(this.generateWAVFile('test-48000.wav', { sampleRate: 48000, frequency: 440, duration: 1.0 }));
    
    // Different channels
    files.push(this.generateWAVFile('test-stereo.wav', { channels: 2, frequency: 440, duration: 1.0 }));
    
    // Different durations
    files.push(this.generateWAVFile('test-short.wav', { duration: 0.1, frequency: 440 }));
    files.push(this.generateWAVFile('test-long.wav', { duration: 10.0, frequency: 440 }));
    
    // Different amplitudes
    files.push(this.generateWAVFile('test-loud.wav', { amplitude: 1.0, frequency: 440, duration: 1.0 }));
    files.push(this.generateWAVFile('test-quiet.wav', { amplitude: 0.1, frequency: 440, duration: 1.0 }));
    
    // Complex audio (multiple frequencies)
    files.push(this.generateComplexAudio('test-complex.wav', {
      frequencies: [440, 880, 1320],
      amplitudes: [0.3, 0.2, 0.1],
      duration: 3.0
    }));
    
    // MP3 files
    files.push(this.generateMP3File('test-audio.mp3', { frequency: 440, duration: 1.0 }));
    files.push(this.generateMP3File('test-stereo.mp3', { channels: 2, frequency: 440, duration: 1.0 }));
    
    return files;
  }

  /**
   * Generate complex audio with multiple frequencies
   */
  generateComplexAudio(filename: string, options: {
    frequencies: number[];
    amplitudes: number[];
    duration: number;
    sampleRate?: number;
    channels?: number;
  }) {
    const { frequencies, amplitudes, duration, sampleRate = 44100, channels = 1 } = options;
    const numSamples = Math.floor(duration * sampleRate);
    const audioData = new Float32Array(numSamples * channels);

    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      let sample = 0;

      // Sum all frequencies
      for (let j = 0; j < frequencies.length; j++) {
        sample += amplitudes[j] * Math.sin(2 * Math.PI * frequencies[j] * time);
      }

      // Apply to all channels
      for (let ch = 0; ch < channels; ch++) {
        audioData[i * channels + ch] = sample;
      }
    }

    const wavData = this.convertToWAV(audioData, sampleRate, channels);
    const filePath = path.join(this.testDataDir, filename);
    writeFileSync(filePath, wavData);

    return filePath;
  }

  /**
   * Generate invalid/corrupted audio files for error testing
   */
  generateInvalidFiles() {
    const files = [];

    // Empty file
    const emptyFile = path.join(this.testDataDir, 'empty.wav');
    writeFileSync(emptyFile, Buffer.alloc(0));
    files.push(emptyFile);

    // Corrupted WAV header
    const corruptedWav = path.join(this.testDataDir, 'corrupted.wav');
    writeFileSync(corruptedWav, Buffer.from('INVALID_WAV_HEADER'));
    files.push(corruptedWav);

    // Text file with .wav extension
    const textFile = path.join(this.testDataDir, 'text-as-wav.wav');
    writeFileSync(textFile, Buffer.from('This is not an audio file'));
    files.push(textFile);

    // Very large file (simulated)
    const largeFile = path.join(this.testDataDir, 'large.wav');
    const largeBuffer = Buffer.alloc(1024 * 1024); // 1MB
    writeFileSync(largeFile, largeBuffer);
    files.push(largeFile);

    return files;
  }

  /**
   * Generate test settings configurations
   */
  generateTestSettings() {
    return {
      // Valid settings combinations
      validSettings: [
        {
          theme: 'dark',
          amplitudeScale: 'linear',
          frequencyScale: 'linear',
          resolution: 'medium',
          refreshRate: 30,
          showLegend: true,
          enableToastNotifications: true
        },
        {
          theme: 'light',
          amplitudeScale: 'logarithmic',
          frequencyScale: 'logarithmic',
          resolution: 'high',
          refreshRate: 60,
          showLegend: false,
          enableToastNotifications: false
        },
        {
          theme: 'neon',
          amplitudeScale: 'db',
          frequencyScale: 'linear',
          resolution: 'low',
          refreshRate: 30,
          showLegend: true,
          enableToastNotifications: true
        }
      ],

      // Invalid settings for testing
      invalidSettings: [
        {
          theme: 'invalid-theme',
          amplitudeScale: 'invalid-scale',
          frequencyScale: 'invalid-scale',
          resolution: 'invalid-resolution',
          refreshRate: 999,
          showLegend: 'not-a-boolean',
          enableToastNotifications: 'not-a-boolean'
        }
      ],

      // Edge case settings
      edgeCaseSettings: [
        {
          theme: 'dark',
          amplitudeScale: 'linear',
          frequencyScale: 'linear',
          resolution: 'low',
          refreshRate: 30,
          showLegend: false,
          enableToastNotifications: false,
          seekbarSignificance: 0,
          seekbarAmplitudeScale: 0
        },
        {
          theme: 'light',
          amplitudeScale: 'db',
          frequencyScale: 'logarithmic',
          resolution: 'high',
          refreshRate: 60,
          showLegend: true,
          enableToastNotifications: true,
          seekbarSignificance: 1,
          seekbarAmplitudeScale: 10
        }
      ]
    };
  }

  /**
   * Generate test user interactions
   */
  generateTestInteractions() {
    return {
      // Mouse interactions
      mouseInteractions: [
        { type: 'click', selector: '[data-testid="play-pause-button"]' },
        { type: 'click', selector: '[data-testid="settings-button"]' },
        { type: 'click', selector: '[data-testid="volume-slider"]', position: { x: 50, y: 10 } },
        { type: 'click', selector: '[data-testid="seekbar"]', position: { x: 25, y: 10 } },
        { type: 'hover', selector: '[data-testid="spectrogram-canvas"]' },
        { type: 'drag', selector: '[data-testid="volume-slider"]', from: { x: 25, y: 10 }, to: { x: 75, y: 10 } }
      ],

      // Keyboard interactions
      keyboardInteractions: [
        { key: 'Space', description: 'Play/Pause' },
        { key: 'ArrowLeft', description: 'Seek Backward' },
        { key: 'ArrowRight', description: 'Seek Forward' },
        { key: 'ArrowUp', description: 'Volume Up' },
        { key: 'ArrowDown', description: 'Volume Down' },
        { key: 'm', description: 'Mute' },
        { key: 'h', description: 'Help' },
        { key: 'Escape', description: 'Close Modals' },
        { key: 'Tab', description: 'Navigate' },
        { key: 'Enter', description: 'Activate' }
      ],

      // Touch interactions
      touchInteractions: [
        { type: 'tap', selector: '[data-testid="play-pause-button"]' },
        { type: 'tap', selector: '[data-testid="settings-button"]' },
        { type: 'swipe', selector: '[data-testid="spectrogram-canvas"]', direction: 'left' },
        { type: 'swipe', selector: '[data-testid="spectrogram-canvas"]', direction: 'right' },
        { type: 'pinch', selector: '[data-testid="spectrogram-canvas"]', scale: 1.5 },
        { type: 'pinch', selector: '[data-testid="spectrogram-canvas"]', scale: 0.5 }
      ]
    };
  }

  /**
   * Generate test scenarios
   */
  generateTestScenarios() {
    return {
      // Basic functionality scenarios
      basicScenarios: [
        {
          name: 'Load and play audio',
          steps: [
            'Upload audio file',
            'Verify file loaded',
            'Click play button',
            'Verify playback started',
            'Click pause button',
            'Verify playback paused'
          ]
        },
        {
          name: 'Change settings',
          steps: [
            'Open settings panel',
            'Change theme to light',
            'Change amplitude scale to logarithmic',
            'Save settings',
            'Verify settings applied',
            'Reload page',
            'Verify settings persisted'
          ]
        },
        {
          name: 'Volume control',
          steps: [
            'Load audio file',
            'Start playback',
            'Adjust volume slider',
            'Verify volume changed',
            'Click mute button',
            'Verify audio muted',
            'Click mute button again',
            'Verify audio unmuted'
          ]
        }
      ],

      // Edge case scenarios
      edgeCaseScenarios: [
        {
          name: 'Rapid interactions',
          steps: [
            'Load audio file',
            'Rapidly click play/pause button 10 times',
            'Verify no crashes or unexpected behavior'
          ]
        },
        {
          name: 'Large file handling',
          steps: [
            'Upload large audio file (10MB+)',
            'Verify file processes without timeout',
            'Verify spectrogram renders correctly'
          ]
        },
        {
          name: 'Invalid file handling',
          steps: [
            'Upload invalid file (text file with .wav extension)',
            'Verify appropriate error message shown',
            'Verify application remains stable'
          ]
        },
        {
          name: 'Network interruption',
          steps: [
            'Start file upload',
            'Simulate network interruption',
            'Verify graceful error handling',
            'Verify application remains responsive'
          ]
        }
      ],

      // Performance scenarios
      performanceScenarios: [
        {
          name: 'Memory usage',
          steps: [
            'Load multiple audio files',
            'Switch between files rapidly',
            'Monitor memory usage',
            'Verify no memory leaks'
          ]
        },
        {
          name: 'CPU usage',
          steps: [
            'Load complex audio file',
            'Start playback',
            'Monitor CPU usage',
            'Verify reasonable performance'
          ]
        },
        {
          name: 'Responsiveness',
          steps: [
            'Perform heavy operation (spectrogram generation)',
            'Try to interact with UI',
            'Verify UI remains responsive'
          ]
        }
      ],

      // Accessibility scenarios
      accessibilityScenarios: [
        {
          name: 'Keyboard navigation',
          steps: [
            'Navigate using Tab key',
            'Activate elements using Enter/Space',
            'Verify all functionality accessible via keyboard'
          ]
        },
        {
          name: 'Screen reader support',
          steps: [
            'Check ARIA labels',
            'Verify semantic HTML structure',
            'Test with screen reader software'
          ]
        },
        {
          name: 'Color contrast',
          steps: [
            'Check color contrast ratios',
            'Verify text readable on all themes',
            'Test with color blindness simulators'
          ]
        }
      ]
    };
  }

  /**
   * Generate all test data
   */
  generateAllTestData() {
    console.log('Generating test audio files...');
    const audioFiles = this.generateTestAudioFiles();
    
    console.log('Generating invalid files...');
    const invalidFiles = this.generateInvalidFiles();
    
    console.log('Generating test settings...');
    const settings = this.generateTestSettings();
    
    console.log('Generating test interactions...');
    const interactions = this.generateTestInteractions();
    
    console.log('Generating test scenarios...');
    const scenarios = this.generateTestScenarios();
    
    const summary = {
      audioFiles: audioFiles.length,
      invalidFiles: invalidFiles.length,
      settings: Object.keys(settings).length,
      interactions: Object.keys(interactions).length,
      scenarios: Object.keys(scenarios).length,
      totalFiles: audioFiles.length + invalidFiles.length
    };
    
    console.log('Test data generation complete:', summary);
    
    return {
      audioFiles,
      invalidFiles,
      settings,
      interactions,
      scenarios,
      summary
    };
  }
}

// Export singleton instance
export const testDataGenerator = new TestDataGenerator();

// Auto-generate test data when this module is imported
if (require.main === module) {
  testDataGenerator.generateAllTestData();
}
