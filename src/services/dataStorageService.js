/**
 * DataStorageService - JSON-based storage for playlist links and sync data
 * 
 * Since the current app doesn't use a database, this service provides
 * file-based JSON storage for persistent data.
 */

const fs = require('fs').promises;
const path = require('path');

class DataStorageService {
    constructor() {
        this.dataDir = path.join(__dirname, '../../data');
        this.playlistLinksFile = path.join(this.dataDir, 'playlist-links.json');
        this.syncHistoryFile = path.join(this.dataDir, 'sync-history.json');
        this.settingsFile = path.join(this.dataDir, 'settings.json');
    }

    /**
     * Initialize storage directory and files
     */
    async initialize() {
        try {
            // Create data directory if it doesn't exist
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // Initialize files if they don't exist
            await this.initializeFile(this.playlistLinksFile, []);
            await this.initializeFile(this.syncHistoryFile, []);
            await this.initializeFile(this.settingsFile, {});
            
            console.log('✅ Data storage service initialized');
        } catch (error) {
            console.error('❌ Error initializing data storage:', error);
            throw error;
        }
    }

    /**
     * Initialize a JSON file with default content if it doesn't exist
     */
    async initializeFile(filePath, defaultContent) {
        try {
            await fs.access(filePath);
        } catch (error) {
            // File doesn't exist, create it
            await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
        }
    }

