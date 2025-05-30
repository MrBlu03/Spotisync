#!/usr/bin/env python3
"""
YouTube Music Search Microservice for Spotisync
This service provides a REST API for YouTube Music operations using ytmusicapi.
"""

import json
import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
import ytmusicapi
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global YouTube Music API instance
ytmusic = None

def initialize_ytmusic():
    """Initialize YouTube Music API with oauth.json credentials"""
    global ytmusic
    
    oauth_file = 'oauth.json'
    if not os.path.exists(oauth_file):
        logger.error(f"❌ {oauth_file} not found. Please run setup first.")
        return False
    
    try:
        logger.info("🔐 Initializing YouTube Music API...")
        ytmusic = ytmusicapi.YTMusic(oauth_file)
        logger.info("✅ YouTube Music API initialized successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to initialize YouTube Music API: {e}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ytmusic_search_service',
        'ytmusic_initialized': ytmusic is not None
    })

@app.route('/search', methods=['GET'])
def search_tracks():
    """Search for tracks on YouTube Music"""
    if not ytmusic:
        return jsonify({'error': 'YouTube Music API not initialized'}), 500
    
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'No search query provided'}), 400
    
    try:
        logger.info(f"Searching for: {query}")
        search_results = ytmusic.search(query, filter='songs', limit=10)
        
        # Filter and format results
        songs = []
        for result in search_results:
            if result.get('resultType') == 'song':
                song = {
                    'videoId': result.get('videoId'),
                    'id': result.get('videoId'),
                    'title': result.get('title', 'Unknown Title'),
                    'artist': result.get('artists', [{}])[0].get('name', 'Unknown Artist') if result.get('artists') else 'Unknown Artist',
                    'artists': [{'name': artist.get('name', 'Unknown')} for artist in result.get('artists', [])],
                    'album': result.get('album', {}).get('name') if result.get('album') else 'Unknown Album',
                    'duration': result.get('duration', '0:00'),
                    'thumbnail': result.get('thumbnails', [{}])[-1].get('url') if result.get('thumbnails') else None
                }
                songs.append(song)
        
        logger.info(f"✅ Found {len(songs)} songs for: {query}")
        return jsonify(songs)
        
    except Exception as e:
        logger.error(f"❌ Search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/playlists', methods=['GET'])
def get_playlists():
    """Get user's YouTube Music playlists"""
    if not ytmusic:
        return jsonify({'error': 'YouTube Music API not initialized'}), 500
    
    try:
        logger.info("Fetching playlists...")
        playlists = ytmusic.get_library_playlists(limit=100)
        
        formatted_playlists = []
        for playlist in playlists:
            formatted_playlist = {
                'id': playlist.get('playlistId'),
                'playlistId': playlist.get('playlistId'),
                'title': playlist.get('title', 'Untitled Playlist'),
                'name': playlist.get('title', 'Untitled Playlist'),
                'description': playlist.get('description', ''),
                'trackCount': playlist.get('count', 0),
                'count': playlist.get('count', 0),
                'thumbnail': playlist.get('thumbnails', [{}])[-1].get('url') if playlist.get('thumbnails') else None
            }
            formatted_playlists.append(formatted_playlist)
        
        logger.info(f"✅ Found {len(formatted_playlists)} playlists")
        return jsonify(formatted_playlists)
        
    except Exception as e:
        logger.error(f"❌ Error fetching playlists: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/playlist/<playlist_id>/tracks', methods=['GET'])
def get_playlist_tracks(playlist_id):
    """Get tracks from a specific playlist"""
    if not ytmusic:
        return jsonify({'error': 'YouTube Music API not initialized'}), 500
    
    try:
        logger.info(f"Fetching tracks for playlist: {playlist_id}")
        playlist = ytmusic.get_playlist(playlist_id, limit=None)
        
        if not playlist or 'tracks' not in playlist:
            return jsonify([])
        
        tracks = []
        for track in playlist['tracks']:
            formatted_track = {
                'id': track.get('videoId'),
                'videoId': track.get('videoId'),
                'title': track.get('title', 'Unknown Title'),
                'artist': track.get('artists', [{}])[0].get('name', 'Unknown Artist') if track.get('artists') else 'Unknown Artist',
                'artists': [{'name': artist.get('name', 'Unknown')} for artist in track.get('artists', [])],
                'album': track.get('album', {}).get('name') if track.get('album') else 'Unknown Album',
                'duration': track.get('duration', '0:00'),
                'thumbnail': track.get('thumbnails', [{}])[-1].get('url') if track.get('thumbnails') else None
            }
            tracks.append(formatted_track)
        
        logger.info(f"✅ Found {len(tracks)} tracks in playlist")
        return jsonify(tracks)
        
    except Exception as e:
        logger.error(f"❌ Error fetching playlist tracks: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/playlist/create', methods=['POST'])
def create_playlist():
    """Create a new playlist"""
    if not ytmusic:
        return jsonify({'error': 'YouTube Music API not initialized'}), 500
    
    data = request.get_json()
    if not data or 'title' not in data:
        return jsonify({'error': 'Playlist title required'}), 400
    
    title = data['title']
    description = data.get('description', '')
    
    try:
        logger.info(f"Creating playlist: {title}")
        playlist_id = ytmusic.create_playlist(title, description)
        
        if playlist_id:
            logger.info(f"✅ Created playlist: {title} (ID: {playlist_id})")
            return jsonify({
                'id': playlist_id,
                'title': title,
                'description': description,
                'success': True
            })
        else:
            return jsonify({'error': 'Failed to create playlist'}), 500
            
    except Exception as e:
        logger.error(f"❌ Error creating playlist: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/playlist/<playlist_id>/add', methods=['POST'])
def add_tracks_to_playlist(playlist_id):
    """Add tracks to a playlist"""
    if not ytmusic:
        return jsonify({'error': 'YouTube Music API not initialized'}), 500
    
    data = request.get_json()
    if not data or 'track_ids' not in data:
        return jsonify({'error': 'Track IDs required'}), 400
    
    track_ids = data['track_ids']
    if not isinstance(track_ids, list):
        track_ids = [track_ids]
    
    try:
        logger.info(f"Adding {len(track_ids)} tracks to playlist {playlist_id}")
        
        # Get current playlist info for before/after comparison
        try:
            playlist_before = ytmusic.get_playlist(playlist_id, limit=1)
            tracks_before = len(playlist_before.get('tracks', []))
        except:
            tracks_before = 0
        
        # Add tracks
        result = ytmusic.add_playlist_items(playlist_id, track_ids)
        
        # Get updated playlist info
        try:
            playlist_after = ytmusic.get_playlist(playlist_id, limit=1)
            tracks_after = len(playlist_after.get('tracks', []))
        except:
            tracks_after = tracks_before
        
        tracks_added = tracks_after - tracks_before
        
        logger.info(f"✅ Added {tracks_added} tracks to playlist")
        return jsonify({
            'success': True,
            'result': result,
            'tracks_before': tracks_before,
            'tracks_after': tracks_after,
            'tracks_added': tracks_added
        })
        
    except Exception as e:
        logger.error(f"❌ Error adding tracks to playlist: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/video/<video_id>', methods=['GET'])
def get_video_info(video_id):
    """Get information about a specific video"""
    if not ytmusic:
        return jsonify({'error': 'YouTube Music API not initialized'}), 500
    
    try:
        logger.info(f"Getting info for video: {video_id}")
        
        # Try to get song info
        try:
            song = ytmusic.get_song(video_id)
            if song:
                return jsonify({
                    'id': video_id,
                    'title': song.get('title', 'Unknown Title'),
                    'artist': song.get('artists', [{}])[0].get('name', 'Unknown Artist') if song.get('artists') else 'Unknown Artist',
                    'artists': [artist.get('name', 'Unknown') for artist in song.get('artists', [])],
                    'album': song.get('album', {}).get('name') if song.get('album') else 'Unknown Album',
                    'duration': song.get('duration', '0:00')
                })
        except:
            pass
        
        # If get_song fails, try searching for the video
        search_results = ytmusic.search(video_id, filter='videos', limit=1)
        if search_results:
            video = search_results[0]
            return jsonify({
                'id': video_id,
                'title': video.get('title', 'Unknown Title'),
                'artist': video.get('artists', [{}])[0].get('name', 'Unknown Artist') if video.get('artists') else 'Unknown Artist',
                'duration': video.get('duration', '0:00')
            })
        
        return jsonify({'error': 'Video not found'}), 404
        
    except Exception as e:
        logger.error(f"❌ Error getting video info: {e}")
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("Starting YouTube Music Search Microservice...")
    print("Initializing YouTube Music API...")
    
    if not initialize_ytmusic():
        print("Failed to initialize YouTube Music API. Please check oauth.json file.")
        sys.exit(1)
    
    print("YouTube Music API initialized successfully!")
    print("Starting Flask server on http://localhost:5001")
    print("Available endpoints:")
    print("   GET  /health - Health check")
    print("   GET  /search?q=query - Search for tracks")
    print("   GET  /playlists - Get user playlists")
    print("   GET  /playlist/{id}/tracks - Get playlist tracks")
    print("   POST /playlist/create - Create new playlist")
    print("   POST /playlist/{id}/add - Add tracks to playlist")
    print("   GET  /video/{id} - Get video information")
    print("\nTo stop the service, press Ctrl+C")
    
    try:
        app.run(host='127.0.0.1', port=5001, debug=False)
    except KeyboardInterrupt:
        print("\nYouTube Music Search Microservice stopped.")