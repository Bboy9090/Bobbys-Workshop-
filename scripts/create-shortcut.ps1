# Create Desktop Shortcut for Bobby's Workshop
$appName = "Bobby's Workshop"
$exePath = "$PSScriptRoot\..\src-tauri\target\release\bobbys-workshop.exe"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktopPath\$appName.lnk"

# Check if executable exists
if (-not (Test-Path $exePath)) {
    Write-Host "Executable not found at: $exePath"
    Write-Host "Please build the application first with: npm run tauri:build"
    exit 1
}

# Create shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $exePath
$Shortcut.WorkingDirectory = Split-Path $exePath
$Shortcut.Description = "Bobby's Secret Workshop - Professional Device Management Tool"
$Shortcut.IconLocation = $exePath
$Shortcut.Save()

Write-Host "Shortcut created at: $shortcutPath"
Write-Host "Application ready to launch!"