    /**
     * Read and parse JSON file
     */
    async readJsonFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Write data to JSON file
     */
    async writeJsonFile(filePath, data) {
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error(`Error writing to ${filePath}:`, error);
            return false;
        }
    }

    // PLAYLIST LINKS METHODS

    /**
     * Get all playlist links
     */
    async getAllPlaylistLinks() {
        return await this.readJsonFile(this.playlistLinksFile) || [];
    }

    /**
     * Get a specific playlist link by ID
     */
    async getPlaylistLink(linkId) {
        const links = await this.getAllPlaylistLinks();
        return links.find(link => link.id === linkId);
    }

    /**
     * Get playlist links by platform playlist ID
     */
    async getPlaylistLinksByPlaylistId(playlistId, platform) {
        const links = await this.getAllPlaylistLinks();
        if (platform === 'spotify') {
            return links.filter(link => link.spotifyPlaylistId === playlistId);
        } else if (platform === 'youtube') {
            return links.filter(link => link.youtubePlaylistId === playlistId);
        }
        return [];
    }

    /**
     * Create a new playlist link
     */
    async createPlaylistLink(linkData) {
        const links = await this.getAllPlaylistLinks();
        
        const newLink = {
            id: this.generateId(),
            spotifyPlaylistId: linkData.spotifyPlaylistId,
            spotifyPlaylistName: linkData.spotifyPlaylistName,
            youtubePlaylistId: linkData.youtubePlaylistId,
            youtubePlaylistName: linkData.youtubePlaylistName,
            syncDirection: linkData.syncDirection || 'bidirectional', // 'spotify-to-youtube', 'youtube-to-spotify', 'bidirectional'
            autoSync: linkData.autoSync || false,
            syncInterval: linkData.syncInterval || 24, // hours
            conflictResolution: linkData.conflictResolution || 'manual', // 'manual', 'source-wins', 'merge'
            lastSyncAt: null,
            nextSyncAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true,
            stats: {
                totalSyncs: 0,
                lastSyncTrackCount: 0,
                successfulSyncs: 0,
                failedSyncs: 0
            }
        };

        // Calculate next sync time if auto sync is enabled
        if (newLink.autoSync) {
            newLink.nextSyncAt = new Date(Date.now() + newLink.syncInterval * 60 * 60 * 1000).toISOString();
        }

        links.push(newLink);
        await this.writeJsonFile(this.playlistLinksFile, links);
        
        console.log(`✅ Created playlist link: ${newLink.spotifyPlaylistName} ↔ ${newLink.youtubePlaylistName}`);
        return newLink;
    }

    /**
     * Update an existing playlist link
     */
    async updatePlaylistLink(linkId, updates) {
        const links = await this.getAllPlaylistLinks();
        const linkIndex = links.findIndex(link => link.id === linkId);
        
        if (linkIndex === -1) {
            throw new Error(`Playlist link with ID ${linkId} not found`);
        }

        const updatedLink = {
            ...links[linkIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Update next sync time if auto sync settings changed
        if (updates.autoSync !== undefined || updates.syncInterval !== undefined) {
            if (updatedLink.autoSync) {
                updatedLink.nextSyncAt = new Date(Date.now() + updatedLink.syncInterval * 60 * 60 * 1000).toISOString();
            } else {
                updatedLink.nextSyncAt = null;
            }
        }

        links[linkIndex] = updatedLink;
        await this.writeJsonFile(this.playlistLinksFile, links);
        
        return updatedLink;
    }

    /**
     * Delete a playlist link
     */
    async deletePlaylistLink(linkId) {
        const links = await this.getAllPlaylistLinks();
        const linkIndex = links.findIndex(link => link.id === linkId);
        
        if (linkIndex === -1) {
            throw new Error(`Playlist link with ID ${linkId} not found`);
        }

        const deletedLink = links.splice(linkIndex, 1)[0];
        await this.writeJsonFile(this.playlistLinksFile, links);
        
        console.log(`🗑️ Deleted playlist link: ${deletedLink.spotifyPlaylistName} ↔ ${deletedLink.youtubePlaylistName}`);
        return deletedLink;
    }

    /**
     * Get playlist links that need to be synced
     */
    async getPlaylistLinksForSync() {
        const links = await this.getAllPlaylistLinks();
        const now = new Date();
        
        return links.filter(link => 
            link.isActive && 
            link.autoSync && 
            link.nextSyncAt && 
            new Date(link.nextSyncAt) <= now
        );
    }

    /**
     * Update sync statistics for a playlist link
     */
    async updateSyncStats(linkId, success, trackCount = 0) {
        const links = await this.getAllPlaylistLinks();
        const linkIndex = links.findIndex(link => link.id === linkId);
        
        if (linkIndex === -1) {
            return false;
        }

        const link = links[linkIndex];
        link.stats.totalSyncs++;
        link.stats.lastSyncTrackCount = trackCount;
        
        if (success) {
            link.stats.successfulSyncs++;
        } else {
            link.stats.failedSyncs++;
        }

        link.lastSyncAt = new Date().toISOString();
        
        // Schedule next sync if auto sync is enabled
        if (link.autoSync) {
            link.nextSyncAt = new Date(Date.now() + link.syncInterval * 60 * 60 * 1000).toISOString();
        }

        link.updatedAt = new Date().toISOString();
        
        await this.writeJsonFile(this.playlistLinksFile, links);
        return true;
    }

    // SYNC HISTORY METHODS

    /**
     * Add a sync history entry
     */
    async addSyncHistory(historyData) {
        const history = await this.readJsonFile(this.syncHistoryFile) || [];
        
        const newEntry = {
            id: this.generateId(),
            playlistLinkId: historyData.playlistLinkId,
            syncDirection: historyData.syncDirection,
            status: historyData.status, // 'success', 'failed', 'partial'
            tracksProcessed: historyData.tracksProcessed || 0,
            tracksAdded: historyData.tracksAdded || 0,
            tracksFailed: historyData.tracksFailed || 0,
            duration: historyData.duration || 0, // milliseconds
            error: historyData.error || null,
            details: historyData.details || {},
            timestamp: new Date().toISOString()
        };

        history.unshift(newEntry); // Add to beginning
        
        // Keep only last 1000 entries
        if (history.length > 1000) {
            history.length = 1000;
        }

        await this.writeJsonFile(this.syncHistoryFile, history);
        return newEntry;
    }

    /**
     * Get sync history for a playlist link
     */
    async getSyncHistory(playlistLinkId, limit = 50) {
        const history = await this.readJsonFile(this.syncHistoryFile) || [];
        
        if (playlistLinkId) {
            return history
                .filter(entry => entry.playlistLinkId === playlistLinkId)
                .slice(0, limit);
        }
        
        return history.slice(0, limit);
    }

    // SETTINGS METHODS

    /**
     * Get all settings
     */
    async getSettings() {
        return await this.readJsonFile(this.settingsFile) || {};
    }

    /**
     * Update settings
     */
    async updateSettings(newSettings) {
        const currentSettings = await this.getSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };
        await this.writeJsonFile(this.settingsFile, updatedSettings);
        return updatedSettings;
    }

    /**
     * Generate a unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Clean up old sync history entries
     */
    async cleanupOldHistory(maxAge = 30) { // days
        const history = await this.readJsonFile(this.syncHistoryFile) || [];
        const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
        
        const filteredHistory = history.filter(entry => 
            new Date(entry.timestamp) > cutoffDate
        );

        if (filteredHistory.length !== history.length) {
            await this.writeJsonFile(this.syncHistoryFile, filteredHistory);
            console.log(`🧹 Cleaned up ${history.length - filteredHistory.length} old sync history entries`);
        }
    }
}

module.exports = DataStorageService;
