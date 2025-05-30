const ChromeDebugService = require('../src/services/chromeDebugService.js');
const CookieMonitorService = require('../src/services/cookieMonitorService.js');
const fs = require('fs');

async function testCookieExtraction() {
    console.log('🧪 Testing CRITICAL Cookie Extraction...');
    
    // Show current oauth.json status
    console.log('\n📄 BEFORE - Current oauth.json status:');
    try {
        const beforeData = JSON.parse(fs.readFileSync('oauth.json', 'utf8'));
        console.log(`   Last Updated: ${beforeData.lastUpdated || 'Unknown'}`);
        console.log(`   Cookie Count: ${beforeData.cookieCount || 0}`);
        console.log(`   Has Cookie String: ${beforeData.cookie ? 'YES' : 'NO'}`);
        if (beforeData.cookie) {
            console.log(`   Cookie Length: ${beforeData.cookie.length} characters`);
        }
    } catch (error) {
        console.log('   ❌ Error reading oauth.json:', error.message);
    }
    
    // Initialize services
    const cookieMonitor = new CookieMonitorService();
    const chromeDebug = new ChromeDebugService(cookieMonitor);
    
    // Set up event listeners to track progress
    chromeDebug.on('cookiesExtracted', (data) => {
        console.log('🎉 EVENT: Cookies extracted successfully!', data);
    });
    
    chromeDebug.on('oauthUpdated', (data) => {
        console.log('🎉 EVENT: OAuth file updated!', data);
    });
    
    chromeDebug.on('error', (error) => {
        console.error('❌ EVENT: Error occurred:', error.message);
    });
    
    console.log('\n🚀 Starting Chrome Debug Service...');
    await chromeDebug.start();
    
    console.log('\n📱 CRITICAL COOKIE EXTRACTION TEST:');
    console.log('===============================================');
    console.log('1. 🌐 Chrome window should open with YouTube Music');
    console.log('2. 🔑 If not logged in, please log in now');
    console.log('3. ⏰ System will detect login and extract cookies');
    console.log('4. 💾 Cookies MUST be saved to oauth.json');
    console.log('5. ✋ Press Ctrl+C after you see success messages');
    console.log('===============================================');
    
    // Wait for user to be logged in and cookies extracted
    let extractionCompleted = false;
    let checkCount = 0;
    const maxChecks = 60; // Wait up to 10 minutes
    
    const checkInterval = setInterval(async () => {
        checkCount++;
        console.log(`\n🔍 Check ${checkCount}/${maxChecks} - Monitoring extraction progress...`);
        
        // Check if oauth.json was updated
        try {
            const currentData = JSON.parse(fs.readFileSync('oauth.json', 'utf8'));
            const currentTime = new Date();
            const lastUpdate = new Date(currentData.lastUpdated);
            const timeDiff = currentTime - lastUpdate;
            
            // If updated within the last 2 minutes, consider it fresh
            if (timeDiff < 120000) {
                console.log('✅ FRESH COOKIES DETECTED!');
                console.log(`   Updated: ${currentData.lastUpdated}`);
                console.log(`   Cookie Count: ${currentData.cookieCount}`);
                console.log(`   Cookie Length: ${currentData.cookie ? currentData.cookie.length : 0} characters`);
                
                extractionCompleted = true;
                clearInterval(checkInterval);
                
                console.log('\n🎉 SUCCESS! Cookie extraction completed!');
                console.log('✅ oauth.json has been updated with fresh cookies');
                console.log('✅ Spotisync should now work properly');
                
                // Stop the service
                await chromeDebug.stop();
                return;
            }
        } catch (error) {
            console.warn('⚠️ Error reading oauth.json:', error.message);
        }
        
        if (checkCount >= maxChecks) {
            console.error('❌ TIMEOUT: Cookie extraction did not complete within 10 minutes');
            clearInterval(checkInterval);
            await chromeDebug.stop();
        }
    }, 10000); // Check every 10 seconds
    
    // Keep the process alive
    process.on('SIGINT', async () => {
        console.log('\n🛑 Manual stop requested...');
        clearInterval(checkInterval);
        await chromeDebug.stop();
        
        // Final check
        console.log('\n📄 FINAL STATUS:');
        try {
            const finalData = JSON.parse(fs.readFileSync('oauth.json', 'utf8'));
            console.log(`   Last Updated: ${finalData.lastUpdated}`);
            console.log(`   Cookie Count: ${finalData.cookieCount}`);
            console.log(`   Has Fresh Cookies: ${finalData.cookie && finalData.cookie.length > 1000 ? 'YES ✅' : 'NO ❌'}`);
        } catch (error) {
            console.log('   ❌ Error reading final oauth.json:', error.message);
        }
        
        process.exit(0);
    });
}

testCookieExtraction().catch(console.error);
