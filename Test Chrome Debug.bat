@echo off
echo.
echo =====================================================
echo    Spotisync Chrome Debug Service Test
echo =====================================================
echo.
echo This will test the automatic cookie refresh system.
echo Chrome will open with YouTube Music for testing.
echo.
pause

echo Starting Chrome Debug Service test...
echo.

npm run test:chrome-debug

pause
