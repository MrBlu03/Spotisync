console.log('🧪 Starting Simple Cookie Test...');

try {
    const ChromeDebugService = require('../src/services/chromeDebugService.js');
    console.log('✅ ChromeDebugService imported successfully');
    
    const CookieMonitorService = require('../src/services/cookieMonitorService.js');
    console.log('✅ CookieMonitorService imported successfully');
    
    const fs = require('fs');
    console.log('✅ fs module loaded');
    
    // Test oauth.json reading
    const oauthData = JSON.parse(fs.readFileSync('oauth.json', 'utf8'));
    console.log('✅ oauth.json read successfully');
    console.log(`   Last Updated: ${oauthData.lastUpdated}`);
    console.log(`   Cookie Count: ${oauthData.cookieCount}`);
    console.log(`   Has Cookie: ${oauthData.cookie ? 'YES' : 'NO'}`);
    
    console.log('\n🚀 Creating services...');
    const cookieMonitor = new CookieMonitorService();
    console.log('✅ CookieMonitorService created');
    
    const chromeDebug = new ChromeDebugService(cookieMonitor);
    console.log('✅ ChromeDebugService created');
    
    console.log('\n✅ All checks passed! Starting actual test...');
    
    // Now run the actual test
    runActualTest(chromeDebug, cookieMonitor);
    
} catch (error) {
    console.error('❌ Error in simple test:', error);
    console.error('Stack:', error.stack);
}

async function runActualTest(chromeDebug, cookieMonitor) {
    try {
        console.log('\n🚀 Starting Chrome Debug Service...');
        await chromeDebug.start();
        
        console.log('\n📱 Please log into YouTube Music in the Chrome window');
        console.log('⏰ Waiting for login detection and cookie extraction...');
        
        // Listen for events
        chromeDebug.on('cookiesExtracted', (data) => {
            console.log('🎉 COOKIES EXTRACTED!', data);
        });
        
        chromeDebug.on('oauthUpdated', (data) => {
            console.log('🎉 OAUTH UPDATED!', data);
            console.log('\n✅ SUCCESS! Cookies have been extracted and saved!');
            process.exit(0);
        });
        
        chromeDebug.on('error', (error) => {
            console.error('❌ Error:', error.message);
        });
        
        // Keep alive
        setInterval(() => {
            console.log('🔄 Still waiting for cookie extraction...');
        }, 30000);
        
    } catch (error) {
        console.error('❌ Error in actual test:', error);
    }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n👋 Exiting...');
    process.exit(0);
});
