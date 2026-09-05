$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiPort = 3336
$clientPort = 5176

if ($env:PORT -match '^\d+$') {
  $apiPort = [int]$env:PORT
} elseif ($env:VITE_API_PORT -match '^\d+$') {
  $apiPort = [int]$env:VITE_API_PORT
}

if ($env:VITE_CLIENT_PORT -match '^\d+$') {
  $clientPort = [int]$env:VITE_CLIENT_PORT
}

$env:PORT = "$apiPort"
$env:VITE_API_PORT = "$apiPort"
$env:VITE_CLIENT_PORT = "$clientPort"
Write-Host "Requesting a supervised NewtNode restart..."
try {
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$apiPort/api/settings/restart" -ContentType "application/json" -Body '{}' -TimeoutSec 5 | Out-Null
} catch {
  # A busy API may not answer. Only signal this checkout's supervisor/watch process.
  & node (Join-Path $root "scripts\requestRestart.mjs")
  if ($LASTEXITCODE -ne 0) { throw "Could not request the NewtNode restart." }
}
Start-Sleep -Seconds 2

Write-Host "Restarting NewtNode..."
$appUrl = & (Join-Path $root "Launch_NewtNode.ps1")

try {
  $serverHealth = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$apiPort/api/health" -TimeoutSec 3
  if ($serverHealth.StatusCode -eq 200) {
    Write-Host "NewtNode API server is running at http://127.0.0.1:$apiPort"
  }
} catch {
  Write-Host "NewtNode API server did not respond on http://127.0.0.1:$apiPort"
}

if ($appUrl) {
  Write-Host "NewtNode browser app is running at $appUrl"
}
