param()

# Set window title and colors
$Host.UI.RawUI.WindowTitle = "Spotisync Setup"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   SPOTISYNC SETUP - Double Click Setup" -ForegroundColor Cyan  
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
Set-Location -Path $PSScriptRoot

try {
    # Check if Node.js is installed
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }

    # Check if Python is installed  
    $pythonVersion = python --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Python is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Please install Python from https://python.org/" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }

    Write-Host "Starting interactive setup..." -ForegroundColor Green
    Write-Host ""

    # Run the Node.js setup script
    & node "scripts/interactive-setup.js"
    
} catch {
    Write-Host ""
    Write-Host "An error occurred: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Read-Host "Press Enter to exit"
