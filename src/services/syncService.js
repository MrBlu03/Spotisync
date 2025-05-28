class SyncService {
    constructor(spotifyService, youtubeMusicService) {
        this.spotify = spotifyService;
        this.youtubeMusic = youtubeMusicService;
    }    async previewSync(youtubePlaylistId, spotifyPlaylistId, progressCallback = null) {
        try {
            console.log(`Previewing sync from YouTube playlist ${youtubePlaylistId} to Spotify playlist ${spotifyPlaylistId}`);

            // Get tracks from both playlists
            const [youtubeTrackIds, spotifyTracks] = await Promise.all([
                this.youtubeMusic.getPlaylistTracks(youtubePlaylistId),
                spotifyPlaylistId ? this.spotify.getPlaylistTracks(spotifyPlaylistId) : []
            ]);            if (progressCallback) {
                progressCallback({
                    phase: 'analyzing',
                    message: `Found ${youtubeTrackIds.length} YouTube tracks and ${spotifyTracks.length} Spotify tracks`,
                    current: 0,
                    total: youtubeTrackIds.length,
                    percentage: 0,
                    stats: {
                        processed: 0,
                        total: youtubeTrackIds.length,
                        matches: 0,
                        duplicates: 0
                    }
                });
            }

            const results = {
                perfectMatches: [],
                uncertainMatches: [],
                noMatches: [],
                duplicates: [],
                summary: {
                    totalYoutubeTracks: youtubeTrackIds.length,
                    existingSpotifyTracks: spotifyTracks.length,
                    perfectMatchCount: 0,
                    uncertainMatchCount: 0,
                    noMatchCount: 0,
                    duplicateCount: 0
                }
            };            // Process each YouTube track
            for (let i = 0; i < youtubeTrackIds.length; i++) {
                const youtubeTrack = youtubeTrackIds[i];
                const trackInfo = this.youtubeMusic.normalizeTrackInfo(youtubeTrack);
                
                const percentage = Math.round(((i + 1) / youtubeTrackIds.length) * 100);
                  if (progressCallback) {
                    progressCallback({
                        phase: 'processing',
                        message: `Processing: "${trackInfo.title}" by "${trackInfo.artist}"`,
                        current: i + 1,
                        total: youtubeTrackIds.length,
                        percentage: percentage,
                        stats: {
                            processed: i + 1,
                            total: youtubeTrackIds.length,
                            matches: results.perfectMatches.length + results.uncertainMatches.length,
                            duplicates: results.duplicates.length
                        }
                    });
                }
                
                console.log(`\n🔍 Processing ${i + 1}/${youtubeTrackIds.length} (${percentage}%): "${trackInfo.title}" by "${trackInfo.artist}"`);
                console.log(`📋 Checking against ${spotifyTracks.length} existing Spotify tracks`);
                
                // Check if track already exists in destination playlist FIRST
                const existingTrack = this.findExistingTrack(trackInfo, spotifyTracks);
                
                if (existingTrack) {
                    console.log(`✅ Found existing track: "${existingTrack.name}" by "${existingTrack.artists.join(', ')}"`);
                } else {
                    console.log(`❌ No existing track found, will search Spotify API`);
                }
                
                // Search for the track on Spotify only if not already in playlist
                const spotifyMatches = existingTrack ? [] : await this.spotify.searchTrack(trackInfo.title, trackInfo.artist);
                  if (existingTrack) {
                    // Verify if it's actually the same track
                    const confidence = this.spotify.calculateMatchConfidence(
                        trackInfo.title, 
                        trackInfo.artist, 
                        existingTrack
                    );
                    
                    // For tracks that already exist in playlist, be more lenient
                    // Since our findExistingTrack method already filtered for good matches,
                    // we can treat most existing tracks as perfect matches
                    if (confidence === 'perfect' || confidence === 'good') {
                        results.duplicates.push({
                            youtubeTrack: trackInfo,
                            spotifyTrack: existingTrack,
                            reason: 'Already in playlist with perfect match'
                        });
                        results.summary.duplicateCount++;
                    } else {
                        // Even partial matches in existing playlist can be treated as duplicates
                        // since the user likely added them manually already
                        results.duplicates.push({
                            youtubeTrack: trackInfo,
                            spotifyTrack: existingTrack,
                            reason: 'Already in playlist (likely same track with slight variation)'
                        });
                        results.summary.duplicateCount++;
                    }
                    continue;
                }                // Find best matches
                const perfectMatches = spotifyMatches.filter(match => match.confidence === 'perfect');
                const goodMatches = spotifyMatches.filter(match => match.confidence === 'good');
                const partialMatches = spotifyMatches.filter(match => match.confidence === 'partial');

                if (perfectMatches.length === 1) {
                    // Single perfect match - safe to sync
                    console.log(`🎯 Perfect match found: "${perfectMatches[0].name}" by "${perfectMatches[0].artists.join(', ')}"`);
                    results.perfectMatches.push({
                        youtubeTrack: trackInfo,
                        spotifyTrack: perfectMatches[0],
                        confidence: 'perfect'
                    });
                    results.summary.perfectMatchCount++;
                } else if (perfectMatches.length > 1) {
                    // Multiple perfect matches - show best one but auto-approve it (CHANGED BEHAVIOR)
                    const bestMatch = this.selectBestMatch(perfectMatches, trackInfo);
                    console.log(`🎯 Multiple perfect matches - auto-approving best match: "${bestMatch.name}" by "${bestMatch.artists.join(', ')}"`);
                    results.perfectMatches.push({
                        youtubeTrack: trackInfo,
                        spotifyTrack: bestMatch,
                        confidence: 'perfect (best of multiple)'
                    });
                    results.summary.perfectMatchCount++;
                } else if (goodMatches.length === 1) {
                    // Single good match - treat as perfect for auto-sync (more aggressive matching)
                    console.log(`🎯 Auto-approving single good match: "${goodMatches[0].name}" by "${goodMatches[0].artists.join(', ')}"`);
                    results.perfectMatches.push({
                        youtubeTrack: trackInfo,
                        spotifyTrack: goodMatches[0],
                        confidence: 'good (auto-approved)'
                    });
                    results.summary.perfectMatchCount++;
                } else if (goodMatches.length > 1) {
                    // Multiple good matches - show best one for manual review
                    const bestMatch = this.selectBestMatch(goodMatches, trackInfo);
                    results.uncertainMatches.push({
                        youtubeTrack: trackInfo,
                        spotifyMatches: [bestMatch], // Only show the best match
                        reason: 'Multiple good matches found - please review',
                        requiresManualReview: true
                    });
                    results.summary.uncertainMatchCount++;                } else if (partialMatches.length > 0) {
                    // Get the best partial match
                    const bestMatch = this.selectBestMatch(partialMatches, trackInfo);
                    
                    // Recheck confidence - some partial matches are upgraded to perfect by the algorithm
                    // in spotifyServices.js when they're high-quality matches
                    const finalConfidence = bestMatch.confidence;
                    
                    // If the confidence is 'perfect', auto-approve it
                    if (finalConfidence === 'perfect') {
                        // This partial match was scored as 'perfect' so put it in perfectMatches
                        console.log(`🎯 Auto-approving high-quality partial match as perfect: "${bestMatch.name}" by "${bestMatch.artists.join(', ')}"`);
                        results.perfectMatches.push({
                            youtubeTrack: trackInfo,
                            spotifyTrack: bestMatch,
                            confidence: 'perfect (upgraded partial)'
                        });
                        results.summary.perfectMatchCount++;
                    } else {
                        // Regular partial match - manual review
                        console.log(`⚠️ Partial match needs review: "${bestMatch.name}" by "${bestMatch.artists.join(', ')}" (confidence: ${finalConfidence})`);
                        results.uncertainMatches.push({
                            youtubeTrack: trackInfo,
                            spotifyMatches: [bestMatch], // Only show the best match
                            reason: 'Partial match found - please verify',
                            requiresManualReview: true
                        });
                        results.summary.uncertainMatchCount++;
                    }
                } else {
                    // No good matches found
                    results.noMatches.push({
                        youtubeTrack: trackInfo,
                        reason: 'No suitable matches found on Spotify'
                    });
                    results.summary.noMatchCount++;
                }                // Add a small delay to avoid hitting API rate limits
                await this.delay(100);
            }            if (progressCallback) {
                progressCallback({
                    phase: 'complete',
                    message: `Analysis complete! Found ${results.summary.perfectMatchCount} perfect matches, ${results.summary.uncertainMatchCount} uncertain matches, ${results.summary.duplicateCount} duplicates, ${results.summary.noMatchCount} no matches`,
                    current: youtubeTrackIds.length,
                    total: youtubeTrackIds.length,
                    percentage: 100,
                    stats: {
                        processed: youtubeTrackIds.length,
                        total: youtubeTrackIds.length,
                        matches: results.summary.perfectMatchCount + results.summary.uncertainMatchCount,
                        duplicates: results.summary.duplicateCount
                    }
                });
            }

            return results;
        } catch (error) {
            console.error('Error during sync preview:', error);
            throw error;
        }    }    async executeSync(options) {
        console.log('executeSync called with options:', options);
        
        if (!options) {
            throw new Error('Options parameter is required');
        }

        const { 
            youtubePlaylistId, 
            spotifyPlaylistId, 
            approvedTracks, 
            createNewPlaylist,
            newPlaylistName,
            removeDuplicates = false,
            previewResults // Added parameter for preview results
        } = options;

        try {
            console.log('Starting sync execution with options:', {
                youtubePlaylistId,
                spotifyPlaylistId,
                approvedTracksCount: approvedTracks?.length || 0,
                createNewPlaylist,
                newPlaylistName
            });

            // Validate authentication
            if (!this.spotify.isAuthenticated) {
                throw new Error('Spotify not authenticated');
            }

            // Validate input
            if (!approvedTracks || !Array.isArray(approvedTracks)) {
                throw new Error('Invalid approvedTracks: must be an array');
            }

            if (approvedTracks.length === 0) {
                console.log('No tracks to sync');
                return {
                    playlistId: spotifyPlaylistId,
                    tracksAdded: [],
                    tracksFailed: [],
                    duplicatesRemoved: [],
                    nonTransferred: {
                        unmatchedTracks: [],
                        unapprovedTracks: [],
                        failedTracks: []
                    },
                    summary: {
                        totalApproved: 0,
                        successfullyAdded: 0,
                        failed: 0,
                        duplicatesRemoved: 0,
                        nonTransferredCount: 0
                    }
                };
            }

            let targetPlaylistId = spotifyPlaylistId;            // Create new playlist if requested
            if (createNewPlaylist) {
                try {
                    console.log('Creating new playlist...');
                    const playlistName = newPlaylistName || `YouTube Sync - ${new Date().toLocaleDateString()}`;
                    
                    // Retry playlist creation up to 3 times with increasing delay
                    let retries = 0;
                    let newPlaylist = null;
                    
                    while (retries < 3 && !newPlaylist) {
                        try {
                            if (retries > 0) {
                                console.log(`Retry attempt ${retries + 1} for creating playlist "${playlistName}"...`);
                                // Wait for a bit before retrying (exponential backoff)
                                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
                            }
                            
                            newPlaylist = await this.spotify.createPlaylist(
                                playlistName,
                                `Synced from YouTube Music on ${new Date().toLocaleDateString()}`
                            );
                        } catch (createError) {
                            console.error(`Attempt ${retries + 1} failed:`, createError);
                            retries++;
                            
                            if (retries >= 3) {
                                throw createError; // Re-throw after final attempt
                            }
                        }
                    }
                    
                    if (!newPlaylist || !newPlaylist.id) {
                        throw new Error('Created playlist object is invalid or missing ID');
                    }
                    
                    targetPlaylistId = newPlaylist.id;
                    console.log(`Successfully created new playlist: ${playlistName} (ID: ${targetPlaylistId})`);
                } catch (playlistError) {
                    console.error('Failed to create playlist after multiple attempts:', playlistError);
                    throw new Error(`Failed to create playlist: ${playlistError.message}`);
                }
            }

            if (!targetPlaylistId) {
                throw new Error('No target playlist ID provided and createNewPlaylist is false');
            }            const results = {
                playlistId: targetPlaylistId,
                tracksAdded: [],
                tracksFailed: [],
                duplicatesRemoved: [],
                nonTransferred: {
                    unmatchedTracks: [],
                    unapprovedTracks: [],
                    failedTracks: []
                },
                summary: {
                    totalApproved: approvedTracks.length,
                    successfullyAdded: 0,
                    failed: 0,
                    duplicatesRemoved: 0,
                    nonTransferredCount: 0
                }
            };
              // If previewResults were provided, we can identify non-transferred tracks
            if (previewResults) {
                // Find tracks that had no matches in Spotify
                results.nonTransferred.unmatchedTracks = previewResults.noMatches || [];
                console.log(`Found ${results.nonTransferred.unmatchedTracks.length} unmatched tracks to report`);
                
                // Identify tracks that were uncertain matches but not approved
                const approvedTrackIds = new Set(approvedTracks.map(track => {
                    if (!track.youtubeTrack) {
                        console.warn('Invalid track structure in approvedTracks:', track);
                        return '';
                    }
                    return `${track.youtubeTrack.title}-${track.youtubeTrack.artist}`.toLowerCase();
                }).filter(id => id)); // Filter out empty IDs
                
                console.log(`Found ${approvedTrackIds.size} approved track IDs to check against uncertain matches`);
                
                // Add uncertain tracks that weren't approved
                results.nonTransferred.unapprovedTracks = (previewResults.uncertainMatches || [])
                    .filter(track => {
                        const trackId = `${track.youtubeTrack.title}-${track.youtubeTrack.artist}`.toLowerCase();
                        return !approvedTrackIds.has(trackId);
                    });
                  // Count total non-transferred tracks
                results.summary.nonTransferredCount = 
                    results.nonTransferred.unmatchedTracks.length + 
                    results.nonTransferred.unapprovedTracks.length;
                
                console.log(`Total non-transferred tracks: ${results.summary.nonTransferredCount} (${results.nonTransferred.unmatchedTracks.length} unmatched, ${results.nonTransferred.unapprovedTracks.length} unapproved)`);
            }

            // Get current playlist tracks to check for duplicates
            console.log('Fetching existing playlist tracks...');
            const existingTracks = await this.spotify.getPlaylistTracks(targetPlaylistId);
            const existingUris = new Set(existingTracks.map(track => track.uri));
            console.log(`Found ${existingTracks.length} existing tracks in playlist`);

            // Process approved tracks
            const tracksToAdd = [];
            
            for (const approvedTrack of approvedTracks) {
                try {
                    // Validate track structure
                    if (!approvedTrack || !approvedTrack.spotifyTrack) {
                        console.warn('Invalid track structure:', approvedTrack);
                        continue;
                    }

                    const spotifyTrack = approvedTrack.spotifyTrack;
                    
                    // Validate spotify track has required properties
                    if (!spotifyTrack.uri || !spotifyTrack.name) {
                        console.warn('Invalid Spotify track structure:', spotifyTrack);
                        continue;
                    }
                    
                    // Check if track is already in playlist
                    if (existingUris.has(spotifyTrack.uri)) {
                        console.log(`Skipping duplicate: ${spotifyTrack.name} by ${spotifyTrack.artists?.join(', ') || 'Unknown'}`);
                        continue;
                    }
                    
                    tracksToAdd.push(spotifyTrack.uri);
                    results.tracksAdded.push({
                        youtubeTrack: approvedTrack.youtubeTrack,
                        spotifyTrack: spotifyTrack
                    });                } catch (trackError) {
                    console.error('Error processing track:', trackError, approvedTrack);
                    const failedTrack = {
                        error: `Failed to process track: ${trackError.message}`,
                        track: approvedTrack
                    };
                    results.tracksFailed.push(failedTrack);
                    results.nonTransferred.failedTracks.push(approvedTrack);
                    results.summary.nonTransferredCount++;
                }
            }

            // Add tracks to playlist in batches
            if (tracksToAdd.length > 0) {                try {
                    await this.spotify.addTracksToPlaylist(targetPlaylistId, tracksToAdd);
                    results.summary.successfullyAdded = tracksToAdd.length;
                } catch (error) {
                    console.error('Error adding tracks to playlist:', error);                    results.tracksFailed.push({
                        error: error.message,
                        tracks: tracksToAdd
                    });
                    results.summary.failed = tracksToAdd.length;
                    
                    // Add all tracks to failed tracks in nonTransferred
                    // But make sure we have complete track info for each failed track
                    for (const approvedTrack of approvedTracks) {
                        // Only include tracks that actually have complete info
                        if (approvedTrack && approvedTrack.youtubeTrack && approvedTrack.spotifyTrack) {
                            const failedTrack = {
                                ...approvedTrack,
                                error: error.message
                            };
                            results.nonTransferred.failedTracks.push(failedTrack);
                        }
                    }
                    
                    console.log(`Added ${results.nonTransferred.failedTracks.length} failed tracks to non-transferred list`);
                    results.summary.nonTransferredCount += results.nonTransferred.failedTracks.length;
                }
            }

            // Remove duplicates if requested
            if (removeDuplicates) {
                const duplicates = await this.findDuplicatesInPlaylist(targetPlaylistId);
                if (duplicates.length > 0) {
                    try {
                        await this.spotify.removeTracksFromPlaylist(targetPlaylistId, duplicates);
                        results.duplicatesRemoved = duplicates;
                        results.summary.duplicatesRemoved = duplicates.length;
                    } catch (error) {
                        console.error('Error removing duplicates:', error);
                    }
                }
            }

            return results;
        } catch (error) {
            console.error('Error during sync execution:', error);
            throw error;
        }
    }    findExistingTrack(youtubeTrack, spotifyTracks) {
        const normalizeString = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
        
        console.log(`    🔍 Looking for existing track: "${youtubeTrack.title}" by "${youtubeTrack.artist}"`);
        
        for (const spotifyTrack of spotifyTracks) {
            const titleMatch = normalizeString(youtubeTrack.title) === normalizeString(spotifyTrack.name);
            const artistMatch = spotifyTrack.artists.some(artist => 
                normalizeString(youtubeTrack.artist) === normalizeString(artist)
            );
            
            // Check for exact matches first
            if (titleMatch && artistMatch) {
                console.log(`    ✅ EXACT MATCH: "${spotifyTrack.name}" by "${spotifyTrack.artists.join(', ')}"`);
                return spotifyTrack;
            }
            
            // Check for strong partial matches (containment matches)
            const titlePartialMatch = normalizeString(youtubeTrack.title).includes(normalizeString(spotifyTrack.name)) ||
                                     normalizeString(spotifyTrack.name).includes(normalizeString(youtubeTrack.title));
            
            const artistPartialMatch = spotifyTrack.artists.some(artist => {
                const cleanArtist = normalizeString(artist);
                const cleanYtArtist = normalizeString(youtubeTrack.artist);
                return cleanArtist.includes(cleanYtArtist) || cleanYtArtist.includes(cleanArtist);
            });
            
            // For existing tracks, be more lenient - if both title and artist have good partial matches
            // and the strings are long enough, consider it a match
            if (titlePartialMatch && artistPartialMatch) {
                const titleLengthCheck = normalizeString(youtubeTrack.title).length > 3 && 
                                       normalizeString(spotifyTrack.name).length > 3;
                const artistLengthCheck = normalizeString(youtubeTrack.artist).length > 3;
                
                if (titleLengthCheck && artistLengthCheck) {
                    console.log(`    ✅ PARTIAL MATCH: "${spotifyTrack.name}" by "${spotifyTrack.artists.join(', ')}" (title: ${titlePartialMatch}, artist: ${artistPartialMatch})`);
                    return spotifyTrack;
                }
            }
            
            // Also check if it's a very close match with slight variations
            const confidence = this.spotify.calculateMatchConfidence(
                youtubeTrack.title, 
                youtubeTrack.artist, 
                spotifyTrack
            );
            
            if (confidence === 'perfect' || confidence === 'good') {
                console.log(`    ✅ CONFIDENCE MATCH (${confidence}): "${spotifyTrack.name}" by "${spotifyTrack.artists.join(', ')}"`);
                return spotifyTrack;
            }
        }
        
        console.log(`    ❌ No existing track found for "${youtubeTrack.title}" by "${youtubeTrack.artist}"`);
        return null;
    }

    async findDuplicatesInPlaylist(playlistId) {
        try {
            const tracks = await this.spotify.getPlaylistTracks(playlistId);
            const seen = new Set();
            const duplicates = [];

            for (const track of tracks) {
                const key = `${track.name.toLowerCase()}-${track.artists.map(a => a.toLowerCase()).join('-')}`;
                if (seen.has(key)) {
                    duplicates.push(track.uri);
                } else {
                    seen.add(key);
                }
            }

            return duplicates;
        } catch (error) {
            console.error('Error finding duplicates:', error);
            return [];
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Helper method to validate sync prerequisites
    async validateSyncPrerequisites() {
        const validation = {
            spotify: { authenticated: this.spotify.isAuthenticated },
            youtubeMusic: await this.youtubeMusic.validateSetup(),
            canProceed: false
        };

        validation.canProceed = validation.spotify.authenticated && validation.youtubeMusic.valid;
        
        return validation;
    }

    // Generate sync statistics
    generateSyncStats(previewResults, executionResults = null) {
        const stats = {
            preview: {
                totalTracks: previewResults.summary.totalYoutubeTracks,
                readyToSync: previewResults.summary.perfectMatchCount,
                needsReview: previewResults.summary.uncertainMatchCount,
                notFound: previewResults.summary.noMatchCount,
                duplicates: previewResults.summary.duplicateCount,
                syncablePercentage: Math.round(
                    (previewResults.summary.perfectMatchCount / previewResults.summary.totalYoutubeTracks) * 100
                )
            }
        };

        if (executionResults) {
            stats.execution = {
                attempted: executionResults.summary.totalApproved,
                successful: executionResults.summary.successfullyAdded,
                failed: executionResults.summary.failed,
                duplicatesRemoved: executionResults.summary.duplicatesRemoved,
                successRate: Math.round(
                    (executionResults.summary.successfullyAdded / executionResults.summary.totalApproved) * 100
                )
            };
        }

        return stats;
    }

    // Select the best match from multiple options using detailed scoring
    selectBestMatch(matches, originalTrack) {
        if (matches.length === 1) return matches[0];
        
        // Score each match based on multiple factors
        const scoredMatches = matches.map(match => ({
            ...match,
            score: this.calculateDetailedScore(originalTrack, match)
        }));
        
        // Sort by score (highest first) and return the best match
        scoredMatches.sort((a, b) => b.score - a.score);
        return scoredMatches[0];
    }
    
    // Calculate a detailed score for matching quality
    calculateDetailedScore(originalTrack, spotifyMatch) {
        const normalizeString = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
        
        let score = 0;
        
        // Title matching (60% of score)
        const originalTitle = normalizeString(originalTrack.title);
        const spotifyTitle = normalizeString(spotifyMatch.name);
        
        if (originalTitle === spotifyTitle) {
            score += 60; // Perfect title match
        } else if (spotifyTitle.includes(originalTitle) || originalTitle.includes(spotifyTitle)) {
            score += 40; // Partial title match
        } else {
            // Calculate similarity based on common words
            const originalWords = originalTitle.split(' ');
            const spotifyWords = spotifyTitle.split(' ');
            const commonWords = originalWords.filter(word => 
                word.length > 2 && spotifyWords.some(sw => sw.includes(word) || word.includes(sw))
            );
            score += Math.min(30, (commonWords.length / originalWords.length) * 30);
        }
        
        // Artist matching (40% of score)
        const originalArtist = normalizeString(originalTrack.artist);
        const artistMatch = spotifyMatch.artists.some(artist => {
            const cleanArtist = normalizeString(artist).replace(/\s*-\s*topic\s*$/i, '');
            return originalArtist === cleanArtist || 
                   cleanArtist.includes(originalArtist) || 
                   originalArtist.includes(cleanArtist);
        });
        
        if (artistMatch) {
            score += 40;
        } else {
            // Check for partial artist matches
            const artistWords = originalArtist.split(' ');
            const hasPartialArtistMatch = spotifyMatch.artists.some(artist => {
                const artistLower = normalizeString(artist);
                return artistWords.some(word => word.length > 2 && artistLower.includes(word));
            });
            if (hasPartialArtistMatch) {
                score += 20;
            }
        }
        
        // Bonus points for exact confidence match
        if (spotifyMatch.confidence === 'perfect') score += 10;
        else if (spotifyMatch.confidence === 'good') score += 5;
        
        return score;
    }

    // New method for reverse sync preview (Spotify to YouTube Music)
    async previewReverseSync(spotifyPlaylistId, youtubePlaylistId, progressCallback = null) {
        try {
            console.log(`Previewing reverse sync from Spotify playlist ${spotifyPlaylistId} to YouTube playlist ${youtubePlaylistId}`);

            // Get tracks from both playlists
            const [spotifyTracks, youtubeTracks] = await Promise.all([
                this.spotify.getPlaylistTracks(spotifyPlaylistId),
                youtubePlaylistId ? this.youtubeMusic.getPlaylistTracks(youtubePlaylistId) : []
            ]);

            if (progressCallback) {
                progressCallback({
                    phase: 'analyzing',
                    message: `Found ${spotifyTracks.length} Spotify tracks and ${youtubeTracks.length} YouTube tracks`,
                    current: 0,
                    total: spotifyTracks.length,
                    percentage: 0,
                    stats: {
                        processed: 0,
                        total: spotifyTracks.length,
                        matches: 0,
                        duplicates: 0
                    }
                });
            }

            const results = {
                perfectMatches: [],
                uncertainMatches: [],
                noMatches: [],
                duplicates: [],
                summary: {
                    totalSpotifyTracks: spotifyTracks.length,
                    existingYoutubeTracks: youtubeTracks.length,
                    perfectMatchCount: 0,
                    uncertainMatchCount: 0,
                    noMatchCount: 0,
                    duplicateCount: 0
                }
            };

            // Process each Spotify track
            for (let i = 0; i < spotifyTracks.length; i++) {
                const spotifyTrack = spotifyTracks[i];
                const trackInfo = {
                    title: spotifyTrack.name,
                    artist: spotifyTrack.artists.join(', '),
                    album: spotifyTrack.album,
                    duration: spotifyTrack.duration_ms,
                    uri: spotifyTrack.uri,
                    id: spotifyTrack.id
                };
                
                const percentage = Math.round(((i + 1) / spotifyTracks.length) * 100);
                
                if (progressCallback) {
                    progressCallback({
                        phase: 'processing',
                        message: `Processing: "${trackInfo.title}" by "${trackInfo.artist}"`,
                        current: i + 1,
                        total: spotifyTracks.length,
                        percentage: percentage,
                        stats: {
                            processed: i + 1,
                            total: spotifyTracks.length,
                            matches: results.perfectMatches.length + results.uncertainMatches.length,
                            duplicates: results.duplicates.length
                        }
                    });
                }
                
                console.log(`\n🔍 Processing ${i + 1}/${spotifyTracks.length} (${percentage}%): "${trackInfo.title}" by "${trackInfo.artist}"`);
                
                // Check if track already exists in destination YouTube playlist
                const existingTrack = this.findExistingYouTubeTrack(trackInfo, youtubeTracks);
                
                if (existingTrack) {
                    console.log(`✅ Found existing track: "${existingTrack.title}" by "${existingTrack.artist}"`);
                    results.duplicates.push({
                        spotifyTrack: trackInfo,
                        youtubeTrack: existingTrack,
                        reason: 'Already in YouTube playlist'
                    });
                    results.summary.duplicateCount++;
                    continue;
                }

                // Search for the track on YouTube Music
                const youtubeMatches = await this.youtubeMusic.searchTrackWithArtistPriority(trackInfo.title, trackInfo.artist);
                
                if (youtubeMatches.length === 0) {
                    console.log(`❌ No matches found on YouTube Music`);
                    results.noMatches.push({
                        spotifyTrack: trackInfo,
                        reason: 'No suitable matches found on YouTube Music'
                    });
                    results.summary.noMatchCount++;
                } else if (youtubeMatches.length === 1) {
                    console.log(`🎯 Single match found: "${youtubeMatches[0].title}" by "${youtubeMatches[0].artist}"`);
                    results.perfectMatches.push({
                        spotifyTrack: trackInfo,
                        youtubeTrack: youtubeMatches[0],
                        confidence: 'perfect'
                    });
                    results.summary.perfectMatchCount++;
                } else {
                    // Multiple matches - show best one for review
                    const bestMatch = youtubeMatches[0]; // First one should be the best due to artist topic prioritization
                    console.log(`⚠️ Multiple matches found - showing best: "${bestMatch.title}" by "${bestMatch.artist}"`);
                    results.uncertainMatches.push({
                        spotifyTrack: trackInfo,
                        youtubeMatches: youtubeMatches.slice(0, 3), // Show top 3 matches
                        reason: 'Multiple matches found - please review',
                        requiresManualReview: true
                    });
                    results.summary.uncertainMatchCount++;
                }

                // Add a small delay to avoid hitting API rate limits
                await this.delay(100);
            }

            if (progressCallback) {
                progressCallback({
                    phase: 'complete',
                    message: `Analysis complete! Found ${results.summary.perfectMatchCount} perfect matches, ${results.summary.uncertainMatchCount} uncertain matches, ${results.summary.duplicateCount} duplicates, ${results.summary.noMatchCount} no matches`,
                    current: spotifyTracks.length,
                    total: spotifyTracks.length,
                    percentage: 100,
                    stats: {
                        processed: spotifyTracks.length,
                        total: spotifyTracks.length,
                        matches: results.summary.perfectMatchCount + results.summary.uncertainMatchCount,
                        duplicates: results.summary.duplicateCount
                    }
                });
            }

            return results;
        } catch (error) {
            console.error('Error during reverse sync preview:', error);
            throw error;
        }
    }

    // New method for executing reverse sync (Spotify to YouTube Music)
    async executeReverseSync(options) {
        console.log('executeReverseSync called with options:', options);
        
        if (!options) {
            throw new Error('Options parameter is required');
        }

        const { 
            spotifyPlaylistId, 
            youtubePlaylistId, 
            approvedTracks, 
            createNewPlaylist,
            newPlaylistName,
            previewResults
        } = options;

        try {
            console.log('Starting reverse sync execution with options:', {
                spotifyPlaylistId,
                youtubePlaylistId,
                approvedTracksCount: approvedTracks?.length || 0,
                createNewPlaylist,
                newPlaylistName
            });

            // Validate authentication
            if (!this.youtubeMusic.isAuthenticated) {
                throw new Error('YouTube Music not authenticated');
            }

            // Validate input
            if (!approvedTracks || !Array.isArray(approvedTracks)) {
                throw new Error('Invalid approvedTracks: must be an array');
            }

            if (approvedTracks.length === 0) {
                console.log('No tracks to sync');
                return {
                    playlistId: youtubePlaylistId,
                    tracksAdded: [],
                    tracksFailed: [],
                    summary: {
                        total: 0,
                        successful: 0,
                        failed: 0
                    }
                };
            }

            let targetPlaylistId = youtubePlaylistId;
            
            // Create new playlist if requested
            if (createNewPlaylist) {
                console.log(`Creating new YouTube Music playlist: "${newPlaylistName}"`);
                const newPlaylist = await this.youtubeMusic.createPlaylist(newPlaylistName, 'Created by Spotisync');
                targetPlaylistId = newPlaylist.id;
                console.log(`New playlist created with ID: ${targetPlaylistId}`);
            }

            const tracksAdded = [];
            const tracksFailed = [];

            // Add approved tracks to YouTube Music playlist
            for (const trackIdentifier of approvedTracks) {
                try {
                    // Find the track data from preview results
                    const trackData = this.findTrackFromPreview(trackIdentifier, previewResults);
                    
                    if (!trackData || !trackData.youtubeTrack) {
                        console.error(`Track data not found for identifier: ${trackIdentifier}`);
                        tracksFailed.push({
                            identifier: trackIdentifier,
                            error: 'Track data not found'
                        });
                        continue;
                    }

                    console.log(`Adding track: "${trackData.youtubeTrack.title}" by "${trackData.youtubeTrack.artist}"`);
                    
                    // Add track to YouTube Music playlist
                    await this.youtubeMusic.addTrackToPlaylist(targetPlaylistId, trackData.youtubeTrack.videoId);
                    
                    tracksAdded.push({
                        spotifyTrack: trackData.spotifyTrack,
                        youtubeTrack: trackData.youtubeTrack,
                        identifier: trackIdentifier
                    });

                    console.log(`✅ Successfully added: "${trackData.youtubeTrack.title}"`);

                } catch (error) {
                    console.error(`❌ Failed to add track ${trackIdentifier}:`, error.message);
                    tracksFailed.push({
                        identifier: trackIdentifier,
                        error: error.message
                    });
                }

                // Add delay to avoid rate limiting
                await this.delay(200);
            }

            console.log(`🎉 Reverse sync completed! Added ${tracksAdded.length} tracks, ${tracksFailed.length} failed`);

            return {
                playlistId: targetPlaylistId,
                tracksAdded,
                tracksFailed,
                summary: {
                    total: approvedTracks.length,
                    successful: tracksAdded.length,
                    failed: tracksFailed.length
                }
            };

        } catch (error) {
            console.error('Error during reverse sync execution:', error);
            throw error;
        }
    }

    // Helper method to find existing YouTube tracks
    findExistingYouTubeTrack(spotifyTrack, youtubeTracks) {
        return youtubeTracks.find(yt => {
            const ytInfo = this.youtubeMusic.normalizeTrackInfo(yt);
            const titleMatch = this.normalizeString(ytInfo.title) === this.normalizeString(spotifyTrack.title);
            const artistMatch = this.normalizeString(ytInfo.artist).includes(this.normalizeString(spotifyTrack.artist.split(',')[0]));
            return titleMatch && artistMatch;
        });
    }

    // Helper method to normalize strings for comparison
    normalizeString(str) {
        return str.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
   }

    // Helper method to find track data from preview results using track identifier
    findTrackFromPreview(trackIdentifier, previewResults) {
        if (!previewResults || !trackIdentifier) {
            return null;
        }

        // Parse the track identifier (format: "type-index")
        const [type, index] = trackIdentifier.split('-');
        const trackIndex = parseInt(index);

        if (isNaN(trackIndex)) {
            console.error('Invalid track index in identifier:', trackIdentifier);
            return null;
        }

        // Find track in appropriate preview results array
        if (type === 'perfect' && previewResults.perfectMatches && previewResults.perfectMatches[trackIndex]) {
            return previewResults.perfectMatches[trackIndex];
        } else if (type === 'uncertain' && previewResults.uncertainMatches && previewResults.uncertainMatches[trackIndex]) {
            const uncertainTrack = previewResults.uncertainMatches[trackIndex];
            // For uncertain tracks, use the best match (first in the youtubeMatches array)
            if (uncertainTrack.youtubeMatches && uncertainTrack.youtubeMatches.length > 0) {
                return {
                    spotifyTrack: uncertainTrack.spotifyTrack,
                    youtubeTrack: uncertainTrack.youtubeMatches[0] // Use best match
                };
            }
        }

        console.error('Track not found in preview results for identifier:', trackIdentifier);
        return null;
    }
}

module.exports = SyncService;
