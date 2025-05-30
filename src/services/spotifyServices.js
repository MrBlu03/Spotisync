const SpotifyWebApi = require('spotify-web-api-node');

class SpotifyService {
    constructor() {
        this.spotify = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            redirectUri: process.env.SPOTIFY_REDIRECT_URI
        });
        this.isAuthenticated = false;
    }

    getAuthUrl() {
        const scopes = [
            'playlist-read-private',
            'playlist-read-collaborative',
            'playlist-modify-private',
            'playlist-modify-public',
            'user-library-read'
        ];
        
        return this.spotify.createAuthorizeURL(scopes, 'state');
    }    async authenticate(code) {
        try {
            console.log('Starting Spotify authentication...');
            const data = await this.spotify.authorizationCodeGrant(code);
            
            // Validate authentication response
            if (!data || !data.body || !data.body.access_token) {
                console.error('Invalid authentication response:', data);
                throw new Error('Invalid authentication response from Spotify');
            }
            
            console.log('Authentication response received, setting tokens...');
            this.spotify.setAccessToken(data.body.access_token);
            this.spotify.setRefreshToken(data.body.refresh_token);
            this.isAuthenticated = true;
            
            console.log('Spotify authentication successful, testing API access...');
            
            // Test the authentication by fetching user info
            try {
                const user = await this.getCurrentUser();
                console.log('User authenticated successfully:', user.id, user.display_name);
                
                // Test API functionality by trying to fetch playlists
                try {
                    const playlists = await this.getUserPlaylists();
                    console.log(`API test successful: fetched ${playlists.length} playlists`);
                } catch (playlistError) {
                    console.error('Playlist fetch test failed but user auth succeeded:', playlistError);
                    // Don't fail authentication for this
                }
                
            } catch (userError) {
                console.error('Authentication succeeded but user fetch failed:', userError);
                this.isAuthenticated = false;
                throw new Error('Authentication validation failed: ' + userError.message);
            }
            
            // Set up auto refresh with better error handling
            setInterval(async () => {
                try {
                    console.log('Auto-refreshing access token...');
                    const refreshData = await this.spotify.refreshAccessToken();
                    this.spotify.setAccessToken(refreshData.body.access_token);
                    console.log('Token refreshed successfully');
                } catch (error) {
                    console.error('Error refreshing token:', error);
                    this.isAuthenticated = false;
                }
            }, 3000000); // Refresh every 50 minutes
            
            return true;
        } catch (error) {
            console.error('Authentication failed:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                statusCode: error.statusCode,
                body: error.body
            });
            this.isAuthenticated = false;
            throw error;
        }
    }

    async getUserPlaylists() {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Spotify');
        }

        try {
            const [playlistData, currentUser] = await Promise.all([
                this.spotify.getUserPlaylists(),
                this.getCurrentUser()
            ]);
            
            return playlistData.body.items.map(playlist => ({
                id: playlist.id,
                name: playlist.name,
                description: playlist.description,
                trackCount: playlist.tracks.total,
                isOwner: playlist.owner.id === currentUser.id
            }));
        } catch (error) {
            console.error('Error fetching playlists:', error);
            throw error;
        }
    }

    async getCurrentUser() {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Spotify');
        }

        try {
            const data = await this.spotify.getMe();
            
            // Validate response
            if (!data || !data.body) {
                console.error('Invalid getMe response:', data);
                throw new Error('Invalid response from Spotify getMe API');
            }
            
            return data.body;
        } catch (error) {
            console.error('Error fetching current user:', error);
            console.error('Error details:', error.message);
            throw error;
        }
    }    async getPlaylistTracks(playlistId) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Spotify');
        }

        try {
            const tracks = [];
            let offset = 0;
            const limit = 100;

            while (true) {
                const data = await this.spotify.getPlaylistTracks(playlistId, { offset, limit });
                const items = data.body.items;
                
                if (items.length === 0) break;
                
                // Filter out null/invalid tracks and map valid ones
                const validTracks = items
                    .filter(item => {
                        // Check if track exists and has required properties
                        if (!item || !item.track) {
                            console.warn('Skipping item with null track:', item);
                            return false;
                        }
                        
                        const track = item.track;
                        
                        // Check for required properties
                        if (!track.id || !track.name || !track.uri) {
                            console.warn('Skipping track with missing required properties:', {
                                id: track.id,
                                name: track.name,
                                uri: track.uri
                            });
                            return false;
                        }
                        
                        // Check if artists array exists
                        if (!track.artists || !Array.isArray(track.artists)) {
                            console.warn('Skipping track with invalid artists:', track.name);
                            return false;
                        }
                        
                        return true;
                    })
                    .map(item => {
                        const track = item.track;
                        return {
                            id: track.id,
                            name: track.name,
                            artists: track.artists.map(artist => artist.name || 'Unknown Artist'),
                            album: track.album?.name || 'Unknown Album',
                            uri: track.uri
                        };
                    });
                
                tracks.push(...validTracks);

                offset += limit;
                if (items.length < limit) break;
            }

            console.log(`Successfully fetched ${tracks.length} valid tracks from playlist ${playlistId}`);
            return tracks;
        } catch (error) {
            console.error('Error fetching playlist tracks:', error);
            throw error;
        }
    }async searchTrack(trackName, artistName) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Spotify');
        }

        try {
            // Clean up the search terms
            let cleanTrackName = this.cleanSearchTerm(trackName);
            const cleanArtistName = this.cleanSearchTerm(artistName);
            
            // Check for special version indicators in original track name
            // This helps adjust the search strategy
            const originalTrackLower = trackName.toLowerCase();
            const containsLive = originalTrackLower.includes('live');
            const containsInstrumental = originalTrackLower.includes('instrumental');
            const containsRemix = originalTrackLower.includes('remix') || 
                                /\bmix\b|\(mix|\)mix|mix\)/.test(originalTrackLower);
            const containsAcoustic = originalTrackLower.includes('acoustic');
            
            // If the original specifies a special version, make sure to include it in the search
            // Otherwise, construct searches that will avoid these special versions
            const specialVersions = [];
            if (containsLive) specialVersions.push('live');
            if (containsInstrumental) specialVersions.push('instrumental'); 
            if (containsRemix) specialVersions.push('remix');
            if (containsAcoustic) specialVersions.push('acoustic');
            
            // Skip search if artist is unknown or track name is too short
            if (cleanArtistName === 'unknown artist' || cleanTrackName.length < 2) {
                return [];
            }
            
            const results = [];
              // Exclude common terms used for special versions if not in original
            // This helps adjust search queries to avoid unwanted special versions
            const excludeTerms = [];
            if (!containsLive) excludeTerms.push('live');
            if (!containsInstrumental) excludeTerms.push('instrumental');
            if (!containsRemix) excludeTerms.push('remix', 'mix');
            if (!containsAcoustic) excludeTerms.push('acoustic');
            
            // Build search queries with appropriate specificity
            let searchQueries = [
                // Exact match with quotes
                `track:"${cleanTrackName}" artist:"${cleanArtistName}"`,
                // Without quotes but specific
                `track:${cleanTrackName} artist:${cleanArtistName}`,
                // More flexible - just the terms
                `"${cleanTrackName}" "${cleanArtistName}"`,
                // Very flexible - just the words
                `${cleanTrackName} ${cleanArtistName}`
            ];
            
            // Conditionally add refined searches to avoid unwanted versions
            // Only if we have terms to exclude and it's not a short track name
            if (excludeTerms.length > 0 && cleanTrackName.length > 5) {
                const minusTerms = excludeTerms.map(term => `-${term}`).join(' ');
                searchQueries = [
                    // Priority search excluding unwanted special versions
                    `track:"${cleanTrackName}" artist:"${cleanArtistName}" ${minusTerms}`,
                    // Then include the regular searches
                    ...searchQueries
                ];
            }
              for (const query of searchQueries) {
                try {
                    const data = await this.spotify.searchTracks(query, { limit: 10 });
                    const tracks = data.body.tracks.items
                        .filter(track => {
                            // Validate track has required properties
                            if (!track || !track.id || !track.name || !track.uri) {
                                console.warn('Skipping invalid track in search results:', track);
                                return false;
                            }
                            
                            // Validate artists array
                            if (!track.artists || !Array.isArray(track.artists)) {
                                console.warn('Skipping track with invalid artists:', track.name);
                                return false;
                            }
                            
                            return true;
                        })
                        .map(track => ({
                            id: track.id,
                            name: track.name,
                            artists: track.artists.map(artist => artist.name || 'Unknown Artist'),
                            album: track.album?.name || 'Unknown Album',
                            uri: track.uri,
                            confidence: this.calculateMatchConfidence(trackName, artistName, track)
                        }));
                    
                    results.push(...tracks);
                    
                    // If we found good matches, don't try more queries
                    const perfectMatches = tracks.filter(t => t.confidence === 'perfect');
                    if (perfectMatches.length > 0) {
                        break;
                    }
                } catch (error) {
                    console.warn(`Search query failed: ${query}`, error.message);
                    continue;
                }
            }
            
            // Remove duplicates based on track ID
            const uniqueResults = results.filter((track, index, self) => 
                index === self.findIndex(t => t.id === track.id)
            );
            
            // Sort by confidence
            return uniqueResults.sort((a, b) => {
                const confidenceOrder = { 'perfect': 0, 'good': 1, 'partial': 2, 'poor': 3 };
                return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
            });
            
        } catch (error) {
            console.error('Error searching tracks:', error);
            return [];
        }
    }
    
    cleanSearchTerm(term) {
        if (!term) return '';
        
        return term
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
            .replace(/\s+/g, ' ') // Multiple spaces to single space
            .trim();
    }    calculateMatchConfidence(originalTrack, originalArtist, spotifyTrack) {
        const normalizeString = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();        // Check for special version indicators in potential match when not in original
        const originalTrackLower = originalTrack.toLowerCase();
        const spotifyTrackLower = spotifyTrack.name.toLowerCase();
        
        // Define special version indicators to check
        const specialVersions = [
            { keyword: 'live', originalHas: originalTrackLower.includes('live'), spotifyHas: spotifyTrackLower.includes('live') },
            { keyword: 'instrumental', originalHas: originalTrackLower.includes('instrumental'), spotifyHas: spotifyTrackLower.includes('instrumental') },
            { keyword: 'remix', originalHas: originalTrackLower.includes('remix'), spotifyHas: spotifyTrackLower.includes('remix') },
            { keyword: 'acoustic', originalHas: originalTrackLower.includes('acoustic'), spotifyHas: spotifyTrackLower.includes('acoustic') },
            { keyword: 'cover', originalHas: originalTrackLower.includes('cover'), spotifyHas: spotifyTrackLower.includes('cover') },
            { keyword: 'edit', originalHas: originalTrackLower.includes('edit'), spotifyHas: spotifyTrackLower.includes('edit') && !spotifyTrackLower.includes('edited') },
            { keyword: 'version', originalHas: originalTrackLower.includes('version'), spotifyHas: spotifyTrackLower.includes('version') },
            // Check for different types of mixes with careful detection to avoid false positives
            { keyword: 'mix', originalHas: /\bmix\b|\(mix|\)mix|mix\)/.test(originalTrackLower), 
                           spotifyHas: /\bmix\b|\(mix|\)mix|mix\)/.test(spotifyTrackLower) && !spotifyTrackLower.includes('remix') },
            { keyword: 'radio edit', originalHas: originalTrackLower.includes('radio edit') || originalTrackLower.includes('radio version'), 
                                   spotifyHas: spotifyTrackLower.includes('radio edit') || spotifyTrackLower.includes('radio version') },
            { keyword: 'remastered', originalHas: originalTrackLower.includes('remaster'), spotifyHas: spotifyTrackLower.includes('remaster') }
        ];
        
        // Check if there are any special versions in Spotify track that aren't in original
        for (const version of specialVersions) {
            if (version.spotifyHas && !version.originalHas) {
                console.log(`Rejecting "${spotifyTrack.name}" because it contains "${version.keyword}" but original "${originalTrack}" doesn't`);
                return 'poor'; // Return poor confidence to effectively exclude from matches
            }
        }
          // Clean artist names for better matching
        const cleanOriginalArtist = this.cleanArtistForMatching(originalArtist);
        
        // Track matching - use more thorough normalization to prevent false negatives
        const normalizeTrackName = (name) => {
            return normalizeString(name)
                .replace(/\bfeat\.?\b|\bft\.?\b/g, '') // Remove feat., ft. indicators
                .replace(/\sand\s/g, '') // Remove "and" connecting artists
                .replace(/\s+/g, ' ') // Normalize spaces
                .trim();
        };
        
        const originalTrackNorm = normalizeTrackName(originalTrack);
        const spotifyTrackNorm = normalizeTrackName(spotifyTrack.name);
        const trackMatch = originalTrackNorm === spotifyTrackNorm;
        
        // Artist matching
        const artistMatch = spotifyTrack.artists.some(artist => 
            normalizeString(cleanOriginalArtist) === normalizeString(this.cleanArtistForMatching(artist.name))
        );

        // Perfect match: both track and artist match exactly
        if (trackMatch && artistMatch) return 'perfect';

        // Check for partial matches
        const trackPartialMatch = spotifyTrackNorm.includes(originalTrackNorm) ||
                                 originalTrackNorm.includes(spotifyTrackNorm);
        
        const artistPartialMatch = spotifyTrack.artists.some(artist => {
            const cleanSpotifyArtist = normalizeString(this.cleanArtistForMatching(artist.name));
            const cleanOriginalNorm = normalizeString(cleanOriginalArtist);
            return cleanSpotifyArtist.includes(cleanOriginalNorm) ||
                   cleanOriginalNorm.includes(cleanSpotifyArtist);
        });        // Enhanced perfect matching: High-quality partial matches should be treated as perfect
        // If both have very strong partial matches (one contains the other), treat as perfect
        const strongTrackMatch = trackMatch || (
            trackPartialMatch && 
            (originalTrackNorm.length > 3 && spotifyTrackNorm.length > 3) &&
            (originalTrackNorm.includes(spotifyTrackNorm) || spotifyTrackNorm.includes(originalTrackNorm)) &&
            // Additional lenient check: if the similarity is very high
            (Math.abs(originalTrackNorm.length - spotifyTrackNorm.length) <= 3)
        );
        
        const strongArtistMatch = artistMatch || (
            artistPartialMatch && 
            spotifyTrack.artists.some(artist => {
                const cleanSpotifyArtist = normalizeString(this.cleanArtistForMatching(artist.name));
                const cleanOriginalNorm = normalizeString(cleanOriginalArtist);
                return cleanOriginalNorm.length > 2 && cleanSpotifyArtist.length > 2 &&
                       (cleanOriginalNorm.includes(cleanSpotifyArtist) || cleanSpotifyArtist.includes(cleanOriginalNorm)) &&
                       // Be very lenient with artist matching
                       (Math.abs(cleanOriginalNorm.length - cleanSpotifyArtist.length) <= 5);
            })
        );

        // Treat strong partial matches as perfect for auto-sync
        if (strongTrackMatch && strongArtistMatch) return 'perfect';
        
        // Also treat cases where one is exact and the other is a strong partial as perfect
        if ((trackMatch && strongArtistMatch) || (artistMatch && strongTrackMatch)) {
            return 'perfect';
        }

        // Good match: exact track match with partial artist, or exact artist with partial track
        if ((trackMatch && artistPartialMatch) || (artistMatch && trackPartialMatch)) {
            return 'good';
        }

        // Good match: both have partial matches
        if (trackPartialMatch && artistPartialMatch) {
            return 'good';
        }

        // Partial match: either track or artist matches (exact or partial)
        if (trackMatch || artistMatch || trackPartialMatch || artistPartialMatch) {
            return 'partial';
        }

        return 'poor';
    }

    cleanArtistForMatching(artistName) {
        if (!artistName) return '';
        
        return artistName
            .replace(/\s*-\s*Topic\s*$/i, '') // Remove "- Topic" suffix
            .replace(/\s*VEVO\s*$/i, '') // Remove "VEVO" suffix
            .replace(/\s*Official\s*$/i, '') // Remove "Official" suffix
            .trim();
    }    async createPlaylist(name, description = '') {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Spotify');
        }

        try {
            // Try refreshing token before important operations
            await this.refreshToken();
            
            const user = await this.getCurrentUser();
            
            // Validate user object
            if (!user || !user.id) {
                console.error('Invalid user object:', user);
                throw new Error('Failed to get current user information');
            }
              console.log('Creating playlist for user:', user.id);
            console.log('Playlist name:', name);
            console.log('Playlist description:', description);
            
            // The spotify-web-api-node library can be inconsistent with promises vs callbacks
            // First try using the promise-based API (no callback parameter)
            let data;
            try {
                data = await this.spotify.createPlaylist(user.id, name, { 
                    description: description || '', 
                    public: false 
                });
                console.log('Successfully created playlist using promise API');
            } catch (promiseError) {
                console.log('Promise-based API failed, falling back to callback pattern');
                console.error('Promise error:', promiseError);
                
                // Fall back to callback pattern wrapped in a promise
                data = await new Promise((resolve, reject) => {
                    try {
                        this.spotify.createPlaylist(user.id, name, { 
                            description: description || '', 
                            public: false 
                        }, (err, callbackData) => {
                            if (err) {
                                return reject(err);
                            }
                            resolve(callbackData);
                        });
                    } catch (callbackError) {
                        reject(callbackError);
                    }
                });
            }
            
            console.log('Playlist creation response:', data);
              // Validate response
            if (!data) {
                console.error('Empty createPlaylist response');
                throw new Error('Empty response from Spotify API');
            }
            
            if (!data.body) {
                console.error('Invalid createPlaylist response structure:', data);
                throw new Error('Invalid response structure from Spotify API - missing body');
            }
            
            if (!data.body.id) {
                console.error('Missing playlist ID in response:', data.body);
                throw new Error('Invalid response from Spotify API - missing playlist ID');
            }
            
            console.log('Successfully created playlist:', data.body.id, data.body.name);
            
            // Return a well-structured playlist object
            return {
                id: data.body.id,
                name: data.body.name,
                description: data.body.description || '',
                url: data.body.external_urls?.spotify || '',
                trackCount: 0
            };} catch (error) {
            console.error('Error creating playlist:', error);
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
            
            // Additional diagnostics
            console.log('Authentication status:', this.isAuthenticated);
            console.log('Spotify API object exists:', !!this.spotify);
            
            // Check if we have access token
            try {
                const token = this.spotify.getAccessToken();
                console.log('Access token available:', !!token);
                console.log('Token length:', token ? token.length : 0);
            } catch (tokenError) {
                console.error('Error checking access token:', tokenError);
            }
            
            throw error;
        }
    }    async addTracksToPlaylist(playlistId, trackUris) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Spotify');
        }
        
        // Try refreshing token before important operations
        await this.refreshToken();

        try {
            // Spotify API limits to 100 tracks per request
            const chunks = [];
            for (let i = 0; i < trackUris.length; i += 100) {
                chunks.push(trackUris.slice(i, i + 100));
            }            const results = [];
            for (const chunk of chunks) {
                let data;
                try {
                    // Try promise-based API first
                    data = await this.spotify.addTracksToPlaylist(playlistId, chunk);
                    console.log('Successfully added tracks using promise API');
                } catch (promiseError) {
                    console.log('Promise-based API failed for addTracksToPlaylist, falling back to callback pattern');
                    console.error('Promise error:', promiseError);
                    
                    // Fall back to callback pattern
                    data = await new Promise((resolve, reject) => {
                        try {
                            this.spotify.addTracksToPlaylist(playlistId, chunk, (err, callbackData) => {
                                if (err) {
                                    return reject(err);
                                }
                                resolve(callbackData);
                            });
                        } catch (callbackError) {
                            reject(callbackError);
                        }
                    });
                }
                results.push(data.body);
            }

            return results;
        } catch (error) {
            console.error('Error adding tracks to playlist:', error);
            throw error;
        }
    }    async removeTracksFromPlaylist(playlistId, trackUris) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Spotify');
        }
        
        // Try refreshing token before important operations
        await this.refreshToken();

        try {            const tracks = trackUris.map(uri => ({ uri }));
            let data;
            try {
                // Try promise-based API first
                data = await this.spotify.removeTracksFromPlaylist(playlistId, tracks);
                console.log('Successfully removed tracks using promise API');
            } catch (promiseError) {
                console.log('Promise-based API failed for removeTracksFromPlaylist, falling back to callback pattern');
                console.error('Promise error:', promiseError);
                
                // Fall back to callback pattern
                data = await new Promise((resolve, reject) => {
                    try {
                        this.spotify.removeTracksFromPlaylist(playlistId, tracks, (err, callbackData) => {
                            if (err) {
                                return reject(err);
                            }
                            resolve(callbackData);
                        });
                    } catch (callbackError) {
                        reject(callbackError);
                    }
                });
            }
            return data.body;
        } catch (error) {
            console.error('Error removing tracks from playlist:', error);
            throw error;
        }
    }

    async refreshToken() {
        try {
            if (!this.spotify.getRefreshToken()) {
                console.warn('No refresh token available, cannot refresh access token');
                return false;
            }
            
            console.log('Manually refreshing access token...');
            const refreshData = await this.spotify.refreshAccessToken();
            this.spotify.setAccessToken(refreshData.body.access_token);
            console.log('Access token manually refreshed successfully');
            return true;
        } catch (error) {
            console.error('Error manually refreshing token:', error);
            return false;
        }
    }

    async getTrack(trackId) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Spotify');
        }

        try {
            // Try refreshing token before important operations
            await this.refreshToken();
            
            const data = await this.spotify.getTrack(trackId);
            
            // Validate response
            if (!data || !data.body) {
                console.error('Invalid getTrack response:', data);
                throw new Error('Invalid response from Spotify API');
            }
            
            const track = data.body;
            
            // Return track in the same format as searchTrack
            return {
                id: track.id,
                name: track.name,
                artists: track.artists.map(artist => artist.name || 'Unknown Artist'),
                album: track.album?.name || 'Unknown Album',
                uri: track.uri,
                duration_ms: track.duration_ms
            };
        } catch (error) {
            console.error('Error getting track by ID:', error);
            throw error;
        }
    }
}

module.exports = SpotifyService;
