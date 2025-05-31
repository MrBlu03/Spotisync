/**
 * PlaylistLinkService - Manages permanent playlist connections and automated syncing
 * 
 * This service handles:
 * - Creating and managing playlist links between Spotify and YouTube Music
 * - Monitoring linked playlists for changes
 * - Executing automatic synchronization
 * - Conflict resolution
 * - Sync scheduling and background processing
 */

const DataStorageService = require('./dataStorageService');

class PlaylistLinkService {
    constructor(spotifyService, youtubeService, syncService) {
        this.spotify = spotifyService;
        this.youtube = youtubeService;
        this.syncService = syncService;
        this.storage = new DataStorageService();
        
        // Background sync tracking
        this.syncTimer = null;
        this.activeSyncs = new Set();
        this.syncIntervalMinutes = 5; // Check for syncs every 5 minutes
    }

    /**
     * Initialize the service
     */
    async initialize() {
        try {
            await this.storage.initialize();
            this.startBackgroundSync();
            console.log('✅ PlaylistLinkService initialized');
        } catch (error) {
            console.error('❌ Error initializing PlaylistLinkService:', error);
            throw error;
        }
    }

    /**
     * Create a new playlist link
     */
    async createPlaylistLink(linkData) {
        try {
            // Validate playlist IDs exist
            const [spotifyPlaylist, youtubePlaylist] = await Promise.all([
                this.validateSpotifyPlaylist(linkData.spotifyPlaylistId),
                this.validateYoutubePlaylist(linkData.youtubePlaylistId)
            ]);

            if (!spotifyPlaylist) {
                throw new Error('Spotify playlist not found or not accessible');
            }

            if (!youtubePlaylist) {
                throw new Error('YouTube Music playlist not found or not accessible');
            }

            // Check for existing links
            const existingLinks = await this.findExistingLinks(
                linkData.spotifyPlaylistId,
                linkData.youtubePlaylistId
            );

            if (existingLinks.length > 0) {
                throw new Error('A link already exists between these playlists');
            }

            // Prepare link data with playlist names
            const enrichedLinkData = {
                ...linkData,
                spotifyPlaylistName: spotifyPlaylist.name,
                youtubePlaylistName: youtubePlaylist.name
            };

            // Create the link
            const newLink = await this.storage.createPlaylistLink(enrichedLinkData);

            // Perform initial sync if requested
            if (linkData.performInitialSync) {
                console.log('🔄 Performing initial sync for new playlist link...');
                await this.syncPlaylistLink(newLink.id, linkData.initialSyncDirection || linkData.syncDirection);
            }

            return newLink;

        } catch (error) {
            console.error('❌ Error creating playlist link:', error);
            throw error;
        }
    }

    /**
     * Get all playlist links
     */
    async getAllPlaylistLinks() {
        return await this.storage.getAllPlaylistLinks();
    }

    /**
     * Get a specific playlist link
     */
    async getPlaylistLink(linkId) {
        return await this.storage.getPlaylistLink(linkId);
    }

    /**
     * Update a playlist link
     */
    async updatePlaylistLink(linkId, updates) {
        try {
            const link = await this.storage.getPlaylistLink(linkId);
            if (!link) {
                throw new Error('Playlist link not found');
            }

            // Validate playlist IDs if they're being updated
            if (updates.spotifyPlaylistId && updates.spotifyPlaylistId !== link.spotifyPlaylistId) {
                const spotifyPlaylist = await this.validateSpotifyPlaylist(updates.spotifyPlaylistId);
                if (!spotifyPlaylist) {
                    throw new Error('New Spotify playlist not found or not accessible');
                }
                updates.spotifyPlaylistName = spotifyPlaylist.name;
            }

            if (updates.youtubePlaylistId && updates.youtubePlaylistId !== link.youtubePlaylistId) {
                const youtubePlaylist = await this.validateYoutubePlaylist(updates.youtubePlaylistId);
                if (!youtubePlaylist) {
                    throw new Error('New YouTube Music playlist not found or not accessible');
                }
                updates.youtubePlaylistName = youtubePlaylist.name;
            }

            return await this.storage.updatePlaylistLink(linkId, updates);

        } catch (error) {
            console.error('❌ Error updating playlist link:', error);
            throw error;
        }
    }

