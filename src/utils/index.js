/**
 * String similarity utilities for better matching
 */
class StringUtils {
    static normalize(str) {
        return str.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    static calculateSimilarity(str1, str2) {
        const normalized1 = this.normalize(str1);
        const normalized2 = this.normalize(str2);
        
        if (normalized1 === normalized2) return 1.0;
        
        // Levenshtein distance
        const distance = this.levenshteinDistance(normalized1, normalized2);
        const maxLength = Math.max(normalized1.length, normalized2.length);
        
        return 1 - (distance / maxLength);
    }

    static levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    static removeFeaturing(str) {
        return str.replace(/\s*[\(\[]?feat\.?[\s\.].*?[\)\]]?$/i, '')
                 .replace(/\s*[\(\[]?ft\.?[\s\.].*?[\)\]]?$/i, '')
                 .replace(/\s*[\(\[]?featuring.*?[\)\]]?$/i, '')
                 .trim();
    }

    static removeVersionInfo(str) {
        return str.replace(/\s*[\(\[].*?(remix|edit|version|remaster).*?[\)\]]?$/i, '')
                 .replace(/\s*-\s*(remix|edit|version|remaster).*$/i, '')
                 .trim();
    }

    static cleanTrackTitle(title) {
        return this.removeVersionInfo(this.removeFeaturing(title));
    }
}

/**
 * Rate limiting utilities for API calls
 */
class RateLimit {
    constructor(requestsPerSecond = 10) {
        this.requestsPerSecond = requestsPerSecond;
        this.queue = [];
        this.isProcessing = false;
    }

    async throttle(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.queue.length > 0) {
            const { fn, resolve, reject } = this.queue.shift();
            
            try {
                const result = await fn();
                resolve(result);
            } catch (error) {
                reject(error);
            }
            
            // Wait to respect rate limit
            await this.delay(1000 / this.requestsPerSecond);
        }
        
        this.isProcessing = false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Playlist comparison utilities
 */
class PlaylistUtils {
    static findDuplicates(tracks) {
        const seen = new Map();
        const duplicates = [];
        
        tracks.forEach((track, index) => {
            const key = this.generateTrackKey(track);
            
            if (seen.has(key)) {
                duplicates.push({
                    original: seen.get(key),
                    duplicate: { ...track, index }
                });
            } else {
                seen.set(key, { ...track, index });
            }
        });
        
        return duplicates;
    }

    static generateTrackKey(track) {
        const title = StringUtils.cleanTrackTitle(track.name || track.title);
        const artist = track.artists ? track.artists[0] : track.artist;
        
        return `${StringUtils.normalize(title)}-${StringUtils.normalize(artist)}`;
    }

    static calculatePlaylistSimilarity(playlist1, playlist2) {
        const tracks1 = new Set(playlist1.map(track => this.generateTrackKey(track)));
        const tracks2 = new Set(playlist2.map(track => this.generateTrackKey(track)));
        
        const intersection = new Set([...tracks1].filter(x => tracks2.has(x)));
        const union = new Set([...tracks1, ...tracks2]);
        
        return intersection.size / union.size;
    }
}

/**
 * Logger utility for debugging and monitoring
 */
class Logger {
    static levels = {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3
    };

    static currentLevel = this.levels.INFO;

    static error(message, data = null) {
        if (this.currentLevel >= this.levels.ERROR) {
            console.error(`[ERROR] ${message}`, data);
        }
    }

    static warn(message, data = null) {
        if (this.currentLevel >= this.levels.WARN) {
            console.warn(`[WARN] ${message}`, data);
        }
    }

    static info(message, data = null) {
        if (this.currentLevel >= this.levels.INFO) {
            console.info(`[INFO] ${message}`, data);
        }
    }

    static debug(message, data = null) {
        if (this.currentLevel >= this.levels.DEBUG) {
            console.debug(`[DEBUG] ${message}`, data);
        }
    }

    static setLevel(level) {
        this.currentLevel = level;
    }
}

/**
 * Configuration manager
 */
class Config {
    static defaults = {
        SPOTIFY_RATE_LIMIT: 10, // requests per second
        YOUTUBE_RATE_LIMIT: 5,  // requests per second
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000,      // milliseconds
        SIMILARITY_THRESHOLD: 0.8,
        BATCH_SIZE: 100,
        REQUEST_TIMEOUT: 30000  // milliseconds
    };

    static get(key) {
        return process.env[key] || this.defaults[key];
    }

    static getNumber(key) {
        const value = this.get(key);
        return typeof value === 'number' ? value : parseInt(value) || this.defaults[key];
    }
}

module.exports = {
    StringUtils,
    RateLimit,
    PlaylistUtils,
    Logger,
    Config
};
