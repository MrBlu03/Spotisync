# Setup Guide for Spotisync

This guide will walk you through setting up Spotisync to sync your Spotify playlists to YouTube Music using header-based authentication.

## 🚀 Quick Setup (Recommended)

For the fastest setup experience, use our interactive setup script:

```bash
npm run setup
```

This script will automatically:
- Check prerequisites (Node.js and Python)
- Install all dependencies
- Guide you through Spotify app configuration
- Help you extract YouTube Music headers
- Generate authentication files
- Start the application

**Skip to [Manual Setup](#manual-setup) if you prefer to configure everything yourself.**

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** (version 14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Python** (for YouTube Music authentication setup) - [Download here](https://python.org/)
- **Spotify account** with playlists you want to sync
- **YouTube Music account** (free or premium)

## 🔧 Manual Setup

### Step 1: Clone and Install

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Spotisync
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

### Step 2: Spotify API Setup

1. **Go to Spotify Developer Dashboard**
   - Visit [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
   - Log in with your Spotify account

2. **Create a new app**
   - Click "Create an App"
   - Fill in the app name (e.g., "Spotisync")
   - Add a description
   - Accept the terms and create

3. **Configure the app**
   - In your new app, click "Edit Settings"
   - Add this redirect URI: `http://localhost:3000/callback`
   - Save the settings

4. **Get your credentials**
   - Copy the **Client ID** and **Client Secret**
   - Keep these secure - you'll need them in the next step

### Step 3: Environment Configuration

1. **Create environment file**
   ```bash
   cp .env.example .env
   ```

2. **Edit the .env file**
   Open `.env` in a text editor and add your Spotify credentials:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
   PORT=3000
   ```

### Step 4: YouTube Music Authentication Setup

This is the most important step for YouTube Music authentication.

1. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the YouTube Music setup script**
   ```bash
   python scripts/setup-ytmusic.py
   ```
   
   The script will guide you through:
   - Opening YouTube Music in your browser
   - Extracting headers from browser network requests
   - Generating the required `oauth.json` file

3. **Follow the interactive prompts**
   - The script provides step-by-step instructions
   - You'll need to copy headers from your browser's developer tools
   - Save the headers to `raw_headers.txt` when prompted
   - The script will automatically generate `oauth.json`

4. **Verify the setup**
   - Ensure `oauth.json` is created in your project root
   - **Important**: This file contains your YouTube Music authentication - keep it secure

### Step 5: Test the Setup

1. **Start the application**
   ```bash
   npm start
   ```

2. **Open your browser**
   - Navigate to `http://localhost:3000`
   - You should see the Spotisync interface

3. **Test authentication**
   - Click "Connect Spotify" and complete the OAuth flow
   - YouTube Music should automatically authenticate using the generated headers

## 🎯 Verification Checklist

Ensure everything is working by checking:

- [ ] Node.js is installed (run `node --version`)
- [ ] Dependencies are installed (you should see `node_modules` folder)
- [ ] `.env` file exists with correct Spotify credentials
- [ ] `oauth.json` file exists in project root
- [ ] Server starts without errors (`npm start`)
- [ ] Browser loads `http://localhost:3000` successfully
- [ ] Spotify authentication works
- [ ] YouTube Music shows as connected

## 🚨 Troubleshooting

### Common Issues and Solutions

**"Cannot find module" error**
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Spotify authentication fails**
- Verify Client ID and Client Secret in `.env`
- Check that redirect URI is exactly: `http://localhost:3000/callback`
- Ensure redirect URI is added in Spotify Developer Dashboard

**YouTube Music authentication fails**
- Regenerate headers: `python scripts/setup-ytmusic.py`
- Ensure `oauth.json` is in the project root
- Check that you're logged into YouTube Music in your browser
- Verify the `raw_headers.txt` file contains valid headers

**"Permission denied" error**
- Ensure you have write permissions in the project directory
- Try running with administrator privileges if needed

**Port already in use**
- Change the PORT in `.env` to a different number (e.g., 3001)
- Or kill the process using port 3000

### Getting Detailed Error Information

If you encounter issues:

1. **Check the console output** when running `npm start`
2. **Open browser developer tools** (F12) and check the console
3. **Look for specific error messages** and search for solutions

## 🔐 Security Notes

- **Never commit `.env` or `oauth.json`** to version control
- **Keep your Spotify credentials secure**
- **Regenerate YouTube Music headers if compromised**
- **The oauth.json file contains authentication data** - treat it like a password

## ✅ Next Steps

Once setup is complete:

1. **Authenticate with both services** through the web interface
2. **Select a Spotify playlist** to sync
3. **Choose or create a YouTube Music playlist** as destination
4. **Start the sync process** and monitor progress

## 🆘 Need Help?

If you're still having issues:

1. **Check the logs** in the terminal where you ran `npm start`
2. **Review this guide** to ensure all steps were followed
3. **Open an issue** on GitHub with:
   - Your operating system
   - Node.js version (`node --version`)
   - Complete error messages
   - Steps you've already tried

## 📚 Additional Resources

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api/)
- [ytmusicapi Documentation](https://github.com/sigma67/ytmusicapi)
- [Node.js Installation Guide](https://nodejs.org/en/download/)
- [Python Installation Guide](https://python.org/downloads/)

---

**Happy syncing! 🎵**