    /**
     * Delete a playlist link
     */
    async deletePlaylistLink(linkId) {
        try {
            // Cancel any active sync for this link
            this.activeSyncs.delete(linkId);
            
            return await this.storage.deletePlaylistLink(linkId);
        } catch (error) {
            console.error('❌ Error deleting playlist link:', error);
            throw error;
        }
    }

    /**
     * Manually sync a playlist link
     */
    async syncPlaylistLink(linkId, direction = null) {
        try {
            const link = await this.storage.getPlaylistLink(linkId);
            if (!link) {
                throw new Error('Playlist link not found');
            }

            if (!link.isActive) {
                throw new Error('Playlist link is inactive');
            }

            // Prevent concurrent syncs of the same link
            if (this.activeSyncs.has(linkId)) {
                throw new Error('Sync already in progress for this playlist link');
            }

            this.activeSyncs.add(linkId);
            const startTime = Date.now();

            try {
                console.log(`🔄 Starting sync for playlist link: ${link.spotifyPlaylistName} ↔ ${link.youtubePlaylistName}`);                // Determine sync direction
                const syncDirection = direction || link.syncDirection;
                let syncResult;

                if (syncDirection === 'bidirectional') {
                    // Perform true bidirectional sync - both directions
                    console.log('🔄 Performing bidirectional sync (both directions)...');
                    syncResult = await this.performBidirectionalSync(link);
                } else if (syncDirection === 'spotify-to-youtube') {
                    syncResult = await this.performSpotifyToYoutubeSync(link);
                } else if (syncDirection === 'youtube-to-spotify') {
                    syncResult = await this.performYoutubeToSpotifySync(link);
                } else {
                    throw new Error(`Invalid sync direction: ${syncDirection}`);
                }

                const duration = Date.now() - startTime;

                // Update statistics
                await this.storage.updateSyncStats(
                    linkId, 
                    syncResult.success, 
                    syncResult.tracksProcessed
                );

                // Record sync history
                await this.storage.addSyncHistory({
                    playlistLinkId: linkId,
                    syncDirection: syncDirection,
                    status: syncResult.success ? 'success' : 'partial',
                    tracksProcessed: syncResult.tracksProcessed,
                    tracksAdded: syncResult.tracksAdded,
                    tracksFailed: syncResult.tracksFailed,
                    duration: duration,
                    details: syncResult.details
                });

                console.log(`✅ Sync completed for playlist link: ${link.spotifyPlaylistName} ↔ ${link.youtubePlaylistName}`);
                return syncResult;

            } catch (syncError) {
                const duration = Date.now() - startTime;

                // Record failed sync
                await this.storage.updateSyncStats(linkId, false, 0);
                await this.storage.addSyncHistory({
                    playlistLinkId: linkId,
                    syncDirection: direction || link.syncDirection,
                    status: 'failed',
                    tracksProcessed: 0,
                    tracksAdded: 0,
                    tracksFailed: 0,
                    duration: duration,
                    error: syncError.message
                });

                throw syncError;
            }

        } finally {
            this.activeSyncs.delete(linkId);
        }
    }

    /**
     * Get sync history for a playlist link
     */
    async getSyncHistory(linkId, limit = 50) {
        return await this.storage.getSyncHistory(linkId, limit);
    }

    /**
     * Get playlist links for a specific playlist
     */
    async getLinksForPlaylist(playlistId, platform) {
        return await this.storage.getPlaylistLinksByPlaylistId(playlistId, platform);
    }

    /**
     * Check if a playlist is linked
     */
    async isPlaylistLinked(playlistId, platform) {
        const links = await this.getLinksForPlaylist(playlistId, platform);
        return links.filter(link => link.isActive).length > 0;
    }

