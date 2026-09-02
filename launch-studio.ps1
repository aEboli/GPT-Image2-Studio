param(
  [string]$Root = $PSScriptRoot,
  [int]$Port = 3600
)

$resolvedRoot = [System.IO.Path]::GetFullPath($Root)

# The mock image generator is test-only. Do not let a stale parent-process
# variable turn a normal desktop launch into a white 1x1 image producer.
Remove-Item Env:IMAGE_STUDIO_MOCK_IMAGE_GENERATION -ErrorAction SilentlyContinue

function Get-ListeningLocalPorts {
  $ports = [System.Collections.Generic.HashSet[int]]::new()
  $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()

  foreach ($listener in $listeners) {
    [void]$ports.Add([int]$listener.Port)
  }

  Write-Output -NoEnumerate $ports
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
  param(
    [int]$StartPort,
    [System.Collections.Generic.HashSet[int]]$ListeningPorts
  )

  for ($targetPort = $StartPort; $targetPort -lt ($StartPort + 50); $targetPort++) {
    if (-not $ListeningPorts.Contains($targetPort)) {
      return $targetPort
    }

    if (Test-StudioServer -TargetPort $targetPort) {
      return $targetPort
    }
  }

  throw "No available studio port found near $StartPort."
}

$listeningPorts = Get-ListeningLocalPorts
$targetPort = Find-StudioPort -StartPort $Port -ListeningPorts $listeningPorts
$targetPortInUse = $listeningPorts.Contains($targetPort)

if (-not $targetPortInUse) {
  $command = "set IMAGE_STUDIO_MOCK_IMAGE_GENERATION=&& set PORT=$targetPort&& node server.mjs"
  Start-Process -FilePath "cmd.exe" -WorkingDirectory $resolvedRoot -ArgumentList "/k", $command | Out-Null

  $deadline = (Get-Date).AddSeconds(20)
  do {
    Start-Sleep -Milliseconds 500
  } until ((Test-StudioServer -TargetPort $targetPort) -or (Get-Date) -gt $deadline)
}

if ($targetPort -ne $Port) {
  Write-Host "Port $Port is occupied by a different server. Opening current studio on port $targetPort."
}

Start-Process "http://localhost:$targetPort"

if (-not (Test-StudioServer -TargetPort $targetPort)) {
  Write-Host "Server startup timed out. Check the new console window."
}
