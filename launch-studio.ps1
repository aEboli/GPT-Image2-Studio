param(
  [string]$Root = $PSScriptRoot,
  [int]$Port = 3600
)

$resolvedRoot = [System.IO.Path]::GetFullPath($Root)

function Get-StudioPortListener {
  param([int]$TargetPort)

  Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

function Test-StudioServer {
  param([int]$TargetPort)

  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$TargetPort/api/article-illustration/sets" -Method Get -UseBasicParsing -TimeoutSec 2
    return [int]$response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Find-StudioPort {
  param([int]$StartPort)

  for ($targetPort = $StartPort; $targetPort -lt ($StartPort + 50); $targetPort++) {
    $listener = Get-StudioPortListener -TargetPort $targetPort
    if (-not $listener) {
      return $targetPort
    }

    if (Test-StudioServer -TargetPort $targetPort) {
      return $targetPort
    }
  }

  throw "No available studio port found near $StartPort."
}

$targetPort = Find-StudioPort -StartPort $Port
$listener = Get-StudioPortListener -TargetPort $targetPort

if (-not $listener) {
  $command = "set PORT=$targetPort&& node server.mjs"
  Start-Process -FilePath "cmd.exe" -WorkingDirectory $resolvedRoot -ArgumentList "/k", $command | Out-Null

  $deadline = (Get-Date).AddSeconds(20)
  do {
    Start-Sleep -Milliseconds 500
    $listener = Get-StudioPortListener -TargetPort $targetPort
  } until ((Test-StudioServer -TargetPort $targetPort) -or (Get-Date) -gt $deadline)
}

if ($targetPort -ne $Port) {
  Write-Host "Port $Port is occupied by a different server. Opening current studio on port $targetPort."
}

Start-Process "http://localhost:$targetPort"

if (-not (Test-StudioServer -TargetPort $targetPort)) {
  Write-Host "Server startup timed out. Check the new console window."
}
