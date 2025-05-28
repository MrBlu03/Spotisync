const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const SpotifyService = require('./services/spotifyServices');
const YouTubeMusicService = require('./services/youtubeMusicService');
const SyncService = require('./services/syncService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({limit: '10mb'})); // Increased limit to 10MB
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' })); // Increased limit to 10MB
app.use(express.static(path.join(__dirname, '../public')));

// Services
const spotifyService = new SpotifyService();
const youtubeMusicService = new YouTubeMusicService();
const syncService = new SyncService(spotifyService, youtubeMusicService);

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
    const authUrl = youtubeMusicService.getAuthUrl();
    res.redirect(authUrl);
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
    try {
        const { code } = req.query;
        await youtubeMusicService.authenticate(code);
        res.redirect('/?ytauth=success');
    } catch (error) {
        console.error('YouTube authentication error:', error);
        res.redirect('/?ytauth=error');
    }
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
        console.error('Error executing reverse sync:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to execute reverse sync',
            details: error.message 
        });
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
