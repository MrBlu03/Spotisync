@echo off
title Spotisync Server
color 0B

echo.
echo ===============================================
echo   SPOTISYNC SERVER - Starting Application
echo ===============================================
echo.

REM Change to the script directory
cd /d "%~dp0"

REM Check if oauth.json exists
if not exist "oauth.json" (
    echo ERROR: YouTube Music authentication not set up!
    echo Please run "Setup Spotisync.bat" first.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo Starting Spotisync server...
echo The application will be available at: http://localhost:3000
echo You can authenticate with Spotify through the web interface.
echo Press Ctrl+C to stop the server when you're done.
echo.

REM Start the application
npm run start:all

echo.
echo Server stopped.
pause
