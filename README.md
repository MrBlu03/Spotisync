# Spotisync

**Seamlessly sync your Spotify playlists to YouTube Music with cookie-based authentication.**

Spotisync is a web application that allows you to transfer your favorite Spotify playlists to YouTube Music without dealing with complex OAuth flows or API quotas. Simply authenticate with cookies and start syncing!

## ✨ Features

- 🎵 **Playlist Synchronization**: Transfer entire Spotify playlists to YouTube Music
- 🔐 **Cookie-Based Authentication**: No complex OAuth setup required
- 🚀 **No API Quotas**: Bypass YouTube Music API limitations
- 🎯 **Smart Matching**: Intelligent track matching between platforms
- 🌐 **Web Interface**: Easy-to-use web-based interface
- ⚡ **Fast Sync**: Efficient batch processing for large playlists

## 🚀 Quick Start

### Interactive Setup (Recommended)

Run our automated setup script for the easiest experience:

```bash
npm run setup
```

This will guide you through the entire setup process automatically.

### Manual Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Python (for YouTube Music authentication)
- Spotify Developer Account
- YouTube Music account with existing playlists

### Manual Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Spotisync
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your Spotify credentials:
   ```env
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
   PORT=3000
   ```

4. **YouTube Music Authentication**
   
   Set up YouTube Music authentication using our custom setup script:
   ```bash
   pip install -r requirements.txt
   python scripts/setup-ytmusic.py
   ```
   
   Follow the interactive prompts to extract headers from your browser and generate the `oauth.json` file.

5. **Start the application**
   ```bash
   npm run start:all
   ```

6. **Open your browser**
   
   Navigate to `http://localhost:3000` and start syncing!

## 🔧 Configuration

### Spotify Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://localhost:3000/callback` to redirect URIs
4. Copy Client ID and Client Secret to your `.env` file

### YouTube Music Setup

The application uses header-based authentication for YouTube Music. You'll need to:

1. Install the Python dependencies: `pip install -r requirements.txt`
2. Run our setup script: `python scripts/setup-ytmusic.py`
3. Follow the interactive prompts to extract headers from your browser
4. The script will generate the required `oauth.json` file automatically

## 📁 Project Structure

```
Spotisync/
├── src/
│   ├── app.js                          # Main application server
│   ├── services/
│   │   ├── spotifyServices.js          # Spotify API integration
│   │   ├── syncService.js              # Playlist synchronization logic
│   │   ├── youtubeMusicService.js      # YouTube Music API service
│   │   └── youtubeMusicServiceFactory.js # YouTube Music API factory
│   └── utils/
│       └── index.js                    # Utility functions
├── public/
│   ├── index.html                      # Main web interface
│   ├── script.js                       # Frontend JavaScript
│   └── styles.css                      # Application styles
├── scripts/
│   ├── refresh-cookies.js              # Cookie refresh utility
│   └── setup-ytmusic.py                # YouTube Music setup script
├── .env.example                        # Environment template
├── requirements.txt                    # Python dependencies
├── package.json                        # Node.js dependencies and scripts
├── README.md                           # This file
└── SETUP.md                            # Detailed setup instructions
```

## 🎯 How It Works

1. **Spotify Authentication**: Uses OAuth 2.0 to access your Spotify playlists
2. **YouTube Music Authentication**: Uses browser headers to bypass API limitations
3. **Track Matching**: Searches YouTube Music for equivalent tracks
4. **Playlist Creation**: Creates new playlists or updates existing ones
5. **Sync Status**: Provides real-time feedback on the sync process

## 🛠️ API Reference

### Spotify Integration
- Uses `spotify-web-api-node` for Spotify Web API access
- Supports playlist retrieval and track listing
- Handles OAuth 2.0 authentication flow

### YouTube Music Integration
- Uses `ytmusicapi` for header-based authentication
- Supports playlist creation, modification, and track addition
- No API quotas or rate limits

## 🔒 Security

- All authentication tokens are stored locally
- No user data is transmitted to external servers
- Spotify tokens are handled securely via OAuth 2.0
- YouTube Music headers are used only for API access

## 🐛 Troubleshooting

### Common Issues

**"YouTube Music authentication failed"**
- Ensure your `oauth.json` file is in the project root
- Try regenerating headers with `python scripts/setup-ytmusic.py`

**"Spotify authentication error"**
- Check your Spotify credentials in `.env`
- Verify redirect URI in Spotify Developer Dashboard

**"Track not found on YouTube Music"**
- Some tracks may not be available on YouTube Music
- The sync will continue with available tracks

### Getting Help

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify all authentication files are correctly placed
3. Ensure all dependencies are installed
4. Open an issue on GitHub with error details

## 🔧 Managing YouTube Music Authentication

### Header Expiration Issues

YouTube Music authentication headers typically expire after a period of time, which can interrupt your sync process. Spotisync includes features to help manage this.

### Solutions for Authentication Expiration

1. **Fresh Authentication Setup**
   
   If you're experiencing authentication issues, regenerate your headers:

   ```bash
   python scripts/setup-ytmusic.py
   ```

   Follow the prompts to extract fresh headers from your browser.

2. **Manual Refresh Using Legacy Script**
   
   For backward compatibility, you can still use the cookie refresh script:

   ```bash
   node scripts/refresh-cookies.js
   ```

### Improved Playlist Support

- Spotisync now supports playlists with **more than 200 songs**
- For very large playlists, the app uses continuation tokens to paginate through all tracks

## 🙏 Acknowledgments

- [spotify-web-api-node](https://github.com/thelinmichael/spotify-web-api-node) - Spotify Web API wrapper
- [ytmusicapi](https://github.com/sigma67/ytmusicapi) - YouTube Music API wrapper
- [youtube-music-ts-api](https://github.com/nickfthedev/youtube-music-ts-api) - Additional YouTube Music API functionality

## 📄 License

This project is licensed under the MIT License.
