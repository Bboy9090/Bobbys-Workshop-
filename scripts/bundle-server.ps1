# Bundle server code to Tauri resources (PowerShell version for Windows)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ResourcesDir = Join-Path $RootDir "src-tauri\bundle\resources"
$ServerDir = Join-Path $RootDir "server"
$TargetServerDir = Join-Path $ResourcesDir "server"

Write-Host "Bundling server code..." -ForegroundColor Cyan

# Ensure resources directory exists (create parent directories if needed)
if (-not (Test-Path $ResourcesDir)) {
    Write-Host "Creating resources directory: $ResourcesDir" -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $ResourcesDir | Out-Null
}

if (-not (Test-Path $ResourcesDir)) {
    throw "Failed to create resources directory: $ResourcesDir"
}

# Clean existing server directory in resources
if (Test-Path $TargetServerDir) {
    Write-Host "Cleaning existing server directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $TargetServerDir
}

# Ensure parent directory exists
$ParentDir = Split-Path -Parent $TargetServerDir
if (-not (Test-Path $ParentDir)) {
    New-Item -ItemType Directory -Force -Path $ParentDir | Out-Null
}

# Clean existing server directory in resources (do this before copy)
if (Test-Path $TargetServerDir) {
    Write-Host "Cleaning existing server directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $TargetServerDir
}

# Copy server directory
Write-Host "Copying server code to $TargetServerDir..." -ForegroundColor Cyan
if (-not (Test-Path $ServerDir)) {
    throw "Source server directory does not exist: $ServerDir"
}

# Copy entire server directory to target
Copy-Item -Recurse -Force $ServerDir $TargetServerDir -ErrorAction Stop

# Copy core directory (required by server imports)
$CoreDir = Join-Path $RootDir "core"
$TargetCoreDir = Join-Path $ResourcesDir "core"
if (Test-Path $CoreDir) {
    Write-Host "Copying core library to $TargetCoreDir..." -ForegroundColor Cyan
    if (Test-Path $TargetCoreDir) {
        Remove-Item -Recurse -Force $TargetCoreDir
    }
    Copy-Item -Recurse -Force $CoreDir $TargetCoreDir -ErrorAction Stop
    Write-Host "Core library copied successfully" -ForegroundColor Green
} else {
    Write-Host "Warning: Core directory not found at $CoreDir" -ForegroundColor Yellow
}

# Copy runtime directory (required by catalog API)
$RuntimeDir = Join-Path $RootDir "runtime"
$TargetRuntimeDir = Join-Path $ResourcesDir "runtime"
if (Test-Path $RuntimeDir) {
    Write-Host "Copying runtime directory to $TargetRuntimeDir..." -ForegroundColor Cyan
    if (Test-Path $TargetRuntimeDir) {
        Remove-Item -Recurse -Force $TargetRuntimeDir
    }
    Copy-Item -Recurse -Force $RuntimeDir $TargetRuntimeDir -ErrorAction Stop
    Write-Host "Runtime directory copied successfully" -ForegroundColor Green
} else {
    Write-Host "Warning: Runtime directory not found at $RuntimeDir" -ForegroundColor Yellow
}

# Copy package.json to resources root (needed by ready.js)
$PackageJson = Join-Path $RootDir "package.json"
if (Test-Path $PackageJson) {
    Copy-Item -Force $PackageJson (Join-Path $ResourcesDir "package.json")
    Write-Host "Copied package.json to resources" -ForegroundColor Green
}

# Verify copy succeeded
if (-not (Test-Path $TargetServerDir)) {
    throw "Failed to copy server directory to $TargetServerDir"
}

Write-Host "Server code copied successfully" -ForegroundColor Green

# Remove development files
Write-Host "Removing development files..." -ForegroundColor Yellow
Get-ChildItem -Path $TargetServerDir -Recurse -Include "*.log" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $TargetServerDir -Recurse -Directory -Filter "node_modules" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $TargetServerDir -Recurse -Directory -Filter ".git" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $TargetServerDir -Recurse -Filter ".env*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# Install production dependencies (if package.json exists)
if (Test-Path (Join-Path $TargetServerDir "package.json")) {
    Write-Host "Installing production dependencies..." -ForegroundColor Cyan
    Push-Location $TargetServerDir
    try {
        npm ci --production --silent
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Warning: npm ci failed, trying npm install..." -ForegroundColor Yellow
            npm install --production --silent
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Warning: npm install also failed, continuing without dependencies" -ForegroundColor Yellow
            }
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "No package.json found, skipping dependency installation" -ForegroundColor Yellow
}

Write-Host "Server bundled successfully!" -ForegroundColor Green
Write-Host "Location: $TargetServerDir" -ForegroundColor Gray
