#!/usr/bin/env python3
"""
YouTube Music Authentication Setup for Spotisync
This script helps you set up YouTube Music authentication using raw headers.
"""

import ytmusicapi
import os
import sys

def setup_ytmusic_with_raw_headers(
    input_file="raw_headers.txt", credentials_file="oauth.json"
):
    """
    Loads raw headers from a file and sets up YTMusic connection using ytmusicapi.setup.

    Parameters:
        input_file (str): Path to the file containing raw headers.
        credentials_file (str): Path to save the configuration headers (credentials).

    Returns:
        str: Configuration headers string returned by ytmusicapi.setup.
    """
    # Check if the input file exists
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Input file {input_file} does not exist.")

    # Read the raw headers from the file
    with open(input_file, "r") as file:
        headers_raw = file.read()

    # Use ytmusicapi.setup to process headers and save the credentials
    config_headers = ytmusicapi.setup(
        filepath=credentials_file, headers_raw=headers_raw
    )
    print(f"Configuration headers saved to {credentials_file}")
    return config_headers


def main():
    """Main setup function with user guidance."""
    print("=== YouTube Music Authentication Setup for Spotisync ===\n")
    
    print("This script will help you set up YouTube Music authentication.")
    print("You'll need to extract raw headers from your browser's network requests.\n")
    
    print("Steps:")
    print("1. Open YouTube Music in your browser and log in")
    print("2. Open Developer Tools (F12)")
    print("3. Go to Network tab")
    print("4. Interact with YouTube Music (search for a song)")
    print("5. Find a request to 'youtubei/v1/...' in the Network tab")
    print("6. Right-click the request → Copy → Copy as cURL")
    print("7. Extract the headers from the cURL command")
    print("8. Save them to 'raw_headers.txt' in this directory\n")
    
    # Check if raw_headers.txt exists
    raw_headers_file = "raw_headers.txt"
    credentials_file = "oauth.json"
    
    if not os.path.exists(raw_headers_file):
        print(f"❌ {raw_headers_file} not found!")
        print("Please create this file with your YouTube Music headers and run this script again.")
        sys.exit(1)
    
    try:
        print(f"✅ Found {raw_headers_file}")
        print(f"📝 Setting up YouTube Music authentication...")
        
        setup_ytmusic_with_raw_headers(
            input_file=raw_headers_file, 
            credentials_file=credentials_file
        )
        
        print(f"✅ YouTube Music setup completed successfully!")
        print(f"📁 Credentials saved to {credentials_file}")
        print("\nYou can now start Spotisync and sync your playlists!")
        
    except Exception as e:
        print(f"❌ An error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
