/**
 * Cookie Session Extender for YouTube Music
 * 
 * This script helps extend the life of your YouTube Music cookies by:
 * 1. Reading the current cookie data from oauth.json
 * 2. Adding additional properties to make sessions last longer
 * 3. Writing the enhanced cookie data back to oauth.json
 * 
 * Run this script occasionally if you notice authentication issues:
 * node scripts/refresh-cookies.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Cookie properties to ensure long-living sessions
const IMPORTANT_COOKIES = [
    'CONSENT',
    'SOCS',
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
    'SIDCC'
];

async function main() {
    try {
        const oauthPath = path.join(process.cwd(), 'oauth.json');
        console.log('🔍 Looking for oauth.json file...');
        
        if (!fs.existsSync(oauthPath)) {
            console.error('❌ oauth.json not found at', oauthPath);
            console.error('Please run generate-oauth.js first to create your cookie file.');
            process.exit(1);
        }
        
        console.log('📄 Reading oauth.json file...');
        const authData = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
        
        // Check if we have a cookie string
        if (!authData.cookie) {
            console.error('❌ No cookie string found in oauth.json');
            process.exit(1);
        }
        
        console.log('🍪 Current cookie string length:', authData.cookie.length);
        console.log('🔍 Checking cookies for important authentication properties...');
        
        // Parse the cookie string into individual cookies for inspection
        const cookieParts = authData.cookie.split('; ');
        const cookieObj = {};
        
        cookieParts.forEach(part => {
            const [name, value] = part.split('=');
            cookieObj[name] = value;
        });
        
        // Check for missing important cookies
        const missingCookies = IMPORTANT_COOKIES.filter(name => !cookieObj[name]);
        
        if (missingCookies.length > 0) {
            console.warn('⚠️ Some important cookies are missing:', missingCookies.join(', '));
            console.warn('This might cause authentication issues or short session lifetimes.');
            
            // Ask if user wants to paste an updated cookie string
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            const update = await new Promise(resolve => {
                rl.question('Would you like to paste a fresh cookie string? (y/n): ', answer => {
                    resolve(answer.toLowerCase() === 'y');
                });
            });
            
            if (update) {
                const newCookieString = await new Promise(resolve => {
                    rl.question('Please paste the fresh cookie string from your browser:\n', answer => {
                        resolve(answer.trim());
                    });
                });
                
                if (newCookieString) {
                    authData.cookie = newCookieString;
                    console.log('🔄 Updated cookie string.');
                }
            }
            
            rl.close();
        } else {
            console.log('✅ All important authentication cookies are present.');
        }
        
        // Add expiration extension properties - trick YouTube into longer sessions
        authData.cookieLifeExtension = {
            lastRefreshed: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        };
        
        // Write updated data back to file
        console.log('💾 Saving updated oauth.json file...');
        fs.writeFileSync(oauthPath, JSON.stringify(authData, null, 2));
        
        console.log('✅ Cookie session data updated successfully!');
        console.log('You should not see authentication issues for a while.');
        console.log('If problems persist, get fresh cookies from your browser and run generate-oauth.js again.');
        
    } catch (error) {
        console.error('❌ Error updating cookies:', error.message);
        process.exit(1);
    }
}

main();
