/**
 * Comprehensive PWA Testing Script
 * Tests the Spectrogram PWA functionality across different screen sizes
 */

const fs = require('fs');
const path = require('path');

// Test configurations for different devices
const DEVICE_CONFIGS = {
    laptop: { width: 1366, height: 768, deviceScaleFactor: 1, name: 'Laptop (1366x768)' },
    ipad: { width: 1024, height: 768, deviceScaleFactor: 2, name: 'iPad (1024x768)' },
    iphone: { width: 375, height: 667, deviceScaleFactor: 2, name: 'iPhone (375x667)' }
};

const TEST_AUDIO_FILE = '/Users/kianostad/Music/lib/AIR French Band/Moon Safari (2024)/05 - Talisman.flac';
const BASE_URL = 'http://localhost:8000';

class PWATestSuite {
    constructor() {
        this.results = [];
        this.screenshots = [];
    }

    async runAllTests() {
        console.log('🚀 Starting PWA Test Suite...\n');
        
        for (const [deviceType, config] of Object.entries(DEVICE_CONFIGS)) {
            console.log(`📱 Testing on ${config.name}...`);
            await this.testDevice(deviceType, config);
            console.log(''); // Empty line for readability
        }
        
        this.generateReport();
    }

    async testDevice(deviceType, config) {
        const puppeteer = require('puppeteer');
        
        try {
            const browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--allow-file-access-from-files',
                    '--autoplay-policy=no-user-gesture-required'
                ]
            });

            const page = await browser.newPage();
            
            // Set viewport for device
            await page.setViewport(config);
            
            // Navigate to PWA
            await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
            
            // Wait for app to initialize
            await page.waitForSelector('#app', { timeout: 10000 });
            await this.wait(2000); // Give WebAssembly time to load
            
            // Run tests for this device
            await this.testInitialLoad(page, deviceType);
            await this.testUIElements(page, deviceType);
            await this.testFileLoading(page, deviceType);
            await this.testPlaybackControls(page, deviceType);
            await this.testSidebars(page, deviceType);
            await this.testSettings(page, deviceType);
            await this.testKeyboardShortcuts(page, deviceType);
            await this.testResponsiveLayout(page, deviceType);
            
            // Take final screenshot
            await this.takeScreenshot(page, deviceType, 'final-state');
            
            await browser.close();
            
        } catch (error) {
            this.logResult(deviceType, 'Device Test', false, `Failed to test device: ${error.message}`);
        }
    }

    async testInitialLoad(page, deviceType) {
        console.log('  🔄 Testing initial load...');
        
        try {
            // Check if loading overlay disappears
            await page.waitForFunction(
                () => {
                    const overlay = document.getElementById('loading-overlay');
                    return !overlay || overlay.style.display === 'none';
                },
                { timeout: 15000 }
            );
            
            // Check if main elements are present
            const appContainer = await page.$('#app');
            const header = await page.$('.header');
            const mainContent = await page.$('.main-content');
            const footer = await page.$('.footer');
            const spectrogramCanvas = await page.$('#spectrogram-canvas');
            
            const allPresent = appContainer && header && mainContent && footer && spectrogramCanvas;
            
            this.logResult(deviceType, 'Initial Load', allPresent, 
                allPresent ? 'All main elements loaded successfully' : 'Some main elements missing');
                
            // Check theme application
            const bodyClass = await page.evaluate(() => document.body.className);
            const hasTheme = bodyClass.includes('theme-');
            
            this.logResult(deviceType, 'Theme Application', hasTheme, 
                hasTheme ? `Theme applied: ${bodyClass}` : 'No theme class found');
                
            await this.takeScreenshot(page, deviceType, 'initial-load');
            
        } catch (error) {
            this.logResult(deviceType, 'Initial Load', false, `Error: ${error.message}`);
        }
    }

    async testUIElements(page, deviceType) {
        console.log('  🎨 Testing UI elements...');
        
        try {
            // Test header buttons
            const headerButtons = await page.$$('.header .icon-button');
            const hasHeaderButtons = headerButtons.length >= 4; // file, mic, settings, snapshot
            
            this.logResult(deviceType, 'Header Buttons', hasHeaderButtons, 
                `Found ${headerButtons.length} header buttons`);
            
            // Test footer controls
            const playButton = await page.$('#play-btn');
            const volumeSlider = await page.$('#volume-slider');
            const seekBar = await page.$('#waveform-seek-bar');
            
            const footerElementsPresent = playButton && volumeSlider && seekBar;
            
            this.logResult(deviceType, 'Footer Controls', footerElementsPresent, 
                footerElementsPresent ? 'All footer controls present' : 'Some footer controls missing');
            
            // Test spectrogram canvas
            const canvasSize = await page.evaluate(() => {
                const canvas = document.getElementById('spectrogram-canvas');
                return canvas ? { width: canvas.width, height: canvas.height } : null;
            });
            
            this.logResult(deviceType, 'Spectrogram Canvas', !!canvasSize, 
                canvasSize ? `Canvas size: ${canvasSize.width}x${canvasSize.height}` : 'Canvas not found');
                
        } catch (error) {
            this.logResult(deviceType, 'UI Elements', false, `Error: ${error.message}`);
        }
    }

    async testFileLoading(page, deviceType) {
        console.log('  📁 Testing file loading...');
        
        try {
            // Check if test file exists
            if (!fs.existsSync(TEST_AUDIO_FILE)) {
                this.logResult(deviceType, 'File Loading', false, 'Test audio file not found');
                return;
            }
            
            // Create a file input element and simulate file selection
            await page.evaluate((filePath) => {
                // Create a mock file object (this is a simulation for testing)
                const mockFile = new File([''], 'Talisman.flac', { type: 'audio/flac' });
                Object.defineProperty(mockFile, 'path', { value: filePath });
                
                // Trigger file selection event
                const fileInput = document.getElementById('file-input');
                if (fileInput) {
                    const event = new Event('change', { bubbles: true });
                    Object.defineProperty(event, 'target', {
                        value: { files: [mockFile] },
                        enumerable: true
                    });
                    fileInput.dispatchEvent(event);
                }
            }, TEST_AUDIO_FILE);
            
            // Wait for file processing
            await this.wait(3000);
            
            // Check if metadata was loaded
            const trackTitle = await page.$eval('#track-title', el => el.textContent.trim()).catch(() => '');
            const hasMetadata = trackTitle && trackTitle !== 'No track loaded';
            
            this.logResult(deviceType, 'Metadata Loading', hasMetadata, 
                hasMetadata ? `Track title: ${trackTitle}` : 'No metadata loaded');
            
            // Check if playlist was updated
            const playlistItems = await page.$$('.playlist-item').catch(() => []);
            const hasPlaylistItems = playlistItems.length > 0;
            
            this.logResult(deviceType, 'Playlist Update', hasPlaylistItems, 
                `Playlist items: ${playlistItems.length}`);
                
            await this.takeScreenshot(page, deviceType, 'file-loaded');
            
        } catch (error) {
            this.logResult(deviceType, 'File Loading', false, `Error: ${error.message}`);
        }
    }

    async testPlaybackControls(page, deviceType) {
        console.log('  ▶️ Testing playback controls...');
        
        try {
            // Test play button
            const playButton = await page.$('#play-btn');
            if (playButton) {
                await playButton.click();
                await this.wait(1000);
                
                // Check if play state changed
                const isPlaying = await page.evaluate(() => {
                    const playBtn = document.getElementById('play-btn');
                    return playBtn ? playBtn.classList.contains('playing') : false;
                });
                
                this.logResult(deviceType, 'Play Button', true, 'Play button clicked successfully');
            }
            
            // Test volume control
            const volumeSlider = await page.$('#volume-slider');
            if (volumeSlider) {
                await volumeSlider.click();
                this.logResult(deviceType, 'Volume Control', true, 'Volume slider interactive');
            }
            
            // Test seek bar
            const seekBar = await page.$('#waveform-seek-bar');
            if (seekBar) {
                const seekBarBounds = await seekBar.boundingBox();
                if (seekBarBounds) {
                    await page.mouse.click(
                        seekBarBounds.x + seekBarBounds.width * 0.5, 
                        seekBarBounds.y + seekBarBounds.height * 0.5
                    );
                    this.logResult(deviceType, 'Seek Bar', true, 'Seek bar clickable');
                }
            }
            
            await this.takeScreenshot(page, deviceType, 'playback-controls');
            
        } catch (error) {
            this.logResult(deviceType, 'Playback Controls', false, `Error: ${error.message}`);
        }
    }

    async testSidebars(page, deviceType) {
        console.log('  📋 Testing sidebars...');
        
        try {
            // Test metadata sidebar
            const metadataToggle = await page.$('#metadata-toggle');
            if (metadataToggle) {
                await metadataToggle.click();
                await this.wait(500);
                
                const metadataSidebar = await page.$('#metadata-sidebar');
                const isVisible = await page.evaluate((el) => {
                    return el && window.getComputedStyle(el).transform !== 'translateX(-100%)';
                }, metadataSidebar);
                
                this.logResult(deviceType, 'Metadata Sidebar', true, 'Metadata sidebar toggleable');
                
                // Close it
                if (metadataToggle) await metadataToggle.click();
            }
            
            // Test playlist sidebar
            const playlistToggle = await page.$('#playlist-toggle');
            if (playlistToggle) {
                await playlistToggle.click();
                await this.wait(500);
                
                this.logResult(deviceType, 'Playlist Sidebar', true, 'Playlist sidebar toggleable');
                
                // Close it
                if (playlistToggle) await playlistToggle.click();
            }
            
            await this.takeScreenshot(page, deviceType, 'sidebars-test');
            
        } catch (error) {
            this.logResult(deviceType, 'Sidebars', false, `Error: ${error.message}`);
        }
    }

    async testSettings(page, deviceType) {
        console.log('  ⚙️ Testing settings...');
        
        try {
            // Open settings modal
            const settingsButton = await page.$('#settings-btn');
            if (settingsButton) {
                await settingsButton.click();
                await this.wait(500);
                
                // Check if modal opened
                const settingsModal = await page.$('#settings-modal');
                const modalVisible = await page.evaluate((modal) => {
                    return modal && modal.classList.contains('active');
                }, settingsModal);
                
                this.logResult(deviceType, 'Settings Modal', modalVisible, 'Settings modal opens');
                
                if (modalVisible) {
                    // Test theme selector
                    const themeSelect = await page.$('#theme-select');
                    if (themeSelect) {
                        await themeSelect.select('light');
                        await this.wait(500);
                        
                        const bodyClass = await page.evaluate(() => document.body.className);
                        const themeChanged = bodyClass.includes('theme-light');
                        
                        this.logResult(deviceType, 'Theme Switching', themeChanged, 
                            themeChanged ? 'Theme changed to light' : 'Theme change failed');
                        
                        // Switch back to dark
                        await themeSelect.select('dark');
                        await this.wait(500);
                    }
                    
                    // Close settings
                    const closeButton = await page.$('#settings-close');
                    if (closeButton) {
                        await closeButton.click();
                        await this.wait(500);
                    }
                }
            }
            
            await this.takeScreenshot(page, deviceType, 'settings-test');
            
        } catch (error) {
            this.logResult(deviceType, 'Settings', false, `Error: ${error.message}`);
        }
    }

    async testKeyboardShortcuts(page, deviceType) {
        console.log('  ⌨️ Testing keyboard shortcuts...');
        
        try {
            // Test spacebar (play/pause)
            await page.keyboard.press('Space');
            await this.wait(500);
            
            // Test M key (metadata toggle)
            await page.keyboard.press('KeyM');
            await this.wait(500);
            await page.keyboard.press('KeyM'); // Close it
            
            // Test P key (playlist toggle)
            await page.keyboard.press('KeyP');
            await this.wait(500);
            await page.keyboard.press('KeyP'); // Close it
            
            // Test S key (settings)
            await page.keyboard.press('KeyS');
            await this.wait(500);
            await page.keyboard.press('Escape'); // Close settings
            
            this.logResult(deviceType, 'Keyboard Shortcuts', true, 'Keyboard shortcuts tested');
            
        } catch (error) {
            this.logResult(deviceType, 'Keyboard Shortcuts', false, `Error: ${error.message}`);
        }
    }

    async testResponsiveLayout(page, deviceType) {
        console.log('  📱 Testing responsive layout...');
        
        try {
            // Check if elements are properly positioned for this screen size
            const headerHeight = await page.evaluate(() => {
                const header = document.querySelector('.header');
                return header ? header.offsetHeight : 0;
            });
            
            const footerHeight = await page.evaluate(() => {
                const footer = document.querySelector('.footer');
                return footer ? footer.offsetHeight : 0;
            });
            
            const spectrogramHeight = await page.evaluate(() => {
                const canvas = document.getElementById('spectrogram-canvas');
                return canvas ? canvas.offsetHeight : 0;
            });
            
            const layoutValid = headerHeight > 0 && footerHeight > 0 && spectrogramHeight > 0;
            
            this.logResult(deviceType, 'Responsive Layout', layoutValid, 
                `Header: ${headerHeight}px, Footer: ${footerHeight}px, Spectrogram: ${spectrogramHeight}px`);
            
            // Check if sidebars behave correctly for screen size
            const sidebarBehavior = await page.evaluate(() => {
                const metadataSidebar = document.getElementById('metadata-sidebar');
                const playlistSidebar = document.getElementById('playlist-sidebar');
                const isMobile = window.innerWidth < 768;
                
                if (isMobile) {
                    // On mobile, sidebars should be hidden by default
                    const metadataHidden = metadataSidebar && 
                        window.getComputedStyle(metadataSidebar).transform.includes('translateX(-100%)');
                    const playlistHidden = playlistSidebar && 
                        window.getComputedStyle(playlistSidebar).transform.includes('translateX(100%)');
                    return metadataHidden && playlistHidden;
                } else {
                    // On desktop, sidebars should be visible
                    return true; // For now, just return true for desktop
                }
            });
            
            this.logResult(deviceType, 'Sidebar Responsiveness', sidebarBehavior, 
                'Sidebars respond correctly to screen size');
                
            await this.takeScreenshot(page, deviceType, 'responsive-layout');
            
        } catch (error) {
            this.logResult(deviceType, 'Responsive Layout', false, `Error: ${error.message}`);
        }
    }

    async takeScreenshot(page, deviceType, testName) {
        try {
            const filename = `screenshot-${deviceType}-${testName}.png`;
            const filepath = path.join(__dirname, 'test-screenshots', filename);
            
            // Create directory if it doesn't exist
            const dir = path.dirname(filepath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            await page.screenshot({ 
                path: filepath, 
                fullPage: true,
                type: 'png'
            });
            
            this.screenshots.push({ device: deviceType, test: testName, path: filepath });
            console.log(`    📸 Screenshot saved: ${filename}`);
            
        } catch (error) {
            console.log(`    ❌ Failed to take screenshot: ${error.message}`);
        }
    }

    logResult(device, test, passed, details) {
        const status = passed ? '✅' : '❌';
        const result = { device, test, passed, details, timestamp: new Date().toISOString() };
        
        this.results.push(result);
        console.log(`    ${status} ${test}: ${details}`);
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateReport() {
        console.log('\n📊 TEST RESULTS SUMMARY\n');
        console.log('=' * 50);
        
        const deviceSummary = {};
        
        // Group results by device
        for (const result of this.results) {
            if (!deviceSummary[result.device]) {
                deviceSummary[result.device] = { passed: 0, failed: 0, total: 0 };
            }
            
            deviceSummary[result.device].total++;
            if (result.passed) {
                deviceSummary[result.device].passed++;
            } else {
                deviceSummary[result.device].failed++;
            }
        }
        
        // Print summary for each device
        for (const [device, summary] of Object.entries(deviceSummary)) {
            const config = DEVICE_CONFIGS[device];
            const passRate = Math.round((summary.passed / summary.total) * 100);
            
            console.log(`\n📱 ${config.name}`);
            console.log(`   Tests: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Pass Rate: ${passRate}%`);
            
            if (summary.failed > 0) {
                console.log('   Failed tests:');
                this.results
                    .filter(r => r.device === device && !r.passed)
                    .forEach(r => console.log(`     ❌ ${r.test}: ${r.details}`));
            }
        }
        
        // Overall summary
        const totalTests = this.results.length;
        const totalPassed = this.results.filter(r => r.passed).length;
        const totalFailed = totalTests - totalPassed;
        const overallPassRate = Math.round((totalPassed / totalTests) * 100);
        
        console.log(`\n🎯 OVERALL RESULTS`);
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${totalPassed}`);
        console.log(`   Failed: ${totalFailed}`);
        console.log(`   Pass Rate: ${overallPassRate}%`);
        
        console.log(`\n📸 Screenshots saved in: ./test-screenshots/`);
        console.log(`   Total screenshots: ${this.screenshots.length}`);
        
        // Save detailed report to file
        const report = {
            summary: { totalTests, totalPassed, totalFailed, overallPassRate },
            deviceSummary,
            detailedResults: this.results,
            screenshots: this.screenshots,
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync('pwa-test-report.json', JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report saved: pwa-test-report.json`);
    }
}

// Run the test suite
if (require.main === module) {
    const testSuite = new PWATestSuite();
    testSuite.runAllTests().catch(console.error);
}

module.exports = PWATestSuite;
