# Bundle FastAPI Backend for Tauri
# Copies FastAPI backend to bundle resources

$ErrorActionPreference = "Stop"

Write-Host "`n📦 Bundling FastAPI Backend...`n" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $PSScriptRoot
$fastapiSource = Join-Path $rootDir "python\fastapi_backend"
$bundleTarget = Join-Path $rootDir "src-tauri\bundle\resources\python\fastapi_backend"

# Create target directory
Write-Host "Creating target directory: $bundleTarget" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $bundleTarget | Out-Null

# Copy FastAPI backend
Write-Host "Copying FastAPI backend files..." -ForegroundColor Yellow
Copy-Item -Path "$fastapiSource\*" -Destination $bundleTarget -Recurse -Force -Exclude @("__pycache__", "*.pyc", ".pytest_cache", "*.log")

# Create __init__.py if missing
$initFile = Join-Path $bundleTarget "__init__.py"
if (-not (Test-Path $initFile)) {
    New-Item -ItemType File -Path $initFile -Force | Out-Null
}

Write-Host "`n✅ FastAPI Backend bundled successfully!`n" -ForegroundColor Green
Write-Host "Location: $bundleTarget" -ForegroundColor Cyan
