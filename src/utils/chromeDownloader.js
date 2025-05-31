const fs = require('fs');
const path = require('path');

class ChromeDownloader {
    constructor() {
        this.chromeExe = null; // Will be set when we find Chrome
    }

    /**
     * Find system Chrome installation
     */
    findSystemChrome() {
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe')
        ];

        for (const chromePath of possiblePaths) {
            if (fs.existsSync(chromePath)) {
                console.log('✅ Found system Chrome at:', chromePath);
                return chromePath;
            }
        }

        return null;
    }

    /**
     * Check if Chrome is installed
     */
    isInstalled() {
        const systemChrome = this.findSystemChrome();
        if (systemChrome) {
            this.chromeExe = systemChrome;
            return true;
        }
        return false;
    }

    /**
     * Install/Setup Chrome (just find system Chrome)
     */
    async install() {
        try {
            if (this.isInstalled()) {
                console.log('✅ Google Chrome found and ready');
                console.log('📍 Chrome path:', this.chromeExe);
                console.log('🎯 Using REAL Google Chrome with full flag support!');
                return true;
            }

            // If no Chrome found, provide instructions
            console.log('❌ Google Chrome not found on this system');
            console.log('');
            console.log('📋 PLEASE INSTALL GOOGLE CHROME:');
            console.log('==========================================');
            console.log('1. Go to: https://www.google.com/chrome/');
            console.log('2. Download and install Google Chrome');
            console.log('3. Restart this application');
            console.log('');
            console.log('🎯 We need the REAL Google Chrome (not Chromium)');
            console.log('✅ Google Chrome supports ALL automation flags');
            console.log('❌ Chromium has many flags disabled/unsupported');
            console.log('==========================================');

            // Try to open Chrome download page
            try {
                const { exec } = require('child_process');
                exec('start https://www.google.com/chrome/', (error) => {
                    if (!error) {
                        console.log('🌐 Opened Chrome download page in browser');
                    }
                });
            } catch (error) {
                // Ignore error if can't open browser
            }

            return false;
            
        } catch (error) {
            console.error('❌ Error checking Chrome installation:', error.message);
            return false;
        }
    }

    /**
     * Get Chrome executable path
     */
    getChromePath() {
        if (this.chromeExe) {
            return this.chromeExe;
        }
        
        // Try to find it again
        if (this.isInstalled()) {
            return this.chromeExe;
        }
        
        throw new Error('Google Chrome not found. Please install Chrome from https://www.google.com/chrome/');
    }

    /**
     * Verify Chrome installation
     */
    async verify() {
        try {
            const chromePath = this.getChromePath();
            
            if (!fs.existsSync(chromePath)) {
                throw new Error('Chrome executable not found');
            }

            console.log('✅ Google Chrome installation verified');
            console.log('📍 Chrome path:', chromePath);
            console.log('🎯 This is the REAL Google Chrome with FULL flag support!');
            console.log('✅ Supports: --no-sandbox, --disable-site-isolation-trials, and more');
            
            return true;
              } catch (error) {
            console.error('❌ Chrome verification failed:', error.message);
            return false;
        }
    }
}

module.exports = ChromeDownloader;