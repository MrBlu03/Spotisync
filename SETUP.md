# Spotisync Setup Guide

This guide will help you set up Spotisync to sync your YouTube Music playlists to Spotify.

## Prerequisites

- Node.js (version 14 or higher)
- A Spotify account
- A YouTube Music account (or YouTube account with music playlists)

## Step 1: Spotify Developer Setup

**⚠️ Important**: As of April 2025, Spotify requires specific redirect URI formats. You must use `127.0.0.1` instead of `localhost` for local development.

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create App"
4. Fill in the app details:
   - **App Name**: Spotisync (or any name you prefer)
   - **App Description**: Personal playlist sync tool
   - **Website**: http://127.0.0.1:3000 (for development)
   - **Redirect URI**: http://127.0.0.1:3000/callback
5. Check the boxes for the terms of service
6. Click "Save"
7. In your new app, note down:
   - **Client ID**
   - **Client Secret** (click "Show Client Secret")

## Step 2: Configure Environment Variables

1. In the Spotisync folder, copy `.env.example` to `.env`
2. Open the `.env` file and replace the placeholder values:   ```env
   SPOTIFY_CLIENT_ID=your_actual_client_id
   SPOTIFY_CLIENT_SECRET=your_actual_client_secret
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
   PORT=3000
   ```

## Step 3: Install Dependencies

Open a terminal in the Spotisync folder and run:
```bash
npm install
```

## Step 4: Start the Application

Run the development server:
```bash
npm run dev
```

The application will start at `http://127.0.0.1:3000`

## Step 5: First Time Usage

1. Open your browser and go to `http://127.0.0.1:3000`
2. Click "Connect Spotify" to authenticate
3. You'll be redirected to Spotify to authorize the app
4. After authorization, you'll be redirected back to Spotisync
5. Select your YouTube Music playlist (source)
6. Select or create a Spotify playlist (destination)
7. Click "Preview Sync" to see what tracks will be synced
8. Review the matches and approve the ones you want to sync
9. Click "Execute Sync" to perform the actual sync

## Understanding the Matching System

Spotisync uses a sophisticated matching system to ensure accuracy:

### Perfect Matches ✅
- Exact artist name and song title match
- These are automatically selected for sync
- Safe to sync without review

### Needs Review ⚠️
- Multiple possible matches found
- Partial matches (similar but not identical)
- Requires manual approval before syncing

### Duplicates 📋
- Songs already in the destination playlist
- Spotisync won't add duplicates
- Shows for reference only

### Not Found ❌
- No suitable matches found on Spotify
- Cannot be synced automatically
- May require manual search and addition

## Tips for Better Matching

1. **Clean Playlist Names**: Use clear, descriptive playlist names
2. **Check Artist Names**: Sometimes artists use different names on different platforms
3. **Review Uncertain Matches**: Take time to verify partial matches
4. **Regular Syncing**: Sync regularly to keep playlists up to date

## Troubleshooting

### "Authentication Failed"
- Check your Spotify Client ID and Client Secret
- Ensure the redirect URI matches exactly: `http://127.0.0.1:3000/callback`
- **Important**: Use `127.0.0.1` not `localhost` (Spotify requirement as of April 2025)
- Make sure your Spotify app is not in development mode restrictions

### "Redirect URI Mismatch"
- Spotify now requires explicit IP addresses for local development
- Use `http://127.0.0.1:3000/callback` instead of `http://localhost:3000/callback`
- Double-check that your Spotify app settings match your `.env` file exactly

### "YouTube Music Playlists Not Loading"
- The current version uses sample data for YouTube Music
- Full YouTube Music integration requires additional API setup
- You can manually input track information for testing

### "No Matches Found"
- Try different search terms
- Check if the artist/song exists on Spotify
- Some tracks may not be available on Spotify due to licensing

### "Server Won't Start"
- Check if port 3000 is already in use
- Try changing the PORT in your `.env` file
- Make sure all dependencies are installed with `npm install`

## Security Notes

- Never share your `.env` file or commit it to version control
- Your Spotify credentials are only used locally
- No data is sent to external servers except Spotify's official API

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Look at the server logs in your terminal
3. Verify your environment configuration
4. Try refreshing your browser and restarting the server

## Next Steps

Once you're comfortable with the basic functionality, you can:
- Set up automated syncing
- Configure multiple playlist pairs
- Customize matching preferences
- Add support for other music platforms
