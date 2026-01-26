# Complete Python Runtime Bundler
# Downloads embedded Python, installs dependencies, and prepares for bundling

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$PythonDir = Join-Path $RootDir "python"
$RuntimeDir = Join-Path $PythonDir "runtime"
$EmbeddedDir = Join-Path $RuntimeDir "python-embedded"

Write-Host "`n=== Complete Python Runtime Bundler ===" -ForegroundColor Green
Write-Host ""

# Detect platform
$IsWindows = $IsWindows -or $env:OS -match "Windows"
$IsMacOS = $IsMacOS -or (Test-Path "/System/Library/CoreServices/SystemVersion.plist")
$IsLinux = -not $IsWindows -and -not $IsMacOS

$Platform = if ($IsWindows) { "windows" } elseif ($IsMacOS) { "macos" } else { "linux" }
$Arch = if ([Environment]::Is64BitOperatingSystem) { "x86_64" } else { "x86" }

Write-Host "Platform: $Platform ($Arch)" -ForegroundColor Cyan
Write-Host ""

# Create directories
if (-not (Test-Path $PythonDir)) {
    New-Item -ItemType Directory -Path $PythonDir | Out-Null
}
if (-not (Test-Path $RuntimeDir)) {
    New-Item -ItemType Directory -Path $RuntimeDir | Out-Null
}
if (-not (Test-Path $EmbeddedDir)) {
    New-Item -ItemType Directory -Path $EmbeddedDir | Out-Null
}

# Python version to bundle
$PythonVersion = "3.12.1"
$PythonVersionShort = "3.12"

if ($IsWindows) {
    Write-Host "=== Windows Python Runtime Bundle ===" -ForegroundColor Yellow
    
    $PythonUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
    $PythonZip = Join-Path $RuntimeDir "python-embedded.zip"
    
    Write-Host "Downloading Python $PythonVersion embedded distribution..." -ForegroundColor Cyan
    Write-Host "URL: $PythonUrl" -ForegroundColor Gray
    
    if (-not (Test-Path $PythonZip)) {
        try {
            Invoke-WebRequest -Uri $PythonUrl -OutFile $PythonZip -UseBasicParsing
            Write-Host "✓ Downloaded Python embedded distribution" -ForegroundColor Green
        } catch {
            Write-Host "✗ Download failed: $_" -ForegroundColor Red
            Write-Host "`nManual download required:" -ForegroundColor Yellow
            Write-Host "  1. Download from: $PythonUrl" -ForegroundColor White
            Write-Host "  2. Save to: $PythonZip" -ForegroundColor White
            Write-Host "  3. Run this script again" -ForegroundColor White
            exit 1
        }
    } else {
        Write-Host "✓ Python embedded distribution already downloaded" -ForegroundColor Green
    }
    
    Write-Host "Extracting Python runtime..." -ForegroundColor Cyan
    if (Test-Path $EmbeddedDir) {
        Remove-Item -Path $EmbeddedDir -Recurse -Force
    }
    Expand-Archive -Path $PythonZip -DestinationPath $EmbeddedDir -Force
    Write-Host "✓ Extracted Python runtime" -ForegroundColor Green
    
    # Enable pip
    Write-Host "Enabling pip..." -ForegroundColor Cyan
    $PythonExe = Join-Path $EmbeddedDir "python.exe"
    $PthFile = Join-Path $EmbeddedDir "python$($PythonVersionShort.Replace('.',''))._pth"
    
    if (Test-Path $PthFile) {
        $Content = Get-Content $PthFile -Raw
        $Content = $Content -replace "#import site", "import site"
        Set-Content -Path $PthFile -Value $Content -NoNewline
        Write-Host "✓ Enabled pip" -ForegroundColor Green
    }
    
    # Install dependencies
    Write-Host "Installing Python dependencies..." -ForegroundColor Cyan
    $RequirementsFile = Join-Path $RootDir "requirements.txt"
    
    if (Test-Path $RequirementsFile) {
        & $PythonExe -m pip install --upgrade pip --target "$EmbeddedDir\Lib\site-packages" --no-warn-script-location
        & $PythonExe -m pip install -r $RequirementsFile --target "$EmbeddedDir\Lib\site-packages" --no-warn-script-location
        Write-Host "✓ Installed Python dependencies" -ForegroundColor Green
    } else {
        Write-Host "⚠ requirements.txt not found, skipping dependency installation" -ForegroundColor Yellow
    }
    
    # Copy backend modules
    Write-Host "Copying backend modules..." -ForegroundColor Cyan
    $BackendSrc = Join-Path $RootDir "backend"
    $BackendDest = Join-Path $EmbeddedDir "backend"
    
    if (Test-Path $BackendSrc) {
        if (Test-Path $BackendDest) {
            Remove-Item -Path $BackendDest -Recurse -Force
        }
        Copy-Item -Path $BackendSrc -Destination $BackendDest -Recurse -Force
        Write-Host "✓ Copied backend modules" -ForegroundColor Green
    }
    
    # Create launcher script
    Write-Host "Creating launcher script..." -ForegroundColor Cyan
    $LauncherScript = Join-Path $EmbeddedDir "start-backend.bat"
    @"
@echo off
cd /d "%~dp0"
python.exe -m backend.main
"@ | Set-Content -Path $LauncherScript
    Write-Host "✓ Created launcher script" -ForegroundColor Green
    
} elseif ($IsMacOS) {
    Write-Host "=== macOS Python Runtime Bundle ===" -ForegroundColor Yellow
    Write-Host "`nFor macOS, we'll use system Python or create a portable bundle" -ForegroundColor Cyan
    Write-Host "`nOption 1: Use system Python (recommended for development)" -ForegroundColor White
    Write-Host "Option 2: Bundle Python via pyenv or download from python.org" -ForegroundColor White
    Write-Host "`nCreating symlink structure..." -ForegroundColor Cyan
    
    # Create a wrapper that uses system Python
    $LauncherScript = Join-Path $EmbeddedDir "start-backend.sh"
    @"
#!/bin/bash
cd "$(dirname "$0")/.."
export PYTHONPATH="$(pwd)/backend:$(pwd)/python/runtime/python-embedded:$PYTHONPATH"
python3 -m backend.main
"@ | Set-Content -Path $LauncherScript
    & chmod +x $LauncherScript
    Write-Host "✓ Created launcher script" -ForegroundColor Green
    
} else {
    Write-Host "=== Linux Python Runtime Bundle ===" -ForegroundColor Yellow
    Write-Host "`nFor Linux, we'll use system Python" -ForegroundColor Cyan
    
    $LauncherScript = Join-Path $EmbeddedDir "start-backend.sh"
    @"
#!/bin/bash
cd "$(dirname "$0")/.."
export PYTHONPATH="$(pwd)/backend:$(pwd)/python/runtime/python-embedded:$PYTHONPATH"
python3 -m backend.main
"@ | Set-Content -Path $LauncherScript
    & chmod +x $LauncherScript
    Write-Host "✓ Created launcher script" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Python Runtime Bundle Complete ===" -ForegroundColor Green
Write-Host "Location: $EmbeddedDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run: npm run prepare:bundle" -ForegroundColor White
Write-Host "  2. Run: npm run tauri:build" -ForegroundColor White
Write-Host ""
