# Chrome Debug Service - Auto Cookie Refresh System

This document explains the new Chrome debugging integration that automatically manages YouTube Music authentication cookies.

## 🚀 Overview

The Chrome Debug Service implements the "Ultimate Idiot Proof" cookie management system from the TODO list. It:

- **Automatically monitors** YouTube Music cookie health
- **Refreshes expired cookies** without user intervention  
- **Keeps sessions alive** with periodic heartbeat interactions
- **Auto-recovers** from Chrome crashes and login issues
- **Provides real-time status** and notifications

## 🔧 How It Works

### Architecture

```
┌─ Cookie Monitor Service ─────────────────────────┐
│  ├─ Status Management                            │
│  ├─ Error Recovery                               │
│  └─ API Integration                              │
│                    │                             │
│  ┌─ Chrome Debug Service ──────────────────────┐ │
│  │  ├─ Chrome Automation (Puppeteer)          │ │
│  │  ├─ Cookie Extraction & Monitoring         │ │
│  │  ├─ Session Heartbeat System               │ │
│  │  └─ OAuth.json Auto-Update                 │ │
│  └─────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

### Chrome Launch Configuration

The service launches Chrome with these debugging flags:
```javascript
const chromeFlags = [
    '--remote-debugging-port=9222',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling'
];
```

### Monitoring Intervals

- **Cookie Health Check**: Every 5 minutes
- **Session Heartbeat**: Every 30 minutes  
- **OAuth File Update**: Automatic when cookies change
- **Auto-Recovery**: Within 10 seconds of failures

## 📦 Installation & Setup

### 1. Install Dependencies

The required packages should be installed automatically:
```bash
npm install puppeteer chrome-launcher
```

### 2. Test the System

Run the test script to verify everything works:
```bash
npm run test:chrome-debug
```

Or use the batch file:
```bash
"Test Chrome Debug.bat"
```

### 3. Integrate with Main App

The Chrome Debug Service is automatically integrated into the main Spotisync application and can be controlled via the web interface.

## 🎮 Usage

### Via Web Interface

1. **Open Spotisync** in your browser (`http://localhost:3000`)
2. **Navigate to Cookie Monitor section**
3. **Click "Start Chrome Monitor"**
4. **Chrome will open** with YouTube Music
5. **Log in manually** if needed (one-time setup)
6. **System runs automatically** from then on

### Via API

You can also control the service programmatically:

```javascript
// Start monitoring
POST /api/cookie-monitor/start

// Stop monitoring  
POST /api/cookie-monitor/stop

// Get status
GET /api/cookie-monitor/status

// Manual cookie refresh
POST /api/cookie-monitor/refresh-cookies

// Check cookie health
POST /api/cookie-monitor/check-health
```

### Manual Testing

```bash
# Test the service standalone
node scripts/test-chrome-debug.js
```

## 🔍 Monitoring & Status

### Status Indicators

| Status | Meaning |
|--------|---------|
| 🟢 **Healthy** | Cookies fresh, system running normally |
| 🟡 **Warning** | Cookies expiring soon, auto-refreshing |
| 🔴 **Error** | Problem detected, manual intervention may be needed |
| ⚫ **Stopped** | Service not running |

### Real-time Notifications

The system provides real-time notifications for:
- ✅ Successful cookie refreshes
- ⚠️ Cookie expiration warnings
- 🔐 Login required alerts
- ❌ System errors and failures
- 💓 Heartbeat confirmations

## 🛠️ Troubleshooting

### Common Issues

**Chrome Won't Start**
```bash
# Check if Puppeteer is installed correctly
npm list puppeteer

# Try reinstalling Puppeteer
npm uninstall puppeteer
npm install puppeteer
```

**Cookies Not Updating**
- Ensure you're logged into YouTube Music in the Chrome window
- Check that the oauth.json file exists and is writable
- Verify YouTube Music is accessible (no VPN/firewall blocks)

**Service Keeps Crashing**
- Check console logs for specific error messages
- Ensure no other automation tools are controlling Chrome
- Try restarting with a clean Chrome profile

### Debug Mode

Enable verbose logging:
```javascript
// In chromeDebugService.js, uncomment debug lines
console.log('Debug: Checking cookie health...');
```

### Manual Recovery

If auto-recovery fails:
1. Stop the service via web interface
2. Close any Chrome processes manually
3. Clear the `chrome-data` directory
4. Restart the service

## 🔒 Security Notes

### Data Protection
- **Cookies stored locally** in oauth.json
- **Chrome profile isolated** in chrome-data directory  
- **No cookies sent to external services**
- **All processing happens locally**

### Privacy
- Chrome runs with a separate profile
- No browsing history or personal data accessed
- Only YouTube Music cookies are monitored
- No data transmission to third parties

## ⚡ Performance

### Resource Usage
- **Memory**: ~100-200MB (Chrome + Node.js)
- **CPU**: Minimal (< 1% when idle)
- **Disk**: ~50MB for Chrome profile data
- **Network**: Only YouTube Music API calls

### Optimization Tips
- Close unnecessary Chrome tabs to save memory
- Use headless mode for production (set in config)
- Adjust monitoring intervals based on usage patterns

## 🔮 Future Enhancements

Planned improvements from the TODO list:

- **System Tray Integration** - Background service with tray icon
- **Auto-updater** - Seamless updates without interruption  
- **Multiple Service Support** - Support for other music services
- **Advanced Analytics** - Cookie health metrics and reporting
- **Portable Installer** - One-click installation package

## 📊 API Reference

### Cookie Monitor Endpoints

```
GET    /api/cookie-monitor/status                 # Get service status
GET    /api/cookie-monitor/cookie-status          # Get cookie health  
POST   /api/cookie-monitor/start                  # Start monitoring
POST   /api/cookie-monitor/stop                   # Stop monitoring
POST   /api/cookie-monitor/restart                # Restart service
POST   /api/cookie-monitor/refresh-cookies        # Manual refresh
POST   /api/cookie-monitor/check-health           # Check cookie health
GET    /api/cookie-monitor/notifications          # Get notifications
DELETE /api/cookie-monitor/notifications          # Clear notifications
```

### Response Formats

**Status Response:**
```json
{
  "isRunning": true,
  "status": "healthy",
  "lastUpdate": "2025-05-30T10:30:00Z",
  "errorCount": 0,
  "maxRetries": 3,
  "notifications": [...],
  "chromeService": "connected"
}
```

**Cookie Status Response:**
```json
{
  "status": "healthy",
  "cookieCount": 15,
  "lastCheck": "2025-05-30T10:30:00Z", 
  "isRunning": true
}
```

## 🎯 Integration Examples

### React Component
```jsx
const CookieMonitor = () => {
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    const fetchStatus = async () => {
      const response = await fetch('/api/cookie-monitor/status');
      const data = await response.json();
      setStatus(data);
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="cookie-monitor">
      <div className={`status ${status?.isRunning ? 'running' : 'stopped'}`}>
        {status?.isRunning ? '🟢 Running' : '🔴 Stopped'}
      </div>
    </div>
  );
};
```

### Node.js Integration
```javascript
const CookieMonitorService = require('./src/services/cookieMonitorService');

const cookieMonitor = new CookieMonitorService();

// Start monitoring
await cookieMonitor.start();

// Listen for events
cookieMonitor.on('cookiesHealthy', () => {
  console.log('✅ Cookies are healthy');
});

cookieMonitor.on('loginRequired', () => {
  console.log('🔐 User login required');
});
```

---

**Need help?** Check the main README.md or create an issue on GitHub.
