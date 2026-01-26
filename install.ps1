# 🚀 Pandora Codex - One-Click Install Script (Windows)
# Run this in PowerShell as Administrator

Write-Host "🎯 Pandora Codex - One-Click Installer (Windows)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check for Administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ This script requires Administrator privileges!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

# Check for Scoop
if (-not (Get-Command scoop -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing Scoop package manager..." -ForegroundColor Yellow
    Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Invoke-RestMethod get.scoop.sh | Invoke-Expression
}

Write-Host "📦 Installing required tools..." -ForegroundColor Yellow
Write-Host ""

# Add scoop buckets
scoop bucket add extras
scoop bucket add versions

# Install tools
Write-Host "Installing Android Platform Tools..." -ForegroundColor Cyan
scoop install adb

Write-Host "Installing scrcpy (Android screen mirror)..." -ForegroundColor Cyan
scoop install scrcpy

Write-Host "Installing FFmpeg (media conversion)..." -ForegroundColor Cyan
scoop install ffmpeg

Write-Host "Installing Git..." -ForegroundColor Cyan
scoop install git

Write-Host "Installing Node.js..." -ForegroundColor Cyan
scoop install nodejs-lts

Write-Host ""
Write-Host "📦 Installing Node.js dependencies..." -ForegroundColor Yellow

# Install npm packages
npm install

Write-Host ""
Write-Host "🔧 Setting up directories..." -ForegroundColor Yellow

# Create directories
$directories = @(
    "data",
    "data\ios-backups",
    "data\debloater-backups",
    "server\routes",
    "server\middleware",
    "server\utils",
    "runtime"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "✅ Created: $dir" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🍎 iOS Tools (Manual Installation Required)" -ForegroundColor Yellow
Write-Host "--------------------------------------------" -ForegroundColor Yellow
Write-Host "For iOS device support, install iTunes from:" -ForegroundColor White
Write-Host "https://www.apple.com/itunes/download/" -ForegroundColor Cyan
Write-Host ""
Write-Host "For advanced iOS tools (libimobiledevice), use WSL2:" -ForegroundColor White
Write-Host "wsl --install" -ForegroundColor Gray
Write-Host "Then in WSL: sudo apt install libimobiledevice-utils" -ForegroundColor Gray
Write-Host ""

Write-Host "🎉 Installation Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run: npm run dev" -ForegroundColor White
Write-Host "2. Open: http://localhost:3001" -ForegroundColor White
Write-Host "3. Connect your device via USB" -ForegroundColor White
Write-Host ""
Write-Host "Available tools:" -ForegroundColor Cyan
Write-Host "  ✅ adb (Android Debug Bridge)" -ForegroundColor Green
Write-Host "  ✅ fastboot (Android bootloader)" -ForegroundColor Green
Write-Host "  ✅ scrcpy (Android screen mirror)" -ForegroundColor Green
Write-Host "  ✅ ffmpeg (media conversion)" -ForegroundColor Green
Write-Host "  ⚠️  iOS tools (install iTunes)" -ForegroundColor Yellow
Write-Host ""
Write-Host "🚀 Ready to go!" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
