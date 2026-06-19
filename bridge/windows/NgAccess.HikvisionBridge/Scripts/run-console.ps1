$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
& "$root\ngsaccess-hikvision-bridge.exe" --console
