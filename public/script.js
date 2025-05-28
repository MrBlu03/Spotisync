class SpotisyncApp {
    constructor() {
        this.currentPreview = null;
        this.selectedTracks = new Set();
        this.spotifyPlaylists = [];
        this.youtubePlayists = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.checkUrlParams();
    }

    setupEventListeners() {
        // Sync direction
        document.getElementById('sync-direction').addEventListener('change', (e) => {
            this.handleSyncDirectionChange(e.target.value);
        });

        // Authentication
        document.getElementById('spotify-auth-btn').addEventListener('click', () => {
            this.authenticateSpotify();
        });        document.getElementById('youtube-auth-btn').addEventListener('click', () => {
            this.authenticateYoutube();
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
        });

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });        });
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
        } else if (urlParams.get('ytauth') === 'success') {
            this.showToast('YouTube Music authentication successful!', 'success');
            this.checkAuthStatus();
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (urlParams.get('ytauth') === 'error') {
            this.showToast('YouTube Music authentication failed. Please try again.', 'error');
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);        }
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
                spotifyResponse = { ok: false };
            }

            // Check YouTube Music authentication
            let youtubeResponse;
            try {
                youtubeResponse = await fetch('/api/youtube/playlists');
                if (youtubeResponse.ok) {
                    document.getElementById('youtube-status').textContent = 'Connected';
                    document.getElementById('youtube-status').className = 'status-indicator status-connected';
                    document.getElementById('youtube-auth-btn').style.display = 'none';
                } else {
                    document.getElementById('youtube-status').textContent = 'Not Connected';
                    document.getElementById('youtube-status').className = 'status-indicator status-error';
                }
            } catch (error) {
                console.error('Error checking YouTube auth:', error);
                document.getElementById('youtube-status').textContent = 'Not Connected';
                document.getElementById('youtube-status').className = 'status-indicator status-error';
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
        } catch (error) {
            console.error('Error checking auth status:', error);
            document.getElementById('spotify-status').textContent = 'Error';
            document.getElementById('spotify-status').className = 'status-indicator status-error';
            document.getElementById('youtube-status').textContent = 'Error';
            document.getElementById('youtube-status').className = 'status-indicator status-error';        }
    }

    authenticateSpotify() {
        window.location.href = '/auth/spotify';
    }    authenticateYoutube() {
        window.location.href = '/auth/youtube';
    }

    async loadPlaylists() {
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
    }

    displaySyncStats() {
        const stats = this.currentPreview.summary;
        const syncablePercentage = Math.round((stats.perfectMatchCount / stats.totalYoutubeTracks) * 100);

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

        // Ensure track and youtubeTrack exist
        if (!track || !track.youtubeTrack) {
            console.warn('Invalid track object:', track);
            div.innerHTML = '<div class="track-info"><div class="track-title">Invalid track data</div></div>';
            return div;
        }

        let content = '';
        let actions = '';

        if (type === 'perfect') {
            content = `
                <div class="track-info">
                    <div class="track-title">${track.youtubeTrack.title}</div>
                    <div class="track-artist">by ${track.youtubeTrack.artist}</div>
                </div>
                <div class="track-confidence confidence-perfect">Perfect Match</div>
            `;
            actions = `
                <input type="checkbox" id="${trackId}" class="track-checkbox" checked>
                <label for="${trackId}">Include in sync</label>
            `;        } else if (type === 'uncertain') {
            const matches = track.spotifyMatches || [];
            const matchesHtml = matches.map(match => 
                `<div style="margin-left: 20px; color: #718096; font-size: 0.9rem;">
                    → ${match.name} by ${match.artists.join(', ')} 
                    <span class="track-confidence confidence-${match.confidence}">${match.confidence}</span>
                </div>`            ).join('');

            // Show original YouTube information for manual searching
            const youtubeInfo = (track.youtubeTrack && (track.youtubeTrack.rawTitle || track.youtubeTrack.channelTitle)) ? `
                <div class="youtube-info" style="margin-top: 8px; padding: 8px; background: #f7fafc; border-radius: 6px; border-left: 3px solid #ff0000;">
                    ${track.youtubeTrack.rawTitle ? `<div class="youtube-title" style="font-size: 0.85rem; color: #4a5568; margin-bottom: 2px;"><strong>YouTube:</strong> ${track.youtubeTrack.rawTitle}</div>` : ''}
                    ${track.youtubeTrack.channelTitle ? `<div class="youtube-channel" style="font-size: 0.85rem; color: #718096;"><strong>Channel:</strong> ${track.youtubeTrack.channelTitle}</div>` : ''}
                </div>
            ` : '';

            content = `
                <div class="track-info">
                    <div class="track-title">${track.youtubeTrack.title}</div>
                    <div class="track-artist">by ${track.youtubeTrack.artist}</div>
                    <div style="margin-top: 8px; font-size: 0.9rem; color: #ed8936;">${track.reason}</div>
                    ${youtubeInfo}
                    ${matchesHtml}
                </div>
            `;
            actions = `
                <button class="action-btn action-approve" onclick="spotisyncApp.approveUncertainTrack('${trackId}')">
                    Approve Best Match
                </button>
            `;
        } else if (type === 'duplicate') {
            content = `
                <div class="track-info">
                    <div class="track-title">${track.youtubeTrack.title}</div>
                    <div class="track-artist">by ${track.youtubeTrack.artist}</div>
                    <div style="margin-top: 8px; font-size: 0.9rem; color: #4299e1;">${track.reason}</div>
                </div>
                <div class="track-confidence confidence-perfect">Already in Playlist</div>
            `;        } else if (type === 'no-match') {
            // Show original YouTube information for manual searching
            const youtubeInfo = (track.youtubeTrack && (track.youtubeTrack.rawTitle || track.youtubeTrack.channelTitle)) ? `
                <div class="youtube-info" style="margin-top: 8px; padding: 8px; background: #f7fafc; border-radius: 6px; border-left: 3px solid #ff0000;">
                    ${track.youtubeTrack.rawTitle ? `<div class="youtube-title" style="font-size: 0.85rem; color: #4a5568; margin-bottom: 2px;"><strong>YouTube:</strong> ${track.youtubeTrack.rawTitle}</div>` : ''}
                    ${track.youtubeTrack.channelTitle ? `<div class="youtube-channel" style="font-size: 0.85rem; color: #718096;"><strong>Channel:</strong> ${track.youtubeTrack.channelTitle}</div>` : ''}
                </div>
            ` : '';

            content = `
                <div class="track-info">
                    <div class="track-title">${track.youtubeTrack.title}</div>
                    <div class="track-artist">by ${track.youtubeTrack.artist}</div>
                    <div style="margin-top: 8px; font-size: 0.9rem; color: #f56565;">${track.reason}</div>
                    ${youtubeInfo}
                </div>
                <div class="track-confidence confidence-poor">Not Found</div>
            `;
        }

        div.innerHTML = content + (actions ? `<div class="track-actions">${actions}</div>` : '');

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

        return div;
    }

    approveUncertainTrack(trackId) {
        const [type, index] = trackId.split('-');
        const track = this.currentPreview.uncertainMatches[parseInt(index)];
        
        if (track.spotifyMatches && track.spotifyMatches.length > 0) {
            // Add the best match to selected tracks
            this.selectedTracks.add(trackId);
            
            // Update UI to show it's approved
            const trackElement = document.querySelector(`[data-type="${type}"][data-index="${index}"]`);
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
            const newPlaylistName = document.getElementById('new-playlist-name').value;

            // Prepare approved tracks
            const approvedTracks = [];
            
            this.selectedTracks.forEach(trackId => {
                const [type, index] = trackId.split('-');
                const trackIndex = parseInt(index);
                
                if (type === 'perfect') {
                    approvedTracks.push(this.currentPreview.perfectMatches[trackIndex]);
                } else if (type === 'uncertain') {
                    const uncertainTrack = this.currentPreview.uncertainMatches[trackIndex];
                    if (syncDirection === 'youtube-to-spotify') {
                        // YouTube to Spotify: use spotifyMatches
                        if (uncertainTrack.spotifyMatches && uncertainTrack.spotifyMatches.length > 0) {
                            approvedTracks.push({
                                youtubeTrack: uncertainTrack.youtubeTrack,
                                spotifyTrack: uncertainTrack.spotifyMatches[0] // Use best match
                            });
                        }
                    } else if (syncDirection === 'spotify-to-youtube') {
                        // Spotify to YouTube: use youtubeMatches  
                        if (uncertainTrack.youtubeMatches && uncertainTrack.youtubeMatches.length > 0) {
                            approvedTracks.push({
                                spotifyTrack: uncertainTrack.spotifyTrack,
                                youtubeTrack: uncertainTrack.youtubeMatches[0] // Use best match
                            });
                        }
                    }
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
            }

            const results = await response.json();
            this.displayResults(results);
            this.showSection('results-section');
            this.hideLoading();        } catch (error) {
            console.error('Error executing sync:', error);
            
            // Check for quota exceeded error
            if (error.message?.includes('quota exceeded') || error.message?.includes('quotaExceeded')) {
                this.showToast('YouTube API quota exceeded. Cannot execute sync at this time. Please try again tomorrow.', 'error');
            } else {
                this.showToast('Error executing sync: ' + error.message, 'error');
            }
            
            this.hideLoading();
        }
    }displayResults(results) {
        const container = document.getElementById('sync-results');
        
        const successRate = results.summary.totalApproved > 0 
            ? Math.round((results.summary.successfullyAdded / results.summary.totalApproved) * 100)
            : 0;
            
        // Calculate total non-transferred tracks count
        const nonTransferredCount = results.summary.nonTransferredCount || 0;
        const hasNonTransferred = nonTransferredCount > 0;

        container.innerHTML = `
            <div class="sync-stats">
                <div class="stat-card stat-perfect">
                    <div class="stat-number">${results.summary.successfullyAdded}</div>
                    <div class="stat-label">Tracks Added</div>
                </div>
                <div class="stat-card stat-uncertain">
                    <div class="stat-number">${results.summary.failed}</div>
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
            
            ${results.summary.successfullyAdded > 0 ? `
                <div style="margin-top: 24px;">
                    <h3 style="color: #48bb78; margin-bottom: 12px;">✅ Successfully Added Tracks</h3>
                    <div class="track-list" style="max-height: 200px;">
                        ${results.tracksAdded.map(track => `
                            <div class="track-item">
                                <div class="track-info">
                                    <div class="track-title">${track.spotifyTrack.name}</div>
                                    <div class="track-artist">by ${track.spotifyTrack.artists.join(', ')}</div>
                                </div>
                                <div class="track-confidence confidence-perfect">Added</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${results.tracksFailed.length > 0 ? `
                <div style="margin-top: 24px;">
                    <h3 style="color: #f56565; margin-bottom: 12px;">❌ Failed Tracks</h3>
                    <div style="background: #fed7d7; padding: 16px; border-radius: 8px; color: #742a2a;">
                        ${results.tracksFailed.map(failure => failure.error).join('<br>')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Display non-transferred tracks -->
            ${results.nonTransferred ? `                <!-- Display unmatched tracks -->
                ${results.nonTransferred.unmatchedTracks && results.nonTransferred.unmatchedTracks.length > 0 ? `
                    <div style="margin-top: 24px;">                        <h3 style="color: #ed8936; margin-bottom: 12px;"><i class="fas fa-search"></i> Unmatched Tracks</h3>
                        <div class="track-list track-list-non-transferred">                            ${results.nonTransferred.unmatchedTracks.map(track => {
                                const youtubeInfo = (track.youtubeTrack && (track.youtubeTrack.rawTitle || track.youtubeTrack.channelTitle)) ? `
                                    <div class="youtube-info" style="margin-top: 6px; padding: 6px; background: #f7fafc; border-radius: 4px; border-left: 2px solid #ff0000;">
                                        ${track.youtubeTrack.rawTitle ? `<div style="font-size: 0.8rem; color: #4a5568; margin-bottom: 1px;"><strong>YouTube:</strong> ${track.youtubeTrack.rawTitle}</div>` : ''}
                                        ${track.youtubeTrack.channelTitle ? `<div style="font-size: 0.8rem; color: #718096;"><strong>Channel:</strong> ${track.youtubeTrack.channelTitle}</div>` : ''}
                                    </div>
                                ` : '';
                                
                                return `
                                    <div class="track-item">
                                        <div class="track-info">
                                            <div class="track-title">${track.youtubeTrack.title}</div>
                                            <div class="track-artist">by ${track.youtubeTrack.artist}</div>
                                            <div class="track-reason">${track.reason || 'No match found on Spotify'}</div>
                                            ${youtubeInfo}
                                            <div class="track-help">Try searching manually on Spotify with alternate spellings or by album name</div>
                                        </div>
                                        <div class="track-confidence confidence-poor">Not Found</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
                  <!-- Display unapproved tracks -->
                ${results.nonTransferred.unapprovedTracks && results.nonTransferred.unapprovedTracks.length > 0 ? `
                    <div style="margin-top: 24px;">                        <h3 style="color: #ed8936; margin-bottom: 12px;"><i class="fas fa-question-circle"></i> Unapproved Tracks</h3>
                        <div class="track-list track-list-non-transferred">                            ${results.nonTransferred.unapprovedTracks.map(track => {
                                const youtubeInfo = (track.youtubeTrack && (track.youtubeTrack.rawTitle || track.youtubeTrack.channelTitle)) ? `
                                    <div class="youtube-info" style="margin-top: 6px; padding: 6px; background: #f7fafc; border-radius: 4px; border-left: 2px solid #ff0000;">
                                        ${track.youtubeTrack.rawTitle ? `<div style="font-size: 0.8rem; color: #4a5568; margin-bottom: 1px;"><strong>YouTube:</strong> ${track.youtubeTrack.rawTitle}</div>` : ''}
                                        ${track.youtubeTrack.channelTitle ? `<div style="font-size: 0.8rem; color: #718096;"><strong>Channel:</strong> ${track.youtubeTrack.channelTitle}</div>` : ''}
                                    </div>
                                ` : '';
                                
                                return `
                                    <div class="track-item">
                                        <div class="track-info">
                                            <div class="track-title">${track.youtubeTrack.title}</div>
                                            <div class="track-artist">by ${track.youtubeTrack.artist}</div>
                                            <div class="track-reason">${track.reason || 'Track required manual approval'}</div>
                                            ${youtubeInfo}
                                            <div class="track-matches">
                                                ${track.spotifyMatches && track.spotifyMatches.length > 0 ? 
                                                    `<div class="possible-match">Best match: "${track.spotifyMatches[0].name}" by ${track.spotifyMatches[0].artists.join(', ')}</div>` 
                                                    : ''}
                                            </div>
                                        </div>
                                        <div class="track-confidence confidence-uncertain">Not Approved</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Display failed tracks -->
                ${results.nonTransferred.failedTracks && results.nonTransferred.failedTracks.length > 0 ? `
                    <div style="margin-top: 24px;">                        <h3 style="color: #f56565; margin-bottom: 12px;"><i class="fas fa-exclamation-circle"></i> Failed to Transfer</h3>
                        <div class="track-list track-list-non-transferred">
                            ${results.nonTransferred.failedTracks.map(track => `
                                <div class="track-item">
                                    <div class="track-info">
                                        <div class="track-title">${track.youtubeTrack?.title || track.title || 'Unknown Track'}</div>
                                        <div class="track-artist">by ${track.youtubeTrack?.artist || track.artist || 'Unknown Artist'}</div>
                                        <div class="track-reason">${track.error || 'Transfer failed - check Spotify API limits'}</div>
                                    </div>
                                    <div class="track-confidence confidence-poor">Transfer Failed</div>
                                </div>
                            `).join('')}
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
    }

    showSection(sectionId) {
        document.querySelectorAll('.card').forEach(card => {
            card.style.display = 'none';
        });
        document.getElementById(sectionId).style.display = 'block';
    }    showLoading(message) {
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
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        document.getElementById('toast-container').appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    resetApp() {
        this.currentPreview = null;
        this.selectedTracks.clear();
        
        // Reset form fields
        document.getElementById('youtube-playlist').value = '';
        document.getElementById('spotify-playlist').value = '';
        document.getElementById('new-playlist-name').value = '';
        document.getElementById('new-playlist-name').style.display = 'none';
        
        // Reset button states
        this.updatePreviewButton();
        
        // Show playlist selection
        this.showSection('playlist-section');
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.spotisyncApp = new SpotisyncApp();
});
