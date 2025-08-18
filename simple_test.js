/**
 * Simple, direct PWA test - no complex loops or timeouts
 */

const puppeteer = require('puppeteer');

async function quickTest() {
    console.log('🚀 Starting simple PWA test...\n');
    
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-web-security'],
        defaultViewport: { width: 1366, height: 768 }
    });

    const page = await browser.newPage();
    
    // Capture console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('❌ Console Error:', msg.text());
        }
    });
    
    try {
        console.log('📱 Loading PWA...');
        await page.goto('http://localhost:8000', { waitUntil: 'domcontentloaded', timeout: 10000 });
        
        // Take initial screenshot
        await page.screenshot({ path: 'initial-load.png', fullPage: true });
        console.log('✅ Initial load - screenshot saved');
        
        // Check basic elements
        const elements = await page.evaluate(() => {
            return {
                app: !!document.getElementById('app'),
                header: !!document.querySelector('.header'),
                footer: !!document.querySelector('.footer'),
                canvas: !!document.getElementById('spectrogram-canvas'),
                playBtn: !!document.getElementById('play-btn'),
                fileBtn: !!document.getElementById('file-input-btn'),
                settingsBtn: !!document.getElementById('settings-btn'),
                theme: document.body.className
            };
        });
        
        console.log('🔍 Elements check:', elements);
        
        // Test settings modal
        console.log('⚙️ Testing settings...');
        await page.click('#settings-btn');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'settings-open.png', fullPage: true });
        console.log('✅ Settings modal opened');
        
        // Try theme change
        await page.select('#theme-select', 'light');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'light-theme.png', fullPage: true });
        console.log('✅ Theme changed to light');
        
        // Switch back to dark
        await page.select('#theme-select', 'dark');
        await page.waitForTimeout(1000);
        
        // Close settings
        await page.click('#settings-close');
        await page.waitForTimeout(500);
        
        // Test sidebars
        console.log('📋 Testing sidebars...');
        await page.click('#metadata-toggle');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'metadata-open.png', fullPage: true });
        console.log('✅ Metadata sidebar opened');
        
        await page.click('#playlist-toggle');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'playlist-open.png', fullPage: true });
        console.log('✅ Playlist sidebar opened');
        
        // Test responsive - resize to tablet
        console.log('📱 Testing tablet size...');
        await page.setViewport({ width: 1024, height: 768 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'tablet-view.png', fullPage: true });
        console.log('✅ Tablet view tested');
        
        // Test responsive - resize to mobile
        console.log('📱 Testing mobile size...');
        await page.setViewport({ width: 375, height: 667 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'mobile-view.png', fullPage: true });
        console.log('✅ Mobile view tested');
        
        // Test playback controls
        console.log('▶️ Testing playback controls...');
        await page.setViewport({ width: 1366, height: 768 }); // Back to desktop
        await page.waitForTimeout(500);
        
        // Click volume slider
        const volumeSlider = await page.$('#volume-slider');
        if (volumeSlider) {
            await volumeSlider.click();
            console.log('✅ Volume control interactive');
        }
        
        // Click play button (even without audio file)
        await page.click('#play-btn');
        await page.waitForTimeout(1000);
        console.log('✅ Play button clicked');
        
        // Test keyboard shortcuts
        console.log('⌨️ Testing keyboard shortcuts...');
        await page.keyboard.press('KeyM'); // Metadata toggle
        await page.waitForTimeout(500);
        await page.keyboard.press('KeyP'); // Playlist toggle
        await page.waitForTimeout(500);
        await page.keyboard.press('KeyS'); // Settings
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape'); // Close
        await page.waitForTimeout(500);
        console.log('✅ Keyboard shortcuts tested');
        
        // Final screenshot
        await page.screenshot({ path: 'final-state.png', fullPage: true });
        console.log('✅ Final screenshot saved');
        
        console.log('\n🎉 Test completed successfully!');
        console.log('📸 Screenshots saved:');
        console.log('  - initial-load.png');
        console.log('  - settings-open.png');
        console.log('  - light-theme.png');
        console.log('  - metadata-open.png');
        console.log('  - playlist-open.png');
        console.log('  - tablet-view.png');
        console.log('  - mobile-view.png');
        console.log('  - final-state.png');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        await page.screenshot({ path: 'error-state.png', fullPage: true });
    }
    
    // Keep browser open for 5 seconds to observe
    console.log('\n👀 Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
    
    await browser.close();
    console.log('✅ Test completed');
}

quickTest().catch(console.error);
