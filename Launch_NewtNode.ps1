$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$clientLog = Join-Path $env:TEMP "newtnode-vite-client.log"
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

Set-Location $root
Remove-Item -LiteralPath $clientLog -Force -ErrorAction SilentlyContinue
$env:PORT = "$apiPort"
$env:VITE_API_PORT = "$apiPort"
$env:VITE_CLIENT_PORT = "$clientPort"

function Test-NewtNodeUrl($url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1
    return $response.StatusCode -eq 200 -and $response.Content -match "NewtNode|/src/main\.jsx|id=`"root`""
  } catch {
    return $false
  }
}

function Find-NewtNodeUrl {
  foreach ($port in $clientPort..($clientPort + 23)) {
    $url = "http://127.0.0.1:$port/"
    if (Test-NewtNodeUrl $url) {
      return $url
    }
  }

  return $null
}

try {
  Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$apiPort/api/health" -TimeoutSec 1 | Out-Null
  Write-Host "NewtNode server is already running on port $apiPort."
} catch {
  Write-Host "Starting NewtNode server on port $apiPort..."
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "server") -WorkingDirectory $root -WindowStyle Minimized
}

$appUrl = Find-NewtNodeUrl

if ($appUrl) {
  Write-Host "NewtNode client is already running at $appUrl"
} else {
  Write-Host "Starting NewtNode client on port $clientPort..."
  $clientCommand = "npm run client > `"$clientLog`" 2>&1"
  Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $clientCommand) -WorkingDirectory $root -WindowStyle Minimized

  Write-Host "Detecting Vite port..."
  $deadline = (Get-Date).AddSeconds(20)

  while (-not $appUrl -and (Get-Date) -lt $deadline) {
    $appUrl = Find-NewtNodeUrl

    if (-not $appUrl -and (Test-Path -LiteralPath $clientLog)) {
      $clientOutput = Get-Content -LiteralPath $clientLog -Raw
      if ($clientOutput -match "error|failed|EADDRINUSE") {
        break
      }
    }

    if (-not $appUrl) {
      Start-Sleep -Milliseconds 250
    }
  }
}

if (-not $appUrl) {
  Write-Host "Could not detect the Vite app URL."
  Write-Host "Client log: $clientLog"
  if (Test-Path -LiteralPath $clientLog) {
    Get-Content -LiteralPath $clientLog
  }
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host "NewtNode is running at $appUrl"
Write-Host "Opening browser window..."

$browserPaths = @(
  (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe")
)

$browser = $browserPaths | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

if ($browser) {
  Start-Process -FilePath $browser -ArgumentList @("--new-window", "--app=$appUrl")
} else {
  Start-Process $appUrl
}

return $appUrl
