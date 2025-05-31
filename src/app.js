const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const SpotifyService = require('./services/spotifyServices');
const SyncService = require('./services/syncService');
const CookieMonitorService = require('./services/cookieMonitorService');
const PlaylistLinkService = require('./services/playlistLinkService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({limit: '10mb'})); // Increased limit to 10MB
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' })); // Increased limit to 10MB
app.use(express.static(path.join(__dirname, '../public')));

// Services
const spotifyService = new SpotifyService();
// const youtubeMusicService = new YouTubeMusicService();
let youtubeMusicService = null; // Will be initialized lazily
const syncService = new SyncService(spotifyService, null); // Pass null for now

// Initialize Playlist Link Service (will be initialized after YouTube Music service)
let playlistLinkService = null;

// Initialize Cookie Monitor Service
const cookieMonitor = new CookieMonitorService();

// Load the YouTube Music service factory
const createYouTubeMusicService = require('./services/youtubeMusicServiceFactory');

// Initialize YouTube Music service with cookies on startup
(async () => {
    try {
        // Use factory function to avoid constructor issues
        youtubeMusicService = createYouTubeMusicService();
        await youtubeMusicService.initialize();
        console.log('✅ YouTube Music service initialized successfully with cookie authentication');
        
        // Update sync service with the initialized YouTube Music service
        syncService.youtubeMusic = youtubeMusicService;
          // Initialize Playlist Link Service
        playlistLinkService = new PlaylistLinkService(spotifyService, youtubeMusicService, syncService);
        await playlistLinkService.initialize();
        console.log('✅ Playlist Link Service initialized successfully');
        
        // Start cookie monitor automatically
        console.log('🔍 Starting YouTube Music cookie monitor...');
        const cookieMonitorResult = await cookieMonitor.start();
        if (cookieMonitorResult.success) {
            console.log('✅ Cookie monitor started successfully');
            // Connect the chrome service to sync service for enhanced functionality
            if (cookieMonitor.chromeService) {
                syncService.setChromeDebugService(cookieMonitor.chromeService);
                console.log('✅ Chrome debug service connected to sync service');
            }
        } else {
            console.log('⚠️  Cookie monitor failed to start:', cookieMonitorResult.error);
            console.log('ℹ️  You can try starting it manually from the web interface');
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize services:', error.message);
        console.log('ℹ️  Make sure oauth.json file exists in the project root with valid cookies');
    }
})();

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Authentication routes
app.get('/auth/spotify', (req, res) => {
    const authUrl = spotifyService.getAuthUrl();
    res.redirect(authUrl);
});

app.get('/auth/youtube', (req, res) => {
    // No longer needed with cookie-based auth
    res.json({ 
        message: 'YouTube Music authentication is now handled via cookies. Service is automatically initialized on startup.',
        authenticated: youtubeMusicService ? youtubeMusicService.isAuthenticated : false
    });
});

app.get('/callback', async (req, res) => {
    try {
        const { code } = req.query;
        await spotifyService.authenticate(code);
        res.redirect('/?auth=success');
    } catch (error) {
        console.error('Authentication error:', error);
        res.redirect('/?auth=error');
    }
});

app.get('/auth/youtube/callback', async (req, res) => {
    // No longer needed with cookie-based auth
    res.json({ 
        message: 'YouTube Music authentication callback is no longer needed. Service uses cookie-based authentication.',
        authenticated: youtubeMusicService ? youtubeMusicService.isAuthenticated : false
    });
});

// API routes
app.get('/api/spotify/playlists', async (req, res) => {
    try {
        const { id } = req.query;
        
        // If an ID is provided, get info for that specific playlist only
        if (id) {
            const playlists = await spotifyService.getUserPlaylists();
            const playlist = playlists.find(p => p.id === id);
            
            if (!playlist) {
                return res.status(404).json({ error: 'Playlist not found' });
            }
            
            return res.json(playlist);
        }
        
        // Otherwise return all playlists as before
        const playlists = await spotifyService.getUserPlaylists();
        res.json(playlists);
    } catch (error) {
        console.error('Error fetching Spotify playlists:', error);
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

app.get('/api/youtube/playlists', async (req, res) => {
    try {
        const { id } = req.query;
        
        // If an ID is provided, get info for that specific playlist only
        if (id) {
            const playlists = await youtubeMusicService.getUserPlaylists();
            const playlist = playlists.find(p => p.id === id);
            
            if (!playlist) {
                return res.status(404).json({ error: 'Playlist not found' });
            }
            
            return res.json(playlist);
        }
        
        // Otherwise return all playlists as before
        const playlists = await youtubeMusicService.getUserPlaylists();
        res.json(playlists);
    } catch (error) {
        console.error('Error fetching YouTube Music playlists:', error);
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

app.post('/api/sync/preview', async (req, res) => {
    try {
        const { youtubePlaylistId, spotifyPlaylistId } = req.body;
        const preview = await syncService.previewSync(youtubePlaylistId, spotifyPlaylistId);
        res.json(preview);
    } catch (error) {
        console.error('Error generating sync preview:', error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

// New endpoint for streaming sync preview with progress
// Support both POST requests with body and GET requests with query params
app.all('/api/sync/preview-stream', async (req, res) => {
    try {
        // Get parameters from either query string (GET) or request body (POST)
        const youtubePlaylistId = req.query.youtubePlaylistId || (req.body ? req.body.youtubePlaylistId : null);
        const spotifyPlaylistId = req.query.spotifyPlaylistId || (req.body ? req.body.spotifyPlaylistId : null);
        
        // Set up Server-Sent Events
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });        // Progress callback function
        const progressCallback = (progress) => {
            try {
                // Ensure progress data has a type field for client parsing
                const progressData = {
                    type: 'progress',
                    ...progress
                };
                const jsonData = JSON.stringify(progressData);
                res.write(`data: ${jsonData}\n\n`);
                res.flush(); // Force immediate transmission
            } catch (error) {
                console.error('Error sending progress update:', error);
            }
        };

        // Start the sync preview with progress tracking
        const preview = await syncService.previewSync(youtubePlaylistId, spotifyPlaylistId, progressCallback);
        
        // Send final result
        res.write(`data: ${JSON.stringify({ type: 'result', data: preview })}\n\n`);
        res.end();
        
    } catch (error) {
        console.error('Error generating sync preview:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

app.post('/api/sync/execute', async (req, res) => {
    try {
        console.log('Sync execute request received:', req.body);
        const { youtubePlaylistId, spotifyPlaylistId, approvedTracks, createNewPlaylist, newPlaylistName, previewResults } = req.body;
        
        // Validate required fields
        if (!approvedTracks || !Array.isArray(approvedTracks)) {
            console.error('Invalid approvedTracks in request:', approvedTracks);
            return res.status(400).json({ error: 'Invalid approvedTracks: must be an array' });
        }
        
        if (createNewPlaylist && (!newPlaylistName || newPlaylistName.trim() === '')) {
            console.error('Missing newPlaylistName for new playlist creation');
            return res.status(400).json({ error: 'New playlist name is required when creating a new playlist' });
        }
        
        console.log('Calling syncService.executeSync with validated data...');
        const result = await syncService.executeSync({
            youtubePlaylistId,
            spotifyPlaylistId,
            approvedTracks,
            createNewPlaylist,
            newPlaylistName,
            previewResults  // Pass the preview results for tracking non-transferred tracks
        });
        
        console.log('Sync execute completed successfully:', result.summary);
        res.json(result);
    } catch (error) {
        console.error('Error executing sync:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to execute sync',
            details: error.message 
        });
    }
});

// New endpoint for reverse sync preview (Spotify to YouTube Music)
app.post('/api/sync/preview-reverse', async (req, res) => {
    try {
        const { spotifyPlaylistId, youtubePlaylistId } = req.body;
        const preview = await syncService.previewReverseSync(spotifyPlaylistId, youtubePlaylistId);
        res.json(preview);
    } catch (error) {
        console.error('Error generating reverse sync preview:', error);
        res.status(500).json({ error: 'Failed to generate reverse sync preview' });
    }
});

// New endpoint for executing reverse sync (Spotify to YouTube Music)
app.post('/api/sync/execute-reverse', async (req, res) => {
    try {
        console.log('Reverse sync execute request received:', req.body);
        const { spotifyPlaylistId, youtubePlaylistId, approvedTracks, createNewPlaylist, newPlaylistName, previewResults } = req.body;
        
        // Validate required fields
        if (!approvedTracks || !Array.isArray(approvedTracks)) {
            console.error('Invalid approvedTracks in request:', approvedTracks);
            return res.status(400).json({ error: 'Invalid approvedTracks: must be an array' });
        }
        
        if (createNewPlaylist && (!newPlaylistName || newPlaylistName.trim() === '')) {
            console.error('Missing newPlaylistName for new playlist creation');
            return res.status(400).json({ error: 'New playlist name is required when creating a new playlist' });
        }
        
        console.log('Calling syncService.executeReverseSync with validated data...');
        const result = await syncService.executeReverseSync({
            spotifyPlaylistId,
            youtubePlaylistId,
            approvedTracks,
            createNewPlaylist,
            newPlaylistName,
            previewResults
        });
        
        console.log('Reverse sync execute completed successfully:', result.summary);
        res.json(result);
    } catch (error) {
        console.error('Error executing reverse sync:', error);        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to execute reverse sync',
            details: error.message 
        });
    }
});

// Endpoint to verify a Spotify link/URI and get track info
app.post('/api/spotify/verify-link', async (req, res) => {
    try {
        const { link, sourceTrackName, sourceTrackArtist } = req.body;
        
        if (!link) {
            return res.status(400).json({ error: 'No link provided' });
        }
        
        console.log(`Verifying Spotify link: ${link} for source track "${sourceTrackName}" by "${sourceTrackArtist}"`);
        
        // Extract track ID from various Spotify URL formats or URIs
        let trackId;
        
        // URI format: spotify:track:1234567890abcdef
        if (link.startsWith('spotify:track:')) {
            trackId = link.split(':')[2];
        } 
        // URL format: https://open.spotify.com/track/1234567890abcdef
        else if (link.includes('spotify.com/track/')) {
            const url = new URL(link);
            trackId = url.pathname.split('/').pop().split('?')[0];
        }
        // Direct ID format
        else if (/^[a-zA-Z0-9]{22}$/.test(link)) {
            trackId = link;
        }
        else {
            return res.status(400).json({ error: 'Invalid Spotify link format. Please use a Spotify URI or URL.' });
        }
        
        // Get track info from Spotify API
        const trackInfo = await spotifyService.getTrack(trackId);
        
        if (!trackInfo) {
            return res.status(404).json({ error: 'Track not found on Spotify' });
        }
        
        // Format the track info for consistent handling
        const formattedTrack = {
            id: trackInfo.id,
            uri: trackInfo.uri,
            name: trackInfo.name,
            artists: trackInfo.artists.map(a => a.name),
            album: trackInfo.album ? { name: trackInfo.album.name } : null,
            duration_ms: trackInfo.duration_ms,
            isCustomMatch: true
        };
        
        res.json(formattedTrack);
    } catch (error) {
        console.error('Error verifying Spotify link:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to verify a YouTube Music link and get track info
app.post('/api/youtube/verify-link', async (req, res) => {
    try {
        const { link, sourceTrackName, sourceTrackArtist } = req.body;
        
        if (!link) {
            return res.status(400).json({ error: 'No link provided' });
        }
        
        console.log(`Verifying YouTube link: ${link} for source track "${sourceTrackName}" by "${sourceTrackArtist}"`);
        
        // Extract video ID from various YouTube URL formats
        let videoId;
        
        // Standard YT URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
        if (link.includes('youtube.com/watch?v=')) {
            const url = new URL(link);
            videoId = url.searchParams.get('v');
        }
        // Short YT URL: https://youtu.be/dQw4w9WgXcQ
        else if (link.includes('youtu.be/')) {
            videoId = link.split('youtu.be/')[1].split('?')[0];
        }
        // YT Music URL: https://music.youtube.com/watch?v=dQw4w9WgXcQ
        else if (link.includes('music.youtube.com/watch?v=')) {
            const url = new URL(link);
            videoId = url.searchParams.get('v');
        }
        // Direct ID format
        else if (/^[a-zA-Z0-9_-]{11}$/.test(link)) {
            videoId = link;
        }
        else {
            return res.status(400).json({ error: 'Invalid YouTube link format. Please use a YouTube URL or video ID.' });
        }
        
        // Get track info from YouTube Music
        try {
            // Call the Python service to get track info
            const response = await axios.get(`${process.env.YTMUSIC_SEARCH_URL.replace('/search', '/video/')}${videoId}`);
            const trackInfo = response.data;
            
            if (!trackInfo || trackInfo.error) {
                return res.status(404).json({ error: trackInfo?.error || 'Track not found on YouTube Music' });
            }
            
            // Format the track info for consistent handling
            const formattedTrack = {
                id: videoId,
                videoId: videoId,
                title: trackInfo.title || sourceTrackName,
                artist: trackInfo.artist || sourceTrackArtist,
                artists: trackInfo.artists || [sourceTrackArtist],
                duration: trackInfo.duration || '0:00',
                isCustomMatch: true
            };
            
            res.json(formattedTrack);
        } catch (error) {
            console.error('Error getting YouTube video info:', error);
            
            // If the API call fails, create a basic track structure with the provided ID
            // This allows manual links to work even if the lookup fails
            const basicTrack = {
                id: videoId,
                videoId: videoId,
                title: sourceTrackName || 'Unknown Track',
                artist: sourceTrackArtist || 'Unknown Artist',
                isCustomMatch: true,
                isManualLink: true
            };
            
            res.json(basicTrack);
        }
    } catch (error) {
        console.error('Error verifying YouTube link:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/spotify/playlist', async (req, res) => {
    try {
        const { name, description } = req.body;
        const playlist = await spotifyService.createPlaylist(name, description);
        res.json(playlist);
    } catch (error) {
        console.error('Error creating playlist:', error);
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});

// Endpoint to manually refresh YouTube Music authentication
app.post('/api/youtube/refresh-auth', async (req, res) => {
    try {
        const { cookieString } = req.body;
        
        if (!cookieString) {
            return res.status(400).json({ error: 'No cookie string provided' });
        }
        
        console.log('🔄 Manually refreshing YouTube Music authentication...');
        
        // Update the oauth.json file with the new cookie
        const fs = require('fs');
        const oauthPath = path.join(process.cwd(), 'oauth.json');
        
        let authData = {};
        if (fs.existsSync(oauthPath)) {
            authData = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
        }
        
        authData.cookie = cookieString;
        authData.lastUpdated = new Date().toISOString();
        
        fs.writeFileSync(oauthPath, JSON.stringify(authData, null, 2));
        
        // Re-initialize the YouTube Music service
        youtubeMusicService = createYouTubeMusicService();
        const initialized = await youtubeMusicService.initialize();
        
        if (initialized) {
            // Update sync service with the re-initialized YouTube Music service
            syncService.youtubeMusic = youtubeMusicService;
            
            console.log('✅ YouTube Music authentication refreshed successfully');
            res.json({ 
                success: true, 
                message: 'YouTube Music authentication refreshed successfully',
                authenticated: youtubeMusicService.isAuthenticated
            });
        } else {
            console.error('❌ Failed to refresh YouTube Music authentication');
            res.status(500).json({ error: 'Failed to refresh authentication' });
        }
        
    } catch (error) {
        console.error('Error refreshing YouTube Music auth:', error);
        res.status(500).json({ error: error.message });
    }
});

// Authentication status check
app.get('/api/auth/status', (req, res) => {
    res.json({
        spotify: {
            authenticated: spotifyService.isAuthenticated
        },
        youtube: {
            authenticated: youtubeMusicService.isAuthenticated
        }
    });
});

// Cookie Monitor API endpoints
app.get('/api/cookie-monitor/status', (req, res) => {
    try {
        const status = cookieMonitor.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Error getting cookie monitor status:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cookie-monitor/cookie-status', async (req, res) => {
    try {
        const cookieStatus = await cookieMonitor.getCookieStatus();
        res.json(cookieStatus);
    } catch (error) {
        console.error('Error getting cookie status:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cookie-monitor/start', async (req, res) => {
    try {
        const result = await cookieMonitor.start();
        if (result) {
            // Establish connection between SyncService and ChromeDebugService for transfer state protection
            if (cookieMonitor.chromeService) {
                syncService.setChromeDebugService(cookieMonitor.chromeService);
                console.log('🔗 Connected SyncService to ChromeDebugService for transfer state protection');
            }
            
            res.json({ success: true, message: 'Cookie monitoring started' });
        } else {
            res.status(500).json({ error: 'Failed to start cookie monitoring' });
        }
    } catch (error) {
        console.error('Error starting cookie monitor:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cookie-monitor/stop', async (req, res) => {
    try {
        await cookieMonitor.stop();
        
        // Disconnect ChromeDebugService from SyncService
        syncService.setChromeDebugService(null);
        console.log('🔌 Disconnected ChromeDebugService from SyncService');
        
        res.json({ success: true, message: 'Cookie monitoring stopped' });
    } catch (error) {
        console.error('Error stopping cookie monitor:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cookie-monitor/restart', async (req, res) => {
    try {
        await cookieMonitor.restart();
        res.json({ success: true, message: 'Cookie monitoring restarted' });
    } catch (error) {
        console.error('Error restarting cookie monitor:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cookie-monitor/refresh-cookies', async (req, res) => {
    try {
        const result = await cookieMonitor.refreshCookies();
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('Error refreshing cookies:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cookie-monitor/check-health', async (req, res) => {
    try {
        const result = await cookieMonitor.checkCookieHealth();
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('Error checking cookie health:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cookie-monitor/notifications', (req, res) => {
    try {
        const count = parseInt(req.query.count) || 10;
        const notifications = cookieMonitor.getNotifications(count);
        res.json(notifications);
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/cookie-monitor/notifications', (req, res) => {
    try {
        cookieMonitor.clearNotifications();
        res.json({ success: true, message: 'Notifications cleared' });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ error: error.message });    }
});

// ============================================================================
// PLAYLIST LINKING API ENDPOINTS
// ============================================================================

// Get all playlist links
app.get('/api/playlist-links', async (req, res) => {
    try {
        if (!playlistLinkService) {
            return res.status(503).json({ error: 'Playlist link service not initialized' });
        }
        
        const links = await playlistLinkService.getAllPlaylistLinks();
        res.json(links);
    } catch (error) {
        console.error('Error fetching playlist links:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get a specific playlist link
app.get('/api/playlist-links/:linkId', async (req, res) => {
    try {
        if (!playlistLinkService) {
            return res.status(503).json({ error: 'Playlist link service not initialized' });
        }
        
        const { linkId } = req.params;
        const link = await playlistLinkService.getPlaylistLink(linkId);
        
        if (!link) {
            return res.status(404).json({ error: 'Playlist link not found' });
        }
        
        res.json(link);
    } catch (error) {
        console.error('Error fetching playlist link:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create a new playlist link
app.post('/api/playlist-links', async (req, res) => {
    try {
        if (!playlistLinkService) {
            return res.status(503).json({ error: 'Playlist link service not initialized' });
        }
        
        const {
            spotifyPlaylistId,
            youtubePlaylistId,
            syncDirection = 'bidirectional',
            autoSync = false,
            syncInterval = 24,
            conflictResolution = 'manual',
            performInitialSync = false,
            initialSyncDirection
        } = req.body;
        
        // Validate required fields
        if (!spotifyPlaylistId || !youtubePlaylistId) {
            return res.status(400).json({ 
                error: 'Both spotifyPlaylistId and youtubePlaylistId are required' 
            });
        }
        
        const linkData = {
            spotifyPlaylistId,
            youtubePlaylistId,
            syncDirection,
            autoSync,
            syncInterval,
            conflictResolution,
            performInitialSync,
            initialSyncDirection
        };
        
        const newLink = await playlistLinkService.createPlaylistLink(linkData);
        res.status(201).json(newLink);
        
    } catch (error) {
        console.error('Error creating playlist link:', error);
        res.status(400).json({ error: error.message });
    }
});

// Update a playlist link
app.put('/api/playlist-links/:linkId', async (req, res) => {
    try {
        if (!playlistLinkService) {
            return res.status(503).json({ error: 'Playlist link service not initialized' });
        }
        
        const { linkId } = req.params;
        const updates = req.body;
        
        const updatedLink = await playlistLinkService.updatePlaylistLink(linkId, updates);
        res.json(updatedLink);
        
    } catch (error) {
        console.error('Error updating playlist link:', error);
        res.status(400).json({ error: error.message });
    }
});

// Delete a playlist link
app.delete('/api/playlist-links/:linkId', async (req, res) => {
    try {
        if (!playlistLinkService) {
            return res.status(503).json({ error: 'Playlist link service not initialized' });
        }
        
        const { linkId } = req.params;
        const deletedLink = await playlistLinkService.deletePlaylistLink(linkId);
        res.json(deletedLink);
        
    } catch (error) {
        console.error('Error deleting playlist link:', error);
        res.status(400).json({ error: error.message });
    }
});

// Manually trigger sync for a playlist link
app.post('/api/playlist-links/:linkId/sync', async (req, res) => {
    try {
        if (!playlistLinkService) {
            return res.status(503).json({ error: 'Playlist link service not initialized' });
        }
        
        const { linkId } = req.params;
        const { direction } = req.body; // Optional: override sync direction
        
        const result = await playlistLinkService.syncPlaylistLink(linkId, direction);
        res.json(result);
        
    } catch (error) {
        console.error('Error syncing playlist link:', error);
        res.status(400).json({ error: error.message });
    }
});

// Get sync history for a playlist link
app.get('/api/playlist-links/:linkId/history', async (req, res) => {
    try {
        if (!playlistLinkService) {
            return res.status(503).json({ error: 'Playlist link service not initialized' });
        }
        
        const { linkId } = req.params;
        const { limit = 50 } = req.query;
        
        const history = await playlistLinkService.getSyncHistory(linkId, parseInt(limit));
        res.json(history);
        
    } catch (error) {
        console.error('Error fetching sync history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check if a playlist is linked
app.get('/api/playlists/:playlistId/links', async (req, res) => {
    try {
        if (!playlistLinkService) {
            return res.status(503).json({ error: 'Playlist link service not initialized' });
        }
        
        const { playlistId } = req.params;
        const { platform } = req.query; // 'spotify' or 'youtube'
        
        if (!platform || !['spotify', 'youtube'].includes(platform)) {
            return res.status(400).json({ 
                error: 'Platform query parameter is required (spotify or youtube)' 
            });
        }
        
        const links = await playlistLinkService.getLinksForPlaylist(playlistId, platform);
        const isLinked = await playlistLinkService.isPlaylistLinked(playlistId, platform);
        
        res.json({
            playlistId,
            platform,
            isLinked,
            links
        });
        
    } catch (error) {
        console.error('Error checking playlist links:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get overall statistics
app.get('/api/playlist-links/stats', async (req, res) => {
    try {
        if (!playlistLinkService) {
            return res.status(503).json({ error: 'Playlist link service not initialized' });
        }
        
        const stats = await playlistLinkService.getOverallStatistics();
        res.json(stats);
        
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all sync history (across all links)
app.get('/api/sync-history', async (req, res) => {
    try {
        if (!playlistLinkService) {
            return res.status(503).json({ error: 'Playlist link service not initialized' });
        }
        
        const { limit = 100 } = req.query;
        const history = await playlistLinkService.getSyncHistory(null, parseInt(limit));
        res.json(history);
        
    } catch (error) {
        console.error('Error fetching sync history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🎵 Spotisync server running on http://localhost:${PORT}`);
    console.log(`📱 Open your browser and navigate to the URL above to get started!`);
});

module.exports = app;
