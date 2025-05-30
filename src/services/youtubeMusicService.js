const fs = require('fs');
const path = require('path');

class YouTubeMusicService {
    constructor() {
        this.ytmusic = null;
        this.ytma = null; // Authenticated API instance
        this.isAuthenticated = false;
        this.quotaExceeded = false; // Keep this for compatibility
        console.log('YouTube Music Service initialized');
    }

    /**
     * Initialize the service with cookie-based authentication
     */
    async initialize() {
        try {
            console.log('🔐 Initializing YouTube Music authentication...');
            
            // Lazy load the YouTube Music API to avoid constructor issues
            if (!this.ytmusic) {
                const YouTubeMusic = require('youtube-music-ts-api').default;
                this.ytmusic = new YouTubeMusic();
                console.log('📦 YouTube Music API instance created');
            }
            
            // Read the authentication file
            const oauthPath = path.join(process.cwd(), 'oauth.json');
            
            if (!fs.existsSync(oauthPath)) {
                console.log('❌ OAuth file not found. Please provide oauth.json for authentication.');
                return false;
            }

            const authData = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
            console.log('📄 Authentication data loaded successfully');

            // Extract cookie string from auth data
            const cookieString = authData.cookie || authData.Cookie;
            
            if (!cookieString) {
                console.log('❌ No cookie found in authentication data');
                return false;
            }

            console.log('🍪 Cookie found, authenticating...');
            
            // Authenticate with the API
            this.ytma = await this.ytmusic.authenticate(cookieString);
            this.isAuthenticated = true;
            
            console.log('✅ YouTube Music authentication successful!');
            
            // Test the connection
            const playlists = await this.ytma.getLibraryPlaylists();
            console.log(`🎵 Successfully connected to YouTube Music! Found ${playlists.length} playlists.`);
            
            return true;
            
        } catch (error) {
            console.error('❌ YouTube Music initialization failed:', error.message);
            this.isAuthenticated = false;
            return false;
        }
    }

