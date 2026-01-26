# Fix import paths in bundled server for production deployment
# This script adjusts import paths to work in the bundled environment

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ServerDir = Join-Path $RootDir "src-tauri\bundle\resources\server"

Write-Host "Fixing import paths in bundled server..." -ForegroundColor Cyan

if (-not (Test-Path $ServerDir)) {
    throw "Server directory not found: $ServerDir"
}

# Find all .js files in the server directory
$jsFiles = Get-ChildItem -Path $ServerDir -Recurse -Filter "*.js" -File

$fixedCount = 0

foreach ($file in $jsFiles) {
    $content = Get-Content -Path $file.FullName -Raw

    $originalContent = $content

    # Fix src/lib imports to use bundled logger (only in utils folder)
    $content = $content -replace "from '\.\./\.\./src/lib/debug-logger\.js'", "from './bundled-logger.js'"
    $content = $content -replace 'from "\.\./\.\./src/lib/debug-logger\.js"', 'from "./bundled-logger.js"'

    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $fixedCount++
        Write-Host "Fixed: $($file.FullName.Replace($RootDir, ''))" -ForegroundColor Gray
    }
}

Write-Host "Fixed import paths in $fixedCount files" -ForegroundColor Green
