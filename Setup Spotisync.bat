@echo off
title Spotisync Setup
color 0B

echo.
echo ===============================================
echo   SPOTISYNC SETUP - Double Click Setup
echo ===============================================
echo.

REM Change to the script directory
cd /d "%~dp0"

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

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    python3 --version >nul 2>&1
    if errorlevel 1 (
        py --version >nul 2>&1
        if errorlevel 1 (
            echo ERROR: Python is not installed or not in PATH
            echo Please install Python from https://python.org/
            echo.
            echo Press any key to exit...
            pause >nul
            exit /b 1
        )
    )
)

echo Starting interactive setup...
echo.

REM Set environment variable to indicate we're running from batch file
set SPOTISYNC_FROM_BATCH=true

REM Run the Node.js setup script
node scripts/interactive-setup.js

REM Check if setup was successful by looking for oauth.json
if exist "oauth.json" (
    echo.
    echo ===============================================
    echo   SETUP COMPLETED SUCCESSFULLY!
    echo ===============================================
    echo.
    choice /C YN /M "Would you like to start Spotisync now"
    if errorlevel 2 goto :manual_start
    if errorlevel 1 goto :start_server
) else (
    echo.
    echo Setup was not completed successfully.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

:start_server
echo.
echo Starting Spotisync server...
echo The application will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server when you're done.
echo.
start "Spotisync Server" cmd /k "npm run start:all"
goto :end

:manual_start
echo.
echo Setup completed! Run "npm run start:all" when you're ready to start.
echo.
pause

:end
