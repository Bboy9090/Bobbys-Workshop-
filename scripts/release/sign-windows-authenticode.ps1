param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$ReceiptPath
)
$ErrorActionPreference = 'Stop'

foreach ($name in @('WINDOWS_SIGNING_PFX_BASE64','WINDOWS_SIGNING_PFX_PASSWORD','WINDOWS_SIGNING_CERT_THUMBPRINT')) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    throw "Missing required signing credential: $name"
  }
}
if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) { throw "Input artifact does not exist: $InputPath" }

$signtool = (Get-Command signtool.exe -ErrorAction Stop).Source
$tempPfx = Join-Path $env:RUNNER_TEMP "bobfwtools-signing-$PID.pfx"
try {
  [IO.File]::WriteAllBytes($tempPfx, [Convert]::FromBase64String($env:WINDOWS_SIGNING_PFX_BASE64))
  $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($tempPfx, $env:WINDOWS_SIGNING_PFX_PASSWORD)
  $expected = ($env:WINDOWS_SIGNING_CERT_THUMBPRINT -replace '[^A-Fa-f0-9]','').ToUpperInvariant()
  $actual = ($cert.Thumbprint -replace '[^A-Fa-f0-9]','').ToUpperInvariant()
  if ($expected -ne $actual) { throw "Signing certificate thumbprint mismatch" }
  if (-not $cert.HasPrivateKey) { throw "Signing certificate has no private key" }
  if ($cert.NotAfter -le [DateTime]::UtcNow) { throw "Signing certificate is expired" }

  & $signtool sign /fd SHA256 /f $tempPfx /p $env:WINDOWS_SIGNING_PFX_PASSWORD /tr 'http://timestamp.digicert.com' /td SHA256 $InputPath
  if ($LASTEXITCODE -ne 0) { throw "signtool sign failed with exit code $LASTEXITCODE" }
  & $signtool verify /pa /all /v $InputPath
  if ($LASTEXITCODE -ne 0) { throw "signtool verification failed with exit code $LASTEXITCODE" }

  $signature = Get-AuthenticodeSignature -LiteralPath $InputPath
  if ($signature.Status -ne 'Valid') { throw "Authenticode status is $($signature.Status), not Valid" }
  $digest = (Get-FileHash -LiteralPath $InputPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $receipt = [ordered]@{
    schema = 'com.bobbyblanco.bobfwtools.windows-authenticode.v1'
    artifact = [ordered]@{ name = [IO.Path]::GetFileName($InputPath); sha256 = $digest }
    signer = [ordered]@{ thumbprint = $actual; subject = $cert.Subject; notAfter = $cert.NotAfter.ToUniversalTime().ToString('o') }
    verification = [ordered]@{ authenticodeStatus = 'Valid'; signtoolVerified = $true }
    security = [ordered]@{ deviceWriteAuthorityGranted = $false; releasePromotionGranted = $false }
  }
  $receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ReceiptPath -Encoding utf8
} finally {
  Remove-Item -LiteralPath $tempPfx -Force -ErrorAction SilentlyContinue
}
