# Fix all execSync('where') calls in bundled server files to use commandExistsInPath
# This eliminates console window pop-ups

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$BundleServerDir = Join-Path $RootDir "src-tauri\bundle\resources\server"

Write-Host "Fixing execSync('where') calls in bundled server files..." -ForegroundColor Cyan

if (-not (Test-Path $BundleServerDir)) {
    Write-Host "Bundle server directory not found: $BundleServerDir" -ForegroundColor Red
    exit 1
}

# Get all JS files in bundled server
$jsFiles = Get-ChildItem -Path $BundleServerDir -Recurse -Filter "*.js" | Where-Object { $_.Name -ne "package-lock.json" }

$fixedCount = 0

foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    $modified = $false

    # Check if file needs commandExistsInPath import
    $needsImport = $false
    if ($content -match "execSync\s*\(\S*where" -or $content -match "execSync\s*\(\S*command\s+-v" -or $content -match "execSync\s*\(\S*which") {
        $needsImport = $true
    }

    # Add import if needed and not present
    if ($needsImport -and $content -notmatch "commandExistsInPath.*from.*safe-exec") {
        $content = "import { commandExistsInPath } from '../utils/safe-exec.js';`n" + $content
        $modified = $true
    }

    # Fix execSync('where ${tool}') patterns - Windows (use [\x60\x27\x22] = ` ' ")
    $q = '[\x60\x27\x22]'
    if ($content -match "execSync\s*\(\S*where\s+\`$\{") {
        $content = $content -replace "execSync\s*\(${q}where\s+\`$\{([^}]+)\}${q},\s*\{[^}]*\}\s*\);", 'if (!commandExistsInPath($1)) { missing.push($1); }'
        $content = $content -replace "execSync\s*\(${q}where\s+(\w+)${q},\s*\{[^}]*\}\s*\);", "if (!commandExistsInPath('`$1')) { return false; }"
        $modified = $true
    }

    # Fix execSync(`command -v ${cmd}`) patterns - Unix
    if ($content -match "execSync\s*\(\S*command\s+-v") {
        $content = $content -replace "execSync\s*\(${q}command\s+-v\s+\`$\{([^}]+)\}${q},\s*\{[^}]*\}\s*\);", 'if (!commandExistsInPath($1)) { return false; }'
        $content = $content -replace "execSync\s*\(${q}command\s+-v\s+(\w+)${q},\s*\{[^}]*\}\s*\);", "if (!commandExistsInPath('`$1')) { return false; }"
        $modified = $true
    }

    # Fix execSync(`which ${cmd}`) patterns
    if ($content -match "execSync\s*\(\S*which") {
        $content = $content -replace "execSync\s*\(${q}which\s+\`$\{([^}]+)\}${q},\s*\{[^}]*\}\s*\);", 'if (!commandExistsInPath($1)) { return false; }'
        $content = $content -replace "execSync\s*\(${q}which\s+(\w+)${q},\s*\{[^}]*\}\s*\);", "if (!commandExistsInPath('`$1')) { return false; }"
        $modified = $true
    }

    if ($modified) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Fixed: $($file.Name)" -ForegroundColor Green
        $fixedCount++
    }
}

Write-Host "Fixed $fixedCount files" -ForegroundColor Green
