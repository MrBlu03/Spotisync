const { google } = require('googleapis');

class YouTubeMusicService {
    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
        this.isAuthenticated = false;
        this.quotaExceeded = false;
        console.log('YouTube Music Service initialized');
    }

    /**
     * Check if error is due to quota exceeded
     */
    isQuotaExceededError(error) {
        return error.code === 403 && 
               (error.message.includes('quotaExceeded') || 
                error.message.includes('quota') ||
                (error.errors && error.errors.some(e => e.reason === 'quotaExceeded')));
    }

    /**
     * Handle API errors with quota awareness
     */
    handleApiError(error, operation) {
        if (this.isQuotaExceededError(error)) {
            this.quotaExceeded = true;
            console.warn(`YouTube API quota exceeded for operation: ${operation}`);
            throw new Error(`YouTube API quota exceeded. Please try again tomorrow or contact the developer to increase quota limits.`);
        }
        
        console.error(`YouTube API error during ${operation}:`, error);
        throw error;
    }

    getAuthUrl() {
        const scopes = [
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/youtubepartner'
        ];
        
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });
    }    async authenticate(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);
            this.isAuthenticated = true;
            this.quotaExceeded = false; // Reset quota flag on successful auth
            return tokens;
        } catch (error) {
            console.error('YouTube authentication error:', error);
            this.handleApiError(error, 'authentication');
        }
    }    async getUserPlaylists() {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with YouTube');
        }
        
        if (this.quotaExceeded) {
            throw new Error('YouTube API quota exceeded. Cannot fetch playlists at this time.');
        }
        
        try {
            const response = await this.youtube.playlists.list({
                part: ['snippet', 'contentDetails'],
                mine: true,
                maxResults: 50
            });

            return response.data.items.map(playlist => ({
                id: playlist.id,
                name: playlist.snippet.title,
                description: playlist.snippet.description || '',
                trackCount: playlist.contentDetails.itemCount,
                thumbnail: playlist.snippet.thumbnails?.medium?.url
            }));
        } catch (error) {
            this.handleApiError(error, 'getUserPlaylists');        }
    }

    async getPlaylistTracks(playlistId) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with YouTube');
        }
        
        if (this.quotaExceeded) {
            throw new Error('YouTube API quota exceeded. Cannot fetch playlist tracks at this time.');
        }
        
        try {
            const tracks = [];
            let nextPageToken = null;
            const maxResults = 50; // YouTube API limit per request

            do {
                const requestParams = {
                    part: ['snippet'],
                    playlistId: playlistId,
                    maxResults: maxResults
                };

                if (nextPageToken) {
                    requestParams.pageToken = nextPageToken;
                }

                const response = await this.youtube.playlistItems.list(requestParams);
                
                const pageItems = response.data.items.map(item => {
                    const snippet = item.snippet;
                    const rawTitle = snippet.title;
                    
                    // Parse artist and title from video title
                    const { artist, title } = this.parseVideoTitle(rawTitle);
                    
                    return {
                        id: snippet.resourceId.videoId,
                        title: title,
                        artist: artist,
                        album: 'Unknown Album', // YouTube doesn't provide album info directly
                        duration: 'Unknown', // Would need additional API call to get duration
                        thumbnail: snippet.thumbnails?.medium?.url,
                        rawTitle: rawTitle, // Keep original title for debugging
                        channelTitle: snippet.videoOwnerChannelTitle
                    };
                });

                tracks.push(...pageItems);
                nextPageToken = response.data.nextPageToken;
                
                console.log(`Fetched ${pageItems.length} tracks from YouTube playlist (total so far: ${tracks.length})`);
                
            } while (nextPageToken);            console.log(`Total tracks fetched from YouTube playlist: ${tracks.length}`);
            return tracks;
        } catch (error) {
            this.handleApiError(error, 'getPlaylistTracks');
        }
    }

    async searchTrack(trackName, artistName) {
        if (!this.isAuthenticated) {
            console.log(`Mock search for: ${trackName} by ${artistName}`);
            
            // Mock search results for demonstration
            const mockResults = [
                {
                    videoId: 'mock_video_1',
                    name: trackName,
                    title: trackName,
                    artists: [{ name: artistName }],
                    album: { name: 'Mock Album' },
                    duration: { text: '3:45' }
                }
            ];
            
            return mockResults.map(track => ({
                id: track.videoId,
                title: track.name || track.title,
                artist: this.extractArtistName(track),
                album: track.album?.name || 'Unknown Album',
                duration: track.duration?.text || 'Unknown',
                confidence: this.calculateMatchConfidence(trackName, artistName, track)
            }));        }

        if (this.quotaExceeded) {
            console.log(`YouTube API quota exceeded - returning empty results for: ${trackName} by ${artistName}`);
            return [];
        }

        try {
            // Real YouTube search implementation
            const response = await this.youtube.search.list({
                part: ['snippet'],
                q: `${trackName} ${artistName}`,
                type: 'video',
                maxResults: 5
            });

            return response.data.items.map(item => ({
                id: item.id.videoId,
                title: item.snippet.title,
                artist: item.snippet.channelTitle,
                album: 'Unknown Album',
                duration: 'Unknown',
                thumbnail: item.snippet.thumbnails?.medium?.url,
                confidence: this.calculateMatchConfidence(trackName, artistName, {
                    title: item.snippet.title,
                    artist: { name: item.snippet.channelTitle }
                })
            }));
        } catch (error) {
            this.handleApiError(error, 'searchTrack');
        }
    }    // Enhanced search method with artist topic channel prioritization
    async searchTrackWithArtistPriority(trackName, artistName) {
        if (!this.isAuthenticated) {
            console.log(`Mock search with artist priority for: ${trackName} by ${artistName}`);
            
            // Mock search results for demonstration
            const mockResults = [
                {
                    videoId: 'mock_video_1',
                    title: trackName,
                    artist: artistName,
                    channelTitle: `${artistName} - Topic`,
                    isTopicChannel: true,
                    confidence: 'perfect'
                }
            ];
            
            return mockResults;
        }

        if (this.quotaExceeded) {
            console.log(`YouTube API quota exceeded - returning empty results for artist priority search: ${trackName} by ${artistName}`);
            return [];
        }

        try {
            console.log(`🔍 Searching YouTube Music for: "${trackName}" by "${artistName}"`);
            
            // Search with multiple strategies to find the best matches
            const searchQueries = [
                `"${trackName}" "${artistName}"`, // Exact phrases
                `${trackName} ${artistName}`,     // Regular search
                `${artistName} ${trackName}`,     // Artist first
            ];

            let allResults = [];
            
            for (const query of searchQueries) {
                try {
                    console.log(`  📡 Trying search query: ${query}`);
                    const response = await this.youtube.search.list({
                        part: ['snippet'],
                        q: query,
                        type: 'video',
                        videoCategoryId: '10', // Music category
                        maxResults: 10
                    });

                    if (response.data.items && response.data.items.length > 0) {
                        const results = response.data.items.map(item => ({
                            videoId: item.id.videoId,
                            title: this.cleanTrackTitle(item.snippet.title),
                            artist: this.extractArtistName({
                                channelTitle: item.snippet.channelTitle,
                                title: item.snippet.title
                            }),
                            channelTitle: item.snippet.channelTitle,
                            thumbnail: item.snippet.thumbnails?.medium?.url,
                            isTopicChannel: item.snippet.channelTitle?.toLowerCase().includes('topic') || false,
                            confidence: this.calculateMatchConfidence(trackName, artistName, {
                                title: item.snippet.title,
                                channelTitle: item.snippet.channelTitle
                            })
                        }));

                        allResults.push(...results);
                    }

                    // Add small delay between searches
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (searchError) {
                    console.error(`  ❌ Search query failed: ${query}`, searchError.message);
                }
            }

            // Remove duplicates and prioritize results
            const uniqueResults = this.removeDuplicates(allResults);
            const prioritizedResults = this.prioritizeSearchResults(uniqueResults, trackName, artistName);

            console.log(`  ✅ Found ${prioritizedResults.length} unique results after prioritization`);
            
            // Log the top results for debugging
            prioritizedResults.slice(0, 3).forEach((result, index) => {
                console.log(`    ${index + 1}. "${result.title}" by "${result.artist}" (${result.channelTitle}) - ${result.isTopicChannel ? 'TOPIC CHANNEL' : 'regular'} - ${result.confidence}`);
            });            return prioritizedResults.slice(0, 5); // Return top 5 results

        } catch (error) {
            this.handleApiError(error, 'searchTrackWithArtistPriority');
        }
    }    // Method to create a new YouTube Music playlist
    async createPlaylist(name, description = '') {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with YouTube');
        }

        if (this.quotaExceeded) {
            throw new Error('YouTube API quota exceeded. Cannot create playlist at this time.');
        }

        try {
            console.log(`🎵 Creating new YouTube Music playlist: "${name}"`);
            
            const response = await this.youtube.playlists.insert({
                part: ['snippet', 'status'],
                resource: {
                    snippet: {
                        title: name,
                        description: description || 'Created by Spotisync',
                        defaultLanguage: 'en'
                    },
                    status: {
                        privacyStatus: 'private' // Start as private, user can change later
                    }
                }
            });

            const playlist = response.data;
            console.log(`✅ Playlist created successfully with ID: ${playlist.id}`);
            
            return {
                id: playlist.id,
                name: playlist.snippet.title,
                description: playlist.snippet.description,
                url: `https://music.youtube.com/playlist?list=${playlist.id}`            };

        } catch (error) {
            this.handleApiError(error, 'createPlaylist');
        }
    }    // Method to add a track to a YouTube Music playlist
    async addTrackToPlaylist(playlistId, videoId) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with YouTube');
        }

        if (this.quotaExceeded) {
            throw new Error('YouTube API quota exceeded. Cannot add tracks to playlist at this time.');
        }

        try {
            console.log(`🎵 Adding video ${videoId} to playlist ${playlistId}`);
            
            const response = await this.youtube.playlistItems.insert({
                part: ['snippet'],
                resource: {
                    snippet: {
                        playlistId: playlistId,
                        resourceId: {
                            kind: 'youtube#video',
                            videoId: videoId
                        }
                    }
                }
            });            console.log(`✅ Track added successfully to playlist`);
            return response.data;

        } catch (error) {
            this.handleApiError(error, 'addTrackToPlaylist');
        }
    }

    // Helper method to clean track titles
    cleanTrackTitle(title) {
        if (!title) return '';
        
        // Remove common YouTube suffixes and prefixes
        return title
            .replace(/\s*\(Official Video\)/gi, '')
            .replace(/\s*\(Official Music Video\)/gi, '')
            .replace(/\s*\(Official Audio\)/gi, '')
            .replace(/\s*\(Lyrics\)/gi, '')
            .replace(/\s*\[Official Video\]/gi, '')
            .replace(/\s*\[Official Music Video\]/gi, '')
            .replace(/\s*\[Official Audio\]/gi, '')
            .replace(/\s*\[Lyrics\]/gi, '')
            .replace(/\s*\|\s*Official\s*/gi, '')
            .replace(/\s*-\s*Official\s*/gi, '')
            .trim();
    }

    // Helper method to remove duplicate search results
    removeDuplicates(results) {
        const seen = new Set();
        return results.filter(result => {
            const key = `${result.videoId}_${result.title}_${result.artist}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // Helper method to prioritize search results with artist topic channels first
    prioritizeSearchResults(results, originalTrack, originalArtist) {
        const normalizeString = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const originalTrackNorm = normalizeString(originalTrack);
        const originalArtistNorm = normalizeString(originalArtist);

        return results.sort((a, b) => {
            // Score each result
            let scoreA = 0;
            let scoreB = 0;

            // PRIORITY 1: Artist Topic Channels get highest priority (100 points)
            if (a.isTopicChannel) scoreA += 100;
            if (b.isTopicChannel) scoreB += 100;

            // PRIORITY 2: Exact artist match in topic channel (50 points)
            if (a.isTopicChannel && normalizeString(a.artist) === originalArtistNorm) scoreA += 50;
            if (b.isTopicChannel && normalizeString(b.artist) === originalArtistNorm) scoreB += 50;

            // PRIORITY 3: Exact track title match (40 points)
            if (normalizeString(a.title) === originalTrackNorm) scoreA += 40;
            if (normalizeString(b.title) === originalTrackNorm) scoreB += 40;

            // PRIORITY 4: Exact artist match (30 points)
            if (normalizeString(a.artist) === originalArtistNorm) scoreA += 30;
            if (normalizeString(b.artist) === originalArtistNorm) scoreB += 30;

            // PRIORITY 5: Partial track title match (20 points)
            if (normalizeString(a.title).includes(originalTrackNorm) || originalTrackNorm.includes(normalizeString(a.title))) scoreA += 20;
            if (normalizeString(b.title).includes(originalTrackNorm) || originalTrackNorm.includes(normalizeString(b.title))) scoreB += 20;

            // PRIORITY 6: Partial artist match (15 points)
            if (normalizeString(a.artist).includes(originalArtistNorm) || originalArtistNorm.includes(normalizeString(a.artist))) scoreA += 15;
            if (normalizeString(b.artist).includes(originalArtistNorm) || originalArtistNorm.includes(normalizeString(b.artist))) scoreB += 15;

            // PRIORITY 7: Confidence bonus (10 points for perfect, 5 for good)
            if (a.confidence === 'perfect') scoreA += 10;
            else if (a.confidence === 'good') scoreA += 5;
            if (b.confidence === 'perfect') scoreB += 10;
            else if (b.confidence === 'good') scoreB += 5;

            // Sort by highest score first
            return scoreB - scoreA;
        });
    }

    parseVideoTitle(rawTitle) {
        // Common patterns for YouTube music videos:
        // "Artist - Song Title"
        // "Artist: Song Title" 
        // "Song Title - Artist"
        // "Song Title by Artist"
        // "Artist | Song Title"
        
        const title = rawTitle.trim();
        
        // Try pattern: "Artist - Song Title"
        if (title.includes(' - ')) {
            const parts = title.split(' - ');
            if (parts.length >= 2) {
                const potentialArtist = parts[0].trim();
                const potentialTitle = parts.slice(1).join(' - ').trim();
                  // Avoid cases where the first part looks like a song title
                if (!this.looksLikeSongTitle(potentialArtist)) {
                    return {
                        artist: this.cleanArtistName(potentialArtist),
                        title: potentialTitle
                    };
                }
                // Try reverse: "Song Title - Artist"
                else if (!this.looksLikeSongTitle(potentialTitle)) {
                    return {
                        artist: this.cleanArtistName(potentialTitle),
                        title: potentialArtist
                    };
                }
            }
        }
          // Try pattern: "Artist: Song Title"
        if (title.includes(': ')) {
            const parts = title.split(': ');
            if (parts.length >= 2) {
                return {
                    artist: this.cleanArtistName(parts[0].trim()),
                    title: parts.slice(1).join(': ').trim()
                };
            }
        }
        
        // Try pattern: "Song Title by Artist"
        if (title.includes(' by ')) {
            const parts = title.split(' by ');
            if (parts.length >= 2) {
                return {
                    artist: this.cleanArtistName(parts[parts.length - 1].trim()),
                    title: parts.slice(0, -1).join(' by ').trim()
                };
            }
        }
        
        // Try pattern: "Artist | Song Title"
        if (title.includes(' | ')) {
            const parts = title.split(' | ');
            if (parts.length >= 2) {
                return {
                    artist: this.cleanArtistName(parts[0].trim()),
                    title: parts.slice(1).join(' | ').trim()
                };
            }
        }
        
        // If no pattern matches, try to extract from common keywords
        const keywords = ['official video', 'official music video', 'lyrics', 'audio', 'hd', 'hq'];
        let cleanTitle = title;
        
        // Remove common keywords (case insensitive)
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\s*\\(.*${keyword}.*\\)`, 'gi');
            cleanTitle = cleanTitle.replace(regex, '');
            const regex2 = new RegExp(`\\s*\\[.*${keyword}.*\\]`, 'gi');
            cleanTitle = cleanTitle.replace(regex2, '');
        });
        
        // If still no clear separation, use the whole title as song title
        return {
            artist: 'Unknown Artist',
            title: cleanTitle.trim() || title
        };
    }
    
    looksLikeSongTitle(text) {
        // Simple heuristic: if it contains common song title indicators
        const songIndicators = ['official video', 'music video', 'lyrics', 'audio', 'ft.', 'feat.', 'remix'];
        const lowerText = text.toLowerCase();
        return songIndicators.some(indicator => lowerText.includes(indicator));
    }    extractArtistName(track) {
        // PRIORITY 1: Check if it's a "Topic" channel - which always indicates the artist name
        // Topic channels are official artist channels managed by YouTube Music
        if (track.channelTitle && track.channelTitle.toLowerCase().includes('topic')) {
            const artistName = this.cleanArtistName(track.channelTitle);
            console.log(`Found Topic channel: ${track.channelTitle} → Using artist "${artistName}" for track: ${track.title || track.name}`);
            
            // Log additional information for debugging
            if (track.artist && track.artist !== 'Unknown Artist' && 
                this.cleanArtistName(track.artist) !== artistName) {
                console.log(`  Note: Overriding track artist "${track.artist}" with Topic channel artist "${artistName}"`);
            }
            
            return artistName;
        }
        
        // If we already parsed the artist, use it
        if (track.artist && track.artist !== 'Unknown Artist') {
            return this.cleanArtistName(track.artist);
        }
        
        // Try different properties
        if (track.artist?.name) return this.cleanArtistName(track.artist.name);
        if (track.artists && track.artists.length > 0) {
            return this.cleanArtistName(track.artists[0].name);
        }
        if (track.subtitle) {
            // YouTube Music often puts artist info in subtitle
            return this.cleanArtistName(track.subtitle.split(' • ')[0]);
        }
        
        // Fallback to channel title if no artist found
        if (track.channelTitle && track.channelTitle !== 'Unknown Artist') {
            return this.cleanArtistName(track.channelTitle);
        }
        
        // Last resort: try to parse from raw title
        if (track.rawTitle) {
            const parsed = this.parseVideoTitle(track.rawTitle);
            if (parsed.artist !== 'Unknown Artist') {
                return this.cleanArtistName(parsed.artist);
            }
        }
        
        return 'Unknown Artist';
    }

    cleanArtistName(artistName) {
        if (!artistName) return 'Unknown Artist';
        
        // Enhanced cleaning for better artist name extraction
        return artistName
            .replace(/\s*-\s*Topic\s*$/i, '') // Remove "- Topic" suffix
            .replace(/\s*VEVO\s*$/i, '') // Remove "VEVO" suffix
            .replace(/\s*Official\s*$/i, '') // Remove "Official" suffix
            .replace(/\s*Music\s*$/i, '') // Remove "Music" suffix
            .replace(/\s*Band\s*$/i, '') // Remove "Band" suffix
            .replace(/\s*Channel\s*$/i, '') // Remove "Channel" suffix
            .replace(/\s*Records\s*$/i, '') // Remove "Records" suffix
            .replace(/^The\s+(.+)$/i, '$1') // Move "The" from beginning to end
            .trim();
    }

    calculateMatchConfidence(originalTrack, originalArtist, youtubeTrack) {
        const normalizeString = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
        
        const trackName = youtubeTrack.name || youtubeTrack.title || '';
        const artistName = this.extractArtistName(youtubeTrack);
        
        const trackMatch = normalizeString(originalTrack) === normalizeString(trackName);
        const artistMatch = normalizeString(originalArtist) === normalizeString(artistName);

        if (trackMatch && artistMatch) return 'perfect';
        
        // Check for partial matches (useful for variations in titles)
        const trackPartialMatch = normalizeString(trackName).includes(normalizeString(originalTrack)) ||
                                 normalizeString(originalTrack).includes(normalizeString(trackName));
        const artistPartialMatch = normalizeString(artistName).includes(normalizeString(originalArtist)) ||
                                  normalizeString(originalArtist).includes(normalizeString(artistName));

        if (trackPartialMatch && artistPartialMatch) return 'good';
        if (trackMatch || artistMatch) return 'partial';
        return 'poor';
    }

    // Helper method to get track info in a standardized format
    normalizeTrackInfo(track) {
        return {
            id: track.id || track.videoId,
            title: track.title || track.name,
            artist: this.extractArtistName(track),
            album: track.album?.name || 'Unknown Album',
            duration: track.duration?.text || track.duration || 'Unknown'
        };
    }

    // Method to validate if YouTube Music API is properly set up
    async validateSetup() {
        try {
            return { valid: true, message: 'YouTube Music API ready' };
        } catch (error) {
            return { 
                valid: false, 
                message: 'YouTube Music API setup required. Please configure authentication.',
                error: error.message 
            };
        }
    }
}

module.exports = YouTubeMusicService;
