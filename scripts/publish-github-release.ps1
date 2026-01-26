# Publish GitHub Release Script
# Creates a GitHub release with installer artifacts

param(
    [string]$Tag = "v3.0.0",
    [string]$Title = "v3.0.0 - Major Release with BootForge USB Hardening",
    [string]$NotesFile = "RELEASE_NOTES_v3.0.0.md",
    [string]$ArtifactsDir = "dist",
    [string]$Repo = "Bboy9090/Bobbys-Workshop-"
)

$ErrorActionPreference = "Stop"

Write-Host "Publishing GitHub Release: $Tag" -ForegroundColor Cyan
Write-Host ""

# Check for GitHub token
$token = $env:GITHUB_TOKEN
if (-not $token) {
    Write-Host "ERROR: GITHUB_TOKEN environment variable not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "To create a GitHub token:" -ForegroundColor Yellow
    Write-Host "1. Go to https://github.com/settings/tokens" -ForegroundColor Gray
    Write-Host "2. Generate new token (classic) with 'repo' scope" -ForegroundColor Gray
    Write-Host "3. Set environment variable: `$env:GITHUB_TOKEN = 'your-token'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or create release manually at:" -ForegroundColor Yellow
    Write-Host "https://github.com/$Repo/releases/new" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Tag: $Tag" -ForegroundColor Cyan
    Write-Host "Title: $Title" -ForegroundColor Cyan
    Write-Host "Attach files from: $ArtifactsDir" -ForegroundColor Cyan
    exit 1
}

# Read release notes
if (-not (Test-Path $NotesFile)) {
    Write-Host "ERROR: Release notes file not found: $NotesFile" -ForegroundColor Red
    exit 1
}
$notes = Get-Content $NotesFile -Raw

# Get artifact files
$artifacts = @()
if (Test-Path $ArtifactsDir) {
    $installerFiles = Get-ChildItem -Path $ArtifactsDir -File | Where-Object {
        $_.Name -like "*setup.exe" -or 
        $_.Name -like "*.msi" -or 
        $_.Name -like "*.exe" -and $_.Name -notlike "*setup.exe"
    }
    foreach ($file in $installerFiles) {
        $artifacts += $file.FullName
        Write-Host "Found artifact: $($file.Name) ($([math]::Round($file.Length / 1MB, 2)) MB)" -ForegroundColor Gray
    }
}

if ($artifacts.Count -eq 0) {
    Write-Host "WARNING: No installer artifacts found in $ArtifactsDir" -ForegroundColor Yellow
    Write-Host "Continuing with release creation (no files attached)" -ForegroundColor Yellow
}

# Create release via GitHub API
Write-Host ""
Write-Host "Creating GitHub release..." -ForegroundColor Yellow

$releaseBody = @{
    tag_name = $Tag
    name = $Title
    body = $notes
    draft = $false
    prerelease = $false
} | ConvertTo-Json

$headers = @{
    "Authorization" = "token $token"
    "Accept" = "application/vnd.github.v3+json"
}

try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases" `
        -Method Post `
        -Headers $headers `
        -Body $releaseBody `
        -ContentType "application/json"
    
    $releaseId = $response.id
    $uploadUrl = $response.upload_url -replace '\{\?name,label\}', ''
    
    Write-Host "Release created successfully!" -ForegroundColor Green
    Write-Host "Release URL: $($response.html_url)" -ForegroundColor Cyan
    Write-Host ""
    
    # Upload artifacts
    if ($artifacts.Count -gt 0) {
        Write-Host "Uploading artifacts..." -ForegroundColor Yellow
        foreach ($artifact in $artifacts) {
            $fileName = Split-Path $artifact -Leaf
            $fileBytes = [System.IO.File]::ReadAllBytes($artifact)
            $fileEnc = [System.Text.Encoding]::GetEncoding("ISO-8859-1").GetString($fileBytes)
            $boundary = [System.Guid]::NewGuid().ToString()
            $LF = "`r`n"
            
            $bodyLines = (
                "--$boundary",
                "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
                "Content-Type: application/octet-stream$LF",
                $fileEnc,
                "--$boundary--"
            ) -join $LF
            
            $uploadHeaders = @{
                "Authorization" = "token $token"
                "Accept" = "application/vnd.github.v3+json"
                "Content-Type" = "multipart/form-data; boundary=$boundary"
            }
            
            try {
                $uploadResponse = Invoke-RestMethod -Uri "$uploadUrl?name=$fileName" `
                    -Method Post `
                    -Headers $uploadHeaders `
                    -Body ([System.Text.Encoding]::GetEncoding("ISO-8859-1").GetBytes($bodyLines))
                
                Write-Host "  Uploaded: $fileName" -ForegroundColor Green
            } catch {
                Write-Host "  Failed to upload: $fileName" -ForegroundColor Red
                Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "Release published successfully!" -ForegroundColor Green
    Write-Host "View at: $($response.html_url)" -ForegroundColor Cyan
    
} catch {
    Write-Host "ERROR: Failed to create release" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "You can create the release manually at:" -ForegroundColor Yellow
    Write-Host "https://github.com/$Repo/releases/new" -ForegroundColor Cyan
    exit 1
}
