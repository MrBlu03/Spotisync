#!/usr/bin/env python3
"""
YouTube Music Proxy Service for Spotisync
Alternative entry point for the YouTube Music microservice.
"""

import sys
import os

# Add the parent directory to the path so we can import the main service
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import and run the main service
from ytmusic_search_service import app, initialize_ytmusic

if __name__ == '__main__':
    print("🎵 Starting YouTube Music Proxy Service...")
    print("📋 Initializing YouTube Music API...")
    
    if not initialize_ytmusic():
        print("❌ Failed to initialize YouTube Music API. Please check oauth.json file.")
        sys.exit(1)
    
    print("✅ YouTube Music API initialized successfully!")
    print("🚀 Starting Flask server on http://localhost:5001")
    
    try:
        app.run(host='127.0.0.1', port=5001, debug=False)
    except KeyboardInterrupt:
        print("\n👋 YouTube Music Proxy Service stopped.")