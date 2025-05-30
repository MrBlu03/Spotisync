# 🚀 Quick Setup Guide

## Double-Click Setup Options

For the easiest setup experience, you can double-click any of these files:

### 🖱️ Windows Users (Recommended)
- **`Setup Spotisync.bat`** - Windows batch file (double-click to run)
- **`Setup Spotisync.html`** - Web-based guide (open in browser for instructions)

### 💻 Cross-Platform / Manual Setup
```bash
npm run setup
```
or
```bash
node scripts/interactive-setup.js
```

## What the Setup Does

1. ✅ Checks that Node.js and Python are installed
2. 📦 Installs all required dependencies (Node.js and Python)
3. 🎬 Guides you through YouTube Music header extraction
4. 🔧 Runs the authentication setup automatically
5. ✅ Verifies everything is configured correctly
6. 🚀 Optionally starts the application

## Important Notes

- **Spotify authentication** is handled through the web interface (no manual setup needed)
- **YouTube Music headers** need to be extracted from your browser
- The setup will **completely overwrite** the `raw_headers.txt` file with your new input
- After setup, you can start the app anytime with `npm run start:all`

## Troubleshooting

If double-clicking doesn't work:
1. Make sure Node.js and Python are installed
2. Try running as administrator
3. Use the manual terminal commands above
4. Check that file associations are correct

## What You'll Need

- 🌐 YouTube Music account (logged in to your browser)
- 🛠️ Browser Developer Tools knowledge (F12)
- 📋 Raw headers from a YouTube Music API request

The interactive setup will guide you through extracting these headers step by step!
