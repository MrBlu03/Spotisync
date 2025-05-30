# Changelog

All notable changes to Spotisync will be documented in this file.

## [2.0.0] - 2025-05-29

### 🚀 Major Changes

**BREAKING:** Complete overhaul from Google OAuth to cookie-based authentication

### ✨ Added

- **Cookie-based YouTube Music authentication** using `youtube-music-ts-api`
- **Factory pattern** for YouTube Music service initialization
- **Automatic service initialization** on server startup
- **Enhanced error handling** for authentication failures
- **Comprehensive setup documentation** with step-by-step guides
- **Improved README** with modern features overview

### 🔄 Changed

- **YouTube Music integration** now uses `youtube-music-ts-api` instead of `ytmusic-api`
- **Authentication method** switched from Google OAuth2 to cookies via `spotify_to_ytmusic`
- **Service architecture** refactored to use factory pattern instead of class constructors
- **Setup process** simplified - no more Google Cloud Console configuration needed
- **Documentation** completely rewritten for cookie-based setup

### 🗑️ Removed

- **Google OAuth2 dependencies** (`googleapis` package removed)
- **Google Cloud Console requirement** for YouTube Music access
- **API quota limitations** and related error handling
- **Complex OAuth callback flows** for YouTube Music
- **Old documentation files** (GOOGLE_SETUP.md, QUOTA_MANAGEMENT.md, etc.)
- **Test files and debug scripts** used during development
- **Backup service files** and unused CSS

### 🔧 Technical Changes

- Replaced `ytmusic-api` with `youtube-music-ts-api` (v1.8.4)
- Implemented factory function pattern in `youtubeMusicServiceFactory.js`
- Updated `app.js` to use lazy initialization with factory pattern
- Cleaned up package.json dependencies
- Enhanced .gitignore to include `oauth.json`
- Removed unnecessary dependencies (`googleapis`, `fs-extra`)

### 🛠️ Fixed

- **Constructor initialization issues** that prevented service startup
- **Authentication failures** due to Google API quota limits
- **Service instantiation errors** in async context
- **Server startup blocking** on YouTube Music service initialization

### 📚 Documentation

- **README.md**: Complete rewrite with cookie-based setup instructions
- **SETUP.md**: New comprehensive setup guide with troubleshooting
- **Package.json**: Updated description and cleaned dependencies
- **Removed obsolete docs**: Google OAuth setup guides and quota management

### 🔐 Security

- Added `oauth.json` to .gitignore for cookie protection
- Simplified authentication reduces attack surface
- Local-only cookie storage (no external token management)

### 📈 Performance

- **Eliminated API quotas** - no more daily limits or request restrictions
- **Faster authentication** - cookies vs OAuth flow
- **Reduced dependencies** - smaller package footprint
- **Immediate service availability** - no OAuth callback delays

---

## [1.0.0] - Previous Version

### Features (Legacy - Google OAuth)

- Bidirectional playlist sync between Spotify and YouTube Music
- Google OAuth2 authentication for YouTube Music
- Spotify OAuth2 authentication
- Artist topic channel prioritization
- Manual review capabilities for uncertain matches
- Web-based interface for playlist management
- Quota-aware error handling for YouTube Data API

### Known Issues (Resolved in 2.0.0)

- Google API quota limitations causing sync failures
- Complex Google Cloud Console setup requirements
- Authentication flow interruptions
- Service initialization blocking server startup
- Constructor-based service instantiation problems

---

## Migration Guide

### From 1.x to 2.0.0

1. **Remove Google Cloud Console setup** - no longer needed
2. **Install Python and spotify_to_ytmusic**: `pip install spotify_to_ytmusic`
3. **Generate YouTube Music cookies**: `ytmusic setup`
4. **Update .env file** - remove Google OAuth variables
5. **Copy oauth.json** to project root
6. **Restart application** - authentication now automatic

### Breaking Changes

- Google OAuth2 for YouTube Music no longer supported
- YouTube Music authentication now requires cookies from `spotify_to_ytmusic`
- Environment variables changed (removed Google OAuth settings)
- Service initialization pattern changed to factory function

### Benefits of Migration

- ✅ No more API quota limits
- ✅ Simplified setup process
- ✅ No Google Cloud Console configuration needed
- ✅ Faster authentication
- ✅ More reliable service initialization
- ✅ Better error handling
