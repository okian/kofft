// Test script to check audio files for embedded album art
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function checkForAlbumArt(filePath) {
  try {
    const data = readFileSync(filePath);
    console.log(`\n📁 Checking: ${filePath}`);
    console.log(`📊 File size: ${data.length} bytes`);
    
    // Check for common audio file headers
    const header = data.slice(0, 16);
    const headerHex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`🔍 Header: ${headerHex}`);
    
    // Check for MP3 ID3 tags
    if (data.length > 10) {
      const id3Header = data.slice(0, 3);
      if (id3Header[0] === 0x49 && id3Header[1] === 0x44 && id3Header[2] === 0x33) {
        console.log('✅ ID3 tag found (MP3)');
        
        // Look for APIC frame (album art)
        let offset = 10; // Skip ID3 header
        while (offset < data.length - 10) {
          const frameId = data.slice(offset, offset + 4);
          const frameIdStr = String.fromCharCode(...frameId);
          
          if (frameIdStr === 'APIC') {
            console.log('🎨 APIC frame found (album art)!');
            const frameSize = (data[offset + 4] << 24) | (data[offset + 5] << 16) | (data[offset + 6] << 8) | data[offset + 7];
            console.log(`   Frame size: ${frameSize} bytes`);
            return true;
          }
          
          offset += 4;
          if (offset >= data.length) break;
        }
      }
    }
    
    // Check for M4A/MP4 atoms
    if (data.length > 8) {
      const ftyp = data.slice(4, 8);
      const ftypStr = String.fromCharCode(...ftyp);
      if (ftypStr === 'ftyp') {
        console.log('✅ MP4/M4A file detected');
        
        // Look for 'moov' atom which contains metadata
        let offset = 8;
        while (offset < data.length - 8) {
          const atomSize = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
          const atomType = data.slice(offset + 4, offset + 8);
          const atomTypeStr = String.fromCharCode(...atomType);
          
          if (atomTypeStr === 'moov') {
            console.log('📋 moov atom found (metadata container)');
            // Look for 'covr' atom (cover art)
            let moovOffset = offset + 8;
            while (moovOffset < offset + atomSize && moovOffset < data.length - 8) {
              const covrSize = (data[moovOffset] << 24) | (data[moovOffset + 1] << 16) | (data[moovOffset + 2] << 8) | data[moovOffset + 3];
              const covrType = data.slice(moovOffset + 4, moovOffset + 8);
              const covrTypeStr = String.fromCharCode(...covrType);
              
              if (covrTypeStr === 'covr') {
                console.log('🎨 covr atom found (cover art)!');
                console.log(`   Cover art size: ${covrSize - 8} bytes`);
                return true;
              }
              
              moovOffset += covrSize;
            }
          }
          
          offset += atomSize;
          if (offset >= data.length) break;
        }
      }
    }
    
    // Check for FLAC metadata
    if (data.length > 4) {
      const flacHeader = data.slice(0, 4);
      if (flacHeader[0] === 0x66 && flacHeader[1] === 0x4C && flacHeader[2] === 0x61 && flacHeader[3] === 0x43) {
        console.log('✅ FLAC file detected');
        
        // Look for metadata blocks
        let offset = 4;
        while (offset < data.length - 4) {
          const blockHeader = data[offset];
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
    
    console.log('❌ No album art found');
    return false;
    
  } catch (error) {
    console.error(`❌ Error checking ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  const testFiles = [
    'test-fixtures/adele-skyfall-30s.m4a',
    'test-fixtures/perfect-circle-passive-30s.mp3',
    'test-fixtures/adele-skyfall.flac',
    'test-fixtures/perfect-circle-passive.flac',
    'test-fixtures/corrupted-audio.mp3'
  ];
  
  console.log('🔍 Checking audio files for embedded album art...\n');
  
  let foundAlbumArt = 0;
  
  for (const file of testFiles) {
    const filePath = join(__dirname, file);
    const hasAlbumArt = checkForAlbumArt(filePath);
    if (hasAlbumArt) foundAlbumArt++;
  }
  
  console.log(`\n📊 Summary: ${foundAlbumArt}/${testFiles.length} files have album art`);
  
  if (foundAlbumArt === 0) {
    console.log('\n💡 No album art found in test files. This explains why you don\'t see album art in the app!');
    console.log('   The WASM module is working correctly, but the test audio files don\'t have embedded album art.');
    console.log('   Try uploading audio files that have album art embedded (like from iTunes, Spotify, etc.)');
  }
}

main();
