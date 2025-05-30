/**
 * Chrome Debug Service - Auto Cookie Refresh System
 * 
 * This service implements the Chrome debugging integration from the TODO list:
 * - Launches Chrome with debugging enabled (but looks like a normal browser)
 * - Monitors YouTube Music cookies
 * - Automatically refreshes authentication when needed
 * - Keeps session alive with periodic interactions
 */

const chromeLauncher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ChromeDebugService extends EventEmitter {    constructor() {
        super();
        this.chrome = null;
        this.client = null;
        this.isRunning = false;
        this.isLoggedIn = false;
        this.cookieCheckInterval = null;
        this.heartbeatInterval = null;
        this.loginDetectionInterval = null;
        this.cookieExpiryThreshold = 8 * 60 * 1000; // 8 minutes
        this.checkInterval = 5 * 60 * 1000; // Check every 5 minutes
        this.heartbeatInterval_duration = 30 * 60 * 1000; // Heartbeat every 30 minutes
        this.tabId = null;
        this.cookieExtractionAttempts = 0;
        this.maxExtractionAttempts = 5;
        this.extractionRetryDelay = 5000; // 5 seconds
        
        // Transfer state protection variables
        this.transferInProgress = false;
        this.transferStartTime = null;
        this.maxTransferDuration = 30 * 60 * 1000; // 30 minutes max transfer time
        
        // Important cookies for YouTube Music authentication
        this.importantCookies = [
            'VISITOR_INFO1_LIVE',
            'LOGIN_INFO',
            'HSID',
            'SSID',
            'APISID',
            'SAPISID',
            'SID',
            '__Secure-1PSID',
            '__Secure-3PAPISID',
            '__Secure-3PSID',
            '__Secure-1PAPISID',
            'SIDCC',
            'SOCS'
            // Removed 'CONSENT' as it's not always present and not critical for API functionality
        ];
        
        console.log('🤖 Chrome Debug Service initialized');
    }

    /**
     * Helper function to wait/delay execution
     * @param {number} ms - Milliseconds to wait
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }    /**
     * Start the Chrome debugging service
     */
    async start() {
        try {
            console.log('🚀 Starting Chrome Debug Service...');
            
            // Launch Chrome with debugging enabled
            await this.startChrome();
            
            // Connect to Chrome DevTools
            await this.connectToDebugger();
            
            // Open YouTube Music and navigate to it
            await this.openYouTubeMusic();
            
            // Start monitoring (including login detection)
            this.startMonitoring();
            
            this.isRunning = true;
            console.log('✅ Chrome Debug Service started successfully');
            this.emit('started');
            
            return true;
        } catch (error) {
            console.error('❌ Failed to start Chrome Debug Service:', error);
            // await this.cleanup();
            this.emit('error', error);
            throw error;
        }
    }/**
     * Launch Chrome with debugging flags (as per TODO list)
     */
    async startChrome() {
        console.log('🌐 Launching Chrome with debugging flags...');
        const debugPort = 9222;
        const chromeFlags = [
            `--remote-debugging-port=${debugPort}`,
            '--no-first-run',                // Skip first run dialogs
            '--no-default-browser-check',    // Don't ask to be default browser
            '--disable-blink-features=AutomationControlled', // Critical: remove automation flag
            '--allow-running-insecure-content', // Allow all content
            '--disable-web-security',        // Disable CORS and other security
            '--ignore-certificate-errors',   // Ignore SSL errors
            '--start-maximized',             // Start with a maximized window (looks natural)
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', // Standard user agent
            '--disable-features=IsolateOrigins', // Fix for login issues
            '--disable-blink-features',      // More security reductions
            '--disable-site-isolation-trials', // Disable site isolation
            '--flag-switches-begin',         // Begin flag switches
            '--flag-switches-end',           // End flag switches
            '--metrics-recording-only',      // Don't send metrics
            '--enable-automation',           // Enables CDP but Google can detect this
            '--password-store=basic',        // Basic password store
            '--use-mock-keychain'            // Mock keychain
        ];

        console.log('🔧 Launching a completely normal-looking Chrome browser...');
        
        // Launch Chrome with chrome-launcher
        this.chrome = await chromeLauncher.launch({
            chromeFlags: chromeFlags,
            userDataDir: path.join(process.cwd(), 'chrome-data'),
            startingUrl: 'https://music.youtube.com',
            ignoreDefaultFlags: true,  // Don't add default automation flags
            handleSIGINT: false,       // We'll handle process signals
            port: debugPort            // Explicitly set port
        });

        console.log(`✅ Chrome launched successfully on port ${debugPort} (looks like a regular browser)`);
    }

    /**
     * Connect to Chrome DevTools Protocol
     */
    async connectToDebugger() {
        console.log('🔗 Connecting to Chrome DevTools...');
        const debugPort = 9222;
        let attempts = 0;
        const maxAttempts = 10;
        const delayMs = 500;
        while (attempts < maxAttempts) {
            try {
                this.client = await CDP({ port: debugPort });
                await this.client.Page.enable();
                await this.client.Runtime.enable();
                await this.client.Network.enable();
                console.log('✅ Connected to Chrome DevTools');

                return;
            } catch (error) {
                attempts++;
                if (attempts >= maxAttempts) {
                    console.error('❌ Failed to connect to Chrome DevTools after multiple attempts:', error);
                    throw error;
                }
                await this.delay(delayMs);
            }
        }
    }

    /**
     * Open YouTube Music tab and keep it alive
     */
    async openYouTubeMusic() {
        console.log('🎵 Opening YouTube Music...');

        try {
            // Navigate to YouTube Music
            await this.client.Page.navigate({ url: 'https://music.youtube.com' });

            // Wait for page to load network activity to idle
            await this.client.Page.loadEventFired(); // Initial load event
            // await this.client.Network.idle(); // REMOVED: This method does not exist.
            
            console.log('✅ YouTube Music opened successfully');

            // Wait a bit for the page to fully render and potential banners to appear
            await this.delay(7000); // Increased delay slightly to 7 seconds

            // Attempt to dismiss potential cookie/privacy banners
            // Look for common buttons like "Accept", "Agree", etc. within common dialog elements
            console.log('🖱️ Attempting to dismiss potential consent banner...');
            const consentButtonSelectors = [
                'button.yt-spec-button-shape-next[aria-label*="Accept"][aria-label*="cookies"]', // Example common selectors
                'button[aria-label*="Agree"][aria-label*="terms"]',
                'tp-yt-paper-button[aria-label*="Accept"]',
                'button:contains("Accept all")', // Using :contains (might need evaluate)
                'button:contains("I agree")',
                 // Adding a more general selector for buttons within potential dialogs
                'ytmusic-consent-box button',
                 '#consent-dialog button'
            ];

            let consentDismissed = false;
            for (const selector of consentButtonSelectors) {
                try {
                     // Use evaluate to find and click the element if exists
                     const result = await this.client.Runtime.evaluate({
                         expression: `
                             const button = document.querySelector('${selector}');
                             if (button) {
                                 button.click();
                                 true; // Return true if clicked
                             } else {
                                 false; // Return false if not found
                             }
                         `,
                         awaitPromise: true // Wait for the click event to potentially complete
                     });

                     if (result.result.value === true) {
                         console.log(`✅ Consent banner dismissed using selector: ${selector}`);
                         consentDismissed = true;
                         await this.delay(2000); // Wait a bit after clicking
                         break; // Stop after the first successful click
                     }

                 } catch (selectorError) {
                     // Ignore errors for individual selectors or if selector is invalid in evaluate context
                     // console.log(`🤷‍♂️ Selector "${selector}" did not work or caused error: ${selectorError.message}`);
                 }
            }

            if (!consentDismissed) {
                 console.log('⚠️ No obvious consent banner dismissed or selectors did not match.');
            }

            // Show manual login instructions
            this.showLoginInstructions();

        } catch (error) {
            console.error('❌ Failed to open YouTube Music:', error);
            throw error;
        }
    }    /**
     * Show instructions for manual login
     */
    showLoginInstructions() {
        console.log('');
        console.log('🔐 MANUAL LOGIN INSTRUCTIONS:');
        console.log('==========================================');
        console.log('✅ Chrome is now open with YouTube Music');
        console.log('📍 1. Switch to the Chrome window that opened');
        console.log('📍 2. Click "Sign in" if you see it');
        console.log('📍 3. Complete the Google sign-in process normally');
        console.log('📍 4. This should work like a regular browser now!');
        console.log('📍 5. Keep the Chrome window open');
        console.log('');
        console.log('⏰ The system will automatically detect when you login');
        console.log('🍪 Once logged in, cookies will be extracted automatically');
        console.log('💾 Your oauth.json file will be updated automatically');
        console.log('👁️ You can watch this console for login detection');
        console.log('==========================================');
        console.log('');
    }/**
     * Start monitoring cookies and session health
     */
    startMonitoring() {
        console.log('👁️ Starting cookie and session monitoring...');
        
        // Start with login detection (check every 10 seconds initially)
        this.loginDetectionInterval = setInterval(async () => {
            await this.checkForSuccessfulLogin();
        }, 10000);
        
        // Cookie health check every 5 minutes (only after login)
        this.cookieCheckInterval = setInterval(async () => {
            await this.checkCookieHealth();
        }, this.checkInterval);
        
        // Keep session alive with periodic interactions every 30 minutes
        this.heartbeatInterval = setInterval(async () => {
            await this.performHeartbeat();
        }, this.heartbeatInterval_duration);
        
        console.log('✅ Monitoring started - waiting for user login...');
    }

    /**
     * Check for successful login by detecting authentication cookies
     */
    async checkForSuccessfulLogin() {
        try {
            // Skip if already logged in
            if (this.isLoggedIn) {
                return;
            }
            
            console.log('🔍 Checking for successful login...');
            
            // Get all cookies from YouTube Music domain
            const cookies = await this.client.Network.getCookies({ 
                domain: 'music.youtube.com',
                urls: ['https://music.youtube.com/*']
            });
            
            // Check for key authentication cookies that indicate successful login
            const authCookies = ['LOGIN_INFO', 'SID', '__Secure-1PSID', '__Secure-3PSID'];
            const foundAuthCookies = authCookies.filter(name => 
                cookies.cookies.find(cookie => cookie.name === name && cookie.value && cookie.value.length > 10)
            );
            
            // Also check if we're still on a login page
            const loginRequired = await this.checkIfLoginRequired();
            
            if (foundAuthCookies.length >= 2 && !loginRequired) {
                console.log('🎉 Login detected! Found authentication cookies:', foundAuthCookies.join(', '));
                this.isLoggedIn = true;
                
                // Stop login detection
                if (this.loginDetectionInterval) {
                    clearInterval(this.loginDetectionInterval);
                    this.loginDetectionInterval = null;
                }
                
                // Now extract and save cookies
                console.log('🍪 Extracting cookies after successful login...');
                const success = await this.extractCookies();
                
                if (success) {
                    console.log('✅ Cookie extraction and oauth.json update completed!');
                    this.emit('loginDetected', { authCookies: foundAuthCookies });
                } else {
                    console.warn('⚠️ Login detected but cookie extraction failed');
                }
                
            } else {
                console.log('⏳ User not logged in yet. Found auth cookies:', foundAuthCookies.length, '| Login required:', loginRequired);
            }
            
        } catch (error) {
            console.error('❌ Error checking for login:', error);
            // Don't emit error for login detection failures
        }
    }    /**
     * Enhanced cookie extraction with retry logic
     */
    async extractCookies() {
        try {            console.log('🍪 Attempting to extract cookies...');
            console.log('⏳ Ensuring page is ready...');
            
            // Instead of waiting for loadEventFired, just add a small delay
            // The page is already loaded since we detected login cookies
            await this.delay(2000);
            
            console.log('🌐 Getting cookies from YouTube Music domain...');
            // Get all cookies from YouTube Music domain
            const cookies = await this.client.Network.getCookies({ 
                domain: 'music.youtube.com',
                urls: ['https://music.youtube.com/*']
            });
            
            console.log(`📊 Retrieved ${cookies.cookies.length} cookies total`);
            
            // Log important cookies found
            const foundImportant = this.importantCookies.filter(name => 
                cookies.cookies.find(cookie => cookie.name === name)
            );
            console.log('🔑 Found important cookies:', foundImportant.join(', '));
            
            // Validate cookie presence
            const missingCookies = this.importantCookies.filter(name => 
                !cookies.cookies.find(cookie => cookie.name === name)
            );
            
            if (missingCookies.length > 0) {
                console.warn('⚠️ Missing important cookies:', missingCookies.join(', '));
                
                // Retry logic for cookie extraction
                if (this.cookieExtractionAttempts < this.maxExtractionAttempts) {
                    this.cookieExtractionAttempts++;
                    console.log(`🔄 Retry attempt ${this.cookieExtractionAttempts}/${this.maxExtractionAttempts}...`);
                    
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, this.extractionRetryDelay));
                    
                    // Refresh the page and try again
                    console.log('🔄 Refreshing page and retrying...');
                    await this.client.Page.reload();
                    return this.extractCookies();
                } else {
                    console.error('❌ Max cookie extraction attempts reached');
                    this.emit('cookieExtractionFailed', { missingCookies });
                    return false;
                }
            }
            
            // Reset extraction attempts on success
            this.cookieExtractionAttempts = 0;
            
            console.log('💾 Updating oauth.json with fresh cookies...');
            // Update oauth.json with fresh cookies
            await this.updateOAuthFile(cookies.cookies);
            
            console.log('✅ Cookie extraction successful');
            console.log(`📈 Extracted ${cookies.cookies.length} cookies including ${foundImportant.length} important ones`);
            this.emit('cookiesExtracted', { cookieCount: cookies.cookies.length });
            return true;
            
        } catch (error) {
            console.error('❌ Error extracting cookies:', error);
            console.error('🔍 Error details:', error.message);
            console.error('📍 Stack trace:', error.stack);
            this.emit('error', error);
            return false;
        }
    }    /**
     * Enhanced cookie health check
     */
    async checkCookieHealth() {
        try {
            // Skip if user is not logged in yet
            if (!this.isLoggedIn) {
                console.log('⏭️ Skipping cookie health check - user not logged in yet');
                return;
            }
            
            // Skip if transfer is in progress
            if (this.isTransferInProgress()) {
                console.log('🔒 Skipping cookie health check - transfer in progress');
                return;
            }
            
            console.log('🔍 Checking cookie health...');
            
            // Get all cookies from YouTube Music domain
            const cookies = await this.client.Network.getCookies({ 
                domain: 'music.youtube.com',
                urls: ['https://music.youtube.com/*']
            });
            
            // Check for important authentication cookies
            const missingCookies = this.importantCookies.filter(name => 
                !cookies.cookies.find(cookie => cookie.name === name)
            );
            
            // Check cookie expiration
            const expiringCookies = cookies.cookies.filter(cookie => {
                if (!cookie.expires) return false;
                const expiryTime = cookie.expires * 1000; // Convert to milliseconds
                const timeUntilExpiry = expiryTime - Date.now();
                return timeUntilExpiry < this.cookieExpiryThreshold;
            });
            
            if (missingCookies.length > 0 || expiringCookies.length > 0) {
                const issues = [];
                if (missingCookies.length > 0) {
                    issues.push(`Missing cookies: ${missingCookies.join(', ')}`);
                }
                if (expiringCookies.length > 0) {
                    issues.push(`Expiring cookies: ${expiringCookies.map(c => c.name).join(', ')}`);
                }
                
                console.warn('⚠️ Cookie health issues:', issues.join('; '));
                this.emit('cookiesExpired', { 
                    missingCookies,
                    expiringCookies: expiringCookies.map(c => c.name)
                });
                
                // Try to refresh the page to get fresh cookies
                await this.refreshSession();
            } else {
                console.log('✅ All cookies healthy');
                // Add a log here to confirm this block is reached
                console.log('✅ Cookies are healthy, attempting to update oauth.json...');

                // Update oauth.json with fresh cookies
                await this.updateOAuthFile(cookies.cookies);
                this.emit('cookiesHealthy');
            }
            
        } catch (error) {
            console.error('❌ Error checking cookie health:', error);
            this.emit('error', error);
        }
    }

    /**
     * Perform heartbeat to keep session alive
     */
    async performHeartbeat() {
        try {
            console.log('💓 Performing session heartbeat...');
            
            // Check if page is still on YouTube Music
            const currentUrl = await this.client.Page.getNavigationHistory();
            if (!currentUrl.url.includes('music.youtube.com')) {
                console.log('🔄 Navigating back to YouTube Music...');
                await this.client.Page.navigate({ url: 'https://music.youtube.com' });
            }
            
            // Perform a light interaction to keep session alive
            try {
                // Try to click on the home button or search area
                await this.client.Page.waitForSelector('[aria-label="Search YouTube Music"], ytmusic-search-box, #search-input', { timeout: 5000 });
                  // Simulate a small mouse movement
                await this.client.Input.dispatchMouseEvent({
                    type: 'mouseMoved',
                    x: 100,
                    y: 100,
                    button: 'left',
                    clickCount: 1
                });
                await this.delay(1000);
                
                console.log('✅ Session heartbeat completed');
                this.emit('heartbeat');
                
            } catch (selectorError) {
                console.warn('⚠️ Could not find search elements, page might have changed');
                // Just refresh the page if we can't find expected elements
                await this.client.Page.reload({ waitUntil: 'networkidle2' });
            }
            
        } catch (error) {
            console.error('❌ Error performing heartbeat:', error);
            this.emit('error', error);
        }
    }

    /**
     * Refresh the session when cookies are expired
     */    async refreshSession() {
        try {
            // Skip if transfer is in progress
            if (this.isTransferInProgress()) {
                console.log('🔒 Skipping session refresh - transfer in progress');
                return;
            }

            console.log('🔄 Refreshing YouTube Music session...');
            
            // Reload the page to trigger fresh authentication
            await this.client.Page.reload({ waitUntil: 'networkidle2' });
              // Wait for page to fully load
            await this.delay(5000);
            
            // Check if we need to log in
            const loginRequired = await this.checkIfLoginRequired();
            
            if (loginRequired) {
                console.log('🔐 Login required - user intervention needed');
                this.emit('loginRequired');
            } else {
                console.log('✅ Session refreshed successfully');
                this.emit('sessionRefreshed');
            }
            
        } catch (error) {
            console.error('❌ Error refreshing session:', error);
            this.emit('error', error);
        }
    }

    /**
     * Check if login is required
     */
    async checkIfLoginRequired() {
        try {
            // Get the current URL
            const { entries } = await this.client.Page.getNavigationHistory();
            if (!entries || entries.length === 0) {
                console.warn('No navigation history available');
                return false;
            }
            
            const currentUrl = entries[0].url;
            console.log('🔍 Checking login status for URL:', currentUrl);
            
            // Check if we're on the login page
            if (currentUrl.includes('accounts.google.com/signin')) {
                console.log('🔐 Found login page URL');
                return true;
            }
            
            // Check for login button presence
            const { root } = await this.client.DOM.getDocument();
            const { nodeId } = await this.client.DOM.querySelector({
                nodeId: root.nodeId,
                selector: 'a[href*="accounts.google.com/signin"]'
            });
            
            if (nodeId) {
                console.log('🔐 Found login button');
                return true;
            }
            
            console.log('✅ No login required');
            return false;
            
        } catch (error) {
            console.warn('Could not determine login status:', error.message);
            return false;
        }
    }    /**
     * Enhanced OAuth file update with validation
     */
    async updateOAuthFile(cookies) {
        try {
            const oauthPath = path.join(process.cwd(), 'oauth.json');
            console.log('📝 Updating oauth.json at:', oauthPath);
            
            // Build cookie string and validate
            const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
            console.log('🍪 Generated cookie string length:', cookieString.length);
            
            // Validate cookie string
            if (!cookieString || cookieString.length < 100) {
                throw new Error(`Invalid cookie string generated - length: ${cookieString.length}`);
            }
            
            // Validate important cookies are present
            const importantFound = this.importantCookies.filter(name => 
                cookies.find(cookie => cookie.name === name)
            );
            console.log('✅ Important cookies in extraction:', importantFound.join(', '));
            
            // Read existing oauth data or create new
            let authData = {};
            if (fs.existsSync(oauthPath)) {
                console.log('📄 Reading existing oauth.json...');
                const existingData = fs.readFileSync(oauthPath, 'utf8');
                authData = JSON.parse(existingData);
                console.log('📄 Current cookie count:', authData.cookieCount || 0);
            } else {
                console.log('📄 Creating new oauth.json...');            }
            
            // ONLY update the cookie field - preserve exact Spotisync format
            console.log('📝 Preserving exact Spotisync oauth.json format...');
            console.log('🔄 Only updating cookie field, keeping all other fields intact');
            
            // Update ONLY the cookie field - do not add any metadata
            authData.cookie = cookieString;
            
            // Do NOT add lastUpdated, autoRefreshed, cookieCount, or cookieMetadata
            // Spotisync expects the clean HTTP headers format only
            
            console.log('✅ Cookie updated, all other fields preserved in original format');
            
            // Write back to file with backup
            const backupPath = `${oauthPath}.bak`;
            if (fs.existsSync(oauthPath)) {
                console.log('📦 Creating backup at:', backupPath);
                fs.copyFileSync(oauthPath, backupPath);
            }
            
            console.log('💾 Writing updated oauth.json...');
            fs.writeFileSync(oauthPath, JSON.stringify(authData, null, 2));
            
            // Verify the write
            const verifyData = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
            if (verifyData.cookie !== cookieString) {
                throw new Error('File verification failed - cookie string mismatch');
            }
              console.log('✅ oauth.json updated successfully');
            console.log('🎯 Spotisync format preserved - only cookie field updated');
            
            this.emit('oauthUpdated', { 
                cookieCount: cookies.length
            });
            
        } catch (error) {
            console.error('❌ Error updating oauth.json:', error);
            console.error('Stack trace:', error.stack);
            this.emit('error', error);
            
            // Restore from backup if available
            const backupPath = `${oauthPath}.bak`;
            if (fs.existsSync(backupPath)) {
                try {
                    console.log('🔄 Attempting to restore from backup...');
                    fs.copyFileSync(backupPath, oauthPath);
                    console.log('✅ Restored oauth.json from backup');
                } catch (restoreError) {
                    console.error('❌ Failed to restore oauth.json from backup:', restoreError);
                }
            }
        }
    }

    /**
     * Get current cookie status
     */
    async getCookieStatus() {
        try {
            const cookies = await this.client.Network.getCookies({ domain: 'music.youtube.com' });
            const loginRequired = await this.checkIfLoginRequired();
            
            return {
                status: loginRequired ? 'login_required' : 'healthy',
                cookieCount: cookies.cookies.length,
                lastCheck: new Date().toISOString(),
                isRunning: this.isRunning
            };
            
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                isRunning: this.isRunning
            };
        }
    }    /**
     * Stop the Chrome debugging service
     */
    async stop() {
        try {
            console.log('🛑 Stopping Chrome Debug Service...');
            
            this.isRunning = false;
            this.isLoggedIn = false;
            
            // Clear intervals
            if (this.cookieCheckInterval) {
                clearInterval(this.cookieCheckInterval);
                this.cookieCheckInterval = null;
            }
            
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }
            
            if (this.loginDetectionInterval) {
                clearInterval(this.loginDetectionInterval);
                this.loginDetectionInterval = null;
            }
            
            // Close browser
            if (this.chrome) {
                await this.chrome.kill();
                this.chrome = null;
            }
            
            console.log('✅ Chrome Debug Service stopped');
            this.emit('stopped');
            
        } catch (error) {
            console.error('❌ Error stopping Chrome Debug Service:', error);
            this.emit('error', error);
        }
    }

    /**
     * Restart the service
     */
    async restart() {
        console.log('🔄 Restarting Chrome Debug Service...');
        await this.stop();
        await this.start();
    }

    /**
     * Transfer State Protection Methods
     * These methods prevent cookie refresh during active sync operations
     */
    
    /**
     * Set transfer in progress state
     * @param {boolean} inProgress - Whether a transfer is in progress
     */
    setTransferInProgress(inProgress) {
        this.transferInProgress = inProgress;
        if (inProgress) {
            this.transferStartTime = Date.now();
            console.log('🔒 Transfer state protection activated - cookie refresh paused');
            this.emit('transferStarted');
        } else {
            this.transferStartTime = null;
            console.log('🔓 Transfer state protection deactivated - cookie refresh resumed');
            this.emit('transferEnded');
        }
    }

    /**
     * Check if a transfer is currently in progress
     * @returns {boolean} True if transfer is in progress
     */
    isTransferInProgress() {
        // Check if transfer is in progress and hasn't exceeded max duration
        if (this.transferInProgress && this.transferStartTime) {
            const elapsed = Date.now() - this.transferStartTime;
            if (elapsed > this.maxTransferDuration) {
                console.log('⚠️ Transfer exceeded maximum duration, clearing protection state');
                this.setTransferInProgress(false);
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Get transfer state information
     * @returns {object} Transfer state info
     */
    getTransferState() {
        return {
            inProgress: this.transferInProgress,
            startTime: this.transferStartTime,
            duration: this.transferStartTime ? Date.now() - this.transferStartTime : 0,
            maxDuration: this.maxTransferDuration
        };
    }
}

module.exports = ChromeDebugService;
