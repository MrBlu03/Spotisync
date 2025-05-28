# Google Cloud Console Setup for YouTube Music Integration

## Overview
To enable YouTube Music playlist access, you need to set up Google OAuth credentials through Google Cloud Console.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" at the top, then "New Project"
3. Enter project name: `Spotisync` or similar
4. Click "Create"

## Step 2: Enable YouTube Data API v3

1. In your Google Cloud project, go to "APIs & Services" > "Library"
2. Search for "YouTube Data API v3"
3. Click on it and press "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" user type
   - Fill in app name: `Spotisync`
   - Add your email as developer contact
   - Add scopes: `../auth/youtube.readonly`
4. For OAuth client ID:
   - Application type: "Web application"
   - Name: `Spotisync YouTube Integration`
   - Authorized redirect URIs: `http://127.0.0.1:3000/auth/youtube/callback`

## Step 4: Configure Environment Variables

Copy the Client ID and Client Secret from Google Cloud Console to your `.env` file:

```bash
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/auth/youtube/callback
```

## Important Notes

1. **Redirect URI**: Use `127.0.0.1` instead of `localhost` for consistency with Spotify requirements
2. **API Quotas**: YouTube Data API has daily quotas. The free tier should be sufficient for personal use
3. **Scopes**: The app only requests read-only access to your YouTube playlists

## Troubleshooting

- **"Access blocked" error**: Make sure your OAuth consent screen is properly configured
- **"Redirect URI mismatch"**: Ensure the redirect URI in Google Cloud Console exactly matches your .env file
- **API quota exceeded**: YouTube Data API has daily limits. Wait 24 hours or request quota increase

## Testing the Integration

1. Start the server: `npm run dev`
2. Open `http://127.0.0.1:3000`
3. Click "Connect YouTube Music"
4. Sign in with your Google account
5. Grant permissions to access your YouTube data
6. You should be redirected back with "YouTube Music authentication successful!"

## Privacy Notice

This application only requests read-only access to your YouTube playlists. It cannot:
- Modify your YouTube playlists
- Access your personal information beyond basic profile
- Upload or delete videos
- Access your YouTube viewing history