    /**
     * Get user's playlists from YouTube Music
     */
    async getUserPlaylists() {
        try {
            if (!this.isAuthenticated || !this.ytma) {
                console.log('⚠️ YouTube Music not authenticated. Call initialize() first.');
                return [];
            }

            console.log('🎵 Fetching YouTube Music playlists...');
            const playlists = await this.ytma.getLibraryPlaylists();
            
            console.log(`✅ Found ${playlists.length} YouTube Music playlists`);
            
            return playlists.map(playlist => ({
                id: playlist.id,
                name: playlist.name,
                tracks: playlist.tracks || [],
                trackCount: playlist.tracks?.length || 0
            }));
            
        } catch (error) {
            console.error('❌ Error fetching YouTube Music playlists:', error.message);
            return [];
        }
    }    /**
     * Get tracks from a specific playlist
     * Handles continuation tokens to fetch all tracks, not just the first 200
     */
    async getPlaylistTracks(playlistId) {
        try {
            if (!this.isAuthenticated || !this.ytma) {
                console.log('⚠️ YouTube Music not authenticated. Call initialize() first.');
                return [];
            }

            console.log(`🎵 Fetching tracks for playlist: ${playlistId}`);
            let allTracks = [];
            let playlist = null;
            let continuationToken = null;
            let pageCounter = 1;
            
            do {
                try {
                    // If it's the first page, fetch the playlist normally
                    if (pageCounter === 1) {
                        playlist = await this.ytma.getPlaylist(playlistId);
                        if (!playlist || !playlist.tracks) {
                            console.log(`⚠️ No tracks found for playlist: ${playlistId}`);
                            return [];
                        }
                        allTracks = [...playlist.tracks];
                        continuationToken = playlist.continuation;
                        console.log(`📃 Fetched page ${pageCounter}: ${allTracks.length} tracks so far`);
                    } 
                    // For subsequent pages, use continuation token
                    else if (continuationToken) {
                        const nextPage = await this.ytma.getPlaylistContinuation(playlistId, continuationToken);
                        if (nextPage && nextPage.tracks && nextPage.tracks.length > 0) {
                            allTracks = [...allTracks, ...nextPage.tracks];
                            continuationToken = nextPage.continuation;
                            console.log(`📃 Fetched page ${pageCounter}: ${allTracks.length} tracks so far`);
                        } else {
                            continuationToken = null;
                        }
                    }
                } catch (pageError) {
                    console.error(`❌ Error fetching page ${pageCounter}:`, pageError.message);
                    // If we get an error, stop pagination but return what we have
                    continuationToken = null;
                }
                pageCounter++;
            } while (continuationToken);

            console.log(`✅ Found ${allTracks.length} tracks in playlist (across multiple pages)`);
            
            return allTracks.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.artist?.name || track.artist || 'Unknown Artist',
                album: track.album?.name || track.album || 'Unknown Album',
                duration: track.duration || '0:00'
            }));
            
        } catch (error) {
            console.error(`❌ Error fetching playlist tracks for ${playlistId}:`, error.message);
            return [];
        }
    }

    /**
     * Search for a track on YouTube Music
     */
    async searchTrack(trackName, artistName) {
        try {
            if (!this.isAuthenticated || !this.ytma) {
                console.log('⚠️ YouTube Music not authenticated. Call initialize() first.');
                return null;
            }

            const query = `${trackName} ${artistName}`.trim();
            console.log(`🔍 Searching YouTube Music for: "${query}"`);
            
            const searchResults = await this.ytma.search(query);
            
            if (!searchResults || searchResults.length === 0) {
                console.log(`❌ No search results found for: "${query}"`);
                return null;
            }

            // Return the first result that's a song
            const song = searchResults.find(result => result.type === 'song' || result.type === 'video');
            
            if (song) {
                console.log(`✅ Found match: "${song.title}" by ${song.artist?.name || 'Unknown Artist'}`);
                return {
                    id: song.id,
                    title: song.title,
                    artist: song.artist?.name || song.artist || 'Unknown Artist',
                    album: song.album?.name || song.album || 'Unknown Album',
                    duration: song.duration || '0:00'
                };
            } else {
                console.log(`❌ No suitable song found for: "${query}"`);
                return null;
            }
            
        } catch (error) {
            console.error(`❌ Error searching for track "${trackName}" by "${artistName}":`, error.message);
            return null;
        }
    }

    /**
     * Create a new playlist on YouTube Music
     */
    async createPlaylist(name, description = '') {
        try {
            if (!this.isAuthenticated || !this.ytma) {
                console.log('⚠️ YouTube Music not authenticated. Call initialize() first.');
                return null;
            }

            console.log(`🎵 Creating playlist: "${name}"`);
            
            const playlist = await this.ytma.createPlaylist(name, description);
            
            if (playlist && playlist.id) {
                console.log(`✅ Created playlist: "${name}" (ID: ${playlist.id})`);
                return {
                    id: playlist.id,
                    name: playlist.name || name,
                    description: playlist.description || description,
                    tracks: []
                };
            } else {
                console.log(`❌ Failed to create playlist: "${name}"`);
                return null;
            }
            
        } catch (error) {
            console.error(`❌ Error creating playlist "${name}":`, error.message);
            return null;
        }
    }

    /**
     * Add a track to a playlist
     */
    async addTrackToPlaylist(playlistId, trackId) {
        try {
            if (!this.isAuthenticated || !this.ytma) {
                console.log('⚠️ YouTube Music not authenticated. Call initialize() first.');
                return false;
            }

            console.log(`🎵 Adding track ${trackId} to playlist ${playlistId}`);
            
            const result = await this.ytma.addTracksToPlaylist(playlistId, [trackId]);
            
            if (result) {
                console.log(`✅ Track added to playlist successfully`);
                return true;
            } else {
                console.log(`❌ Failed to add track to playlist`);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ Error adding track ${trackId} to playlist ${playlistId}:`, error.message);
            return false;
        }
    }

    /**
     * Refresh the cookie session
     * This helps prevent authentication issues due to cookie expiration
     */
    async refreshCookieSession() {
        try {
            console.log('🔄 Refreshing YouTube Music cookie session...');
            
            // Read the authentication file again to get fresh cookies
            const oauthPath = path.join(process.cwd(), 'oauth.json');
            
            if (!fs.existsSync(oauthPath)) {
                console.log('❌ OAuth file not found. Cannot refresh session.');
                return false;
            }

            const authData = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
            
            // Extract cookie string from auth data
            const cookieString = authData.cookie || authData.Cookie;
            
            if (!cookieString) {
                console.log('❌ No cookie found in authentication data');
                return false;
            }

            console.log('🍪 Fresh cookie loaded, re-authenticating...');
            
            // Re-authenticate with the API
            this.ytma = await this.ytmusic.authenticate(cookieString);
            this.isAuthenticated = true;
            
            console.log('✅ YouTube Music session refreshed successfully!');
            return true;
            
        } catch (error) {
            console.error('❌ YouTube Music session refresh failed:', error.message);
            return false;
        }
    }

    /**
     * Get authenticated status
     */
    getAuthStatus() {
        return {
            authenticated: this.isAuthenticated,
            hasApi: !!this.ytma,
            quotaExceeded: this.quotaExceeded,
            message: this.isAuthenticated 
                ? 'YouTube Music authenticated with cookies' 
                : 'YouTube Music not authenticated'
        };
    }

    /**
     * Method to validate if YouTube Music API is properly set up
     */
    async validateSetup() {
        try {
            if (this.isAuthenticated && this.ytma) {
                return { valid: true, message: 'YouTube Music API ready with cookie authentication' };
            } else {
                return { 
                    valid: false, 
                    message: 'YouTube Music API not initialized. Call initialize() first.',
                    requiresInitialization: true
                };
            }
        } catch (error) {
            return { 
                valid: false, 
                message: 'YouTube Music API setup error',
                error: error.message 
            };
        }
    }
}

module.exports = YouTubeMusicService;
