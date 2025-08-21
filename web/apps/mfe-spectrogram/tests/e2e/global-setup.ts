import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  console.log('🚀 Setting up E2E test environment...');
  
  // Create test data directory if it doesn't exist
  const testDataDir = path.join(__dirname, 'test-data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Create sample audio files for testing
  await createTestAudioFiles(testDataDir);
  
  // Verify the application is accessible
  await verifyApplicationAccess(baseURL);
  
  console.log('✅ E2E test environment setup complete');
}

async function createTestAudioFiles(testDataDir: string) {
  console.log('📁 Creating test audio files...');
  
  // Create a simple test audio file (1 second of silence)
  const sampleRate = 44100;
  const duration = 1; // 1 second
  const samples = new Float32Array(sampleRate * duration);
  
  // Create WAV file header
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  // Write audio data
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i] * 32767, true);
  }
  
  // Save test files
  const testWavPath = path.join(testDataDir, 'test-silence.wav');
  fs.writeFileSync(testWavPath, Buffer.from(buffer));
  
  // Create a simple MP3-like file (just a placeholder)
  const testMp3Path = path.join(testDataDir, 'test-audio.mp3');
  const mp3Placeholder = new Uint8Array([0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00]);
  fs.writeFileSync(testMp3Path, Buffer.from(mp3Placeholder));
  
  console.log('✅ Test audio files created:', {
    wav: testWavPath,
    mp3: testMp3Path
  });
}

async function verifyApplicationAccess(baseURL: string) {
  console.log('🔍 Verifying application accessibility...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for the app to load
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Check if WebAssembly module is loaded
    await page.waitForFunction(() => {
      return window.wasmModule !== undefined || 
             document.querySelector('[data-testid="spectrogram-canvas"]') !== null;
    }, { timeout: 15000 });
    
    console.log('✅ Application is accessible and WebAssembly is loaded');
  } catch (error) {
    console.error('❌ Failed to verify application access:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