    /**
     * Start background sync monitoring
     */
    startBackgroundSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }

        this.syncTimer = setInterval(async () => {
            try {
                await this.processScheduledSyncs();
            } catch (error) {
                console.error('❌ Error in background sync:', error);
            }
        }, this.syncIntervalMinutes * 60 * 1000);

        console.log(`🔄 Background sync monitoring started (checking every ${this.syncIntervalMinutes} minutes)`);
    }

    /**
     * Stop background sync monitoring
     */
    stopBackgroundSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('⏹️ Background sync monitoring stopped');
        }
    }

    /**
     * Process scheduled syncs
     */
    async processScheduledSyncs() {
        try {
            const linksToSync = await this.storage.getPlaylistLinksForSync();
            
            if (linksToSync.length === 0) {
                return;
            }

            console.log(`🔄 Found ${linksToSync.length} playlist links ready for sync`);

            // Process syncs one at a time to avoid overwhelming the APIs
            for (const link of linksToSync) {
                try {
                    if (!this.activeSyncs.has(link.id)) {
                        await this.syncPlaylistLink(link.id);
                    }
                } catch (error) {
                    console.error(`❌ Error syncing playlist link ${link.id}:`, error);
                }
            }

        } catch (error) {
            console.error('❌ Error processing scheduled syncs:', error);
        }
    }

    /**
     * Validate Spotify playlist exists and is accessible
     */
    async validateSpotifyPlaylist(playlistId) {
        try {
            const playlists = await this.spotify.getUserPlaylists();
            return playlists.find(p => p.id === playlistId);
        } catch (error) {
            console.error('Error validating Spotify playlist:', error);
            return null;
        }
    }

    /**
     * Validate YouTube Music playlist exists and is accessible
     */
    async validateYoutubePlaylist(playlistId) {
        try {
            const playlists = await this.youtube.getUserPlaylists();
            return playlists.find(p => p.id === playlistId);
        } catch (error) {
            console.error('Error validating YouTube Music playlist:', error);
            return null;
        }
    }

    /**
     * Find existing links between playlists
     */
    async findExistingLinks(spotifyPlaylistId, youtubePlaylistId) {
        const allLinks = await this.storage.getAllPlaylistLinks();
        return allLinks.filter(link => 
            link.isActive &&
            link.spotifyPlaylistId === spotifyPlaylistId &&
            link.youtubePlaylistId === youtubePlaylistId
        );
    }    /**
     * Perform Spotify to YouTube Music sync
     */
    async performSpotifyToYoutubeSync(link) {
        try {
            console.log(`🔄 Starting Spotify to YouTube sync for link: ${link.spotifyPlaylistName} → ${link.youtubePlaylistName}`);

            // First, run the preview to get matched tracks with proper structure
            console.log('📋 Running preview to match tracks...');            const previewResults = await this.syncService.previewReverseSync(
                link.spotifyPlaylistId, 
                link.youtubePlaylistId
            );

            // Get all tracks that can be automatically synced (perfect and good matches)
            const approvedTracks = [
                ...previewResults.perfectMatches
            ];            // Auto-approve ALL uncertain matches for completely unattended sync
            const autoApprovedUncertain = [];
            previewResults.uncertainMatches.forEach(track => {
                if (track.youtubeMatches && track.youtubeMatches.length > 0) {
                    const bestMatch = track.youtubeMatches[0];
                    // Auto-approve the best match regardless of confidence level
                    const approvedTrack = {
                        spotifyTrack: track.spotifyTrack,
                        youtubeTrack: bestMatch,
                        confidence: bestMatch.confidence,
                        autoApproved: true
                    };
                    approvedTracks.push(approvedTrack);
                    autoApprovedUncertain.push(approvedTrack);
                }
            });

            // Store only tracks with no matches at all for manual review
            const pendingManualReview = previewResults.uncertainMatches.filter(track => {
                return !track.youtubeMatches || track.youtubeMatches.length === 0;
            });

            // Store pending tracks in holding list if any exist (only no matches)
            if (pendingManualReview.length > 0 || previewResults.noMatches.length > 0) {
                await this.storage.addPendingTracks(link.id, {
                    uncertainMatches: pendingManualReview,
                    noMatches: previewResults.noMatches,
                    timestamp: new Date().toISOString(),
                    syncDirection: 'spotify-to-youtube'
                });
            }

            console.log(`✅ Found ${previewResults.perfectMatches.length} perfect matches`);
            console.log(`🎯 Auto-approved ${autoApprovedUncertain.length} uncertain matches (best available matches)`);
            console.log(`⏳ Stored ${pendingManualReview.length} uncertain matches with no available matches for manual review`);
            console.log(`❌ Stored ${previewResults.noMatches.length} tracks with no matches for manual review`);

            if (approvedTracks.length === 0) {
                console.log('⚠️ No tracks found for automatic sync');
                return {
                    success: true,
                    tracksProcessed: 0,
                    tracksAdded: 0,
                    tracksFailed: 0,
                    details: {
                        type: 'spotify-to-youtube',
                        message: 'No tracks available for automatic sync',
                        totalTracks: previewResults.summary.totalSpotifyTracks,
                        uncertainMatches: previewResults.uncertainMatches.length,
                        noMatches: previewResults.noMatches.length
                    }
                };
            }

            // Execute sync with properly matched tracks
            console.log(`🎵 Executing sync for ${approvedTracks.length} approved tracks...`);
            const result = await this.syncService.executeReverseSync({
                spotifyPlaylistId: link.spotifyPlaylistId,
                youtubePlaylistId: link.youtubePlaylistId,
                approvedTracks: approvedTracks,
                createNewPlaylist: false,
                previewResults: previewResults
            });

            return {
                success: result.summary?.successfullyAdded > 0 || result.summary?.failed === 0,
                tracksProcessed: result.summary?.totalApproved || 0,
                tracksAdded: result.summary?.successfullyAdded || 0,
                tracksFailed: result.summary?.failed || 0,
                details: {
                    type: 'spotify-to-youtube',
                    spotifyTrackCount: previewResults.summary.totalSpotifyTracks,
                    youtubeTrackCount: previewResults.summary.existingYoutubeTracks,
                    perfectMatches: previewResults.summary.perfectMatchCount,
                    uncertainMatches: previewResults.summary.uncertainMatchCount,
                    noMatches: previewResults.summary.noMatchCount,
                    summary: result.summary
                }
            };

        } catch (error) {
            console.error('Error in Spotify to YouTube sync:', error);
            throw error;
        }
    }    /**
     * Perform YouTube Music to Spotify sync
     */
    async performYoutubeToSpotifySync(link) {
        try {
            console.log(`🔄 Starting YouTube to Spotify sync for link: ${link.youtubePlaylistName} → ${link.spotifyPlaylistName}`);

            // First, run the preview to get matched tracks with proper structure
            console.log('📋 Running preview to match tracks...');
            const previewResults = await this.syncService.previewSync(
                link.youtubePlaylistId, 
                link.spotifyPlaylistId
            );            // Get all tracks that can be automatically synced (perfect matches AND best uncertain matches)
            const approvedTracks = [
                ...previewResults.perfectMatches
            ];

            // Auto-approve ALL uncertain matches for completely unattended sync
            const autoApprovedUncertain = [];
            previewResults.uncertainMatches.forEach(track => {
                if (track.spotifyMatches && track.spotifyMatches.length > 0) {
                    const bestMatch = track.spotifyMatches[0];
                    // Auto-approve the best match regardless of confidence level
                    const approvedTrack = {
                        youtubeTrack: track.youtubeTrack,
                        spotifyTrack: bestMatch,
                        confidence: bestMatch.confidence,
                        autoApproved: true
                    };
                    approvedTracks.push(approvedTrack);
                    autoApprovedUncertain.push(approvedTrack);
                }
            });

            // Store only tracks with no matches at all for manual review
            const pendingManualReview = previewResults.uncertainMatches.filter(track => {
                return !track.spotifyMatches || track.spotifyMatches.length === 0;
            });

            // Store pending tracks in holding list if any exist (only no matches)
            if (pendingManualReview.length > 0 || previewResults.noMatches.length > 0) {
                await this.storage.addPendingTracks(link.id, {
                    uncertainMatches: pendingManualReview,
                    noMatches: previewResults.noMatches,
                    timestamp: new Date().toISOString(),
                    syncDirection: 'youtube-to-spotify'
                });
            }

            console.log(`✅ Found ${previewResults.perfectMatches.length} perfect matches`);
            console.log(`🎯 Auto-approved ${autoApprovedUncertain.length} uncertain matches (best available matches)`);
            console.log(`⏳ Stored ${pendingManualReview.length} uncertain matches with no available matches for manual review`);
            console.log(`❌ Stored ${previewResults.noMatches.length} tracks with no matches for manual review`);

            if (approvedTracks.length === 0) {
                console.log('⚠️ No tracks found for automatic sync');
                return {
                    success: true,
                    tracksProcessed: 0,
                    tracksAdded: 0,
                    tracksFailed: 0,
                    details: {
                        type: 'youtube-to-spotify',
                        message: 'No tracks available for automatic sync',
                        totalTracks: previewResults.summary.totalYoutubeTracks,
                        uncertainMatches: previewResults.uncertainMatches.length,
                        noMatches: previewResults.noMatches.length
                    }
                };
            }

            // Execute sync with properly matched tracks
            console.log(`🎵 Executing sync for ${approvedTracks.length} approved tracks...`);
            const result = await this.syncService.executeSync({
                youtubePlaylistId: link.youtubePlaylistId,
                spotifyPlaylistId: link.spotifyPlaylistId,
                approvedTracks: approvedTracks,
                createNewPlaylist: false,
                previewResults: previewResults
            });

            return {
                success: result.summary?.successfullyAdded > 0 || result.summary?.failed === 0,
                tracksProcessed: result.summary?.totalApproved || 0,
                tracksAdded: result.summary?.successfullyAdded || 0,
                tracksFailed: result.summary?.failed || 0,
                details: {
                    type: 'youtube-to-spotify',
                    youtubeTrackCount: previewResults.summary.totalYoutubeTracks,
                    spotifyTrackCount: previewResults.summary.existingSpotifyTracks,
                    perfectMatches: previewResults.summary.perfectMatchCount,
                    uncertainMatches: previewResults.summary.uncertainMatchCount,
                    noMatches: previewResults.summary.noMatchCount,
                    summary: result.summary
                }
            };        } catch (error) {
            console.error('Error in YouTube to Spotify sync:', error);
            throw error;
        }
    }

    /**
     * Perform true bidirectional sync - syncs both directions
     */
    async performBidirectionalSync(link) {
        try {
            console.log(`🔄 Starting bidirectional sync for link: ${link.spotifyPlaylistName} ↔ ${link.youtubePlaylistName}`);

            // Perform both sync directions concurrently for better performance
            const [spotifyToYoutubeResult, youtubeToSpotifyResult] = await Promise.allSettled([
                this.performSpotifyToYoutubeSync(link),
                this.performYoutubeToSpotifySync(link)
            ]);

            // Process results from both directions
            let totalTracksProcessed = 0;
            let totalTracksAdded = 0;
            let totalTracksFailed = 0;
            let overallSuccess = true;
            const errors = [];
            const details = {
                type: 'bidirectional',
                spotifyToYoutube: null,
                youtubeToSpotify: null
            };

            // Handle Spotify → YouTube Music result
            if (spotifyToYoutubeResult.status === 'fulfilled') {
                const result = spotifyToYoutubeResult.value;
                totalTracksProcessed += result.tracksProcessed || 0;
                totalTracksAdded += result.tracksAdded || 0;
                totalTracksFailed += result.tracksFailed || 0;
                details.spotifyToYoutube = {
                    success: result.success,
                    tracksProcessed: result.tracksProcessed,
                    tracksAdded: result.tracksAdded,
                    tracksFailed: result.tracksFailed,
                    details: result.details
                };
                console.log(`✅ Spotify → YouTube: ${result.tracksAdded} added, ${result.tracksFailed} failed`);
            } else {
                overallSuccess = false;
                const error = spotifyToYoutubeResult.reason;
                errors.push(`Spotify → YouTube: ${error.message}`);
                details.spotifyToYoutube = {
                    success: false,
                    error: error.message
                };
                console.error(`❌ Spotify → YouTube sync failed:`, error);
            }

            // Handle YouTube Music → Spotify result
            if (youtubeToSpotifyResult.status === 'fulfilled') {
                const result = youtubeToSpotifyResult.value;
                totalTracksProcessed += result.tracksProcessed || 0;
                totalTracksAdded += result.tracksAdded || 0;
                totalTracksFailed += result.tracksFailed || 0;
                details.youtubeToSpotify = {
                    success: result.success,
                    tracksProcessed: result.tracksProcessed,
                    tracksAdded: result.tracksAdded,
                    tracksFailed: result.tracksFailed,
                    details: result.details
                };
                console.log(`✅ YouTube → Spotify: ${result.tracksAdded} added, ${result.tracksFailed} failed`);
            } else {
                overallSuccess = false;
                const error = youtubeToSpotifyResult.reason;
                errors.push(`YouTube → Spotify: ${error.message}`);
                details.youtubeToSpotify = {
                    success: false,
                    error: error.message
                };
                console.error(`❌ YouTube → Spotify sync failed:`, error);
            }

            // Determine overall success
            const anyTracksAdded = totalTracksAdded > 0;
            const noFailures = totalTracksFailed === 0;
            const bothDirectionsSucceeded = details.spotifyToYoutube?.success && details.youtubeToSpotify?.success;
            
            // Consider it successful if:
            // 1. Both directions succeeded, OR
            // 2. At least one direction succeeded and added tracks, with no critical failures
            overallSuccess = bothDirectionsSucceeded || (anyTracksAdded && overallSuccess);

            console.log(`🎯 Bidirectional sync complete: ${totalTracksAdded} total tracks added, ${totalTracksFailed} failed`);
            
            if (errors.length > 0) {
                console.warn(`⚠️ Some sync directions had issues: ${errors.join(', ')}`);
            }

            return {
                success: overallSuccess,
                tracksProcessed: totalTracksProcessed,
                tracksAdded: totalTracksAdded,
                tracksFailed: totalTracksFailed,
                details: details,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            console.error('Error in bidirectional sync:', error);
            throw error;
        }
    }

    /**
     * Get statistics for all playlist links
     */
    async getOverallStatistics() {
        const links = await this.getAllPlaylistLinks();
        const activeLinks = links.filter(link => link.isActive);
        
        const stats = {
            totalLinks: links.length,
            activeLinks: activeLinks.length,
            autoSyncEnabled: activeLinks.filter(link => link.autoSync).length,
            totalSyncs: activeLinks.reduce((sum, link) => sum + link.stats.totalSyncs, 0),
            successfulSyncs: activeLinks.reduce((sum, link) => sum + link.stats.successfulSyncs, 0),
            failedSyncs: activeLinks.reduce((sum, link) => sum + link.stats.failedSyncs, 0),
            activeSyncsCount: this.activeSyncs.size,
            upcomingSyncs: 0
        };

        // Count upcoming syncs
        const now = new Date();
        stats.upcomingSyncs = activeLinks.filter(link => 
            link.autoSync && 
            link.nextSyncAt && 
            new Date(link.nextSyncAt) > now
        ).length;

        return stats;
    }

    /**
     * Clean up old data
     */
    async cleanup() {
        try {
            await this.storage.cleanupOldHistory();
            console.log('🧹 Playlist link service cleanup completed');
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
        }
    }

    /**
     * Shutdown the service
     */
    shutdown() {
        this.stopBackgroundSync();
        console.log('🛑 PlaylistLinkService shutdown');
    }
}

module.exports = PlaylistLinkService;
