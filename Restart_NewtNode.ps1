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
$ports = @($apiPort) + ($clientPort..($clientPort + 23))
$processIds = New-Object System.Collections.Generic.HashSet[int]

Write-Host "Stopping NewtNode server/client processes on API port $apiPort and client ports $clientPort-$($clientPort + 23)..."

foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    if ($connection.OwningProcess -and $connection.OwningProcess -ne 0) {
      [void]$processIds.Add([int]$connection.OwningProcess)
    }
  }
}

foreach ($processId in $processIds) {
  try {
    $process = Get-Process -Id $processId -ErrorAction Stop
    Write-Host "Stopping PID $processId ($($process.ProcessName))"
    Stop-Process -Id $processId -Force -ErrorAction Stop
  } catch {
    Write-Host "PID $processId already stopped."
  }
}

Start-Sleep -Seconds 1

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
