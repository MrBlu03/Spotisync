const ChromeDebugService = require('../src/services/chromeDebugService.js');
const CookieMonitorService = require('../src/services/cookieMonitorService.js');
const path = require('path');

async function testManualLogin() {
    console.log('🧪 Testing Manual Login Detection...');
    
    // Initialize services
    const cookieMonitor = new CookieMonitorService();
    const chromeDebug = new ChromeDebugService(cookieMonitor);
    
    console.log('🚀 Starting Chrome Debug Service...');
    await chromeDebug.start();
    
    console.log('\n📱 MANUAL LOGIN INSTRUCTIONS:');
    console.log('1. A Chrome window should have opened with YouTube Music');
    console.log('2. Log into your YouTube Music account');
    console.log('3. The system will automatically detect when you\'re logged in');
    console.log('4. Once detected, cookies will be extracted automatically');
    console.log('5. Press Ctrl+C when you want to stop the test\n');
    
    // Keep the process alive
    process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping test...');
        await chromeDebug.stop();
        process.exit(0);
    });
    
    // Keep alive
    setInterval(() => {
        console.log('🔄 Still monitoring... (Press Ctrl+C to stop)');
    }, 30000);
}

testManualLogin().catch(console.error);
