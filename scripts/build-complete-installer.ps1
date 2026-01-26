# Complete One-Click Installer Build Script
# Builds production app, packages into ZIP with installer

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

Write-Host "Building Complete One-Click Installer..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Build frontend
Write-Host "Step 1: Building frontend..." -ForegroundColor Yellow
Set-Location $RootDir
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed"
}

# Step 2: Prepare bundle
Write-Host "Step 2: Preparing server bundle..." -ForegroundColor Yellow
npm run prepare:bundle
if ($LASTEXITCODE -ne 0) {
    throw "Bundle preparation failed"
}

# Step 3: Build Tauri app with installer
Write-Host "Step 3: Building Tauri app with installer..." -ForegroundColor Yellow
Set-Location "$RootDir\src-tauri"
cargo tauri build --target x86_64-pc-windows-msvc
if ($LASTEXITCODE -ne 0) {
    throw "Tauri build failed"
}

# Step 4: Collect artifacts
Write-Host "Step 4: Collecting installer artifacts..." -ForegroundColor Yellow
Set-Location $RootDir
npm run tauri:artifacts:windows:skipbuild
if ($LASTEXITCODE -ne 0) {
    throw "Artifact collection failed"
}

Write-Host ""
Write-Host "Complete installer build finished!" -ForegroundColor Green
Write-Host ""
Write-Host "Installer location: dist-artifacts/windows/" -ForegroundColor Cyan
Write-Host "   - MSI installer: dist-artifacts/windows/*.msi" -ForegroundColor Gray
Write-Host "   - NSIS installer: dist-artifacts/windows/*-setup.exe" -ForegroundColor Gray
Write-Host ""
Write-Host "Ready for distribution!" -ForegroundColor Green
