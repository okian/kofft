#!/usr/bin/env node

/**
 * E2E Test Setup Script
 * 
 * This script helps developers set up the E2E testing environment
 * and provides useful commands for running tests.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(message, 'bright');
  log('='.repeat(60), 'cyan');
}

function logStep(message) {
  log(`\n${colors.yellow}▶${colors.reset} ${message}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function checkPrerequisites() {
  logHeader('Checking Prerequisites');
  
  // Check Node.js version
  try {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion >= 18) {
      logSuccess(`Node.js ${nodeVersion} is installed`);
    } else {
      logError(`Node.js ${nodeVersion} is installed, but version 18+ is required`);
      return false;
    }
  } catch (error) {
    logError('Could not determine Node.js version');
    return false;
  }
  
  // Check npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    logSuccess(`npm ${npmVersion} is available`);
  } catch (error) {
    logError('npm is not available');
    return false;
  }
  
  // Check if we're in the right directory
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    logError('package.json not found. Please run this script from the mfe-spectrogram directory');
    return false;
  }
  
  return true;
}

function installDependencies() {
  logHeader('Installing Dependencies');
  
  try {
    logStep('Installing npm dependencies...');
    execSync('npm ci', { stdio: 'inherit' });
    logSuccess('npm dependencies installed');
    
    logStep('Installing Playwright browsers...');
    execSync('npx playwright install --with-deps', { stdio: 'inherit' });
    logSuccess('Playwright browsers installed');
    
    return true;
  } catch (error) {
    logError('Failed to install dependencies');
    return false;
  }
}

function createTestData() {
  logHeader('Setting Up Test Data');
  
  const testDataDir = path.join(__dirname, '..', 'tests', 'e2e', 'test-data');
  
  try {
    if (!fs.existsSync(testDataDir)) {
      logStep('Creating test data directory...');
      fs.mkdirSync(testDataDir, { recursive: true });
      logSuccess('Test data directory created');
    } else {
      logInfo('Test data directory already exists');
    }
    
    // Create a simple test audio file
    const testWavPath = path.join(testDataDir, 'test-silence.wav');
    if (!fs.existsSync(testWavPath)) {
      logStep('Creating test audio files...');
      
      // Create a simple WAV file (1 second of silence)
      const sampleRate = 44100;
      const duration = 1;
      const samples = new Float32Array(sampleRate * duration);
      
      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);
      
      // WAV header
      const writeString = (offset, string) => {
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
      
      fs.writeFileSync(testWavPath, Buffer.from(buffer));
      logSuccess('Test audio files created');
    } else {
      logInfo('Test audio files already exist');
    }
    
    return true;
  } catch (error) {
    logError('Failed to create test data');
    console.error(error);
    return false;
  }
}

function verifySetup() {
  logHeader('Verifying Setup');
  
  try {
    logStep('Checking Playwright installation...');
    execSync('npx playwright --version', { stdio: 'pipe' });
    logSuccess('Playwright is properly installed');
    
    logStep('Checking test configuration...');
    const configPath = path.join(process.cwd(), 'playwright.config.ts');
    if (fs.existsSync(configPath)) {
      logSuccess('Playwright configuration found');
    } else {
      logError('Playwright configuration not found');
      return false;
    }
    
    logStep('Checking test files...');
    const testDir = path.join(process.cwd(), 'tests', 'e2e');
    if (fs.existsSync(testDir)) {
      const testFiles = fs.readdirSync(testDir).filter(file => file.endsWith('.spec.ts'));
      logSuccess(`Found ${testFiles.length} test files`);
    } else {
      logError('Test directory not found');
      return false;
    }
    
    return true;
  } catch (error) {
    logError('Setup verification failed');
    return false;
  }
}

function showUsage() {
  logHeader('E2E Testing Commands');
  
  log('\n📋 Available Commands:', 'bright');
  
  log('\n🧪 Running Tests:');
  log('  npm run test:e2e              # Run all E2E tests');
  log('  npm run test:e2e:ui           # Run tests with UI (interactive)');
  log('  npm run test:e2e:headed       # Run tests in headed mode');
  log('  npm run test:e2e:debug        # Run tests in debug mode');
  log('  npm run test:e2e:report       # Show test report');
  
  log('\n🎯 Specific Test Files:');
  log('  npx playwright test functionality.spec.ts');
  log('  npx playwright test visual-regression.spec.ts');
  log('  npx playwright test accessibility.spec.ts');
  log('  npx playwright test cross-browser.spec.ts');
  log('  npx playwright test performance.spec.ts');
  
  log('\n🔧 Development Commands:');
  log('  npx playwright test --debug   # Debug specific test');
  log('  npx playwright test --headed  # See browser while testing');
  log('  npx playwright test --trace on # Generate trace for debugging');
  
  log('\n📊 Reports:');
  log('  npm run test:e2e:report       # Open HTML report');
  log('  npx playwright show-report    # Show latest report');
  
  log('\n📚 Documentation:');
  log('  See tests/e2e/README.md for detailed documentation');
  
  log('\n🌐 Browser Support:');
  log('  - Chrome/Chromium');
  log('  - Firefox');
  log('  - Safari/WebKit');
  log('  - Mobile Chrome');
  log('  - Mobile Safari');
  
  log('\n📈 Test Categories:');
  log('  - Functionality Tests');
  log('  - Visual Regression Tests');
  log('  - Accessibility Tests');
  log('  - Cross-Browser Tests');
  log('  - Performance Tests');
}

function main() {
  logHeader('E2E Test Environment Setup');
  
  log('This script will set up the E2E testing environment for the Kofft Spectrogram application.\n');
  
  // Check prerequisites
  if (!checkPrerequisites()) {
    logError('Prerequisites check failed. Please fix the issues above and try again.');
    process.exit(1);
  }
  
  // Install dependencies
  if (!installDependencies()) {
    logError('Dependency installation failed. Please check the error messages above.');
    process.exit(1);
  }
  
  // Create test data
  if (!createTestData()) {
    logError('Test data creation failed. Please check the error messages above.');
    process.exit(1);
  }
  
  // Verify setup
  if (!verifySetup()) {
    logError('Setup verification failed. Please check the error messages above.');
    process.exit(1);
  }
  
  logHeader('Setup Complete! 🎉');
  logSuccess('E2E testing environment is ready to use!');
  
  showUsage();
  
  log('\n🚀 Next Steps:', 'bright');
  log('1. Start the development server: npm run dev');
  log('2. Run a quick test: npm run test:e2e');
  log('3. Check the documentation: tests/e2e/README.md');
  
  log('\n💡 Tips:', 'bright');
  log('- Use npm run test:e2e:ui for interactive testing');
  log('- Use npm run test:e2e:headed to see the browser');
  log('- Check test results in the playwright-report directory');
  log('- Add data-testid attributes to your components for reliable testing');
}

// Run the setup
if (require.main === module) {
  main();
}

module.exports = {
  checkPrerequisites,
  installDependencies,
  createTestData,
  verifySetup
};
