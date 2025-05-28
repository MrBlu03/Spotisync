# Spotisync - Bidirectional Playlist Sync

A tool that syncs playlists between YouTube Music and Spotify in both directions with precision matching and manual review capabilities.

## Features

- **Bidirectional Sync**: Sync from YouTube Music → Spotify OR Spotify → YouTube Music
- **Artist Topic Channel Priority**: Prioritizes official artist channels when searching YouTube
- **Precise Matching**: Only syncs songs with exact artist and song name matches
- **Manual Review**: Flags uncertain matches for manual vetting
- **Duplicate Prevention**: Avoids adding duplicate songs to playlists
- **Safe Operations**: Never deletes songs without explicit permission
- **Playlist Creation**: Automatically creates new playlists if they don't exist
- **Quota-Aware Error Handling**: Gracefully handles YouTube API quota limits
- **Web Interface**: Easy-to-use browser-based interface with dynamic sync direction selection

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure API Credentials**
   - Create a Spotify App at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Set up YouTube Data API v3 access at [Google Cloud Console](https://console.cloud.google.com/)
   - Copy `.env.example` to `.env` and fill in your credentials
   - See `GOOGLE_SETUP.md` for detailed YouTube API setup instructions

3. **Run the Application**
   ```bash
   npm run dev
   ```

4. **Open Browser**
   Navigate to `http://localhost:3000`

## Configuration

Create a `.env` file with the following:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback

YOUTUBE_CLIENT_ID=your_google_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_google_oauth_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback

PORT=3000
```

## Usage

1. Authenticate with both Spotify and YouTube Music
2. **Select sync direction**: Choose between YouTube Music → Spotify or Spotify → YouTube Music
3. Select source playlist from the chosen platform
4. Choose or create destination playlist on the target platform
5. Review matching results and artist topic channel prioritization
6. Approve precise matches for sync
7. Manually review flagged items

## API Endpoints

### Core Interface
- `GET /` - Main web interface

### Authentication
- `POST /auth/spotify` - Spotify authentication
- `POST /auth/youtube` - YouTube Music authentication

### Sync Operations
- `POST /api/sync/preview` - Preview YouTube Music → Spotify sync
- `POST /api/sync/execute` - Execute YouTube Music → Spotify sync
- `POST /api/sync/preview-reverse` - Preview Spotify → YouTube Music sync
- `POST /api/sync/execute-reverse` - Execute Spotify → YouTube Music sync

### Playlist Management
- `GET /api/spotify/playlists` - Get Spotify playlists
- `GET /api/spotify/playlists/:id` - Get specific Spotify playlist
- `GET /api/youtube/playlists` - Get YouTube Music playlists

## Quota Management

The application includes comprehensive YouTube API quota management. If you encounter quota exceeded errors:

1. **Daily quotas reset** at midnight Pacific Time
2. **Request quota increase** through Google Cloud Console for heavy usage
3. **Monitor usage** - the app will show quota status and handle errors gracefully

See `QUOTA_MANAGEMENT.md` for detailed information on managing YouTube API quotas.

## License

MIT
