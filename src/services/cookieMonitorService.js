/**
 * Cookie Monitor Service - Background Service for Auto Cookie Management
 * 
 * This service manages the overall cookie monitoring system:
 * - Integrates with Chrome Debug Service
 * - Provides status updates and notifications
 * - Handles recovery from failures
 * - Exposes API endpoints for manual control
 */

const EventEmitter = require('events');
const ChromeDebugService = require('./chromeDebugService');
const path = require('path');
const fs = require('fs');

class CookieMonitorService extends EventEmitter {
    constructor() {
        super();
        this.chromeService = null;
        this.status = 'stopped';
        this.lastUpdate = null;
        this.errorCount = 0;
        this.maxRetries = 3;
        this.notifications = [];
        this.maxNotifications = 10;
        this.cookieHealthChecks = [];
        this.maxHealthChecks = 10;
        
        console.log('🔍 Cookie Monitor Service initialized');
    }

    /**
     * Start the cookie monitoring system
     */
    async start() {
        try {
            console.log('🚀 Starting Cookie Monitor Service...');
            
            if (this.chromeService) {
                console.log('⚠️ Cookie Monitor Service already running');
                return true;
            }
            
            // Initialize Chrome Debug Service
            this.chromeService = new ChromeDebugService();
            this.setupEventHandlers();
            
            // Start Chrome debugging
            const started = await this.chromeService.start();
            
            if (started) {
                this.status = 'running';
                this.lastUpdate = new Date().toISOString();
                this.errorCount = 0;
                
                this.addNotification('success', 'Cookie monitoring started successfully');
                console.log('✅ Cookie Monitor Service started');
                
                this.emit('started');
                return true;
            } else {
                throw new Error('Failed to start Chrome Debug Service');
            }
            
        } catch (error) {
            console.error('❌ Failed to start Cookie Monitor Service:', error);
            if (error && error.stack) {
                console.error('Stack trace:', error.stack);
            }
            this.status = 'error';
            this.addNotification('error', `Failed to start: ${error.message}`);
            this.emit('error', error);
            return false;
        }
    }

    /**
     * Setup event handlers for Chrome Debug Service
     */
    setupEventHandlers() {
        this.chromeService.on('cookiesHealthy', () => {
            this.status = 'healthy';
            this.lastUpdate = new Date().toISOString();
            this.errorCount = 0;
            this.addNotification('success', 'Cookies are healthy');
            this.addHealthCheck('healthy', 'All cookies present and valid');
            console.log('✅ Cookies are healthy');
        });

        this.chromeService.on('cookiesExpired', (data) => {
            this.status = 'cookies_expired';
            this.lastUpdate = new Date().toISOString();
            this.errorCount++;
            
            const issues = [];
            if (data.missingCookies?.length > 0) {
                issues.push(`Missing: ${data.missingCookies.join(', ')}`);
            }
            if (data.expiringCookies?.length > 0) {
                issues.push(`Expiring: ${data.expiringCookies.join(', ')}`);
            }
            
            this.addNotification('warning', `Cookie issues: ${issues.join('; ')}`);
            this.addHealthCheck('warning', issues.join('; '));
            console.log('⚠️ Cookies expired, attempting refresh...');
        });

        this.chromeService.on('cookiesExtracted', (data) => {
            this.status = 'extracted';
            this.lastUpdate = new Date().toISOString();
            this.errorCount = 0;
            this.addNotification('success', `Successfully extracted ${data.cookieCount} cookies`);
            this.addHealthCheck('extracted', `Extracted ${data.cookieCount} cookies`);
            console.log(`✅ Extracted ${data.cookieCount} cookies`);
        });

        this.chromeService.on('cookieExtractionFailed', (data) => {
            this.status = 'extraction_failed';
            this.lastUpdate = new Date().toISOString();
            this.errorCount++;
            this.addNotification('error', `Failed to extract cookies: ${data.missingCookies.join(', ')}`);
            this.addHealthCheck('error', `Extraction failed: ${data.missingCookies.join(', ')}`);
            console.log('❌ Cookie extraction failed');
        });

        this.chromeService.on('sessionRefreshed', () => {
            this.status = 'refreshed';
            this.lastUpdate = new Date().toISOString();
            this.errorCount = 0;
            this.addNotification('success', 'Session refreshed successfully');
            this.addHealthCheck('refreshed', 'Session refreshed');
            console.log('✅ Session refreshed successfully');
        });

        this.chromeService.on('loginRequired', () => {
            this.status = 'login_required';
            this.lastUpdate = new Date().toISOString();
            this.errorCount++;
            this.addNotification('error', 'User login required - please check Chrome window');
            this.addHealthCheck('error', 'Login required');
            console.log('🔐 User login required');
        });

        this.chromeService.on('heartbeat', () => {
            this.addHealthCheck('heartbeat', 'Session heartbeat completed');
            console.log('💓 Session heartbeat completed');
        });

        this.chromeService.on('oauthUpdated', (data) => {
            const metadata = data.metadata || {};
            const details = [
                `Updated ${data.cookieCount} cookies`,
                `${metadata.secureCookies} secure cookies`,
                `${metadata.persistentCookies} persistent cookies`
            ].join(', ');
            
            this.addNotification('info', details);
            this.addHealthCheck('updated', details);
            console.log(`💾 OAuth file updated: ${details}`);
        });

        this.chromeService.on('error', (error) => {
            this.errorCount++;
            this.addNotification('error', `System error: ${error.message}`);
            this.addHealthCheck('error', error.message);
            console.error('❌ System error:', error);
        });

        this.chromeService.on('loginDetected', (data) => {
            this.status = 'logged_in';
            this.lastUpdate = new Date().toISOString();
            this.errorCount = 0;
            this.addNotification('success', `Login detected! Found auth cookies: ${data.authCookies.join(', ')}`);
            this.addHealthCheck('logged_in', `User logged in successfully`);
            console.log('🎉 User login detected - cookie extraction started');
        });
    }

