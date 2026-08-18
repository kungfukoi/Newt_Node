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

Set-Location $root
$env:PORT = "$apiPort"
$env:VITE_API_PORT = "$apiPort"
$env:VITE_CLIENT_PORT = "$clientPort"
$appUrl = "http://127.0.0.1:$clientPort/"
$apiHealthUrl = "http://127.0.0.1:$apiPort/api/health"

Write-Host "Checking NewtNode dependencies..."
& node (Join-Path $root "scripts\ensureDependencies.mjs")
if ($LASTEXITCODE -ne 0) { throw "NewtNode dependency installation failed." }

$distIndex = Join-Path $root "dist\index.html"
$sourcePaths = @(
  (Join-Path $root "src"),
  (Join-Path $root "public"),
  (Join-Path $root "index.html"),
  (Join-Path $root "vite.config.js"),
  (Join-Path $root "package.json")
)
$buildRequired = -not (Test-Path -LiteralPath $distIndex)
if (-not $buildRequired) {
  $builtAt = (Get-Item -LiteralPath $distIndex).LastWriteTimeUtc
  foreach ($sourcePath in $sourcePaths) {
    if (-not (Test-Path -LiteralPath $sourcePath)) { continue }
    $newerSource = Get-ChildItem -LiteralPath $sourcePath -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTimeUtc -gt $builtAt } |
      Select-Object -First 1
    if ($newerSource) {
      $buildRequired = $true
      break
    }
  }
}

if ($buildRequired) {
  Write-Host "Building the optimized NewtNode client..."
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "NewtNode client build failed." }
}

try {
  Invoke-WebRequest -UseBasicParsing -Uri $apiHealthUrl -TimeoutSec 1 | Out-Null
  Write-Host "NewtNode server is already running on port $apiPort."
} catch {
  Write-Host "Starting NewtNode server on port $apiPort..."
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "server") -WorkingDirectory $root -WindowStyle Minimized
}

Write-Host "Waiting for the NewtNode API..."
$apiReady = $false
$apiDeadline = (Get-Date).AddSeconds(20)
while (-not $apiReady -and (Get-Date) -lt $apiDeadline) {
  try {
    $apiResponse = Invoke-WebRequest -UseBasicParsing -Uri $apiHealthUrl -TimeoutSec 1
    $apiReady = $apiResponse.StatusCode -eq 200
  } catch {
    Start-Sleep -Milliseconds 250
  }
}

if (-not $apiReady) {
  Write-Host "Could not start the NewtNode API at $apiHealthUrl"
  Write-Host "The client will not open without a healthy API server."
  Read-Host "Press Enter to close"
  exit 1
}

try {
  Invoke-WebRequest -UseBasicParsing -Uri $appUrl -TimeoutSec 1 | Out-Null
  Write-Host "NewtNode client is already running."
} catch {
  Write-Host "Starting the optimized NewtNode client on port $clientPort..."
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "preview", "--", "--port", "$clientPort", "--strictPort") -WorkingDirectory $root -WindowStyle Minimized
}

Write-Host "Waiting for NewtNode..."
$appReady = $false
$deadline = (Get-Date).AddSeconds(20)
while (-not $appReady -and (Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $appUrl -TimeoutSec 1
    $appReady = $response.StatusCode -eq 200
  } catch {
    Start-Sleep -Milliseconds 250
  }
}

if (-not $appReady) {
  Write-Host "Could not start the optimized NewtNode app at $appUrl"
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
