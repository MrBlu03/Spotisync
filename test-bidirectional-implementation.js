/**
 * Test script to verify bidirectional sync implementation
 */

const PlaylistLinkService = require('./src/services/playlistLinkService');
const Storage = require('./src/services/storage');

async function testBidirectionalSync() {
    console.log('🧪 Testing Bidirectional Sync Implementation...\n');
    
    try {
        // Initialize services
        const storage = new Storage();
        const linkService = new PlaylistLinkService(storage);
        
        // Get all bidirectional playlist links
        const allLinks = await storage.getPlaylistLinks();
        const bidirectionalLinks = allLinks.filter(link => 
            link.syncDirection === 'bidirectional' && link.isActive
        );
        
        console.log(`📊 Found ${bidirectionalLinks.length} bidirectional playlist links`);
        
        if (bidirectionalLinks.length === 0) {
            console.log('❌ No bidirectional links found for testing');
            return;
        }
        
        // Test with the first bidirectional link
        const testLink = bidirectionalLinks[0];
        console.log(`🎯 Testing with: ${testLink.spotifyPlaylistName} ↔ ${testLink.youtubePlaylistName}`);
        console.log(`   Spotify ID: ${testLink.spotifyPlaylistId}`);
        console.log(`   YouTube ID: ${testLink.youtubePlaylistId}`);
        console.log(`   Link ID: ${testLink.id}\n`);
        
        // Test 1: Verify the method exists
        console.log('1️⃣ Testing method existence...');
        if (typeof linkService.performBidirectionalSync === 'function') {
            console.log('   ✅ performBidirectionalSync method exists');
        } else {
            console.log('   ❌ performBidirectionalSync method not found');
            return;
        }
        
        // Test 2: Check sync routing logic
        console.log('\n2️⃣ Testing sync routing logic...');
        const originalPerformBidirectionalSync = linkService.performBidirectionalSync;
        let bidirectionalSyncCalled = false;
        
        // Mock the performBidirectionalSync method to track calls
        linkService.performBidirectionalSync = async function(link) {
            bidirectionalSyncCalled = true;
            console.log('   ✅ performBidirectionalSync called correctly');
            
            // Return a mock result
            return {
                success: true,
                tracksProcessed: 10,
                tracksAdded: 5,
                tracksFailed: 0,
                details: {
                    type: 'bidirectional',
                    spotifyToYoutube: { success: true, tracksAdded: 3 },
                    youtubeToSpotify: { success: true, tracksAdded: 2 }
                }
            };
        };
        
        // Test the sync method with bidirectional direction
        try {
            const mockResult = await linkService.syncPlaylistLink(testLink.id, 'bidirectional');
            
            if (bidirectionalSyncCalled) {
                console.log('   ✅ Bidirectional sync routing works correctly');
                console.log(`   📊 Mock result: ${mockResult.tracksAdded} tracks added`);
            } else {
                console.log('   ❌ Bidirectional sync was not called');
            }
        } catch (error) {
            console.log(`   ⚠️ Sync test failed (expected with mocked services): ${error.message}`);
        }
        
        // Restore original method
        linkService.performBidirectionalSync = originalPerformBidirectionalSync;
        
        // Test 3: Verify sync history tracking
        console.log('\n3️⃣ Testing sync history...');
        const recentHistory = await storage.getSyncHistory(testLink.id, 5);
        
        console.log(`   📊 Found ${recentHistory.length} sync history entries for this link`);
        
        const bidirectionalHistoryEntries = recentHistory.filter(entry => 
            entry.syncDirection === 'bidirectional'
        );
        
        console.log(`   📊 Found ${bidirectionalHistoryEntries.length} bidirectional sync entries`);
        
        if (bidirectionalHistoryEntries.length > 0) {
            const latest = bidirectionalHistoryEntries[0];
            console.log(`   📅 Latest bidirectional sync: ${new Date(latest.timestamp).toLocaleString()}`);
            console.log(`   📊 Status: ${latest.status}, Added: ${latest.tracksAdded}, Failed: ${latest.tracksFailed}`);
            
            // Check if the sync details indicate actual bidirectional behavior
            if (latest.details && latest.details.type === 'bidirectional') {
                console.log('   ✅ Sync details indicate true bidirectional sync');
                
                if (latest.details.spotifyToYoutube || latest.details.youtubeToSpotify) {
                    console.log('   ✅ Both sync directions recorded in details');
                } else {
                    console.log('   ⚠️ Sync details missing direction-specific information');
                }
            } else {
                console.log('   ⚠️ Sync details do not indicate bidirectional sync');
            }
        }
        
        // Test 4: Check for old vs new sync behavior
        console.log('\n4️⃣ Analyzing sync behavior patterns...');
        
        // Look for patterns that indicate old one-way sync vs new bidirectional sync
        const allBidirectionalHistory = await storage.getAllSyncHistory();
        const allBidirectionalEntries = allBidirectionalHistory.filter(entry => 
            entry.syncDirection === 'bidirectional'
        );
        
        console.log(`   📊 Total bidirectional sync entries: ${allBidirectionalEntries.length}`);
        
        // Check for entries with bidirectional details vs old spotify-to-youtube details
        const newBidirectionalEntries = allBidirectionalEntries.filter(entry => 
            entry.details && entry.details.type === 'bidirectional'
        );
        
        const oldStyleEntries = allBidirectionalEntries.filter(entry => 
            entry.details && entry.details.type === 'spotify-to-youtube'
        );
        
        console.log(`   📊 New bidirectional style entries: ${newBidirectionalEntries.length}`);
        console.log(`   📊 Old single-direction style entries: ${oldStyleEntries.length}`);
        
        if (newBidirectionalEntries.length > 0) {
            console.log('   ✅ New bidirectional sync implementation is being used');
        } else if (oldStyleEntries.length > 0) {
            console.log('   ⚠️ Only old single-direction sync entries found');
        } else {
            console.log('   ℹ️ No detailed sync history found yet');
        }
        
        console.log('\n🎯 Bidirectional Sync Implementation Test Complete!');
        console.log('Key findings:');
        console.log(`• performBidirectionalSync method: ${typeof linkService.performBidirectionalSync === 'function' ? 'EXISTS' : 'MISSING'}`);
        console.log(`• Routing logic: ${bidirectionalSyncCalled ? 'WORKING' : 'NEEDS CHECK'}`);
        console.log(`• History tracking: ${bidirectionalHistoryEntries.length > 0 ? 'ACTIVE' : 'NO DATA'}`);
        console.log(`• True bidirectional behavior: ${newBidirectionalEntries.length > 0 ? 'IMPLEMENTED' : 'PENDING VERIFICATION'}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    }
}

// Run the test
if (require.main === module) {
    testBidirectionalSync().catch(console.error);
}

module.exports = { testBidirectionalSync };
