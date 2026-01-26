# Master script to prepare bundle (PowerShell version for Windows)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

Write-Host "Preparing Tauri bundle resources..." -ForegroundColor Cyan

# Bundle Node.js
Write-Host ""
Write-Host "Step 1: Bundling Node.js runtime" -ForegroundColor Cyan
node "$ScriptDir\bundle-nodejs.js"
if ($LASTEXITCODE -ne 0) {
    throw "Node.js bundling failed"
}

# Bundle server
Write-Host ""
Write-Host "Step 2: Bundling server code" -ForegroundColor Cyan
& "$ScriptDir\bundle-server.ps1"
if ($LASTEXITCODE -ne 0) {
    throw "Server bundling failed"
}

# Fix import paths
Write-Host ""
Write-Host "Step 3: Fixing import paths" -ForegroundColor Cyan
& "$ScriptDir\fix-bundle-imports.ps1"
if ($LASTEXITCODE -ne 0) {
    throw "Import path fixing failed"
}

# Fix execSync('where') calls to eliminate pop-ups
Write-Host ""
Write-Host "Step 4: Fixing execSync calls to eliminate console pop-ups" -ForegroundColor Cyan
& "$ScriptDir\fix-bundle-execsync.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: execSync fix script failed, but continuing..." -ForegroundColor Yellow
}

# Bundle Python runtime
Write-Host ""
Write-Host "Step 5: Bundling Python runtime" -ForegroundColor Cyan
& "$ScriptDir\bundle-python-complete.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Python runtime bundling failed, but continuing..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Bundle preparation complete!" -ForegroundColor Green
