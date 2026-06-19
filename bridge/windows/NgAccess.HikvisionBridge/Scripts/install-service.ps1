$ErrorActionPreference = "Stop"
$serviceName = "NgAccessHikvisionBridge"
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "ngsaccess-hikvision-bridge.exe"

if (-not (Test-Path $exe)) {
  throw "Bridge EXE not found: $exe"
}

if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
  Stop-Service -Name $serviceName -ErrorAction SilentlyContinue
  sc.exe delete $serviceName | Out-Null
  Start-Sleep -Seconds 2
}

New-Service -Name $serviceName -BinaryPathName "`"$exe`"" -DisplayName "NGS Access Hikvision Bridge" -StartupType Automatic
Start-Service -Name $serviceName
Get-Service -Name $serviceName
