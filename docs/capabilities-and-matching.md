# Spotisync — Capabilities, Matching Logic, and APIs

This document summarizes what Spotisync can do, how its song matching works in both directions, and which external APIs/libraries it uses.

## What Spotisync can do

- Two-way playlist sync
  - YouTube Music → Spotify (primary flow)
  - Spotify → YouTube Music (reverse flow)
- Preview before syncing (with live progress via Server-Sent Events)
  - Categorizes results into perfect matches, uncertain matches, duplicates, and no matches
  - Lets you approve only the tracks you want to transfer
- Execute sync with duplicate protection
  - Creates a new destination playlist or appends to an existing one
  - Skips already-present tracks
- Large playlists support
  - YouTube playlist pagination (continuation tokens) so >200 tracks are handled
  - Spotify add/remove in batches
- Manual verification of links
  - Verify a Spotify link/URI and normalize it
  - Verify a YouTube/YouTube Music link and normalize it
- Auth handling
  - Spotify OAuth with token refresh
  - YouTube Music cookie-based auth via a local Python microservice

## High-level architecture

- Web server and API: Node.js/Express (`src/app.js`)
- Core services
  - Spotify: `src/services/spotifyServices.js` (spotify-web-api-node)
  - YouTube Music: `src/services/youtubeMusicServiceFactory.js` (talks to local Python microservice)
  - Sync logic: `src/services/syncService.js`
- Frontend: static app under `public/` (drives flows via REST endpoints)
- Python microservice: `ytmusic_search_service.py` (Flask + ytmusicapi)
  - Provides search, playlists, tracks, playlist create, and add-to-playlist endpoints used by the Node server

Note: `src/services/youtubeMusicService.js` exists for direct Node usage of youtube-music-ts-api, but the current runtime path uses the Python microservice via the factory.

## External APIs and libraries used

- Spotify Web API (via npm: `spotify-web-api-node`)
  - OAuth scopes: playlist-read-private, playlist-read-collaborative, playlist-modify-private, playlist-modify-public, user-library-read
  - Operations used: user profile, list playlists, list playlist tracks (paginated), search tracks, create playlist, add tracks, remove tracks, token refresh
- YouTube Music (via Python: `ytmusicapi` exposed through a local Flask service)
  - Cookie-based auth (stored in `oauth.json`)
  - Endpoints exposed by the local service (default base http://localhost:5001):
    - GET /health
    - GET /search?q=...
    - GET /playlists
    - GET /playlist/{id}/tracks
    - POST /playlist/create
    - POST /playlist/{id}/add
    - GET /video/{id}
- HTTP and server utilities: `express`, `axios`, `cors`, `body-parser`

## How matching works (YouTube → Spotify)

1. Source data
   - YouTube playlist tracks are fetched and normalized to `{ id, title, artist, album, duration }`.
2. Duplicate check against destination playlist (if provided)
   - `findExistingTrack()` compares normalized title and artist combinations to identify exact and strong partial matches in the target Spotify playlist.
   - Exact matches are treated as duplicates and skipped.
3. Spotify search for non-duplicates
   - `SpotifyService.searchTrack(title, artist)` builds multiple queries with varying specificity:
     - With quotes: `track:"<title>" artist:"<artist>"`
     - Without quotes: `track:<title> artist:<artist>`
     - Looser combinations: `"<title>" "<artist>"` and `<title> <artist>`
   - If the source title does NOT contain special version tags, the queries may include exclusion terms to avoid unwanted versions: `-live -instrumental -remix -mix -acoustic`.
   - Results are de-duped and sorted by a confidence score.
4. Confidence scoring (`calculateMatchConfidence`)
   - Normalizes strings (lowercase, strip punctuation/spaces) and cleans artist names (removes suffixes like “- Topic”, “VEVO”, “Official”).
   - Penalizes Spotify candidates that contain special-version keywords (live, instrumental, remix, acoustic, cover, radio edit, version, remastered, mix) when the original title doesn’t.
   - Track and artist are compared for:
     - Exact equality after normalization
     - Strong partial containment (lenient when lengths are close)
   - Confidence labels: `perfect`, `good`, `partial`, `poor`.
5. Picking the best match
   - If there’s exactly one `perfect` match → auto-approve.
   - Multiple `perfect` or `good` matches → pick the best using `selectBestMatch()`.
   - `selectBestMatch()` uses a weighted score (`calculateDetailedScore`):
     - Title 60% (exact > partial > shared-words)
     - Artist 40% (exact > partial), plus small bonus for `perfect/good` confidence.
6. Preview result categories
   - perfectMatches: auto-approvable
   - uncertainMatches: needs manual review (top candidate provided)
   - duplicates: already present in destination playlist
   - noMatches: nothing suitable found

## How matching works (Spotify → YouTube Music)

1. Source data
   - Spotify playlist tracks normalized to `{ id, name/title, artists, album, duration_ms/uri }`.
2. Duplicate check against destination playlist
   - `findExistingYouTubeTrack()` normalizes and compares title/artist against existing YouTube tracks.
3. YouTube search via microservice
   - `searchTrackWithArtistPriority(title, artist)` calls `GET /search` (ytmusicapi, filter=songs).
   - Results are normalized to `{ videoId, title, artist, album, duration }` and sorted with artist priority:
     - Exact artist match first, then contains/contained comparisons.
4. Match quality (`calculateYouTubeMatchQuality`)
   - Same style of normalized comparisons for title and artist.
   - Categories: `perfect`, `good`, `partial`, `poor`.
   - Single `good` match may be auto-approved; otherwise sent to manual review.

## Key REST endpoints (Node server)

- Auth
  - GET /auth/spotify → redirect to Spotify OAuth
  - GET /callback → Spotify OAuth callback
  - GET /api/auth/status → auth status
- Playlists
  - GET /api/spotify/playlists[?id=...] → list Spotify playlists (or one by id)
  - GET /api/youtube/playlists[?id=...] → list YouTube playlists (or one by id)
- Sync (YouTube → Spotify)
  - POST /api/sync/preview → compute preview
  - ALL /api/sync/preview-stream → SSE streaming preview/progress
  - POST /api/sync/execute → perform sync
- Reverse sync (Spotify → YouTube)
  - POST /api/sync/preview-reverse
  - POST /api/sync/execute-reverse
- Manual link verification
  - POST /api/spotify/verify-link
  - POST /api/youtube/verify-link
- YouTube cookie refresh
  - POST /api/youtube/refresh-auth

## Safeguards and edge cases

- Token handling
  - Spotify: refresh token on interval and before critical calls
  - YouTube: cookie-based, can be refreshed by updating `oauth.json` and reinitializing
- Rate limiting protection
  - Small delays between search/add operations
- Duplicate prevention
  - Checks destination playlist before adding; optional duplicate removal (Spotify)
- Robust pagination
  - YouTube playlist tracks fetched across continuation pages
- Defensive data handling
  - Skips invalid/null items; validates structures before use

## Files to look at

- Matching and sync
  - `src/services/syncService.js`
  - `src/services/spotifyServices.js`
- YouTube integration
  - `src/services/youtubeMusicServiceFactory.js` (active path)
  - `ytmusic_search_service.py` (Flask microservice powered by ytmusicapi)
- Server and routes
  - `src/app.js`

If you want this doc linked from the README, add a short reference to `docs/capabilities-and-matching.md`.
