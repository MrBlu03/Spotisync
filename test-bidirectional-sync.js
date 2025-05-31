/**
 * Test script for bidirectional sync functionality
 */

const PlaylistLinkService = require('./src/services/playlistLinkService');

// Mock services for testing
const mockSpotifyService = {
    isAuthenticated: true,
    getPlaylistTracks: async (playlistId) => {
        console.log(`Mock: Getting Spotify tracks for playlist ${playlistId}`);
        return [
            { name: 'Test Song 1', artists: ['Artist 1'], uri: 'spotify:track:1' },
            { name: 'Test Song 2', artists: ['Artist 2'], uri: 'spotify:track:2' }
        ];
    }
};

const mockYoutubeService = {
    validateSetup: async () => ({ valid: true }),
    getPlaylistTracks: async (playlistId) => {
        console.log(`Mock: Getting YouTube tracks for playlist ${playlistId}`);
        return [
            { title: 'Test Song 3', artist: 'Artist 3', videoId: 'yt1' },
            { title: 'Test Song 4', artist: 'Artist 4', videoId: 'yt2' }
        ];
    }
};

const mockSyncService = {
    previewReverseSync: async (spotifyId, youtubeId) => {
        console.log(`Mock: Preview Spotify → YouTube sync`);
        return {
            perfectMatches: [],
            uncertainMatches: [
                {
                    spotifyTrack: { name: 'Test Song 1', artists: ['Artist 1'] },
                    youtubeMatches: [{ title: 'Test Song 1', artist: 'Artist 1', confidence: 'good' }]
                }
            ],
            noMatches: [],
            summary: { totalSpotifyTracks: 2, uncertainMatchCount: 1, perfectMatchCount: 0, noMatchCount: 0 }
        };
    },
    previewSync: async (youtubeId, spotifyId) => {
        console.log(`Mock: Preview YouTube → Spotify sync`);
        return {
            perfectMatches: [],
            uncertainMatches: [
                {
                    youtubeTrack: { title: 'Test Song 3', artist: 'Artist 3' },
                    spotifyMatches: [{ name: 'Test Song 3', artists: ['Artist 3'], confidence: 'good' }]
                }
            ],
            noMatches: [],
            summary: { totalYoutubeTracks: 2, uncertainMatchCount: 1, perfectMatchCount: 0, noMatchCount: 0 }
        };
    },
    executeReverseSync: async (options) => {
        console.log(`Mock: Execute Spotify → YouTube sync with ${options.approvedTracks.length} tracks`);
        return {
            summary: { successfullyAdded: 1, failed: 0, totalApproved: 1 }
        };
    },
    executeSync: async (options) => {
        console.log(`Mock: Execute YouTube → Spotify sync with ${options.approvedTracks.length} tracks`);
        return {
            summary: { successfullyAdded: 1, failed: 0, totalApproved: 1 }
        };
    }
};

async function testBidirectionalSync() {
    try {
        console.log('🧪 Testing bidirectional sync functionality...\n');

        // Create PlaylistLinkService with mock services
        const linkService = new PlaylistLinkService(mockSpotifyService, mockYoutubeService, mockSyncService);

        // Test link object
        const testLink = {
            id: 'test-link-123',
            spotifyPlaylistId: 'spotify-test-123',
            spotifyPlaylistName: 'Test Spotify Playlist',
            youtubePlaylistId: 'youtube-test-123',
            youtubePlaylistName: 'Test YouTube Playlist',
            syncDirection: 'bidirectional'
        };

        console.log('🔄 Testing bidirectional sync...');
        const result = await linkService.performBidirectionalSync(testLink);

        console.log('\n📊 Bidirectional sync results:');
        console.log(`✅ Success: ${result.success}`);
        console.log(`📈 Total tracks processed: ${result.tracksProcessed}`);
        console.log(`➕ Total tracks added: ${result.tracksAdded}`);
        console.log(`❌ Total tracks failed: ${result.tracksFailed}`);
        
        if (result.details) {
            console.log('\n📋 Detailed results:');
            if (result.details.spotifyToYoutube) {
                console.log(`  🎵 Spotify → YouTube: ${result.details.spotifyToYoutube.tracksAdded || 0} added`);
            }
            if (result.details.youtubeToSpotify) {
                console.log(`  🎵 YouTube → Spotify: ${result.details.youtubeToSpotify.tracksAdded || 0} added`);
            }
        }

        if (result.errors && result.errors.length > 0) {
            console.log('\n⚠️ Errors encountered:');
            result.errors.forEach(error => console.log(`  - ${error}`));
        }

        console.log('\n✅ Bidirectional sync test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testBidirectionalSync();
