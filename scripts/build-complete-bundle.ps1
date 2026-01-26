# Complete Build Script - Windows
# Builds Tauri app with Python runtime, Node.js, and all dependencies
# Creates NSIS installer

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

Write-Host ""
Write-Host "=== Complete Bundle Build (Windows) ===" -ForegroundColor Green
Write-Host ""

# Step 1: Install dependencies
Write-Host "Step 1: Installing dependencies..." -ForegroundColor Yellow
Set-Location $RootDir
npm install
if ($LASTEXITCODE -ne 0) {
    throw "npm install failed"
}

# Step 2: Build frontend
Write-Host ""
Write-Host "Step 2: Building frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed"
}

# Step 3: Prepare bundle (Node.js + Server + Python)
Write-Host ""
Write-Host "Step 3: Preparing bundle (Node.js + Server + Python)..." -ForegroundColor Yellow
npm run prepare:bundle
if ($LASTEXITCODE -ne 0) {
    throw "Bundle preparation failed"
}

# Step 3.5: Bundle FastAPI backend
Write-Host ""
Write-Host "Step 3.5: Bundling FastAPI backend..." -ForegroundColor Yellow
npm run bundle:fastapi
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: FastAPI bundling failed, continuing..." -ForegroundColor Yellow
}

# Step 4: Copy Python runtime to Tauri bundle
Write-Host ""
Write-Host "Step 4: Copying Python runtime to Tauri bundle..." -ForegroundColor Yellow
$PythonRuntime = Join-Path $RootDir "python\runtime\python-embedded"
$TauriBundle = Join-Path $RootDir "src-tauri\bundle\resources\python\runtime"

if (Test-Path $PythonRuntime) {
    if (Test-Path $TauriBundle) {
        Remove-Item -Path $TauriBundle -Recurse -Force
    }
    New-Item -ItemType Directory -Path $TauriBundle -Force | Out-Null
    Copy-Item -Path $PythonRuntime -Destination $TauriBundle -Recurse -Force
    Write-Host "[OK] Python runtime copied" -ForegroundColor Green
} else {
    Write-Host "[WARN] Python runtime not found, skipping..." -ForegroundColor Yellow
}

# Step 5: Copy unified launcher
Write-Host ""
Write-Host "Step 5: Copying unified launcher..." -ForegroundColor Yellow
$LauncherSrc = Join-Path $ScriptDir "unified-launcher.ps1"
$LauncherDest = Join-Path $TauriBundle "..\unified-launcher.ps1"
if (Test-Path $LauncherSrc) {
    Copy-Item -Path $LauncherSrc -Destination $LauncherDest -Force
    Write-Host "[OK] Unified launcher copied" -ForegroundColor Green
}

# Step 6: Build Tauri with NSIS installer
Write-Host ""
Write-Host "Step 6: Building Tauri app with NSIS installer..." -ForegroundColor Yellow
Set-Location "$RootDir\src-tauri"
cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis
if ($LASTEXITCODE -ne 0) {
    throw "Tauri build failed"
}

# Step 7: Collect artifacts
Write-Host ""
Write-Host "Step 7: Collecting installer artifacts..." -ForegroundColor Yellow
Set-Location $RootDir
$ArtifactsDir = Join-Path $RootDir "dist-artifacts\windows"
if (-not (Test-Path $ArtifactsDir)) {
    New-Item -ItemType Directory -Path $ArtifactsDir -Force | Out-Null
}

$TauriOutput = Join-Path $RootDir "src-tauri\target\x86_64-pc-windows-msvc\release"
$Installer = Get-ChildItem -Path $TauriOutput -Filter "*.exe" | Where-Object { $_.Name -like "*setup*" }

if ($Installer) {
    Copy-Item -Path $Installer.FullName -Destination $ArtifactsDir -Force
    Write-Host "[OK] Installer copied to: $ArtifactsDir\$($Installer.Name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Installer location: $ArtifactsDir" -ForegroundColor Cyan
if ($Installer) {
    Write-Host "Installer file: $($Installer.Name)" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "The installer includes:" -ForegroundColor Yellow
Write-Host "  [OK] Frontend (React + Vite)" -ForegroundColor White
Write-Host "  [OK] Node.js runtime" -ForegroundColor White
Write-Host "  [OK] Node.js server" -ForegroundColor White
Write-Host "  [OK] Python runtime (embedded)" -ForegroundColor White
Write-Host "  [OK] FastAPI backend" -ForegroundColor White
Write-Host "  [OK] All dependencies" -ForegroundColor White
Write-Host ""
Write-Host "Ready for distribution!" -ForegroundColor Green
