# Google OAuth Test User Setup

## Quick Fix for "access_denied" Error

You're seeing this error because your Google OAuth app is in testing mode. Here's how to fix it:

### Step 1: Add Yourself as Test User

1. **Go to**: https://console.cloud.google.com/
2. **Select your project**: Spotisync (or whatever you named it)
3. **Navigate to**: APIs & Services → OAuth consent screen
4. **Scroll to "Test users" section**
5. **Click "ADD USERS"**
6. **Enter your email**: The Google account you're trying to log in with
7. **Click "Save"**

### Step 2: Verify Your Configuration

Make sure your OAuth consent screen has:
- **App name**: Spotisync
- **User support email**: Your email
- **Developer contact information**: Your email
- **Scopes**: Should include:
  - `../auth/youtube.readonly`
  - `../auth/youtubepartner` (optional)

### Step 3: Check Redirect URI

In "Credentials" → "OAuth 2.0 Client IDs":
- **Authorized redirect URI**: `http://127.0.0.1:3000/auth/youtube/callback`

### Step 4: Test Again

1. Restart your server if needed
2. Go to: http://127.0.0.1:3000
3. Click "Connect YouTube Music"
4. You should now be able to log in!

## Troubleshooting

**Still getting errors?**
- Double-check the email you added matches the one you're logging in with
- Make sure the redirect URI exactly matches (including the IP address format)
- Try incognito/private browsing mode
- Clear browser cache and cookies

**Need to add more users?**
- In testing mode, you can add up to 100 test users
- Each user must be explicitly added to the test user list

## Production Notes

For production deployment, you'd need to:
1. Complete Google's verification process
2. Add privacy policy and terms of service URLs
3. Submit app for review
4. But for personal/development use, test user mode is perfect!
