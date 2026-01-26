# Ingest third-party tool dumps into local-only bin directory
# This does NOT commit binaries; it copies them into:
#   %LOCALAPPDATA%\Bobbys-Workshop\tools\third_party\bin
#
# Usage (PowerShell):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ingest-third-party-tools.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

$LocalAppData = $env:LOCALAPPDATA
if (-not $LocalAppData) {
  throw "LOCALAPPDATA not set; cannot determine local tools directory."
}

$TargetBin = Join-Path $LocalAppData "Bobbys-Workshop\tools\third_party\bin"
New-Item -ItemType Directory -Force -Path $TargetBin | Out-Null

Write-Host "Target bin: $TargetBin" -ForegroundColor Cyan

# Candidate sources inside repo (you can add more)
$Candidates = @(
  # Canonical location (preferred)
  (Join-Path $RootDir "third_party\tool_dumps\15_Second_ADB_Installer_v1.5.6"),
  (Join-Path $RootDir "third_party\tool_dumps\SSH-Ramdisk-tool-master"),
  (Join-Path $RootDir "third_party\tool_dumps\ipwndfu-master"),

  # Legacy location (repo root)
  (Join-Path $RootDir "15_Second_ADB_Installer_v1.5.6"),
  (Join-Path $RootDir "SSH-Ramdisk-tool-master"),
  (Join-Path $RootDir "ipwndfu-master"),

  # Bundled helper binaries already in-repo (ex: libimobiledevice-win32 tools)
  (Join-Path $RootDir "files")
)

function Copy-IfExists($path) {
  if (-not (Test-Path $path)) { return }
  Write-Host "Scanning: $path" -ForegroundColor Gray
  Get-ChildItem -Path $path -Recurse -File | ForEach-Object {
    $ext = $_.Extension.ToLowerInvariant()
    if ($ext -in @(".exe",".dll",".bat",".cmd",".ps1",".py",".sh")) {
      $dest = Join-Path $TargetBin $_.Name
      Copy-Item -Force $_.FullName $dest
    }
  }
}

foreach ($c in $Candidates) { Copy-IfExists $c }

# Also ingest any loose binaries in repo root (user-managed)
Get-ChildItem -Path $RootDir -File | ForEach-Object {
  $ext = $_.Extension.ToLowerInvariant()
  if ($ext -in @(".exe",".dll")) {
    $dest = Join-Path $TargetBin $_.Name
    Copy-Item -Force $_.FullName $dest
  }
}

Write-Host "Ingest complete." -ForegroundColor Green
Write-Host "Next: restart the backend / rebuild bundle so tools are discoverable." -ForegroundColor Yellow

