# Serula Nesting Pro PC: self-contained Windows bridge installer (no download).
# Installed by the PC application on first run and reused at each Windows sign-in.
param([switch]$VerboseLog)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$root=Join-Path $env:LOCALAPPDATA 'SerulaBridge'
$src=Join-Path $PSScriptRoot 'SerulaTransferBridge.ps1'
$dst=Join-Path $root 'SerulaTransferBridge.ps1'
$startup=Join-Path ([Environment]::GetFolderPath('Startup')) 'Serula Bridge.lnk'
$endpoint='http://127.0.0.1:43842/health'
$prefix='http://127.0.0.1:43842/'
$version='1.4'
[IO.Directory]::CreateDirectory($root)|Out-Null
function Log([string]$message) {
  $line='['+(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')+'] '+$message
  Add-Content -LiteralPath (Join-Path $root 'installation.log') -Value $line -Encoding UTF8
  if($VerboseLog){Write-Host $line}
}
function IsHealthy {
  try{
    $r=Invoke-RestMethod -Uri $endpoint -TimeoutSec 2
    return ($r.ok -eq $true -and $r.service -eq 'serula-bridge' -and [version]$r.version -ge [version]$version)
  }catch{return $false}
}
function OwnBridgeProcess {
  $session=(Get-Process -Id $PID).SessionId
  @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.SessionId -eq $session -and $_.CommandLine -and
      ($_.CommandLine.IndexOf($dst,[StringComparison]::OrdinalIgnoreCase) -ge 0) })
}
$mutex=[System.Threading.Mutex]::new($false,'Local\SerulaBridgeBundledSetup')
$acquired=$false
try{
  $acquired=$mutex.WaitOne(15000)
  if(-not $acquired){throw 'Another Serula installer is already running.'}
  if(!(Test-Path -LiteralPath $src -PathType Leaf)){throw 'Bundled bridge source is missing.'}
  $changed=(!(Test-Path -LiteralPath $dst)) -or
    ((Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash)
  # A bundled installer must never downgrade a newer bridge that was
  # installed independently (including after a later application update).
  if(Test-Path -LiteralPath $dst -PathType Leaf){
    $installedText=Get-Content -LiteralPath $dst -Raw -ErrorAction SilentlyContinue
    if($installedText -match "service='serula-bridge';version='([0-9]+\.[0-9]+)'"){
      if([version]$matches[1] -gt [version]$version){$changed=$false}
    }
  }
  if($changed) {
    foreach($old in @(OwnBridgeProcess)){
      Log ('Replacing previous bridge PID: '+$old.ProcessId)
      Stop-Process -Id $old.ProcessId -Force -ErrorAction Stop
    }
    Start-Sleep -Milliseconds 450
    Copy-Item -LiteralPath $src -Destination $dst -Force
    Log 'Bundled bridge source installed.'
  }
  if(-not (IsHealthy)){
    & netsh.exe http show urlacl "url=$prefix" *> $null
    if($LASTEXITCODE -ne 0){
      # URLACL is limited to the current Windows SID, not the whole network.
      $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
      if($sid -notmatch '^S-1-[0-9-]+$'){throw 'Windows user identity could not be resolved.'}
      $command="& netsh.exe http add urlacl url=$prefix 'sddl=D:(A;;GX;;;$sid)'"
      $command+='; exit $LASTEXITCODE'
      $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
      Log 'Asking for one-time Windows localhost access permission.'
      $process=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -Verb RunAs -ArgumentList @('-NoProfile','-EncodedCommand',$encoded) -Wait -PassThru
      if($process.ExitCode -ne 0){throw 'Windows administrator permission was declined or localhost setup failed.'}
    }
    # If an old bridge remains on the port, stop only this user's matching process.
    foreach($old in @(OwnBridgeProcess)){
      Log ('Restarting previous bridge PID: '+$old.ProcessId)
      Stop-Process -Id $old.ProcessId -Force
    }
    Start-Sleep -Milliseconds 350
    $arguments='-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$dst+'"'
    $child=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -WindowStyle Hidden -PassThru
    for($i=0;$i -lt 35;$i++){
      Start-Sleep -Milliseconds 250
      if(IsHealthy){break}
      if($child.HasExited){break}
    }
    if(-not (IsHealthy)){throw 'Bridge could not listen on 127.0.0.1:43842. See the log and URLACL settings.'}
  }
  $sc=(New-Object -ComObject WScript.Shell).CreateShortcut($startup)
  $sc.TargetPath=Join-Path $PSHOME 'powershell.exe'
  $sc.Arguments='-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$dst+'"'
  $sc.WorkingDirectory=$root
  $sc.WindowStyle=7
  $sc.Description='Serula CorelDRAW / RDWorks local transfer'
  $sc.Save()
  Log "Serula Bridge $version is ready. Starts with Windows."
}catch{
  Log ('INSTALL FAILED: '+$_.Exception.Message)
  throw
}finally{
  if($acquired){$mutex.ReleaseMutex() | Out-Null}
  $mutex.Dispose()
}
