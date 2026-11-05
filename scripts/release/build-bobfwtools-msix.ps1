param(
  [Parameter(Mandatory=$true)][string]$IdentityName,
  [Parameter(Mandatory=$true)][string]$Publisher,
  [Parameter(Mandatory=$true)][string]$PackageVersion,
  [Parameter(Mandatory=$true)][string]$ReleaseLabel,
  [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'

if ($IdentityName -notmatch '^[A-Za-z0-9.-]{3,50}$') { throw 'Partner Center identity name is invalid' }
if ([string]::IsNullOrWhiteSpace($Publisher)) { throw 'Partner Center publisher is required' }
if ($PackageVersion -notmatch '^(\d{1,5})\.(\d{1,5})\.(\d{1,5})\.(\d{1,5})$') { throw 'PackageVersion must be four numeric components' }
foreach ($part in $PackageVersion.Split('.')) {
  if ([int]$part -gt 65535) { throw 'PackageVersion components must be <= 65535' }
}
$SafeLabel = ($ReleaseLabel -replace '[^A-Za-z0-9._-]','-').Trim('-')
if ([string]::IsNullOrWhiteSpace($SafeLabel)) { throw 'ReleaseLabel produced an empty safe label' }
if ($SafeLabel.Length -gt 64) { $SafeLabel = $SafeLabel.Substring(0,64) }

$Exe = Resolve-Path 'src-tauri/target/release/bobfwtools.exe'
$Icon = Resolve-Path 'src-tauri/icons/128x128@2x.png'
$Out = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$Stage = Join-Path $env:RUNNER_TEMP "bobfwtools-msix-$PID"
New-Item -ItemType Directory -Force -Path $Stage | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Stage 'Assets') | Out-Null
Copy-Item -LiteralPath $Exe -Destination (Join-Path $Stage 'bobfwtools.exe')

Add-Type -AssemblyName System.Drawing
function Write-ResizedPng([string]$source,[string]$dest,[int]$w,[int]$h) {
  $src=[System.Drawing.Image]::FromFile($source)
  try {
    $bmp=New-Object System.Drawing.Bitmap($w,$h)
    try {
      $g=[System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($src,0,0,$w,$h)
      } finally { $g.Dispose() }
      $bmp.Save($dest,[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $bmp.Dispose() }
  } finally { $src.Dispose() }
}
Write-ResizedPng $Icon (Join-Path $Stage 'Assets\StoreLogo.png') 50 50
Write-ResizedPng $Icon (Join-Path $Stage 'Assets\Square44x44Logo.png') 44 44
Write-ResizedPng $Icon (Join-Path $Stage 'Assets\Square150x150Logo.png') 150 150
Write-ResizedPng $Icon (Join-Path $Stage 'Assets\Wide310x150Logo.png') 310 150

$IdentityEsc=[Security.SecurityElement]::Escape($IdentityName)
$PublisherEsc=[Security.SecurityElement]::Escape($Publisher)
$Manifest=@"
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
         xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
         xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
         xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
         IgnorableNamespaces="uap uap10 rescap">
  <Identity Name="$IdentityEsc" Publisher="$PublisherEsc" Version="$PackageVersion" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>BobFWTools</DisplayName>
    <PublisherDisplayName>Bobby's Workshop</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
    <Description>Authorized Android device diagnostics, USB/MTP transfer, ADB/Fastboot support, and repair workflows.</Description>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources><Resource Language="en-us" /></Resources>
  <Applications>
    <Application Id="BobFWTools"
                 Executable="bobfwtools.exe"
                 uap10:RuntimeBehavior="packagedClassicApp"
                 uap10:TrustLevel="mediumIL">
      <uap:VisualElements DisplayName="BobFWTools"
                          Description="Authorized Android device diagnostics and support tools."
                          BackgroundColor="transparent"
                          Square150x150Logo="Assets\Square150x150Logo.png"
                          Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile Wide310x150Logo="Assets\Wide310x150Logo.png" />
      </uap:VisualElements>
    </Application>
  </Applications>
  <Capabilities>
    <Capability Name="internetClient" />
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
"@
Set-Content -LiteralPath (Join-Path $Stage 'AppxManifest.xml') -Value $Manifest -Encoding utf8

$MakeAppx=(Get-Command makeappx.exe -ErrorAction SilentlyContinue).Source
if (-not $MakeAppx) {
  $sdkRoot=Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'Windows Kits\10\bin'
  $candidate=Get-ChildItem $sdkRoot -Filter makeappx.exe -Recurse -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
  if (-not $candidate) { throw 'makeappx.exe was not found' }
  $MakeAppx=$candidate.FullName
}
$Msix=Join-Path $Out "BobFWTools-$SafeLabel-x64.msix"
& $MakeAppx pack /d $Stage /p $Msix /o
if ($LASTEXITCODE -ne 0) { throw "makeappx failed with exit code $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $Msix -PathType Leaf)) { throw 'MSIX package was not created' }

$Digest=(Get-FileHash -LiteralPath $Msix -Algorithm SHA256).Hash.ToLowerInvariant()
$Receipt=[ordered]@{
  schema='com.bobbyblanco.bobfwtools.microsoft-store-msix.v1'
  product='BobFWTools'
  distribution='microsoft-store'
  sourceRevision=$env:GITHUB_SHA
  identityName=$IdentityName
  publisher=$Publisher
  packageVersion=$PackageVersion
  package=[ordered]@{ name=[IO.Path]::GetFileName($Msix); sha256=$Digest; signed=$false }
  appxManifestValidated=$true
  storeUploaded=$false
  storeReviewApproved=$false
  deviceWriteAuthorityGranted=$false
}
$Receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Out 'MSIX-BUILD-RECEIPT.json') -Encoding utf8