    /**
     * Stop the cookie monitoring service
     */
    async stop() {
        try {
            console.log('🛑 Stopping Cookie Monitor Service...');
            
            if (this.chromeService) {
                await this.chromeService.stop();
                this.chromeService = null;
            }
            
            this.status = 'stopped';
            this.lastUpdate = new Date().toISOString();
            
            this.addNotification('info', 'Cookie monitoring stopped');
            console.log('✅ Cookie Monitor Service stopped');
            
            this.emit('stopped');
            
        } catch (error) {
            console.error('❌ Error stopping Cookie Monitor Service:', error);
            this.emit('error', error);
        }
    }

    /**
     * Restart the service
     */
    async restart() {
        console.log('🔄 Restarting Cookie Monitor Service...');
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        await this.start();
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isRunning: this.chromeService?.isRunning || false,
            status: this.status,
            lastUpdate: this.lastUpdate,
            errorCount: this.errorCount,
            maxRetries: this.maxRetries,
            notifications: this.notifications.slice(-10), // Last 10 notifications
            chromeService: this.chromeService ? 'connected' : 'disconnected'
        };
    }

    /**
     * Get detailed cookie status from Chrome service
     */
    async getCookieStatus() {
        if (!this.chromeService) {
            return { status: 'service_not_running' };
        }
        
        return await this.chromeService.getCookieStatus();
    }

    /**
     * Manually trigger cookie refresh
     */
    async refreshCookies() {
        try {
            if (!this.chromeService) {
                throw new Error('Chrome Debug Service not running');
            }
            
            console.log('🔄 Manual cookie refresh requested...');
            await this.chromeService.refreshSession();
            
            this.addNotification('info', 'Manual cookie refresh completed');
            return { success: true, message: 'Cookie refresh initiated' };
            
        } catch (error) {
            console.error('❌ Manual cookie refresh failed:', error);
            this.addNotification('error', `Manual refresh failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Force check cookie health
     */
    async checkCookieHealth() {
        try {
            if (!this.chromeService) {
                throw new Error('Chrome Debug Service not running');
            }
            
            console.log('🔍 Manual cookie health check requested...');
            await this.chromeService.checkCookieHealth();
            
            return { success: true, message: 'Cookie health check completed' };
            
        } catch (error) {
            console.error('❌ Manual cookie health check failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add a notification to the notification queue
     */
    addNotification(type, message) {
        const notification = {
            type, // 'success', 'warning', 'error', 'info'
            message,
            timestamp: new Date().toISOString()
        };
        
        this.notifications.push(notification);
        
        // Keep only last 50 notifications
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(-50);
        }
        
        this.emit('notification', notification);
    }

    /**
     * Get recent notifications
     */
    getNotifications(count = 10) {
        return this.notifications.slice(-count);
    }

    /**
     * Clear notifications
     */
    clearNotifications() {
        this.notifications = [];
        console.log('🧹 Notifications cleared');
    }

    /**
     * Add a health check record
     */
    addHealthCheck(status, message) {
        const check = {
            timestamp: new Date().toISOString(),
            status,
            message
        };
        
        this.cookieHealthChecks.unshift(check);
        
        // Keep only the last N health checks
        if (this.cookieHealthChecks.length > this.maxHealthChecks) {
            this.cookieHealthChecks = this.cookieHealthChecks.slice(0, this.maxHealthChecks);
        }
    }

    /**
     * Get detailed cookie health status
     */
    getDetailedStatus() {
        return {
            status: this.status,
            lastUpdate: this.lastUpdate,
            errorCount: this.errorCount,
            maxRetries: this.maxRetries,
            notifications: this.notifications,
            healthChecks: this.cookieHealthChecks,
            isRunning: this.chromeService?.isRunning || false
        };
    }

    /**
     * Get cookie extraction status
     */
    async getCookieExtractionStatus() {
        try {
            if (!this.chromeService?.isRunning) {
                return {
                    status: 'not_running',
                    message: 'Chrome Debug Service is not running'
                };
            }

            const cookieStatus = await this.chromeService.getCookieStatus();
            const oauthPath = path.join(process.cwd(), 'oauth.json');
            
            let oauthData = null;
            if (fs.existsSync(oauthPath)) {
                oauthData = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
            }

            return {
                status: cookieStatus.status,
                cookieCount: cookieStatus.cookieCount,
                lastCheck: cookieStatus.lastCheck,
                oauthFile: oauthData ? {
                    lastUpdated: oauthData.lastUpdated,
                    cookieCount: oauthData.cookieCount,
                    metadata: oauthData.cookieMetadata
                } : null,
                isRunning: true
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                isRunning: this.chromeService?.isRunning || false
            };
        }
    }
}

module.exports = CookieMonitorService;
