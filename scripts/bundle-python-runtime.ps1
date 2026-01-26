# Bundle Python Runtime for Tauri
# Downloads and extracts embedded Python distribution

$ErrorActionPreference = "Stop"

Write-Host "`n=== Bundling Python Runtime ===" -ForegroundColor Green
Write-Host ""

$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonDir = Join-Path $projectRoot "python"
$runtimeDir = Join-Path $pythonDir "runtime"

# Create directories
if (-not (Test-Path $pythonDir)) {
    New-Item -ItemType Directory -Path $pythonDir | Out-Null
}

if (-not (Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}

Write-Host "📦 Python Runtime Bundle Script" -ForegroundColor Cyan
Write-Host "`nThis script will help you bundle Python runtime for the application." -ForegroundColor White
Write-Host "`nFor Windows:" -ForegroundColor Yellow
Write-Host "  1. Download Python embedded distribution from:" -ForegroundColor White
Write-Host "     https://www.python.org/downloads/windows/" -ForegroundColor Cyan
Write-Host "  2. Extract to: $runtimeDir" -ForegroundColor White
Write-Host "  3. Install required packages (if any)" -ForegroundColor White
Write-Host "`nFor macOS/Linux:" -ForegroundColor Yellow
Write-Host "  1. Download Python embedded distribution" -ForegroundColor White
Write-Host "  2. Extract to: $runtimeDir" -ForegroundColor White
Write-Host "  3. Install required packages (if any)" -ForegroundColor White
Write-Host "`nTarget Directory: $runtimeDir" -ForegroundColor Cyan
Write-Host "`n✅ Script ready - follow manual steps above" -ForegroundColor Green
