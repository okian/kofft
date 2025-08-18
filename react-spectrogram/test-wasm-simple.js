// Simple test script to verify WASM metadata extraction
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testWASMMetadata() {
  try {
    console.log('🔧 Testing WASM metadata extraction...');
    
    // Import the WASM module
    const wasmModule = await import('./src/wasm/web_spectrogram.js');
    console.log('✅ WASM module loaded successfully');
    
    // Initialize the module
    await wasmModule.default();
    console.log('✅ WASM module initialized');
    
    // Create a metadata extractor
    const extractor = new wasmModule.MetadataExtractor();
    console.log('✅ MetadataExtractor created');
    
    // Test with MP3 file
    const testFile = join(__dirname, 'test-fixtures', 'perfect-circle-passive-30s.mp3');
    const fileData = readFileSync(testFile);
    
    console.log(`📁 Testing with file: ${testFile}`);
    console.log(`📊 File size: ${fileData.length} bytes`);
    
    // Extract metadata
    const metadata = extractor.extract_metadata(fileData, 'perfect-circle-passive-30s.mp3');
    
    console.log('✅ Metadata extracted successfully');
    console.log('📋 Metadata:', JSON.stringify(metadata, null, 2));
    
    // Check for album art
    if (metadata.album_art) {
      console.log('🎨 Album art found!');
      console.log(`   Size: ${metadata.album_art.length} bytes`);
      console.log(`   MIME type: ${metadata.album_art_mime || 'unknown'}`);
      
      // Check if it looks like valid image data
      const header = metadata.album_art.slice(0, 8);
      console.log(`   Header bytes: ${Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      
      if (header[0] === 0xFF && header[1] === 0xD8) {
        console.log('   ✅ Valid JPEG header detected');
      } else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        console.log('   ✅ Valid PNG header detected');
      } else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
        console.log('   ✅ Valid GIF header detected');
      } else {
        console.log('   ⚠️ Unknown image format');
      }
    } else {
      console.log('❌ No album art found in metadata');
    }
    
    // Clean up
    extractor.free();
    console.log('✅ Cleanup completed');
    
  } catch (error) {
    console.error('❌ Error testing WASM metadata extraction:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testWASMMetadata();
