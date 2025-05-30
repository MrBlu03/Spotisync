#!/usr/bin/env node

/**
 * Enhanced Cookie Extraction Test
 * 
 * This script tests the new smart login detection and cookie extraction system:
 * 1. Launches Chrome and waits for user to log in
 * 2. Detects when login is successful
 * 3. Extracts cookies and updates oauth.json
 * 4. Shows real-time feedback
 */

const CookieMonitorService = require('../src/services/cookieMonitorService');
const path = require('path');
const fs = require('fs');

async function testEnhancedCookieExtraction() {
    console.log('🧪 Testing Enhanced Cookie Extraction System...\n');
    
    const cookieMonitor = new CookieMonitorService();
    
    // Enhanced event handlers with better feedback
    cookieMonitor.on('statusChanged', (status) => {
        console.log(`📊 Status changed: ${status}`);
    });
    
    cookieMonitor.on('notification', (notification) => {
        const emoji = {
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'info': 'ℹ️'
        }[notification.type] || '📢';
        
        console.log(`${emoji} ${notification.message}`);
    });
    
    // Check oauth.json before test
    const oauthPath = path.join(process.cwd(), 'oauth.json');
    console.log('\n📄 OAuth Status Before Test:');
    if (fs.existsSync(oauthPath)) {
        const beforeData = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
        console.log(`   Last Updated: ${beforeData.lastUpdated || 'Unknown'}`);
        console.log(`   Cookie Count: ${beforeData.cookieCount || 'Unknown'}`);
        console.log(`   Auto Refreshed: ${beforeData.autoRefreshed || false}`);
    } else {
        console.log('   ❌ oauth.json does not exist');
    }
    
    try {
        console.log('\n🚀 Starting Cookie Monitor Service...');
        const started = await cookieMonitor.start();
        
        if (started) {
            console.log('✅ Cookie Monitor Service started successfully!');
            console.log('🌐 Chrome should now be opening with YouTube Music...');
            console.log('\n🔐 WAITING FOR LOGIN:');
            console.log('   1. Switch to the Chrome window');
            console.log('   2. Log into YouTube Music');
            console.log('   3. Watch this console for login detection');
            console.log('   4. The test will run for 5 minutes');
            console.log('   5. Press Ctrl+C to stop early\n');
            
            // Enhanced status monitoring every 15 seconds
            const statusInterval = setInterval(async () => {
                const detailedStatus = cookieMonitor.getDetailedStatus();
                const chromeStatus = await cookieMonitor.getCookieExtractionStatus();
                
                console.log('\n📊 System Status:');
                console.log(`   Service: ${detailedStatus.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
                console.log(`   Status: ${detailedStatus.status}`);
                console.log(`   Chrome: ${chromeStatus.status}`);
                
                if (chromeStatus.oauthFile) {
                    console.log(`   OAuth Updated: ${chromeStatus.oauthFile.lastUpdated}`);
                    console.log(`   Cookie Count: ${chromeStatus.oauthFile.cookieCount}`);
                }
                
                // Check for oauth.json updates
                if (fs.existsSync(oauthPath)) {
                    const currentData = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
                    if (currentData.lastUpdated) {
                        const updateTime = new Date(currentData.lastUpdated);
                        const timeSinceUpdate = Date.now() - updateTime.getTime();
                        if (timeSinceUpdate < 60000) { // Updated within last minute
                            console.log('   🎉 oauth.json was recently updated!');
                        }
                    }
                }
                
            }, 15000);
            
            // Handle graceful shutdown
            process.on('SIGINT', async () => {
                console.log('\n🛑 Stopping test...');
                clearInterval(statusInterval);
                await cookieMonitor.stop();
                
                // Show final oauth.json status
                console.log('\n📄 OAuth Status After Test:');
                if (fs.existsSync(oauthPath)) {
                    const afterData = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
                    console.log(`   Last Updated: ${afterData.lastUpdated || 'Unknown'}`);
                    console.log(`   Cookie Count: ${afterData.cookieCount || 'Unknown'}`);
                    console.log(`   Auto Refreshed: ${afterData.autoRefreshed || false}`);
                } else {
                    console.log('   ❌ oauth.json still does not exist');
                }
                
                console.log('✅ Test completed');
                process.exit(0);
            });
            
            // Auto-stop after 5 minutes
            setTimeout(async () => {
                console.log('\n⏰ Test duration completed (5 minutes)');
                clearInterval(statusInterval);
                await cookieMonitor.stop();
                
                // Show final results
                console.log('\n📄 Final OAuth Status:');
                if (fs.existsSync(oauthPath)) {
                    const finalData = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
                    console.log(`   Last Updated: ${finalData.lastUpdated || 'Unknown'}`);
                    console.log(`   Cookie Count: ${finalData.cookieCount || 'Unknown'}`);
                    console.log(`   Auto Refreshed: ${finalData.autoRefreshed || false}`);
                    
                    if (finalData.lastUpdated) {
                        const updateTime = new Date(finalData.lastUpdated);
                        const timeSinceUpdate = Date.now() - updateTime.getTime();
                        if (timeSinceUpdate < 300000) { // Updated within last 5 minutes
                            console.log('   ✅ SUCCESS: oauth.json was updated during the test!');
                        } else {
                            console.log('   ⚠️ oauth.json was not updated during the test');
                        }
                    }
                } else {
                    console.log('   ❌ oauth.json was not created');
                }
                
                console.log('✅ Test completed successfully');
                process.exit(0);
            }, 300000); // 5 minutes
            
        } else {
            console.error('❌ Failed to start Cookie Monitor Service');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Start the test
testEnhancedCookieExtraction().catch(console.error);
