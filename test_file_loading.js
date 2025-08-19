/**
 * Focused test for file loading and metadata extraction
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEST_AUDIO_FILE = '/Users/kianostad/Music/lib/AIR French Band/Moon Safari (2024)/05 - Talisman.flac';
const BASE_URL = 'http://localhost:8000';

async function testFileLoading() {
    console.log('🎵 Testing file loading and metadata extraction...\n');
    
    // Check if test file exists
    if (!fs.existsSync(TEST_AUDIO_FILE)) {
        console.log('❌ Test audio file not found:', TEST_AUDIO_FILE);
        return;
    }
    
    console.log('✅ Test audio file found:', TEST_AUDIO_FILE);
    console.log('📊 File size:', fs.statSync(TEST_AUDIO_FILE).size, 'bytes');
    
    const browser = await puppeteer.launch({
        headless: false, // Show browser for debugging
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--allow-file-access-from-files',
            '--autoplay-policy=no-user-gesture-required'
        ]
    });

    const page = await browser.newPage();
    
    // Set up console logging
    page.on('console', msg => {
        const type = msg.type();
        if (type === 'error') {
            console.log('🔴 Console Error:', msg.text());
        } else if (type === 'warn') {
            console.log('🟡 Console Warning:', msg.text());
        } else if (type === 'log' && msg.text().includes('WASM')) {
            console.log('🔧 WASM:', msg.text());
        }
    });
    
    // Set viewport
    await page.setViewport({ width: 1366, height: 768 });
    
    // Navigate to PWA
    console.log('🌐 Loading PWA...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    
    // Wait for app to initialize
    await page.waitForSelector('#app', { timeout: 15000 });
    
    // Wait for WebAssembly to load
    console.log('⏳ Waiting for WebAssembly module...');
    await page.waitForFunction(
        () => window.wasmModule !== undefined,
        { timeout: 10000 }
    ).catch(() => console.log('⚠️ WebAssembly module may not have loaded'));
    
    // Check WebAssembly status
    const wasmStatus = await page.evaluate(() => {
        return {
            moduleLoaded: typeof window.wasmModule !== 'undefined',
            hasAnalyzer: window.wasmModule && typeof window.wasmModule.AudioAnalyzer !== 'undefined',
            hasMetadataExtractor: window.wasmModule && typeof window.wasmModule.MetadataExtractor !== 'undefined'
        };
    });
    
    console.log('🔧 WebAssembly Status:', wasmStatus);
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-screenshots/file-loading-initial.png', fullPage: true });
    console.log('📸 Initial state screenshot saved');
    
    // Try to load file using the file input
    console.log('📁 Attempting to load audio file...');
    
    // Read the actual file
    const fileBuffer = fs.readFileSync(TEST_AUDIO_FILE);
    
    // Create a file input and upload the file
    const fileInput = await page.$('#file-input');
    if (fileInput) {
        // Use the file input to upload the file
        await fileInput.uploadFile(TEST_AUDIO_FILE);
        
        console.log('✅ File uploaded to file input');
        
        // Wait for file processing
        console.log('⏳ Waiting for file processing...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if metadata was extracted
        const metadata = await page.evaluate(() => {
            return {
                title: document.getElementById('track-title')?.textContent || '',
                artist: document.getElementById('track-artist')?.textContent || '',
                album: document.getElementById('track-album')?.textContent || '',
                year: document.getElementById('track-year')?.textContent || '',
                bitrate: document.getElementById('track-bitrate')?.textContent || '',
                samplerate: document.getElementById('track-samplerate')?.textContent || ''
            };
        });
        
        console.log('📋 Extracted Metadata:');
        console.log('   Title:', metadata.title);
        console.log('   Artist:', metadata.artist);
        console.log('   Album:', metadata.album);
        console.log('   Year:', metadata.year);
        console.log('   Bitrate:', metadata.bitrate);
        console.log('   Sample Rate:', metadata.samplerate);
        
        // Check playlist
        const playlistItems = await page.$$('.playlist-item');
        console.log('📝 Playlist items:', playlistItems.length);
        
        if (playlistItems.length > 0) {
            const playlistInfo = await page.evaluate(() => {
                const item = document.querySelector('.playlist-item');
                return {
                    title: item?.querySelector('.playlist-item-title')?.textContent || '',
                    artist: item?.querySelector('.playlist-item-artist')?.textContent || '',
                    duration: item?.querySelector('.playlist-item-duration')?.textContent || ''
                };
            });
            
            console.log('📝 Playlist item info:');
            console.log('   Title:', playlistInfo.title);
            console.log('   Artist:', playlistInfo.artist);
            console.log('   Duration:', playlistInfo.duration);
        }
        
        // Take screenshot after file loading
        await page.screenshot({ path: 'test-screenshots/file-loading-complete.png', fullPage: true });
        console.log('📸 File loading complete screenshot saved');
        
        // Test playback
        console.log('▶️ Testing playback...');
        const playButton = await page.$('#play-btn');
        if (playButton) {
            await playButton.click();
            console.log('✅ Play button clicked');
            
            // Wait a bit and check if audio is playing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check if waveform data was generated
            const waveformData = await page.evaluate(() => {
                const canvas = document.getElementById('waveform-canvas');
                return canvas ? {
                    width: canvas.width,
                    height: canvas.height,
                    hasContext: !!canvas.getContext('2d')
                } : null;
            });
            
            console.log('🌊 Waveform canvas:', waveformData);
            
            // Check spectrogram
            const spectrogramData = await page.evaluate(() => {
                const canvas = document.getElementById('spectrogram-canvas');
                return canvas ? {
                    width: canvas.width,
                    height: canvas.height,
                    hasContext: !!canvas.getContext('2d')
                } : null;
            });
            
            console.log('📊 Spectrogram canvas:', spectrogramData);
        }
        
        // Test seeking
        console.log('⏭️ Testing seek functionality...');
        const seekBar = await page.$('#waveform-seek-bar');
        if (seekBar) {
            const seekBarBounds = await seekBar.boundingBox();
            if (seekBarBounds) {
                // Click at 25% position
                await page.mouse.click(
                    seekBarBounds.x + seekBarBounds.width * 0.25,
                    seekBarBounds.y + seekBarBounds.height * 0.5
                );
                console.log('✅ Seek bar clicked at 25% position');
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Check current time display
                const currentTime = await page.$eval('#current-time', el => el.textContent).catch(() => '');
                const totalTime = await page.$eval('#total-time', el => el.textContent).catch(() => '');
                
                console.log('⏰ Time display:', currentTime, '/', totalTime);
            }
        }
        
        // Take final screenshot
        await page.screenshot({ path: 'test-screenshots/file-loading-final.png', fullPage: true });
        console.log('📸 Final screenshot saved');
        
    } else {
        console.log('❌ File input element not found');
    }
    
    // Keep browser open for 10 seconds to observe
    console.log('👀 Keeping browser open for observation (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    await browser.close();
    console.log('✅ Test completed');
}

testFileLoading().catch(console.error);
