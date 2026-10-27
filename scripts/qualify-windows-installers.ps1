param([Parameter(Mandatory=$true)][string]$MsiPath,[Parameter(Mandatory=$true)][string]$NsisPath,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
if (-not $env:GITHUB_ACTIONS -or $env:RUNNER_OS -ne 'Windows') { throw 'Disposable Windows CI runner required' }
$msiCopy = Join-Path $OutputDirectory 'msi-copy'
$nsisCopy = Join-Path $OutputDirectory 'nsis-copy'
if ((Test-Path $msiCopy) -or (Test-Path $nsisCopy)) { throw 'Installer copy destinations must be new' }
New-Item -ItemType Directory -Path $msiCopy | Out-Null
$msi = Start-Process msiexec.exe -ArgumentList @('/a', ('"'+$MsiPath+'"'),'/qn',('TARGETDIR="'+$msiCopy+'"'),'/L*v',('"'+(Join-Path $OutputDirectory 'msi-extract.log')+'"')) -Wait -PassThru
if ($msi.ExitCode -ne 0) { throw "MSI extraction failed: $($msi.ExitCode)" }
$msiExecutables = @(Get-ChildItem $msiCopy -Filter bobfwtools.exe -File -Recurse)
if ($msiExecutables.Count -ne 1) { throw 'Expected one MSI-copied application' }
$installer = Start-Process -FilePath $NsisPath -ArgumentList @('/S',('/D='+$nsisCopy)) -PassThru
if (-not $installer.WaitForExit(120000)) { throw 'NSIS installation exceeded deadline' }
if ($installer.ExitCode -ne 0) { throw "NSIS installation failed: $($installer.ExitCode)" }
$executable = Join-Path $nsisCopy 'bobfwtools.exe'
if (-not (Test-Path $executable -PathType Leaf)) { throw 'NSIS-copied application missing' }
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$app = Start-Process -FilePath $executable -PassThru
try {
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  $names = @()
  $webViewObserved = $false
  while ([DateTime]::UtcNow -lt $deadline) {
    if ($app.HasExited) { throw "Native app exited early: $($app.ExitCode)" }
    $app.Refresh()
    if ($app.MainWindowHandle -ne 0) {
      $window = [System.Windows.Automation.AutomationElement]::FromHandle($app.MainWindowHandle)
      $elements = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
      $names = @($elements | ForEach-Object { $_.Current.Name } | Where-Object { $_ })
      $webViewObserved = @($names | Where-Object { $_ -like '*Web content' }).Count -gt 0
      if ($webViewObserved -and $app.MainWindowTitle -like 'BobFWTools*') { break }
    }
    Start-Sleep -Milliseconds 500
  }
  # Hosted WebView2 currently exposes the native window + web-content boundary
  # through UIAutomation, but not the rendered DOM descendants. Do not invent a
  # completed device scan from an inaccessible subtree. Record that separately
  # and keep public release/device authority false.
  $scanComplete = $names -contains 'Device checks complete'
  $hostStorageAsPhone = ($names -contains 'Connected phones') -or ($names -contains 'MTP connection observed')
  $titleObserved = $app.MainWindowTitle -like 'BobFWTools*'
  $passed = $titleObserved -and $webViewObserved -and (-not $hostStorageAsPhone)
  $receipt = @{status=$(if($passed){'PASS'}else{'FAIL'});observedAt=[DateTime]::UtcNow.ToString('o');scope='Windows CI native WebView2 GUI and isolated installer copies';title=$app.MainWindowTitle;navigationNames=$names;nativeWebViewObserved=$webViewObserved;deviceScanComplete=$scanComplete;noPhoneOnDisposableRunner=(-not $hostStorageAsPhone);hardwareQualified=$false;releaseQualified=$false;executionAuthorized=$false;executables=@(@{location='msi-copy';path=$msiExecutables[0].FullName},@{location='nsis-copy';path=$executable})}
  $receipt | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $OutputDirectory 'native-smoke.json')
  Write-Output ('NATIVE_GUI_EVIDENCE ' + ($receipt | ConvertTo-Json -Depth 8 -Compress))
  if (-not $passed) { throw 'Native WebView2 launch/accessibility boundary failed or host storage was exposed as a phone' }
} finally {
  if (-not $app.HasExited) {
    $null = $app.CloseMainWindow()
    if (-not $app.WaitForExit(10000)) { Stop-Process -Id $app.Id }
  }
}
