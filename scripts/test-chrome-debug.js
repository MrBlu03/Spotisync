#!/usr/bin/env node

/**
 * Test script for Chrome Debug Service and Cookie Monitor
 * 
 * This script tests the enhanced cookie extraction and monitoring system:
 * 1. Launches Chrome with debugging enabled
 * 2. Monitors cookie health and extraction
 * 3. Tests automatic cookie refresh
 * 4. Verifies cookie storage and usage
 */

const CookieMonitorService = require('../src/services/cookieMonitorService');
const path = require('path');
const fs = require('fs');

async function testChromeDebugService() {
    console.log('🧪 Testing Chrome Debug Service...\n');
    
    const cookieMonitor = new CookieMonitorService();
    
    // Setup test event handlers
    cookieMonitor.on('statusChanged', (status) => {
        console.log(`📊 Status changed: ${status}`);
    });
    
    cookieMonitor.on('notification', (notification) => {
        console.log(`📢 ${notification.type.toUpperCase()}: ${notification.message}`);
    });
    
    try {
        console.log('🚀 Starting Cookie Monitor Service...');
        const started = await cookieMonitor.start();
        
        if (started) {
            console.log('✅ Cookie Monitor Service started successfully!');
            console.log('🌐 Chrome should now be opening with YouTube Music...');
            console.log('📝 Check the Chrome window and oauth.json file for changes.\n');
            
            // Show detailed status every 30 seconds
            const statusInterval = setInterval(async () => {
                const detailedStatus = cookieMonitor.getDetailedStatus();
                const extractionStatus = await cookieMonitor.getCookieExtractionStatus();
                
                console.log('\n📊 Current Status:');
                console.log('------------------');
                console.log(`Service Status: ${detailedStatus.status}`);
                console.log(`Running: ${detailedStatus.isRunning}`);
                console.log(`Errors: ${detailedStatus.errorCount}/${detailedStatus.maxRetries}`);
                console.log(`Last Update: ${detailedStatus.lastUpdate || 'Never'}`);
                
                if (extractionStatus.isRunning) {
                    console.log('\n🍪 Cookie Status:');
                    console.log('------------------');
                    console.log(`Status: ${extractionStatus.status}`);
                    console.log(`Cookie Count: ${extractionStatus.cookieCount || 0}`);
                    console.log(`Last Check: ${extractionStatus.lastCheck || 'Never'}`);
                    
                    if (extractionStatus.oauthFile) {
                        console.log('\n📄 OAuth File:');
                        console.log('------------------');
                        console.log(`Last Updated: ${extractionStatus.oauthFile.lastUpdated}`);
                        console.log(`Cookie Count: ${extractionStatus.oauthFile.cookieCount}`);
                        if (extractionStatus.oauthFile.metadata) {
                            console.log('Metadata:');
                            console.log(`  - Secure Cookies: ${extractionStatus.oauthFile.metadata.secureCookies}`);
                            console.log(`  - HTTP-Only Cookies: ${extractionStatus.oauthFile.metadata.httpOnlyCookies}`);
                            console.log(`  - Session Cookies: ${extractionStatus.oauthFile.metadata.sessionCookies}`);
                            console.log(`  - Persistent Cookies: ${extractionStatus.oauthFile.metadata.persistentCookies}`);
                        }
                    }
                }
                
                // Show recent health checks
                if (detailedStatus.healthChecks.length > 0) {
                    console.log('\n🔍 Recent Health Checks:');
                    console.log('------------------');
                    detailedStatus.healthChecks.slice(0, 3).forEach(check => {
                        console.log(`[${check.timestamp}] ${check.status.toUpperCase()}: ${check.message}`);
                    });
                }
                
                console.log('\n');
            }, 30000);
            
            // Test manual operations after 1 minute
            setTimeout(async () => {
                console.log('\n🔄 Testing manual cookie refresh...');
                const refreshResult = await cookieMonitor.refreshCookies();
                console.log(`Refresh result: ${refreshResult.success ? 'Success' : 'Failed'} - ${refreshResult.message || refreshResult.error}`);
            }, 60000);
            
            // Test cookie extraction after 2 minutes
            setTimeout(async () => {
                console.log('\n🍪 Testing cookie extraction...');
                const extractionStatus = await cookieMonitor.getCookieExtractionStatus();
                console.log('Extraction status:', extractionStatus);
                
                // Verify oauth.json
                const oauthPath = path.join(process.cwd(), 'oauth.json');
                if (fs.existsSync(oauthPath)) {
                    const oauthData = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
                    console.log('\n📄 OAuth File Verification:');
                    console.log('------------------');
                    console.log(`File exists: Yes`);
                    console.log(`Last updated: ${oauthData.lastUpdated}`);
                    console.log(`Cookie count: ${oauthData.cookieCount}`);
                    console.log(`Auto-refreshed: ${oauthData.autoRefreshed ? 'Yes' : 'No'}`);
                    if (oauthData.cookieMetadata) {
                        console.log('Cookie metadata:');
                        Object.entries(oauthData.cookieMetadata).forEach(([key, value]) => {
                            console.log(`  - ${key}: ${value}`);
                        });
                    }
                } else {
                    console.log('❌ OAuth file not found');
                }
            }, 120000);
            
            // Instructions for user
            console.log('\n📋 Test Instructions:');
            console.log('------------------');
            console.log('1. A Chrome window should have opened with YouTube Music');
            console.log('2. If not logged in, please log into YouTube Music manually');
            console.log('3. Watch the console for automatic cookie updates');
            console.log('4. Check the oauth.json file for cookie updates');
            console.log('5. The test will run for 3 minutes');
            console.log('6. Press Ctrl+C to stop the test early\n');
            
            // Handle graceful shutdown
            process.on('SIGINT', async () => {
                console.log('\n🛑 Stopping Chrome Debug Service...');
                clearInterval(statusInterval);
                await cookieMonitor.stop();
                console.log('✅ Test completed');
                process.exit(0);
            });
            
            // Auto-stop after 3 minutes
            setTimeout(async () => {
                console.log('\n⏰ Test duration completed');
                clearInterval(statusInterval);
                await cookieMonitor.stop();
                console.log('✅ Test completed successfully');
                process.exit(0);
            }, 180000);
            
        } else {
            console.error('❌ Failed to start Cookie Monitor Service');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Check if oauth.json exists
const oauthPath = path.join(process.cwd(), 'oauth.json');

if (!fs.existsSync(oauthPath)) {
    console.log('⚠️ Warning: oauth.json not found');
    console.log('The Chrome Debug Service will create one automatically when you log in.');
    console.log('');
}

// Start the test
testChromeDebugService().catch(console.error);
