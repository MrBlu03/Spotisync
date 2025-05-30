const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Factory function to create YouTube Music service
function createYouTubeMusicService() {
    const service = {
        ytmusic: null,
        ytma: null,
        isAuthenticated: false,
        quotaExceeded: false,
        searchServiceUrl: process.env.YTMUSIC_SEARCH_URL || 'http://localhost:5001/search',

        async initialize() {
            try {
                console.log('🔐 Initializing YouTube Music via Python service...');
                
                // Check if oauth.json exists for the Python service
                const oauthPath = path.join(process.cwd(), 'oauth.json');
                
                if (!fs.existsSync(oauthPath)) {
                    console.log('❌ OAuth file not found. Please provide oauth.json for Python service authentication.');
                    return false;
                }

                console.log('📄 Found oauth.json for Python service');
                
                // Test the Python service connection by trying to get playlists
                try {
                    const response = await axios.get(`${this.searchServiceUrl.replace('/search', '/playlists')}`);
                    const playlists = response.data;
                    
                    this.isAuthenticated = true;
                    console.log(`✅ YouTube Music Python service connected! Found ${playlists.length} playlists.`);
                    return true;
                    
                } catch (serviceError) {
                    console.error('❌ Failed to connect to Python service:', serviceError.message);
                    if (serviceError.code === 'ECONNREFUSED') {
                        console.log('💡 Make sure the Python service is running: python ytmusic_search_service.py');
                    }
                    this.isAuthenticated = false;
                    return false;
                }
                
            } catch (error) {
                console.error('❌ YouTube Music initialization failed:', error.message);
                this.isAuthenticated = false;
                return false;
            }
        },

        async getUserPlaylists() {
            try {
                console.log('🎵 Fetching YouTube Music playlists via Python service...');
                
                const response = await axios.get(`${this.searchServiceUrl.replace('/search', '/playlists')}`);
                const playlists = response.data;
                
                console.log(`✅ Found ${playlists.length} YouTube Music playlists`);
                
                // Map playlists and try to get track counts
                return playlists.map(playlist => {
                    let trackCount = 0;
                    
                    // Try to get track count from different possible properties
                    if (playlist.tracks && Array.isArray(playlist.tracks)) {
                        trackCount = playlist.tracks.length;
                    } else if (playlist.trackCount) {
                        trackCount = playlist.trackCount;
                    } else if (playlist.track_count) {
                        trackCount = playlist.track_count;
                    } else if (playlist.count) {
                        trackCount = playlist.count;
                    }
                    
                    return {
                        id: playlist.playlistId || playlist.id,
                        name: playlist.title || playlist.name || 'Unnamed Playlist',
                        tracks: playlist.tracks || [],
                        trackCount: trackCount
                    };
                });
                
            } catch (error) {
                console.error('❌ Error fetching YouTube Music playlists via Python service:', error.message);
                if (error.response) {
                    console.error('API Response Error Data:', error.response.data);
                    console.error('API Response Status:', error.response.status);
                }
                return [];
            }
        },

        async getPlaylistTracks(playlistId) {
            try {
                console.log(`🎵 Fetching tracks for playlist: ${playlistId} via Python service`);
                
                const response = await axios.get(`${this.searchServiceUrl.replace('/search', `/playlist/${playlistId}/tracks`)}`);
                const tracks = response.data;
                
                if (!tracks || !Array.isArray(tracks)) {
                    console.log(`⚠️ No tracks found for playlist: ${playlistId}`);
                    return [];
                }

                console.log(`✅ Found ${tracks.length} tracks in playlist`);
                
                return tracks.map(track => ({
                    id: track.videoId || track.id,
                    title: track.title,
                    artist: track.artists?.[0]?.name || track.artist || 'Unknown Artist',
                    album: track.album?.name || track.album || 'Unknown Album',
                    duration: track.duration || '0:00'
                }));
                
            } catch (error) {
                console.error(`❌ Error fetching playlist tracks for ${playlistId} via Python service:`, error.message);
                if (error.response) {
                    console.error('API Response Error Data:', error.response.data);
                    console.error('API Response Status:', error.response.status);
                }
                return [];
            }
        },

        async searchTrack(trackName, artistName) {
            try {
                const query = `${trackName} ${artistName}`.trim();
                console.log(`🔍 Searching YouTube Music (via microservice) for: "${query}"`);

                // Call the Python microservice for search
                const response = await axios.get(this.searchServiceUrl, {
                    params: { q: query }
                });

                const searchResults = response.data;

                if (!searchResults || searchResults.length === 0) {
                    console.log(`❌ No search results found for: "${query}"`);
                    return null;
                }

                // The Python service filtered for songs, so we return the first result
                const song = searchResults[0];
                console.log(`✅ Found match: "${song.title}" by ${song.artists?.[0]?.name || song.artist || 'Unknown Artist'}`);

                return {
                    id: song.videoId || song.id,
                    title: song.title,
                    artist: song.artists?.[0]?.name || song.artist || 'Unknown Artist',
                    album: song.album?.name || song.album || 'Unknown Album',
                    duration: song.duration || '0:00'
                };

            } catch (error) {
                console.error(`❌ Error searching for track "${trackName}" by "${artistName}":`, error.message);
                 if (error.response) {
                    console.error('API Response Error Data:', error.response.data);
                    console.error('API Response Status:', error.response.status);
                } else if (error.request) {
                    console.error('API Request Error: No response received from microservice. Is it running?');
                }
                return null;
            }
        },

        async searchTrackWithArtistPriority(trackName, artistName) {
            try {
                const query = `${trackName} ${artistName}`.trim();
                console.log(`🔍 Searching YouTube Music (via microservice) with artist priority for: "${query}"`);

                // Call the Python microservice for search
                 const response = await axios.get(this.searchServiceUrl, {
                    params: { q: query }
                });

                const searchResults = response.data;


                if (!searchResults || searchResults.length === 0) {
                    console.log(`❌ No search results found for: "${query}"`);
                    return [];
                }

                // Transform all song results from the Python service
                const songs = searchResults.map(song => ({
                    id: song.videoId || song.id,
                    videoId: song.videoId || song.id,
                    title: song.title,
                    artist: song.artists?.[0]?.name || song.artist || 'Unknown Artist',
                    album: song.album?.name || song.album || 'Unknown Album',
                    duration: song.duration || '0:00'
                }));


                if (songs.length > 0) {
                    console.log(`✅ Found ${songs.length} matches for: "${query}"`);

                    // Sort by artist relevance (existing logic, applied to results from Python service)
                    const normalizeString = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
                    const normalizedSearchArtist = normalizeString(artistName);

                    songs.sort((a, b) => {
                        const aArtist = normalizeString(a.artist);
                        const bArtist = normalizeString(b.artist);

                        // Exact artist matches first
                        const aExactMatch = aArtist === normalizedSearchArtist;
                        const bExactMatch = bArtist === normalizedSearchArtist;

                        if (aExactMatch && !bExactMatch) return -1;
                        if (bExactMatch && !aExactMatch) return 1;

                        // Then artist containing matches
                        const aContains = aArtist.includes(normalizedSearchArtist) || normalizedSearchArtist.includes(aArtist);
                        const bContains = bArtist.includes(normalizedSearchArtist) || normalizedSearchArtist.includes(bArtist);

                        if (aContains && !bContains) return -1;
                        if (bContains && !aContains) return 1;

                        return 0;
                    });

                    return songs;
                } else {
                    console.log(`❌ No suitable songs found for: "${query}"`);
                    return [];
                }

            } catch (error) {
                console.error(`❌ Error searching for track "${trackName}" by "${artistName}":`, error.message);
                 if (error.response) {
                    console.error('API Response Error Data:', error.response.data);
                    console.error('API Response Status:', error.response.status);
                } else if (error.request) {
                    console.error('API Request Error: No response received from microservice. Is it running?');
                }
                return [];
            }
        },

        // Helper method to normalize track info into a consistent format
        normalizeTrackInfo(track) {
            return {
                id: track.id,
                title: track.title || track.name || 'Unknown Title',
                artist: track.artist?.name || track.artist || 'Unknown Artist',
                album: track.album?.name || track.album || 'Unknown Album',
                duration: track.duration || track.duration_ms || '0:00'
            };
        },

        async createPlaylist(name, description = '') {
            try {
                console.log(`🎵 Creating playlist: "${name}" via Python service`);
                
                const response = await axios.post(`${this.searchServiceUrl.replace('/search', '/playlist/create')}`, {
                    title: name,
                    description: description
                });
                
                const playlist = response.data;
                
                if (playlist && playlist.id) {
                    console.log(`✅ Created playlist: "${name}" (ID: ${playlist.id})`);
                    return {
                        id: playlist.id,
                        name: playlist.title || name,
                        description: playlist.description || description,
                        tracks: []
                    };
                } else {
                    console.log(`❌ Failed to create playlist: "${name}"`);
                    return null;
                }
                
            } catch (error) {
                console.error(`❌ Error creating playlist "${name}" via Python service:`, error.message);
                if (error.response) {
                    console.error('API Response Error Data:', error.response.data);
                    console.error('API Response Status:', error.response.status);
                }
                return null;
            }
        },

        async addTrackToPlaylist(playlistId, trackId) {
            try {
                console.log(`🎵 Adding track ${trackId} to playlist ${playlistId} via Python service`);
                
                const response = await axios.post(`${this.searchServiceUrl.replace('/search', `/playlist/${playlistId}/add`)}`, {
                    track_ids: [trackId]
                });
                
                const result = response.data;
                
                console.log(`📊 Add track result:`, result);
                
                // Consider the operation successful if:
                // 1. The API explicitly returns success: true OR
                // 2. The tracks_after count is greater than tracks_before OR
                // 3. The result contains a non-error status
                if ((result.success === true) || 
                    (result.tracks_after > result.tracks_before) || 
                    (result.result && !result.error)) {
                    console.log(`✅ Successfully added track to playlist (API reported ${result.tracks_added || "unknown"} tracks added)`);
                    console.log(`📊 Playlist track count: ${result.tracks_before || "?"} -> ${result.tracks_after || "?"}`);
                    return true;
                } else {
                    console.log(`❌ Failed to add track to playlist`);
                    console.log(`📊 Track count remained: ${result.tracks_before || "unknown"} -> ${result.tracks_after || "unknown"}`);
                    return false;
                }
                
            } catch (error) {
                console.error(`❌ Error adding track ${trackId} to playlist ${playlistId} via Python service:`, error.message);
                if (error.response) {
                    console.error('API Response Error Data:', error.response.data);
                    console.error('API Response Status:', error.response.status);
                }
                return false;
            }
        },

        getAuthStatus() {
            return {
                authenticated: this.isAuthenticated,
                hasApi: true, // Always true for Python service
                quotaExceeded: this.quotaExceeded,
                message: this.isAuthenticated 
                    ? 'YouTube Music authenticated via Python service' 
                    : 'YouTube Music Python service not connected'
            };
        },

        async validateSetup() {
            try {
                if (this.isAuthenticated) {
                    return { valid: true, message: 'YouTube Music Python service ready' };
                } else {
                    // Try to initialize if not already done
                    const initResult = await this.initialize();
                    if (initResult) {
                        return { valid: true, message: 'YouTube Music Python service connected' };
                    } else {
                        return { 
                            valid: false, 
                            message: 'YouTube Music Python service not available. Make sure ytmusic_search_service.py is running.',
                            requiresInitialization: true
                        };
                    }
                }
            } catch (error) {
                return { 
                    valid: false, 
                    message: 'YouTube Music Python service error',
                    error: error.message 
                };
            }
        }
    };

    console.log('YouTube Music Service factory created');
    return service;
}

module.exports = createYouTubeMusicService;
