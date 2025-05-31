class SpotisyncApp {
    constructor() {
        this.currentPreview = null;
        this.selectedTracks = new Set();
        this.spotifyPlaylists = [];
        this.youtubePlayists = [];
        this.customMatches = new Map(); // Store custom matches by trackId
        this.init();
    }    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.checkUrlParams();
        this.initializeUI();
    }

    initializeUI() {
        // Set default view to one-time sync
        this.switchToOneTimeSync();
    }

    setupEventListeners() {
        // Sync direction
        document.getElementById('sync-direction').addEventListener('change', (e) => {
            this.handleSyncDirectionChange(e.target.value);
        });        // Authentication
        document.getElementById('spotify-auth-btn').addEventListener('click', () => {
            this.authenticateSpotify();
        });

        // Playlist selection
        document.getElementById('source-playlist').addEventListener('change', (e) => {
            this.handleSourcePlaylistChange(e.target.value);
        });

        document.getElementById('destination-playlist').addEventListener('change', () => {
            this.updatePreviewButton();
        });

        document.getElementById('new-playlist-name').addEventListener('input', () => {
            this.updatePreviewButton();
        });

        // Preview sync
        document.getElementById('preview-sync-btn').addEventListener('click', () => {
            this.previewSync();
        });

        // Execute sync
        document.getElementById('execute-sync-btn').addEventListener('click', () => {
            this.executeSync();
        });

        // Navigation
        document.getElementById('back-to-selection-btn').addEventListener('click', () => {
            this.showSection('playlist-section');
        });

        document.getElementById('new-sync-btn').addEventListener('click', () => {
            this.resetApp();
        });        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });        });

        // Cookie Monitor Controls
        document.getElementById('start-monitor-btn').addEventListener('click', () => {
            this.startCookieMonitor();
        });        // YouTube Music authentication is now automatic via cookie monitoring
        // Cookie management event listeners removed since UI was simplified

        // Navigation Tabs
        document.getElementById('one-time-sync-tab').addEventListener('click', () => {
            this.switchToOneTimeSync();
        });

        document.getElementById('playlist-links-tab').addEventListener('click', () => {
            this.switchToPlaylistLinks();
        });

        // Playlist Linking Event Listeners
        document.getElementById('link-sync-direction').addEventListener('change', () => {
            this.updateCreateLinkButton();
        });

        document.getElementById('link-auto-sync').addEventListener('change', () => {
            this.updateCreateLinkButton();
        });

        document.getElementById('link-spotify-playlist').addEventListener('change', () => {
            this.updateCreateLinkButton();
        });

        document.getElementById('link-youtube-playlist').addEventListener('change', () => {
            this.updateCreateLinkButton();
        });

        document.getElementById('create-link-btn').addEventListener('click', () => {
            this.createPlaylistLink();
        });

        document.getElementById('refresh-links-btn').addEventListener('click', () => {
            this.loadExistingLinks();
        });

        document.getElementById('sync-all-links-btn').addEventListener('click', () => {
            this.syncAllLinks();
        });

        document.getElementById('view-all-history-btn').addEventListener('click', () => {
            this.viewAllHistory();
        });
        
        }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('auth') === 'success') {
            this.showToast('Spotify authentication successful!', 'success');
            this.checkAuthStatus();
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (urlParams.get('auth') === 'error') {
            this.showToast('Spotify authentication failed. Please try again.', 'error');
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    async checkAuthStatus() {
        try {
            // Check Spotify authentication
            let spotifyResponse;
            try {
                spotifyResponse = await fetch('/api/spotify/playlists');
                if (spotifyResponse.ok) {
                    document.getElementById('spotify-status').textContent = 'Connected';
                    document.getElementById('spotify-status').className = 'status-indicator status-connected';
                    document.getElementById('spotify-auth-btn').style.display = 'none';
                } else {
                    document.getElementById('spotify-status').textContent = 'Not Connected';
                    document.getElementById('spotify-status').className = 'status-indicator status-error';
                }
            } catch (error) {
                console.error('Error checking Spotify auth:', error);
                document.getElementById('spotify-status').textContent = 'Error';
                document.getElementById('spotify-status').className = 'status-indicator status-error';
                spotifyResponse = { ok: false };            }
            
            // Check YouTube Music authentication (automatically configured)
            let youtubeResponse;
            try {
                youtubeResponse = await fetch('/api/youtube/playlists');
                // YouTube status is handled automatically via cookie authentication
            } catch (error) {
                console.error('Error checking YouTube auth:', error);
                youtubeResponse = { ok: false };
            }

            // Load playlists and show playlist section if both services are connected
            if (spotifyResponse.ok && youtubeResponse.ok) {
                await this.loadPlaylists();
                this.showSection('playlist-section');
            } else if (spotifyResponse.ok || youtubeResponse.ok) {
                // If only one service is connected, still load playlists
                await this.loadPlaylists();
            }
        } catch (error) {            console.error('Error checking auth status:', error);
            document.getElementById('spotify-status').textContent = 'Error';
            document.getElementById('spotify-status').className = 'status-indicator status-error';
            document.getElementById('youtube-status').textContent = 'Error';
            document.getElementById('youtube-status').className = 'status-indicator status-error';
        }
    }

    authenticateSpotify() {
        window.location.href = '/auth/spotify';
    }    async loadPlaylists() {
        try {
            this.showLoading('Loading playlists...');

            // Store playlists for later use
            this.spotifyPlaylists = [];
            this.youtubePlayists = [];

            // Try to load Spotify playlists
            try {
                const spotifyResponse = await fetch('/api/spotify/playlists');
                if (spotifyResponse.ok) {
                    this.spotifyPlaylists = await spotifyResponse.json();
                    console.log('Loaded Spotify playlists:', this.spotifyPlaylists.length);
                } else {
                    console.log('Spotify playlists not available - user not authenticated');
                }
            } catch (error) {
                console.error('Error loading Spotify playlists:', error);
            }            // Try to load YouTube playlists
            try {
                const youtubeResponse = await fetch('/api/youtube/playlists');
                if (youtubeResponse.ok) {
                    this.youtubePlayists = await youtubeResponse.json();
                    console.log('Loaded YouTube playlists:', this.youtubePlayists.length);
                } else if (youtubeResponse.status === 500) {
                    // Check if it's a quota error
                    const errorData = await youtubeResponse.json();
                    if (errorData.error?.includes('quota exceeded')) {
                        console.log('YouTube API quota exceeded');
                        this.showToast('YouTube API quota exceeded. Please try again tomorrow.', 'error');
                    } else {
                        console.log('YouTube Music playlists not available - user not authenticated or API not enabled');
                    }
                } else {
                    console.log('YouTube Music playlists not available - user not authenticated or API not enabled');
                }            } catch (error) {
                console.error('Error loading YouTube playlists:', error);
                
                // Check for quota exceeded error
                if (error.message?.includes('quota exceeded') || error.message?.includes('quotaExceeded')) {
                    this.showToast('YouTube API quota exceeded. Please try again tomorrow.', 'error');
                } else {
                    this.showToast('YouTube Music setup required. Please check documentation.', 'warning');
                }
            }

            // Populate playlists based on current sync direction
            const syncDirection = document.getElementById('sync-direction');
            if (syncDirection) {
                this.handleSyncDirectionChange(syncDirection.value);
            }

            // Update preview button state after loading playlists
            this.updatePreviewButton();
            this.hideLoading();
        } catch (error) {
            console.error('Error loading playlists:', error);
            this.showToast('Error loading playlists', 'error');
            this.hideLoading();
        }
    }

    populatePlaylistSelect(selectId, playlists) {
        const select = document.getElementById(selectId);
        
        // Clear existing options (except the first one and "new" option for Spotify)
        while (select.children.length > (selectId === 'spotify-playlist' ? 2 : 1)) {
            select.removeChild(select.lastChild);
        }

        playlists.forEach(playlist => {
            const option = document.createElement('option');
            option.value = playlist.id;
            option.textContent = `${playlist.name} (${playlist.trackCount} tracks)`;
            select.appendChild(option);        });
    }

    handleSyncDirectionChange(direction) {
        // Update UI labels based on sync direction
        const sourceLabel = document.getElementById('source-playlist-label');
        const destLabel = document.getElementById('destination-playlist-label');
        const sourceSelect = document.getElementById('source-playlist');
        const destSelect = document.getElementById('destination-playlist');
        const arrowIcon = document.getElementById('sync-arrow-icon');
        
        if (!sourceLabel || !destLabel || !sourceSelect || !destSelect) {
            console.warn('Some playlist UI elements not found');
            return;
        }
        
        if (direction === 'youtube-to-spotify') {
            // YouTube → Spotify
            sourceLabel.textContent = 'YouTube Music Playlist:';
            destLabel.textContent = 'Spotify Playlist:';
            if (arrowIcon) arrowIcon.className = 'fas fa-arrow-right';
            
            // Populate source with YouTube playlists
            this.populateSourcePlaylists('youtube');
            this.populateDestinationPlaylists('spotify');
        } else if (direction === 'spotify-to-youtube') {
            // Spotify → YouTube Music
            sourceLabel.textContent = 'Spotify Playlist:';
            destLabel.textContent = 'YouTube Music Playlist:';
            if (arrowIcon) arrowIcon.className = 'fas fa-arrow-right';
            
            // Populate source with Spotify playlists
            this.populateSourcePlaylists('spotify');
            this.populateDestinationPlaylists('youtube');
        }
        
        // Reset playlist selections
        if (sourceSelect) sourceSelect.selectedIndex = 0;
        if (destSelect) destSelect.selectedIndex = 0;
          this.updatePreviewButton();
    }

    async populateSourcePlaylists(service) {
        const select = document.getElementById('source-playlist');
        
        if (!select) {
            console.warn('Source playlist select element not found');
            return;
        }
        
        // Clear existing options
        select.innerHTML = '<option value="">Select source playlist...</option>';
        
        try {
            let playlists = [];
            if (service === 'youtube' && this.youtubePlayists.length > 0) {
                playlists = this.youtubePlayists;
            } else if (service === 'spotify' && this.spotifyPlaylists.length > 0) {
                playlists = this.spotifyPlaylists;
            } else {
                // Try to fetch fresh data if not available
                if (service === 'youtube') {
                    const response = await fetch('/api/youtube/playlists');
                    if (response.ok) {
                        playlists = await response.json();
                        this.youtubePlayists = playlists;
                    }
                } else if (service === 'spotify') {
                    const response = await fetch('/api/spotify/playlists');
                    if (response.ok) {
                        playlists = await response.json();
                        this.spotifyPlaylists = playlists;
                    }
                }
            }
            
            playlists.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist.id;
                option.textContent = `${playlist.name} (${playlist.trackCount} tracks)`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error(`Error loading ${service} playlists:`, error);
        }
    }

    async populateDestinationPlaylists(service) {
        const select = document.getElementById('destination-playlist');
        
        if (!select) {
            console.warn('Destination playlist select element not found');
            return;
        }
        
        // Clear existing options
        select.innerHTML = '<option value="">Select destination playlist...</option>';
        
        // Add option to create new playlist (always first)
        const newOption = document.createElement('option');
        newOption.value = 'new';
        newOption.textContent = '+ Create New Playlist';
        select.appendChild(newOption);
        
        try {
            let playlists = [];
            if (service === 'youtube' && this.youtubePlayists.length > 0) {
                playlists = this.youtubePlayists;
            } else if (service === 'spotify' && this.spotifyPlaylists.length > 0) {
                playlists = this.spotifyPlaylists;
            } else {
                // Try to fetch fresh data if not available
                if (service === 'youtube') {
                    const response = await fetch('/api/youtube/playlists');
                    if (response.ok) {
                        playlists = await response.json();
                        this.youtubePlayists = playlists;
                    }
                } else if (service === 'spotify') {
                    const response = await fetch('/api/spotify/playlists');
                    if (response.ok) {
                        playlists = await response.json();
                        this.spotifyPlaylists = playlists;
                    }
                }
            }
            
            playlists.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist.id;
                option.textContent = `${playlist.name} (${playlist.trackCount} tracks)`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error(`Error loading ${service} playlists:`, error);
        }
    }handleSourcePlaylistChange(value) {
        this.updatePreviewButton();
    }

    handleSpotifyPlaylistChange(value) {
        const newPlaylistInput = document.getElementById('new-playlist-name');
        if (value === 'new') {
            newPlaylistInput.style.display = 'block';
            newPlaylistInput.focus();
        } else {
            newPlaylistInput.style.display = 'none';
        }
        this.updatePreviewButton();
    }    updatePreviewButton() {
        const syncDirection = document.getElementById('sync-direction').value;
        const sourceSelect = document.getElementById('source-playlist');
        const destSelect = document.getElementById('destination-playlist');
        const newPlaylistInput = document.getElementById('new-playlist-name');
        const previewBtn = document.getElementById('preview-sync-btn');
        
        if (!sourceSelect || !destSelect || !previewBtn) {
            return; // Elements not ready yet
        }
        
        const sourcePlaylist = sourceSelect.value;
        const destPlaylist = destSelect.value;
        const newPlaylistName = newPlaylistInput ? newPlaylistInput.value : '';
        
        const canPreview = syncDirection && sourcePlaylist && (destPlaylist !== '' && 
            (destPlaylist !== 'new' || newPlaylistName.trim()));
        
        previewBtn.disabled = !canPreview;
    }    async previewSync() {
        try {
            const syncDirection = document.getElementById('sync-direction').value;
            const sourcePlaylistId = document.getElementById('source-playlist').value;
            const destPlaylistId = document.getElementById('destination-playlist').value === 'new' 
                ? null 
                : document.getElementById('destination-playlist').value;            this.showProgressLoading('Generating preview...', 0);
            
            let previewData;
            let endpoint;
            let requestBody;
            
            if (syncDirection === 'youtube-to-spotify') {
                // YouTube to Spotify sync (existing functionality)
                endpoint = '/api/sync/preview';
                requestBody = {
                    youtubePlaylistId: sourcePlaylistId,
                    spotifyPlaylistId: destPlaylistId
                };
            } else if (syncDirection === 'spotify-to-youtube') {
                // Spotify to YouTube sync (new functionality)
                endpoint = '/api/sync/preview-reverse';
                requestBody = {
                    spotifyPlaylistId: sourcePlaylistId,
                    youtubePlaylistId: destPlaylistId
                };
            } else {
                throw new Error('Invalid sync direction');
            }            
            // Determine which service to get playlist info from based on sync direction
            let playlistInfoResponse;
            let trackCount = 0;
            
            if (syncDirection === 'youtube-to-spotify') {
                playlistInfoResponse = await fetch(`/api/youtube/playlists?id=${sourcePlaylistId}`);
            } else if (syncDirection === 'spotify-to-youtube') {
                playlistInfoResponse = await fetch(`/api/spotify/playlists?id=${sourcePlaylistId}`);
            }
              if (playlistInfoResponse && playlistInfoResponse.ok) {
                const playlistInfo = await playlistInfoResponse.json();
                trackCount = playlistInfo.trackCount || 0;
            }
            
            // For larger playlists (>200 tracks), use streaming endpoint for better progress tracking
            if (trackCount > 200 && syncDirection === 'youtube-to-spotify') {
                // Use streaming endpoint with EventSource (only supported for YouTube to Spotify)
                await new Promise((resolve, reject) => {
                    const eventSource = new EventSource(`/api/sync/preview-stream?youtubePlaylistId=${sourcePlaylistId}&spotifyPlaylistId=${destPlaylistId || ''}`);
                    
                    eventSource.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);
                            
                            if (data.type === 'progress') {
                                this.updateProgress(data);
                            } else if (data.type === 'result') {
                                previewData = data.data;
                                eventSource.close();
                                resolve();
                            } else if (data.type === 'error') {
                                throw new Error(data.message);
                            }
                        } catch (error) {
                            eventSource.close();
                            reject(error);
                        }
                    };
                    
                    eventSource.onerror = (error) => {
                        eventSource.close();
                        reject(new Error('Error in preview stream connection'));
                    };
                });
            } else {
                // Use regular API endpoint with simulated progress for smaller playlists
                // Start a progress simulation
                let progress = 0;
                const progressInterval = setInterval(() => {
                    progress += Math.random() * 3; // Random progress between 0-3%
                    if (progress > 90) progress = 90; // Cap at 90% until real completion
                    this.updateProgressDisplay('Generating preview...', progress, {
                        phase: 'processing',
                        stats: {
                            processed: Math.floor((progress/100) * trackCount),
                            total: trackCount,
                            matches: Math.floor((progress/100) * trackCount * 0.8), // Estimate
                            duplicates: Math.floor((progress/100) * trackCount * 0.1) // Estimate
                        }
                    });
                }, 300);
                      // Use regular API endpoint for preview
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            clearInterval(progressInterval);
            
            if (!response.ok) {
                throw new Error('Failed to generate preview');
            }
            
            // Show 100% progress
            this.updateProgressDisplay('Preview generated!', 100, {
                phase: 'complete',
                stats: {
                    processed: trackCount,
                    total: trackCount,
                    matches: 0, // Will be updated with actual data
                    duplicates: 0 // Will be updated with actual data
                }
            });            // Process the JSON response directly
            previewData = await response.json();
            }
            
            // Update the UI with the preview data
            this.currentPreview = previewData;
            this.displayPreview();
            this.showSection('preview-section');
            this.hideLoading();        } catch (error) {
            console.error('Error previewing sync:', error);
            
            // Check for quota exceeded error
            if (error.message?.includes('quota exceeded') || error.message?.includes('quotaExceeded')) {
                this.showToast('YouTube API quota exceeded. Cannot generate preview at this time. Please try again tomorrow.', 'error');
            } else {
                this.showToast('Error generating preview: ' + error.message, 'error');
            }
            this.hideLoading();
        }
    }

    displayPreview() {
        if (!this.currentPreview) return;

        // Update stats
        this.displaySyncStats();
        
        // Update tab counts
        document.getElementById('perfect-count').textContent = this.currentPreview.summary.perfectMatchCount;
        document.getElementById('uncertain-count').textContent = this.currentPreview.summary.uncertainMatchCount;
        document.getElementById('duplicate-count').textContent = this.currentPreview.summary.duplicateCount;
        document.getElementById('no-match-count').textContent = this.currentPreview.summary.noMatchCount;

        // Display track lists
        this.displayTrackList('perfect-matches', this.currentPreview.perfectMatches, 'perfect');
        this.displayTrackList('uncertain-matches', this.currentPreview.uncertainMatches, 'uncertain');
        this.displayTrackList('duplicate-matches', this.currentPreview.duplicates, 'duplicate');
        this.displayTrackList('no-matches', this.currentPreview.noMatches, 'no-match');

        // Pre-select all perfect matches
        this.currentPreview.perfectMatches.forEach((match, index) => {
            this.selectedTracks.add(`perfect-${index}`);
        });

        this.updateExecuteButton();
    }    displaySyncStats() {
        const stats = this.currentPreview.summary;
        
        // Handle both sync directions - use the appropriate total tracks count
        const totalTracks = stats.totalYoutubeTracks || stats.totalSpotifyTracks || 0;
        const syncablePercentage = totalTracks > 0 
            ? Math.round((stats.perfectMatchCount / totalTracks) * 100)
            : 0;

        document.getElementById('sync-stats').innerHTML = `
            <div class="stat-card stat-perfect">
                <div class="stat-number">${stats.perfectMatchCount}</div>
                <div class="stat-label">Perfect Matches</div>
            </div>
            <div class="stat-card stat-uncertain">
                <div class="stat-number">${stats.uncertainMatchCount}</div>
                <div class="stat-label">Need Review</div>
            </div>
            <div class="stat-card stat-duplicate">
                <div class="stat-number">${stats.duplicateCount}</div>
                <div class="stat-label">Duplicates</div>
            </div>
            <div class="stat-card stat-missing">
                <div class="stat-number">${stats.noMatchCount}</div>
                <div class="stat-label">Not Found</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${syncablePercentage}%</div>
                <div class="stat-label">Ready to Sync</div>
            </div>
        `;
    }

    displayTrackList(containerId, tracks, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        if (tracks.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #718096; padding: 20px;">No tracks in this category</p>';
            return;
        }

        tracks.forEach((track, index) => {
            const trackElement = this.createTrackElement(track, type, index);
            container.appendChild(trackElement);
        });
    }    createTrackElement(track, type, index) {
        const div = document.createElement('div');
        div.className = 'track-item';
        div.dataset.type = type;
        div.dataset.index = index;

        const trackId = `${type}-${index}`;

        // Determine sync direction by checking track structure and current sync direction
        const syncDirection = document.getElementById('sync-direction').value;
        const isReverseSync = syncDirection === 'spotify-to-youtube';
        
        // Validate track structure based on sync direction and track type
        if (!track) {
            console.warn('Invalid track object:', track);
            div.innerHTML = '<div class="track-info"><div class="track-title">Invalid track data</div></div>';
            return div;
        }
        
        // For reverse sync "no-match" tracks, only spotifyTrack exists
        if (isReverseSync && type === 'no-match') {
            if (!track.spotifyTrack) {
                console.warn('Invalid reverse sync no-match track object:', track);
                div.innerHTML = '<div class="track-info"><div class="track-title">Invalid track data</div></div>';
                return div;
            }
        } else {
            // For all other cases, check appropriate track property exists
            const requiredProperty = isReverseSync ? 'spotifyTrack' : 'youtubeTrack';
            if (!track[requiredProperty]) {
                console.warn(`Invalid track object - missing ${requiredProperty}:`, track);
                div.innerHTML = '<div class="track-info"><div class="track-title">Invalid track data</div></div>';
                return div;
            }
        }        let content = '';
        let actions = '';

        // Determine which track info to display based on sync direction (reuse existing isReverseSync variable)
        const sourceTrack = isReverseSync ? track.spotifyTrack : track.youtubeTrack;
        const targetTrack = isReverseSync ? track.youtubeTrack : track.spotifyTrack;        if (type === 'perfect') {
            const title = sourceTrack.name || sourceTrack.title || 'Unknown Title';
            const artist = isReverseSync ? 
                (sourceTrack.artists && Array.isArray(sourceTrack.artists) ? sourceTrack.artists.join(', ') : sourceTrack.artist || 'Unknown Artist') : 
                sourceTrack.artist;
            
            content = `
                <div class="track-info">
                    <div class="track-title">${title}</div>
                    <div class="track-artist">by ${artist}</div>
                </div>
                <div class="track-confidence confidence-perfect">Perfect Match</div>
            `;
            actions = `
                <input type="checkbox" id="${trackId}" class="track-checkbox" checked>
                <label for="${trackId}">Include in sync</label>
            `;        } else if (type === 'uncertain') {
            const title = sourceTrack.name || sourceTrack.title || 'Unknown Title';
            const artist = isReverseSync ? 
                (sourceTrack.artists && Array.isArray(sourceTrack.artists) ? sourceTrack.artists.join(', ') : sourceTrack.artist || 'Unknown Artist') : 
                sourceTrack.artist;
            
            const matches = isReverseSync ? (track.youtubeMusicMatches || []) : (track.spotifyMatches || []);
            const matchesHtml = matches.map(match => {
                if (isReverseSync) {
                    return `<div style="margin-left: 20px; color: #718096; font-size: 0.9rem;">
                        → ${match.title} by ${match.artist} 
                        <span class="track-confidence confidence-${match.confidence}">${match.confidence}</span>
                    </div>`;
                } else {
                    const matchArtist = match.artists && Array.isArray(match.artists) ? match.artists.join(', ') : match.artist || 'Unknown Artist';
                    return `<div style="margin-left: 20px; color: #718096; font-size: 0.9rem;">
                        → ${match.name} by ${matchArtist} 
                        <span class="track-confidence confidence-${match.confidence}">${match.confidence}</span>
                    </div>`;
                }
            }).join('');

            // Show original source information for manual searching
            let originalInfo = '';
            if (isReverseSync) {
                // For reverse sync, show Spotify info
                const displayArtist = sourceTrack.artists && Array.isArray(sourceTrack.artists) ? sourceTrack.artists.join(', ') : sourceTrack.artist || 'Unknown Artist';
                originalInfo = `
                    <div class="spotify-info" style="margin-top: 8px; padding: 8px; background: #f7fafc; border-radius: 6px; border-left: 3px solid #1db954;">
                        <div class="spotify-title" style="font-size: 0.85rem; color: #4a5568; margin-bottom: 2px;"><strong>Spotify:</strong> ${sourceTrack.name}</div>
                        <div class="spotify-artist" style="font-size: 0.85rem; color: #718096;"><strong>Artist:</strong> ${displayArtist}</div>
                        ${sourceTrack.album ? `<div class="spotify-album" style="font-size: 0.85rem; color: #718096;"><strong>Album:</strong> ${sourceTrack.album.name || sourceTrack.album}</div>` : ''}
                    </div>
                `;
            } else {
                // For original sync, show YouTube info
                originalInfo = (sourceTrack && (sourceTrack.rawTitle || sourceTrack.channelTitle)) ? `
                    <div class="youtube-info" style="margin-top: 8px; padding: 8px; background: #f7fafc; border-radius: 6px; border-left: 3px solid #ff0000;">
                        ${sourceTrack.rawTitle ? `<div class="youtube-title" style="font-size: 0.85rem; color: #4a5568; margin-bottom: 2px;"><strong>YouTube:</strong> ${sourceTrack.rawTitle}</div>` : ''}
                        ${sourceTrack.channelTitle ? `<div class="youtube-channel" style="font-size: 0.85rem; color: #718096;"><strong>Channel:</strong> ${sourceTrack.channelTitle}</div>` : ''}
                    </div>
                ` : '';
            }

            content = `
                <div class="track-info">
                    <div class="track-title">${title}</div>
                    <div class="track-artist">by ${artist}</div>                    <div style="margin-top: 8px; font-size: 0.9rem; color: #ed8936;">${track.reason}</div>
                    ${originalInfo}
                    ${matchesHtml}
                    <div class="manual-match-container" style="margin-top: 12px; border-top: 1px solid #edf2f7; padding-top: 10px;">
                        <div style="font-weight: 600; margin-bottom: 8px;">Override with Custom Match:</div>
                        <input type="text" class="manual-match-input" placeholder="${isReverseSync ? 'YouTube Video ID or URL' : 'Spotify Track URL or URI'}" 
                            style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; margin-bottom: 8px;">
                        <button class="action-btn manual-match-btn" data-track-id="${trackId}">
                            Apply Custom Match
                        </button>
                    </div>
                </div>
            `;
            actions = `
                <button class="action-btn action-approve" onclick="spotisyncApp.approveUncertainTrack('${trackId}')">
                    Approve Best Match
                </button>
            `;
        } else if (type === 'duplicate') {
            const title = isReverseSync ? sourceTrack.name : sourceTrack.title;
            const artist = isReverseSync ? 
                (sourceTrack.artists && Array.isArray(sourceTrack.artists) ? sourceTrack.artists.join(', ') : sourceTrack.artist || 'Unknown Artist') : 
                sourceTrack.artist;
            
            content = `
                <div class="track-info">
                    <div class="track-title">${title}</div>
                    <div class="track-artist">by ${artist}</div>
                    <div style="margin-top: 8px; font-size: 0.9rem; color: #4299e1;">${track.reason}</div>
                </div>
                <div class="track-confidence confidence-perfect">Already in Playlist</div>
            `;
        } else if (type === 'no-match') {
            const title = isReverseSync ? sourceTrack.name : sourceTrack.title;
            const artist = isReverseSync ? 
                (sourceTrack.artists && Array.isArray(sourceTrack.artists) ? sourceTrack.artists.join(', ') : sourceTrack.artist || 'Unknown Artist') : 
                sourceTrack.artist;
            
            // Show original source information for manual searching
            let originalInfo = '';
            if (isReverseSync) {
                // For reverse sync, show Spotify info
                const displayArtist = sourceTrack.artists && Array.isArray(sourceTrack.artists) ? sourceTrack.artists.join(', ') : sourceTrack.artist || 'Unknown Artist';
                originalInfo = `
                    <div class="spotify-info" style="margin-top: 8px; padding: 8px; background: #f7fafc; border-radius: 6px; border-left: 3px solid #1db954;">
                        <div class="spotify-title" style="font-size: 0.85rem; color: #4a5568; margin-bottom: 2px;"><strong>Spotify:</strong> ${sourceTrack.name}</div>
                        <div class="spotify-artist" style="font-size: 0.85rem; color: #718096;"><strong>Artist:</strong> ${displayArtist}</div>
                        ${sourceTrack.album ? `<div class="spotify-album" style="font-size: 0.85rem; color: #718096;"><strong>Album:</strong> ${sourceTrack.album.name || sourceTrack.album}</div>` : ''}
                    </div>
                `;
            } else {
                // For original sync, show YouTube info
                originalInfo = (sourceTrack && (sourceTrack.rawTitle || sourceTrack.channelTitle)) ? `
                    <div class="youtube-info" style="margin-top: 8px; padding: 8px; background: #f7fafc; border-radius: 6px; border-left: 3px solid #ff0000;">
                        ${sourceTrack.rawTitle ? `<div class="youtube-title" style="font-size: 0.85rem; color: #4a5568; margin-bottom: 2px;"><strong>YouTube:</strong> ${sourceTrack.rawTitle}</div>` : ''}
                        ${sourceTrack.channelTitle ? `<div class="youtube-channel" style="font-size: 0.85rem; color: #718096;"><strong>Channel:</strong> ${sourceTrack.channelTitle}</div>` : ''}
                    </div>
                ` : '';
            }

            content = `
                <div class="track-info">                    <div class="track-title">${title}</div>
                    <div class="track-artist">by ${artist}</div>
                    <div style="margin-top: 8px; font-size: 0.9rem; color: #f56565;">${track.reason}</div>
                    ${originalInfo}
                    <div class="manual-match-container" style="margin-top: 12px; border-top: 1px solid #edf2f7; padding-top: 10px;">
                        <div style="font-weight: 600; margin-bottom: 8px;">Add Custom Match:</div>
                        <input type="text" class="manual-match-input" placeholder="${isReverseSync ? 'YouTube Video ID or URL' : 'Spotify Track URL or URI'}" 
                            style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; margin-bottom: 8px;">
                        <button class="action-btn manual-match-btn" data-track-id="${trackId}">
                            Apply Custom Match
                        </button>
                    </div>
                </div>
                <div class="track-confidence confidence-poor">Not Found</div>
            `;
        }        div.innerHTML = content + (actions ? `<div class="track-actions">${actions}</div>` : '');

        // Add event listener for checkbox changes
        if (type === 'perfect') {
            const checkbox = div.querySelector('.track-checkbox');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedTracks.add(trackId);
                } else {
                    this.selectedTracks.delete(trackId);
                }
                this.updateExecuteButton();
            });
        }
        
        // Add event listener for custom match buttons
        if (type === 'uncertain' || type === 'no-match') {
            const matchBtn = div.querySelector('.manual-match-btn');
            if (matchBtn) {
                matchBtn.addEventListener('click', (e) => {
                    const input = div.querySelector('.manual-match-input');
                    const customValue = input.value;
                    this.applyCustomMatch(trackId, customValue);
                });
            }
        }

        return div;
    }    approveUncertainTrack(trackId) {
        // Parse trackId properly for "uncertain" pattern
        const trackIndex = parseInt(trackId.substring(10)); // Remove "uncertain-" prefix
        const track = this.currentPreview.uncertainMatches[trackIndex];
        const syncDirection = document.getElementById('sync-direction').value;
        const isReverseSync = syncDirection === 'spotify-to-youtube';
        
        // Check for matches based on sync direction
        const hasMatches = isReverseSync ? 
            (track.youtubeMatches && track.youtubeMatches.length > 0) :
            (track.spotifyMatches && track.spotifyMatches.length > 0);
        
        if (hasMatches) {
            // Add the best match to selected tracks
            this.selectedTracks.add(trackId);
              // Update UI to show it's approved
            const trackElement = document.querySelector(`[data-type="uncertain"][data-index="${trackIndex}"]`);
            const button = trackElement.querySelector('.action-approve');
            button.textContent = 'Approved';
            button.className = 'action-btn action-approved';
            button.style.background = '#48bb78';
            button.disabled = true;
            
            this.updateExecuteButton();
            this.showToast('Track approved for sync', 'success');
        }
    }

    updateExecuteButton() {
        const selectedCount = this.selectedTracks.size;
        const executeBtn = document.getElementById('execute-sync-btn');
        executeBtn.disabled = selectedCount === 0;
        executeBtn.innerHTML = `<i class="fas fa-play"></i> Execute Sync (${selectedCount} tracks)`;
    }    async executeSync() {
        try {
            const syncDirection = document.getElementById('sync-direction').value;
            const sourcePlaylistId = document.getElementById('source-playlist').value;
            const destPlaylistId = document.getElementById('destination-playlist').value;
            const createNewPlaylist = destPlaylistId === 'new';
            const newPlaylistName = document.getElementById('new-playlist-name').value;            // Prepare approved tracks
            const approvedTracks = [];
            const isReverseSync = syncDirection === 'spotify-to-youtube';
              // Process selected tracks
            this.selectedTracks.forEach(trackId => {
                // Parse trackId properly for different patterns
                let type, trackIndex;
                if (trackId.startsWith('no-match-')) {
                    type = 'no-match';
                    trackIndex = parseInt(trackId.substring(9));
                } else if (trackId.startsWith('uncertain-')) {
                    type = 'uncertain';
                    trackIndex = parseInt(trackId.substring(10));
                } else if (trackId.startsWith('perfect-')) {
                    type = 'perfect';
                    trackIndex = parseInt(trackId.substring(8));
                } else {
                    console.warn('Unknown trackId pattern:', trackId);
                    return;
                }
                
                // Check if this track has a custom match
                if (this.customMatches.has(trackId)) {
                    const customMatch = this.customMatches.get(trackId);
                    const originalTrack = customMatch.originalTrack;
                    const customTrack = customMatch.customTrack;
                    
                    // Create the appropriate track structure based on sync direction
                    if (isReverseSync) {
                        // Spotify to YouTube
                        approvedTracks.push({
                            spotifyTrack: originalTrack.spotifyTrack,
                            youtubeTrack: customTrack,
                            isCustomMatch: true
                        });
                    } else {
                        // YouTube to Spotify
                        approvedTracks.push({
                            youtubeTrack: originalTrack.youtubeTrack,
                            spotifyTrack: customTrack,
                            isCustomMatch: true
                        });
                    }
                } else if (type === 'perfect') {
                    // Normal perfect match case
                    approvedTracks.push(this.currentPreview.perfectMatches[trackIndex]);
                } else if (type === 'uncertain') {
                    const uncertainTrack = this.currentPreview.uncertainMatches[trackIndex];
                    if (isReverseSync) {
                        // Spotify to YouTube: use youtubeMatches  
                        if (uncertainTrack.youtubeMatches && uncertainTrack.youtubeMatches.length > 0) {
                            approvedTracks.push({
                                spotifyTrack: uncertainTrack.spotifyTrack,
                                youtubeTrack: uncertainTrack.youtubeMatches[0] // Use best match
                            });
                        }
                    } else {
                        // YouTube to Spotify: use spotifyMatches  
                        if (uncertainTrack.spotifyMatches && uncertainTrack.spotifyMatches.length > 0) {
                            approvedTracks.push({
                                youtubeTrack: uncertainTrack.youtubeTrack,
                                spotifyTrack: uncertainTrack.spotifyMatches[0] // Use best match
                            });
                        }
                    }
                } else if (type === 'no-match') {
                    // This case should be handled by customMatches already
                    console.log('No-match track selected but not found in customMatches', trackId);
                }
            });

            this.showLoading(`Syncing ${approvedTracks.length} tracks...`);

            // Determine endpoint and request body based on sync direction
            let endpoint, requestBody;
            
            if (syncDirection === 'youtube-to-spotify') {
                // YouTube to Spotify sync (existing functionality)
                endpoint = '/api/sync/execute';
                requestBody = {
                    youtubePlaylistId: sourcePlaylistId,
                    spotifyPlaylistId: createNewPlaylist ? null : destPlaylistId,
                    approvedTracks,
                    createNewPlaylist,
                    newPlaylistName,
                    previewResults: this.currentPreview
                };
            } else if (syncDirection === 'spotify-to-youtube') {
                // Spotify to YouTube sync (new functionality)
                endpoint = '/api/sync/execute-reverse';
                requestBody = {
                    spotifyPlaylistId: sourcePlaylistId,
                    youtubePlaylistId: createNewPlaylist ? null : destPlaylistId,
                    approvedTracks,
                    createNewPlaylist,
                    newPlaylistName,
                    previewResults: this.currentPreview
                };
            } else {
                throw new Error('Invalid sync direction');
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Failed to execute sync');
            }            const results = await response.json();
            console.log('Sync results received:', results);
            
            try {
                this.displayResults(results);
                console.log('displayResults completed successfully');
                this.showSection('results-section');
                console.log('showSection called for results-section');
            } catch (displayError) {
                console.error('Error in displayResults:', displayError);
                this.showToast('Error displaying results: ' + displayError.message, 'error');
            }
            
            this.hideLoading();} catch (error) {
            console.error('Error executing sync:', error);
            
            // Check for quota exceeded error
            if (error.message?.includes('quota exceeded') || error.message?.includes('quotaExceeded')) {
                this.showToast('YouTube API quota exceeded. Cannot execute sync at this time. Please try again tomorrow.', 'error');
            } else {
                this.showToast('Error executing sync: ' + error.message, 'error');
            }
            
            this.hideLoading();
        }
    }    displayResults(results) {
        const container = document.getElementById('sync-results');
        
        // Determine sync direction for proper data handling
        const syncDirection = document.getElementById('sync-direction').value;
        const isReverseSync = syncDirection === 'spotify-to-youtube';
        
        // For reverse sync (Spotify to YouTube), we might have inconsistencies due to Python/Node integration
        // Therefore, determine the success count based on tracksAdded length rather than summary
        let successfullyAdded = results.tracksAdded ? results.tracksAdded.length : results.summary.successfullyAdded;
        let totalApproved = results.summary.totalApproved;
        
        // Calculate success rate based on actual added tracks
        const successRate = totalApproved > 0 
            ? Math.round((successfullyAdded / totalApproved) * 100)
            : 0;
            
        // Get the failed count - use actual tracksFailed length for accuracy
        const actualFailedCount = results.tracksFailed ? results.tracksFailed.length : results.summary.failed;
        
        // Get the non-transferred count directly from the summary for consistency
        const nonTransferredCount = results.summary.nonTransferredCount || 0;
        const hasNonTransferred = nonTransferredCount > 0;
        
        // For reverse sync, display warning if there's a mismatch between reported and actual counts
        const shouldShowDiscrepancyWarning = isReverseSync && 
            (successfullyAdded + actualFailedCount !== totalApproved);        container.innerHTML = `
            <div class="sync-stats">
                <div class="stat-card stat-perfect">
                    <div class="stat-number">${successfullyAdded}</div>
                    <div class="stat-label">Tracks Added</div>
                </div>
                <div class="stat-card stat-uncertain">
                    <div class="stat-number">${actualFailedCount}</div>
                    <div class="stat-label">Failed</div>
                </div>
                ${hasNonTransferred ? `
                <div class="stat-card stat-missing">
                    <div class="stat-number">${nonTransferredCount}</div>
                    <div class="stat-label">Not Transferred</div>
                </div>
                ` : ''}
                <div class="stat-card">
                    <div class="stat-number">${successRate}%</div>
                    <div class="stat-label">Success Rate</div>
                </div>
            </div>
            
            ${shouldShowDiscrepancyWarning ? `
            <div class="alert alert-warning" style="margin: 20px 0; padding: 15px; background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; border-radius: 4px;">
                <strong>Note:</strong> Some tracks may have been added to YouTube Music even though they were reported as failed. 
                Please check your YouTube Music playlist to confirm the final results.
                <div style="margin-top: 10px; font-size: 0.9em;">
                    <span style="font-weight: bold;">Reported counts:</span> ${totalApproved} attempted, ${successfullyAdded} succeeded, ${actualFailedCount} failed
                </div>
            </div>
            ` : ''}${results.summary.successfullyAdded > 0 ? `
                <div style="margin-top: 24px;">
                    <h3 style="color: #48bb78; margin-bottom: 12px;">✅ Successfully Added Tracks</h3>
                    <div class="track-list" style="max-height: 200px;">                        ${results.tracksAdded.map(track => {
                            // Standardized track display for both sync directions
                            let trackName, trackArtist;
                            
                            if (isReverseSync) {
                                // For reverse sync (Spotify to YouTube), show Spotify track info
                                trackName = track.spotifyTrack?.name || track.spotifyTrack?.title || 'Unknown Track';
                                trackArtist = track.spotifyTrack?.artists 
                                    ? (Array.isArray(track.spotifyTrack.artists) ? track.spotifyTrack.artists.join(', ') : track.spotifyTrack.artists)
                                    : track.spotifyTrack?.artist || 'Unknown Artist';
                            } else {
                                // For original sync (YouTube to Spotify), show Spotify track info
                                trackName = track.spotifyTrack?.name || track.spotifyTrack?.title || 'Unknown Track';
                                trackArtist = track.spotifyTrack?.artists 
                                    ? (Array.isArray(track.spotifyTrack.artists) ? track.spotifyTrack.artists.join(', ') : track.spotifyTrack.artists)
                                    : track.spotifyTrack?.artist || 'Unknown Artist';
                            }
                            
                            return `
                                <div class="track-item">
                                    <div class="track-info">
                                        <div class="track-title">${trackName}</div>
                                        <div class="track-artist">by ${trackArtist}</div>
                                    </div>
                                    <div class="track-confidence confidence-perfect">Added</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
              ${results.tracksFailed && results.tracksFailed.length > 0 ? `
                <div style="margin-top: 24px;">
                    <h3 style="color: #f56565; margin-bottom: 12px;">❌ Failed Tracks</h3>
                    <div class="track-list track-list-non-transferred">                        ${results.tracksFailed.map(failure => {
                            // Standardized failed track display for both sync directions
                            let trackName, trackArtist, errorMessage;
                            
                            if (isReverseSync) {
                                // For reverse sync, show source (Spotify) track info
                                trackName = failure.spotifyTrack?.name || failure.spotifyTrack?.title || 'Unknown Track';
                                trackArtist = failure.spotifyTrack?.artists 
                                    ? (Array.isArray(failure.spotifyTrack.artists) ? failure.spotifyTrack.artists.join(', ') : failure.spotifyTrack.artists)
                                    : failure.spotifyTrack?.artist || 'Unknown Artist';
                                errorMessage = failure.error || 'Failed to add to YouTube Music';
                            } else {
                                // For original sync, show source (YouTube) track info
                                trackName = failure.youtubeTrack?.title || failure.track?.youtubeTrack?.title || 'Unknown Track';
                                trackArtist = failure.youtubeTrack?.artist || failure.track?.youtubeTrack?.artist || 'Unknown Artist';
                                errorMessage = failure.error || 'Failed to add to Spotify';
                            }
                            
                            return `
                                <div class="track-item">
                                    <div class="track-info">
                                        <div class="track-title">${trackName}</div>
                                        <div class="track-artist">by ${trackArtist}</div>
                                        <div class="track-reason">${errorMessage}</div>
                                    </div>
                                    <div class="track-confidence confidence-poor">Transfer Failed</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Display non-transferred tracks -->            ${results.nonTransferred ? `                <!-- Display unmatched tracks -->
                ${results.nonTransferred.unmatchedTracks && results.nonTransferred.unmatchedTracks.length > 0 ? `
                    <div style="margin-top: 24px;">                        <h3 style="color: #ed8936; margin-bottom: 12px;"><i class="fas fa-search"></i> Unmatched Tracks</h3>
                        <div class="track-list track-list-non-transferred">                            ${results.nonTransferred.unmatchedTracks.map(track => {
                                let trackTitle, trackArtist, trackReason;
                                let trackSourceInfo = '';
                                
                                if (isReverseSync) {
                                    // For reverse sync, show Spotify track info
                                    trackTitle = track.spotifyTrack?.name || track.spotifyTrack?.title || 'Unknown Track';
                                    trackArtist = track.spotifyTrack?.artists 
                                        ? (Array.isArray(track.spotifyTrack.artists) ? track.spotifyTrack.artists.join(', ') : track.spotifyTrack.artists)
                                        : track.spotifyTrack?.artist || 'Unknown Artist';
                                    trackReason = track.reason || 'No match found on YouTube Music';
                                } else {
                                    // For forward sync, show YouTube track info
                                    trackTitle = track.youtubeTrack?.title || 'Unknown Track';
                                    trackArtist = track.youtubeTrack?.artist || 'Unknown Artist';
                                    trackReason = track.reason || 'No match found on Spotify';
                                    
                                    // Add YouTube specific info for forward sync
                                    if (track.youtubeTrack && (track.youtubeTrack.rawTitle || track.youtubeTrack.channelTitle)) {
                                        trackSourceInfo = `
                                            <div class="youtube-info" style="margin-top: 6px; padding: 6px; background: #f7fafc; border-radius: 4px; border-left: 2px solid #ff0000;">
                                                ${track.youtubeTrack.rawTitle ? `<div style="font-size: 0.8rem; color: #4a5568; margin-bottom: 1px;"><strong>YouTube:</strong> ${track.youtubeTrack.rawTitle}</div>` : ''}
                                                ${track.youtubeTrack.channelTitle ? `<div style="font-size: 0.8rem; color: #718096;"><strong>Channel:</strong> ${track.youtubeTrack.channelTitle}</div>` : ''}
                                            </div>
                                        `;
                                    }
                                }
                                
                                return `
                                    <div class="track-item">
                                        <div class="track-info">
                                            <div class="track-title">${trackTitle}</div>
                                            <div class="track-artist">by ${trackArtist}</div>
                                            <div class="track-reason">${trackReason}</div>
                                            ${trackSourceInfo}
                                            <div class="track-help">Try searching manually with alternate spellings or by album name</div>
                                        </div>
                                        <div class="track-confidence confidence-poor">Not Found</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}                <!-- Display unapproved tracks -->
                ${results.nonTransferred.unapprovedTracks && results.nonTransferred.unapprovedTracks.length > 0 ? `
                    <div style="margin-top: 24px;">                        <h3 style="color: #ed8936; margin-bottom: 12px;"><i class="fas fa-question-circle"></i> Unapproved Tracks</h3>
                        <div class="track-list track-list-non-transferred">                            ${results.nonTransferred.unapprovedTracks.map(track => {
                                let trackTitle, trackArtist, trackReason;
                                let trackSourceInfo = '';
                                let matchInfo = '';
                                
                                if (isReverseSync) {
                                    // For reverse sync, show Spotify track info and potential YouTube matches
                                    trackTitle = track.spotifyTrack?.name || track.spotifyTrack?.title || 'Unknown Track';
                                    trackArtist = track.spotifyTrack?.artists 
                                        ? (Array.isArray(track.spotifyTrack.artists) ? track.spotifyTrack.artists.join(', ') : track.spotifyTrack.artists)
                                        : track.spotifyTrack?.artist || 'Unknown Artist';
                                    trackReason = track.reason || 'Track required manual approval';
                                    
                                    // Show YouTube matches if available
                                    if (track.youtubeMatches && track.youtubeMatches.length > 0) {
                                        matchInfo = `<div class="possible-match">Best match: "${track.youtubeMatches[0].title}" by ${track.youtubeMatches[0].artist}</div>`;
                                    }
                                } else {
                                    // For forward sync, show YouTube track info and potential Spotify matches
                                    trackTitle = track.youtubeTrack?.title || 'Unknown Track';
                                    trackArtist = track.youtubeTrack?.artist || 'Unknown Artist';
                                    trackReason = track.reason || 'Track required manual approval';
                                    
                                    // Add YouTube specific info for forward sync
                                    if (track.youtubeTrack && (track.youtubeTrack.rawTitle || track.youtubeTrack.channelTitle)) {
                                        trackSourceInfo = `
                                            <div class="youtube-info" style="margin-top: 6px; padding: 6px; background: #f7fafc; border-radius: 4px; border-left: 2px solid #ff0000;">
                                                ${track.youtubeTrack.rawTitle ? `<div style="font-size: 0.8rem; color: #4a5568; margin-bottom: 1px;"><strong>YouTube:</strong> ${track.youtubeTrack.rawTitle}</div>` : ''}
                                                ${track.youtubeTrack.channelTitle ? `<div style="font-size: 0.8rem; color: #718096;"><strong>Channel:</strong> ${track.youtubeTrack.channelTitle}</div>` : ''}
                                            </div>
                                        `;
                                    }
                                    
                                    // Show Spotify matches if available
                                    if (track.spotifyMatches && track.spotifyMatches.length > 0) {
                                        matchInfo = `<div class="possible-match">Best match: "${track.spotifyMatches[0].name}" by ${track.spotifyMatches[0].artists.join(', ')}</div>`;
                                    }
                                }
                                
                                return `
                                    <div class="track-item">
                                        <div class="track-info">
                                            <div class="track-title">${trackTitle}</div>
                                            <div class="track-artist">by ${trackArtist}</div>
                                            <div class="track-reason">${trackReason}</div>
                                            ${trackSourceInfo}
                                            <div class="track-matches">
                                                ${matchInfo}
                                            </div>
                                        </div>
                                        <div class="track-confidence confidence-uncertain">Not Approved</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>                ` : ''}                <!-- Display failed tracks from execution failures for both sync directions -->
                ${results.nonTransferred.failedTracks && results.nonTransferred.failedTracks.length > 0 ? `
                    <div style="margin-top: 24px;">                        <h3 style="color: #f56565; margin-bottom: 12px;"><i class="fas fa-exclamation-circle"></i> Failed to Transfer</h3>
                        <div class="track-list track-list-non-transferred">
                            ${results.nonTransferred.failedTracks.map(track => {
                                let trackTitle, trackArtist, errorMessage;
                                
                                if (isReverseSync) {
                                    // For reverse sync, show Spotify track info
                                    trackTitle = track.spotifyTrack?.name || track.spotifyTrack?.title || track.title || 'Unknown Track';
                                    trackArtist = track.spotifyTrack?.artists 
                                        ? (Array.isArray(track.spotifyTrack.artists) ? track.spotifyTrack.artists.join(', ') : track.spotifyTrack.artists)
                                        : track.spotifyTrack?.artist || track.artist || 'Unknown Artist';
                                    errorMessage = track.error || 'Transfer failed - check YouTube Music API';
                                } else {
                                    // For forward sync, show YouTube track info
                                    trackTitle = track.youtubeTrack?.title || track.title || 'Unknown Track';
                                    trackArtist = track.youtubeTrack?.artist || track.artist || 'Unknown Artist';
                                    errorMessage = track.error || 'Transfer failed - check Spotify API limits';
                                }
                                
                                return `
                                    <div class="track-item">
                                        <div class="track-info">
                                            <div class="track-title">${trackTitle}</div>
                                            <div class="track-artist">by ${trackArtist}</div>
                                            <div class="track-reason">${errorMessage}</div>
                                        </div>
                                        <div class="track-confidence confidence-poor">Transfer Failed</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            ` : ''}
        `;

        if (results.summary.successfullyAdded > 0) {
            this.showToast(`Successfully synced ${results.summary.successfullyAdded} tracks!`, 'success');
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }    showSection(sectionId) {
        document.querySelectorAll('.card').forEach(card => {
            // Always keep auth section visible, hide only other sections
            if (card.id !== 'auth-section') {
                card.style.display = 'none';
            }
        });
        document.getElementById(sectionId).style.display = 'block';
    }showLoading(message) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingContent = loadingOverlay.querySelector('.loading-content');
        
        // Simple loading without progress tracking
        loadingContent.innerHTML = `
            <div class="spinner"></div>
            <p id="loading-message">${message}</p>
        `;
        
        loadingOverlay.style.display = 'flex';
    }showProgressLoading(message, percentage = 0) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingContent = loadingOverlay.querySelector('.loading-content');
        
        // Update loading content structure for better progress display
        loadingContent.innerHTML = `
            <div class="loading-header">
                <div class="loading-title">Processing Your Playlist</div>
                <div class="loading-subtitle">Analyzing tracks and finding matches...</div>
            </div>
            <div class="spinner"></div>
            <div id="progress-container" class="progress-container active">
                <div class="progress-message">${message}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="progress-percentage">${percentage}%</div>
                <div class="progress-stats">
                    <div class="progress-stat">
                        <div class="progress-stat-number" id="processed-count">0</div>
                        <div class="progress-stat-label">Processed</div>
                    </div>
                    <div class="progress-stat">
                        <div class="progress-stat-number" id="total-count">0</div>
                        <div class="progress-stat-label">Total</div>
                    </div>
                    <div class="progress-stat">
                        <div class="progress-stat-number" id="matches-count">0</div>
                        <div class="progress-stat-label">Matches</div>
                    </div>
                    <div class="progress-stat">
                        <div class="progress-stat-number" id="duplicates-count">0</div>
                        <div class="progress-stat-label">Duplicates</div>
                    </div>
                </div>
            </div>
        `;
        
        loadingOverlay.style.display = 'flex';
    }

    updateProgress(data) {
        if (data.phase && data.message && typeof data.percentage === 'number') {
            this.updateProgressDisplay(data.message, data.percentage, data);
        }
    }    updateProgressDisplay(message, percentage, data = {}) {
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            // Update main progress elements
            const progressMessage = progressContainer.querySelector('.progress-message');
            const progressFill = progressContainer.querySelector('.progress-fill');
            const progressPercentage = progressContainer.querySelector('.progress-percentage');
            
            if (progressMessage) progressMessage.textContent = message;
            if (progressFill) progressFill.style.width = `${percentage}%`;
            if (progressPercentage) progressPercentage.textContent = `${Math.round(percentage)}%`;
            
            // Update stats if provided
            if (data.stats) {
                const processedCount = document.getElementById('processed-count');
                const totalCount = document.getElementById('total-count');
                const matchesCount = document.getElementById('matches-count');
                const duplicatesCount = document.getElementById('duplicates-count');
                
                if (processedCount) processedCount.textContent = data.stats.processed || 0;
                if (totalCount) totalCount.textContent = data.stats.total || 0;
                if (matchesCount) matchesCount.textContent = data.stats.matches || 0;
                if (duplicatesCount) duplicatesCount.textContent = data.stats.duplicates || 0;
            }
            
            // Update phase-specific styling
            if (data.phase) {
                const loadingSubtitle = document.querySelector('.loading-subtitle');
                if (loadingSubtitle) {
                    switch (data.phase) {
                        case 'fetching':
                            loadingSubtitle.textContent = 'Fetching tracks from YouTube Music...';
                            break;
                        case 'analyzing':
                            loadingSubtitle.textContent = 'Analyzing tracks and finding matches...';
                            break;
                        case 'matching':
                            loadingSubtitle.textContent = 'Searching Spotify for track matches...';
                            break;
                        case 'finalizing':
                            loadingSubtitle.textContent = 'Finalizing results and preparing preview...';
                            break;
                        default:
                            loadingSubtitle.textContent = 'Processing your playlist...';
                    }
                }
            }
        }
    }    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        const progressContainer = document.getElementById('progress-container');
        
        // Remove active animation class
        if (progressContainer) {
            progressContainer.classList.remove('active');
        }
        
        loadingOverlay.style.display = 'none';
    }    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        document.getElementById('toast-container').appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, duration);
    }    resetApp() {
        this.currentPreview = null;
        this.selectedTracks.clear();
        this.customMatches.clear(); // Clear custom matches
        
        // Reset form fields
        document.getElementById('youtube-playlist').value = '';
        document.getElementById('spotify-playlist').value = '';
        document.getElementById('new-playlist-name').value = '';
        document.getElementById('new-playlist-name').style.display = 'none';
        
        // Reset button states
        this.updatePreviewButton();
        
        // Show playlist selection
        this.showSection('playlist-section');
    }    async applyCustomMatch(trackId, customMatchValue) {
        // Parse trackId properly for "no-match" and "uncertain" patterns
        let type, trackIndex;
        if (trackId.startsWith('no-match-')) {
            type = 'no-match';
            trackIndex = parseInt(trackId.substring(9)); // Remove "no-match-" prefix
        } else if (trackId.startsWith('uncertain-')) {
            type = 'uncertain';
            trackIndex = parseInt(trackId.substring(10)); // Remove "uncertain-" prefix
        } else {
            console.error('Invalid trackId pattern:', trackId);
            this.showToast('Invalid track ID', 'error');
            return false;
        }
        
        const track = this.currentPreview[type === 'no-match' ? 'noMatches' : 'uncertainMatches'][trackIndex];
        const syncDirection = document.getElementById('sync-direction').value;
        const isReverseSync = syncDirection === 'spotify-to-youtube';
        
        // Validate input
        if (!customMatchValue || customMatchValue.trim() === '') {
            this.showToast('Please enter a valid custom match link', 'error');
            return false;
        }        // Validate track structure
        if (!track) {
            console.error('Track not found:', trackId, type, trackIndex);
            this.showToast('Track data not found', 'error');
            return false;
        }

        console.log('Track structure for custom match:', { type, track, isReverseSync });

        try {
            this.showLoading('Verifying custom match...');
            
            // Normalize the input value
            let cleanValue = customMatchValue.trim();
            
            // Make an API call to verify the link and get full track info
            let endpoint, requestBody;
            
            // Handle different track structures for no-match vs uncertain tracks
            let sourceTrack;
            
            // For both no-match and uncertain tracks, the structure is the same
            // no-match: { youtubeTrack: trackInfo, reason: '...' } or { spotifyTrack: trackInfo, reason: '...' }
            // uncertain: { youtubeTrack: trackInfo, spotifyMatches: [...], reason: '...' } or { spotifyTrack: trackInfo, youtubeMatches: [...], reason: '...' }
            sourceTrack = isReverseSync ? track.spotifyTrack : track.youtubeTrack;
            
            if (!sourceTrack) {
                console.error('Source track not found in track object:', track);
                const expectedProperty = isReverseSync ? 'spotifyTrack' : 'youtubeTrack';
                this.showToast(`Missing ${expectedProperty} in track data`, 'error');
                return false;
            }
            
            if (isReverseSync) {
                // Verifying YouTube link for Spotify track
                endpoint = '/api/youtube/verify-link';
                requestBody = {
                    link: cleanValue,
                    sourceTrackName: sourceTrack.name || sourceTrack.title,
                    sourceTrackArtist: sourceTrack.artists && Array.isArray(sourceTrack.artists) 
                        ? sourceTrack.artists.join(', ') 
                        : sourceTrack.artist
                };
            } else {
                // Verifying Spotify link for YouTube track
                endpoint = '/api/spotify/verify-link';
                requestBody = {
                    link: cleanValue,
                    sourceTrackName: sourceTrack.title,
                    sourceTrackArtist: sourceTrack.artist
                };
            }
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                this.hideLoading();
                const errorData = await response.json();
                this.showToast(`Error verifying link: ${errorData.error || 'Unknown error'}`, 'error');
                return false;
            }
            
            const verifiedTrack = await response.json();
            
            // Store the custom match
            this.customMatches.set(trackId, {
                originalTrack: track,
                customTrack: verifiedTrack,
                type: type
            });
            
            // Add to selected tracks
            this.selectedTracks.add(trackId);
              // Update UI
            const trackElement = document.querySelector(`[data-type="${type}"][data-index="${trackIndex}"]`);
            const input = trackElement.querySelector('.manual-match-input');
            const button = trackElement.querySelector('.manual-match-btn');
            const matchContainer = trackElement.querySelector('.manual-match-container');
            
            button.textContent = 'Custom Match Applied';
            button.className = 'action-btn action-approved';
            button.style.background = '#48bb78';
            button.disabled = true;
            input.disabled = true;
            
            // Add matched track info display
            const matchInfoDiv = document.createElement('div');
            matchInfoDiv.className = 'custom-match-info';
            matchInfoDiv.style.marginTop = '8px';
            matchInfoDiv.style.padding = '8px';
            matchInfoDiv.style.backgroundColor = '#ebf8ff';
            matchInfoDiv.style.borderRadius = '4px';
            matchInfoDiv.style.borderLeft = '3px solid #4299e1';
            
            const matchType = isReverseSync ? 'YouTube' : 'Spotify';
            const matchTitle = isReverseSync ? verifiedTrack.title : verifiedTrack.name;
            const matchArtist = isReverseSync 
                ? verifiedTrack.artist 
                : (Array.isArray(verifiedTrack.artists) ? verifiedTrack.artists.join(', ') : verifiedTrack.artist);
            
            matchInfoDiv.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 4px;">Custom ${matchType} Match:</div>
                <div style="font-size: 0.9rem;"><strong>${matchTitle}</strong> by ${matchArtist}</div>
            `;
            
            matchContainer.appendChild(matchInfoDiv);
            
            this.updateExecuteButton();
            this.hideLoading();
            this.showToast('Custom match applied successfully', 'success');
            return true;
        } catch (error) {
            console.error('Error applying custom match:', error);
            this.hideLoading();
            this.showToast('Failed to apply custom match: ' + error.message, 'error');        return false;
        }
    }

    // Cookie Monitor Methods
    async updateCookieMonitorStatus() {
        try {
            const response = await fetch('/api/cookie-monitor/status');
            const status = await response.json();
            
            // Update status badge
            const statusElement = document.getElementById('monitor-status');
            statusElement.textContent = status.isRunning ? 'Running' : 'Stopped';
            statusElement.className = `status-badge ${status.isRunning ? 'status-running' : 'status-stopped'}`;
            
            // Update cookie health
            const healthElement = document.getElementById('cookie-health');
            if (status.status === 'healthy') {
                healthElement.textContent = 'Healthy';
                healthElement.className = 'status-badge status-healthy';
            } else if (status.status === 'cookies_expired') {
                healthElement.textContent = 'Expired';
                healthElement.className = 'status-badge status-warning';
            } else if (status.status === 'error') {
                healthElement.textContent = 'Error';
                healthElement.className = 'status-badge status-error';
            } else {
                healthElement.textContent = 'Unknown';
                healthElement.className = 'status-badge status-unknown';
            }
            
            // Update last update time
            const lastUpdateElement = document.getElementById('last-update');
            if (status.lastUpdate) {
                const date = new Date(status.lastUpdate);
                lastUpdateElement.textContent = date.toLocaleString();
            } else {
                lastUpdateElement.textContent = 'Never';
            }
            
            // Update button visibility
            const startBtn = document.getElementById('start-monitor-btn');
            const stopBtn = document.getElementById('stop-monitor-btn');
            
            if (status.isRunning) {
                startBtn.style.display = 'none';
                stopBtn.style.display = 'inline-flex';
            } else {
                startBtn.style.display = 'inline-flex';
                stopBtn.style.display = 'none';
            }
            
            // Update notifications
            this.updateNotifications(status.notifications || []);
            
        } catch (error) {
            console.error('Error updating cookie monitor status:', error);
        }
    }

    updateNotifications(notifications) {
        const notificationsList = document.getElementById('notifications-list');
        
        if (!notifications || notifications.length === 0) {
            notificationsList.innerHTML = '<p class="no-notifications">No notifications yet</p>';
            return;
        }
        
        notificationsList.innerHTML = notifications.reverse().map(notification => {
            const date = new Date(notification.timestamp);
            const iconMap = {
                success: 'fas fa-check-circle',
                warning: 'fas fa-exclamation-triangle', 
                error: 'fas fa-times-circle',
                info: 'fas fa-info-circle'
            };
            
            return `
                <div class="notification-item ${notification.type}">
                    <div class="notification-icon">
                        <i class="${iconMap[notification.type] || 'fas fa-circle'}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-message">${notification.message}</div>
                        <div class="notification-time">${date.toLocaleString()}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async startCookieMonitor() {
        try {
            this.showLoading('Starting Chrome Debug Service...');
            
            const response = await fetch('/api/cookie-monitor/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showToast('Cookie monitor started successfully!', 'success');
                await this.updateCookieMonitorStatus();
            } else {
                this.showToast(`Failed to start monitor: ${result.error || 'Unknown error'}`, 'error');
            }
            
        } catch (error) {
            console.error('Error starting cookie monitor:', error);
            this.showToast('Failed to start cookie monitor', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async stopCookieMonitor() {
        try {
            this.showLoading('Stopping Chrome Debug Service...');
            
            const response = await fetch('/api/cookie-monitor/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showToast('Cookie monitor stopped successfully!', 'success');
                await this.updateCookieMonitorStatus();
            } else {
                this.showToast(`Failed to stop monitor: ${result.error || 'Unknown error'}`, 'error');
            }
            
        } catch (error) {
            console.error('Error stopping cookie monitor:', error);
            this.showToast('Failed to stop cookie monitor', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async restartCookieMonitor() {
        try {
            this.showLoading('Restarting Chrome Debug Service...');
            
            const response = await fetch('/api/cookie-monitor/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showToast('Cookie monitor restarted successfully!', 'success');
                await this.updateCookieMonitorStatus();
            } else {
                this.showToast(`Failed to restart monitor: ${result.error || 'Unknown error'}`, 'error');
            }
            
        } catch (error) {
            console.error('Error restarting cookie monitor:', error);
            this.showToast('Failed to restart cookie monitor', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async refreshCookies() {
        try {
            this.showLoading('Refreshing YouTube Music cookies...');
            
            const response = await fetch('/api/cookie-monitor/refresh-cookies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showToast('Cookies refreshed successfully!', 'success');
                await this.updateCookieMonitorStatus();
            } else {
                this.showToast(`Failed to refresh cookies: ${result.error || 'Unknown error'}`, 'error');
            }
            
        } catch (error) {
            console.error('Error refreshing cookies:', error);
            this.showToast('Failed to refresh cookies', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async checkCookieHealth() {
        try {
            this.showLoading('Checking cookie health...');
            
            const response = await fetch('/api/cookie-monitor/check-health', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showToast('Cookie health check completed!', 'success');
                await this.updateCookieMonitorStatus();
            } else {
                this.showToast(`Health check failed: ${result.error || 'Unknown error'}`, 'error');
            }
            
        } catch (error) {
            console.error('Error checking cookie health:', error);
            this.showToast('Failed to check cookie health', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async clearNotifications() {
        try {
            const response = await fetch('/api/cookie-monitor/notifications', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showToast('Notifications cleared!', 'info');
                await this.updateCookieMonitorStatus();
            } else {
                this.showToast('Failed to clear notifications', 'error');
            }
            
        } catch (error) {
            console.error('Error clearing notifications:', error);
            this.showToast('Failed to clear notifications', 'error');
        }    }

    // Navigation Methods
    switchToOneTimeSync() {
        // Update navigation tabs
        document.getElementById('one-time-sync-tab').classList.add('active');
        document.getElementById('playlist-links-tab').classList.remove('active');
        
        // Show one-time sync sections, hide playlist linking
        document.getElementById('playlist-linking-section').style.display = 'none';
        
        // Ensure auth section is always visible
        document.getElementById('auth-section').style.display = 'block';
        
        // Show the appropriate section based on current state
        if (this.currentPreview) {
            this.showSection('preview-section');
        } else {
            this.showSection('playlist-section');
        }
    }

    switchToPlaylistLinks() {
        // Update navigation tabs
        document.getElementById('playlist-links-tab').classList.add('active');
        document.getElementById('one-time-sync-tab').classList.remove('active');
        
        // Hide all one-time sync sections
        document.querySelectorAll('.card').forEach(card => {
            if (card.id !== 'auth-section' && card.id !== 'playlist-linking-section') {
                card.style.display = 'none';
            }
        });
        
        // Ensure auth section is always visible
        document.getElementById('auth-section').style.display = 'block';
        
        // Show playlist linking section
        document.getElementById('playlist-linking-section').style.display = 'block';
        
        // Load playlist linking data
        this.initializePlaylistLinks();
    }

    // Playlist Linking Methods
    async initializePlaylistLinks() {
        try {
            // Load playlists for link creation
            await this.loadPlaylistsForLinking();
            
            // Load existing links
            await this.loadExistingLinks();
            
            // Load statistics
            await this.loadLinkStatistics();
            
            // Load sync history
            await this.loadSyncHistory();
            
        } catch (error) {
            console.error('Error initializing playlist links:', error);
            this.showToast('Failed to load playlist links data', 'error');
        }
    }

    async loadPlaylistsForLinking() {
        try {
            // Load Spotify playlists
            const spotifyResponse = await fetch('/api/spotify/playlists');
            if (spotifyResponse.ok) {
                const spotifyPlaylists = await spotifyResponse.json();
                this.populateLinkingPlaylistSelect('link-spotify-playlist', spotifyPlaylists);
            }

            // Load YouTube Music playlists
            const youtubeResponse = await fetch('/api/youtube/playlists');
            if (youtubeResponse.ok) {
                const youtubePlaylists = await youtubeResponse.json();
                this.populateLinkingPlaylistSelect('link-youtube-playlist', youtubePlaylists);
            }

        } catch (error) {
            console.error('Error loading playlists for linking:', error);
        }
    }

    populateLinkingPlaylistSelect(selectId, playlists) {
        const select = document.getElementById(selectId);
        if (!select) return;

        // Clear existing options except the first one
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);

        // Add playlist options
        playlists.forEach(playlist => {
            const option = document.createElement('option');
            option.value = playlist.id;
            option.textContent = playlist.name || playlist.title;
            select.appendChild(option);
        });
    }

    updateCreateLinkButton() {
        const syncDirection = document.getElementById('link-sync-direction').value;
        const spotifyPlaylist = document.getElementById('link-spotify-playlist').value;
        const youtubePlaylist = document.getElementById('link-youtube-playlist').value;
        const createBtn = document.getElementById('create-link-btn');

        const canCreate = syncDirection && spotifyPlaylist && youtubePlaylist;
        createBtn.disabled = !canCreate;
    }

    async createPlaylistLink() {
        try {
            const syncDirection = document.getElementById('link-sync-direction').value;
            const autoSyncInterval = parseInt(document.getElementById('link-auto-sync').value);
            const spotifyPlaylistId = document.getElementById('link-spotify-playlist').value;
            const youtubePlaylistId = document.getElementById('link-youtube-playlist').value;

            this.showLoading('Creating playlist link...');

            const linkData = {
                spotifyPlaylistId,
                youtubePlaylistId,
                syncDirection,
                autoSync: autoSyncInterval > 0,
                syncInterval: autoSyncInterval > 0 ? autoSyncInterval / (1000 * 60 * 60) : 24, // Convert to hours
                conflictResolution: 'manual',
                performInitialSync: false
            };

            const response = await fetch('/api/playlist-links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(linkData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create playlist link');
            }

            const newLink = await response.json();
            this.showToast('Playlist link created successfully!', 'success');

            // Reset form
            document.getElementById('link-sync-direction').value = 'bidirectional';
            document.getElementById('link-auto-sync').value = '86400000';
            document.getElementById('link-spotify-playlist').value = '';
            document.getElementById('link-youtube-playlist').value = '';
            this.updateCreateLinkButton();

            // Refresh the links display
            await this.loadExistingLinks();
            await this.loadLinkStatistics();

        } catch (error) {
            console.error('Error creating playlist link:', error);
            this.showToast(error.message || 'Failed to create playlist link', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadExistingLinks() {
        try {
            const response = await fetch('/api/playlist-links');
            if (!response.ok) {
                throw new Error('Failed to fetch playlist links');
            }

            const links = await response.json();
            this.displayPlaylistLinks(links);

        } catch (error) {
            console.error('Error loading existing links:', error);
            this.showToast('Failed to load playlist links', 'error');
        }
    }

    displayPlaylistLinks(links) {
        const container = document.getElementById('playlist-links-list');
        if (!container) return;

        if (links.length === 0) {
            container.innerHTML = `
                <div class="no-links-message">
                    <i class="fas fa-info-circle"></i>
                    <p>No playlist links created yet. Create your first link above to get started!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = links.map(link => this.createLinkElement(link)).join('');
    }

    createLinkElement(link) {
        const lastSyncText = link.lastSyncAt 
            ? new Date(link.lastSyncAt).toLocaleString()
            : 'Never';
        
        const nextSyncText = link.nextSyncAt && link.autoSync
            ? new Date(link.nextSyncAt).toLocaleString()
            : 'Manual';

        const syncDirectionIcon = this.getSyncDirectionIcon(link.syncDirection);
        const statusClass = link.isActive ? 'active' : 'inactive';

        return `
            <div class="link-card ${statusClass}" data-link-id="${link.id}">
                <div class="link-header">
                    <div class="link-title">
                        <span class="playlist-name">${link.spotifyPlaylistName}</span>
                        <span class="sync-direction">${syncDirectionIcon}</span>
                        <span class="playlist-name">${link.youtubePlaylistName}</span>
                    </div>
                    <div class="link-status">
                        <span class="status-badge ${statusClass}">${link.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                </div>
                
                <div class="link-details">
                    <div class="detail-row">
                        <span class="detail-label">Sync Mode:</span>
                        <span class="detail-value">${this.formatSyncDirection(link.syncDirection)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Auto Sync:</span>
                        <span class="detail-value">${link.autoSync ? `Every ${link.syncInterval}h` : 'Manual'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Last Sync:</span>
                        <span class="detail-value">${lastSyncText}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Next Sync:</span>
                        <span class="detail-value">${nextSyncText}</span>
                    </div>
                </div>

                <div class="link-stats">
                    <div class="stat-item">
                        <span class="stat-number">${link.stats.totalSyncs}</span>
                        <span class="stat-label">Total</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${link.stats.successfulSyncs}</span>
                        <span class="stat-label">Success</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${link.stats.failedSyncs}</span>
                        <span class="stat-label">Failed</span>
                    </div>
                </div>

                <div class="link-actions">
                    <button class="btn btn-sm btn-primary" onclick="spotisyncApp.syncLink('${link.id}')">
                        <i class="fas fa-sync"></i> Sync Now
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="spotisyncApp.viewLinkHistory('${link.id}')">
                        <i class="fas fa-history"></i> History
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="spotisyncApp.editLink('${link.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="spotisyncApp.deleteLink('${link.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }

    getSyncDirectionIcon(direction) {
        switch (direction) {
            case 'spotify-to-youtube':
                return '<i class="fas fa-arrow-right"></i>';
            case 'youtube-to-spotify':
                return '<i class="fas fa-arrow-left"></i>';
            case 'bidirectional':
                return '<i class="fas fa-exchange-alt"></i>';
            default:
                return '<i class="fas fa-question"></i>';
        }
    }

    formatSyncDirection(direction) {
        switch (direction) {
            case 'spotify-to-youtube':
                return 'Spotify → YouTube Music';
            case 'youtube-to-spotify':
                return 'YouTube Music → Spotify';
            case 'bidirectional':
                return 'Bidirectional';
            default:
                return 'Unknown';
        }
    }

    async syncLink(linkId) {
        try {
            this.showLoading('Syncing playlist...');

            const response = await fetch(`/api/playlist-links/${linkId}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to sync playlist');
            }

            const result = await response.json();
            this.showToast('Playlist synced successfully!', 'success');

            // Refresh the display
            await this.loadExistingLinks();
            await this.loadLinkStatistics();
            await this.loadSyncHistory();

        } catch (error) {
            console.error('Error syncing playlist link:', error);
            this.showToast(error.message || 'Failed to sync playlist', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async syncAllLinks() {
        try {
            this.showLoading('Syncing all playlists...');

            const linksResponse = await fetch('/api/playlist-links');
            if (!linksResponse.ok) {
                throw new Error('Failed to fetch playlist links');
            }

            const links = await linksResponse.json();
            const activeLinks = links.filter(link => link.isActive);

            if (activeLinks.length === 0) {
                this.showToast('No active playlist links to sync', 'info');
                return;
            }

            let successCount = 0;
            let failCount = 0;

            // Sync all active links
            for (const link of activeLinks) {
                try {
                    const response = await fetch(`/api/playlist-links/${link.id}/sync`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    console.error(`Error syncing link ${link.id}:`, error);
                    failCount++;
                }
            }

            this.showToast(`Sync completed: ${successCount} successful, ${failCount} failed`, 'info');

            // Refresh the display
            await this.loadExistingLinks();
            await this.loadLinkStatistics();
            await this.loadSyncHistory();

        } catch (error) {
            console.error('Error syncing all links:', error);
            this.showToast('Failed to sync all playlists', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteLink(linkId) {
        if (!confirm('Are you sure you want to delete this playlist link? This action cannot be undone.')) {
            return;
        }

        try {
            this.showLoading('Deleting playlist link...');

            const response = await fetch(`/api/playlist-links/${linkId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete playlist link');
            }

            this.showToast('Playlist link deleted successfully', 'success');

            // Refresh the display
            await this.loadExistingLinks();
            await this.loadLinkStatistics();

        } catch (error) {
            console.error('Error deleting playlist link:', error);
            this.showToast(error.message || 'Failed to delete playlist link', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async editLink(linkId) {
        // For now, show a simple alert. In the future, this could open a modal
        this.showToast('Link editing feature coming soon!', 'info');
    }

    async viewLinkHistory(linkId) {
        try {
            const response = await fetch(`/api/playlist-links/${linkId}/history?limit=10`);
            if (!response.ok) {
                throw new Error('Failed to fetch sync history');
            }

            const history = await response.json();
            this.displayLinkHistoryModal(linkId, history);

        } catch (error) {
            console.error('Error loading link history:', error);
            this.showToast('Failed to load sync history', 'error');
        }
    }

    displayLinkHistoryModal(linkId, history) {
        // For now, show a simple alert with history. In the future, this could be a proper modal
        let historyText = `Sync History for Link ${linkId}:\n\n`;
        
        if (history.length === 0) {
            historyText += 'No sync history available.';
        } else {
            history.forEach(entry => {
                const date = new Date(entry.syncedAt).toLocaleString();
                historyText += `${date}: ${entry.status} - ${entry.tracksProcessed} tracks processed\n`;
            });
        }

        alert(historyText);
    }

    async loadLinkStatistics() {
        try {
            const response = await fetch('/api/playlist-links/stats');
            if (!response.ok) {
                throw new Error('Failed to fetch statistics');
            }

            const stats = await response.json();
            this.displayLinkStatistics(stats);

        } catch (error) {
            console.error('Error loading link statistics:', error);
        }
    }

    displayLinkStatistics(stats) {
        document.getElementById('total-links').textContent = stats.totalLinks || 0;
        document.getElementById('successful-syncs').textContent = stats.successfulSyncs || 0;
        document.getElementById('failed-syncs').textContent = stats.failedSyncs || 0;
        
        // Calculate total tracks synced (approximate)
        const totalTracks = stats.successfulSyncs * 10; // Rough estimate
        document.getElementById('total-tracks-synced').textContent = totalTracks;
    }

    async loadSyncHistory() {
        try {
            const response = await fetch('/api/sync-history?limit=5');
            if (!response.ok) {
                throw new Error('Failed to fetch sync history');
            }

            const history = await response.json();
            this.displaySyncHistory(history);

        } catch (error) {
            console.error('Error loading sync history:', error);
        }
    }

    displaySyncHistory(history) {
        const container = document.getElementById('sync-history-list');
        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = `
                <div class="no-history-message">
                    <i class="fas fa-info-circle"></i>
                    <p>No sync history available yet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = history.map(entry => this.createHistoryElement(entry)).join('');
    }

    createHistoryElement(entry) {
        const date = new Date(entry.syncedAt).toLocaleString();
        const statusClass = entry.status === 'success' ? 'success' : 
                           entry.status === 'failed' ? 'failed' : 'partial';
        
        const directionIcon = this.getSyncDirectionIcon(entry.syncDirection);

        return `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-direction">${directionIcon}</span>
                    <span class="history-date">${date}</span>
                    <span class="status-badge ${statusClass}">${entry.status}</span>
                </div>
                <div class="history-details">
                    <span>${entry.tracksProcessed} tracks processed</span>
                    ${entry.tracksAdded ? `, ${entry.tracksAdded} added` : ''}
                    ${entry.tracksFailed ? `, ${entry.tracksFailed} failed` : ''}
                </div>
            </div>
        `;
    }

    async viewAllHistory() {
        // For now, show a toast. In the future, this could open a dedicated history page
        this.showToast('Full history view coming soon!', 'info');
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.spotisyncApp = new SpotisyncApp();
});
