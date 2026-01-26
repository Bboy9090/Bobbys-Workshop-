# Create Windows Desktop Shortcut for Bobby's Workshop
# This script creates a desktop shortcut for the application

$ErrorActionPreference = "Stop"

Write-Host "`n=== Creating Desktop Shortcut ===" -ForegroundColor Green
Write-Host ""

# Get desktop path
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Bobbys Workshop.lnk"
$shortcutPathTranscendent = Join-Path $desktop "Transcendent Legendary Enterprise.lnk"

# Determine application path
$projectRoot = Split-Path -Parent $PSScriptRoot
$exePath = $null
$workingDir = $projectRoot
$arguments = ""

# Check for production build (Cargo binary = bobbys-secret-workshop.exe)
$releasePaths = @(
    "src-tauri/target/release/bobbys-secret-workshop.exe",
    "src-tauri/target/release/bobbys-workshop.exe",
    "src-tauri/target/x86_64-pc-windows-msvc/release/bobbys-secret-workshop.exe",
    "src-tauri/target/x86_64-pc-windows-msvc/release/bobbys-workshop.exe"
)

foreach ($path in $releasePaths) {
    $fullPath = Join-Path $projectRoot $path
    if (Test-Path $fullPath) {
        $exePath = (Resolve-Path $fullPath).Path
        $workingDir = Split-Path -Parent $exePath
        Write-Host "[OK] Found production build: $exePath" -ForegroundColor Green
        break
    }
}

# If no production build, create dev shortcut
if (-not $exePath) {
    Write-Host "[!] Production build not found" -ForegroundColor Yellow
    Write-Host "[*] Creating development shortcut..." -ForegroundColor Cyan
    
    # Find npm
    $npmPath = (Get-Command npm -ErrorAction SilentlyContinue).Source
    if (-not $npmPath) {
        $npmPath = "npm"
    }
    
    $exePath = $npmPath
    $arguments = "run tauri:dev"
    Write-Host "[OK] Dev shortcut will use: npm run tauri:dev" -ForegroundColor Green
}

# Create shortcut
try {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $exePath
    $shortcut.WorkingDirectory = $workingDir
    $shortcut.Arguments = $arguments
    $shortcut.Description = "Bobbys Workshop - Professional Device Repair Toolkit"
    
    # Set icon if available
    $iconPath = Join-Path $projectRoot "src-tauri/icons/icon.ico"
    if (Test-Path $iconPath) {
        $shortcut.IconLocation = $iconPath
    }
    
    # Set window style (1 = normal, 3 = maximized, 7 = minimized)
    $shortcut.WindowStyle = 1
    
    $shortcut.Save()
    
    # Create second shortcut: Transcendent Legendary Enterprise (same target)
    $shortcut2 = $shell.CreateShortcut($shortcutPathTranscendent)
    $shortcut2.TargetPath = $exePath
    $shortcut2.WorkingDirectory = $workingDir
    $shortcut2.Arguments = $arguments
    $shortcut2.Description = "Transcendent Legendary Enterprise - Autonomous AI, Neural Networks, Self-Evolution"
    if (Test-Path $iconPath) { $shortcut2.IconLocation = $iconPath }
    $shortcut2.WindowStyle = 1
    $shortcut2.Save()
    
    Write-Host "" ; Write-Host "[OK] Desktop shortcuts created successfully!" -ForegroundColor Green
    Write-Host "   Bobbys Workshop:       $shortcutPath" -ForegroundColor Cyan
    Write-Host "   Transcendent Legendary: $shortcutPathTranscendent" -ForegroundColor Cyan
    Write-Host "   Target: $exePath" -ForegroundColor White
    if ($arguments) {
        Write-Host "   Arguments: $arguments" -ForegroundColor White
    }
    Write-Host ""
    
} catch {
    $errorMsg = $_.Exception.Message
    Write-Host ""
    Write-Host ("[ERROR] Error creating shortcut: " + $errorMsg) -ForegroundColor Red
    exit 1
}
