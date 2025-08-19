// Simple debug script to test WASM module and album art extraction
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function checkMP3AlbumArt(fileData) {
  console.log('🔍 Checking MP3 file for ID3 tags...');
  
  // Check for ID3v2 tag
  if (fileData.length > 10) {
    const id3Header = fileData.slice(0, 3);
    if (id3Header[0] === 0x49 && id3Header[1] === 0x44 && id3Header[2] === 0x33) {
      console.log('✅ ID3v2 tag found');
      
      // Look for APIC frame (album art)
      let offset = 10; // Skip ID3 header
      while (offset < fileData.length - 10) {
        const frameId = fileData.slice(offset, offset + 4);
        const frameIdStr = String.fromCharCode(...frameId);
        
        if (frameIdStr === 'APIC') {
          console.log('🎨 APIC frame found (album art)!');
          const frameSize = (fileData[offset + 4] << 24) | (fileData[offset + 5] << 16) | (fileData[offset + 6] << 8) | fileData[offset + 7];
          console.log(`   Frame size: ${frameSize} bytes`);
          return true;
        }
        
        offset += 4;
        if (offset >= fileData.length) break;
      }
    }
  }
  
  return false;
}

function checkM4AAlbumArt(fileData) {
  console.log('🔍 Checking M4A file for album art...');
  
  // Look for 'moov' atom which contains metadata
  for (let i = 0; i < fileData.length - 8; i++) {
    const atomSize = (fileData[i] << 24) | (fileData[i + 1] << 16) | (fileData[i + 2] << 8) | fileData[i + 3];
    const atomType = fileData.slice(i + 4, i + 8);
    const atomTypeStr = String.fromCharCode(...atomType);
    
    if (atomTypeStr === 'moov') {
      console.log('✅ Found moov atom at offset:', i);
      
      // Look for 'covr' atom (cover art) within moov
      let moovOffset = i + 8;
      while (moovOffset < i + atomSize && moovOffset < fileData.length - 8) {
        const covrSize = (fileData[moovOffset] << 24) | (fileData[moovOffset + 1] << 16) | (fileData[moovOffset + 2] << 8) | fileData[moovOffset + 3];
        const covrType = fileData.slice(moovOffset + 4, moovOffset + 8);
        const covrTypeStr = String.fromCharCode(...covrType);
        
        if (covrTypeStr === 'covr') {
          console.log('🎨 Found covr atom (cover art)!');
          console.log(`   Cover art size: ${covrSize - 8} bytes`);
          return true;
        }
        
        moovOffset += covrSize;
      }
      break;
    }
    
    i += atomSize - 1;
  }
  
  return false;
}

function checkFLACAlbumArt(fileData) {
  console.log('🔍 Checking FLAC file for album art...');
  
  // Check for FLAC header
  if (fileData.length > 4) {
    const flacHeader = fileData.slice(0, 4);
    if (flacHeader[0] === 0x66 && flacHeader[1] === 0x4C && flacHeader[2] === 0x61 && flacHeader[3] === 0x43) {
      console.log('✅ FLAC file detected');
      
      // Look for metadata blocks
      let offset = 4;
      while (offset < fileData.length - 4) {
        const blockHeader = fileData[offset];
        const blockType = blockHeader & 0x7F;
        const isLast = (blockHeader & 0x80) !== 0;
        
        if (blockType === 6) { // PICTURE block
          console.log('🎨 PICTURE metadata block found (album art)!');
          return true;
        }
        
        if (isLast) break;
        offset += 4; // Skip block size
      }
    }
  }
  
  return false;
}

async function testWASMModule() {
  try {
    console.log('🔧 Testing WASM module...');
    
    const testFiles = [
      { name: 'adele-skyfall-30s.m4a', type: 'm4a' },
      { name: 'perfect-circle-passive-30s.mp3', type: 'mp3' },
      { name: 'adele-skyfall.flac', type: 'flac' }
    ];
    
    for (const testFile of testFiles) {
      const filePath = join(__dirname, 'test-fixtures', testFile.name);
      
      try {
        console.log(`\n📁 Testing file: ${testFile.name}`);
        
        // Read the file
        const fileData = readFileSync(filePath);
        console.log(`📊 File size: ${fileData.length} bytes`);
        
        let hasAlbumArt = false;
        
        // Check for album art based on file type
        switch (testFile.type) {
          case 'mp3':
            hasAlbumArt = checkMP3AlbumArt(fileData);
            break;
          case 'm4a':
            hasAlbumArt = checkM4AAlbumArt(fileData);
            break;
          case 'flac':
            hasAlbumArt = checkFLACAlbumArt(fileData);
            break;
        }
        
        if (!hasAlbumArt) {
          console.log('❌ No album art found in this file');
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${testFile.name}:`, error.message);
      }
    }
    
    console.log('\n✅ All files analyzed');
    
  } catch (error) {
    console.error('❌ Error testing WASM module:', error);
  }
}

// Run the test
testWASMModule();
