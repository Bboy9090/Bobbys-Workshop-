# Copy server files to release directory for direct execution
# This allows running the exe directly from target/release without installing

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ServerSource = Join-Path $RootDir "src-tauri\bundle\resources\server"
$ServerDest = Join-Path $RootDir "src-tauri\target\release\server"

if (Test-Path $ServerSource) {
    Write-Host "📦 Copying server files to release directory..." -ForegroundColor Cyan
    if (Test-Path $ServerDest) {
        Remove-Item -Path $ServerDest -Recurse -Force
    }
    Copy-Item -Path $ServerSource -Destination $ServerDest -Recurse -Force
    Write-Host "✅ Server files copied to release directory" -ForegroundColor Green
} else {
    Write-Host "⚠️  Server source not found at: $ServerSource" -ForegroundColor Yellow
    Write-Host "   Make sure to run 'npm run prepare:bundle' first" -ForegroundColor Yellow
}
