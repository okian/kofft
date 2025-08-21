import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...');
  
  // Clean up test data if needed
  const testDataDir = path.join(__dirname, 'test-data');
  if (fs.existsSync(testDataDir) && process.env.CLEANUP_TEST_DATA === 'true') {
    fs.rmSync(testDataDir, { recursive: true, force: true });
    console.log('🗑️ Test data cleaned up');
  }
  
  // Generate test summary
  await generateTestSummary();
  
  console.log('✅ E2E test environment cleanup complete');
}

async function generateTestSummary() {
  const resultsDir = path.join(process.cwd(), 'test-results');
  
  if (fs.existsSync(resultsDir)) {
    const files = fs.readdirSync(resultsDir);
    const screenshots = files.filter(f => f.endsWith('.png')).length;
    const videos = files.filter(f => f.endsWith('.webm')).length;
    const traces = files.filter(f => f.endsWith('.zip')).length;
    
    console.log('📊 Test artifacts generated:', {
      screenshots,
      videos,
      traces,
      totalFiles: files.length
    });
  }
}

export default globalTeardown;
