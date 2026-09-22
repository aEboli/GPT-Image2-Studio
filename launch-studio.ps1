#Requires -Version 7.4
param(
  [string]$Root = $PSScriptRoot,
  [int]$Port = 3600
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if (-not $IsWindows) { throw "此脚本需要 Windows 和 PowerShell 7.4 或更高版本。" }
$resolvedRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Root)

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
  if (-not (Test-Path -LiteralPath (Join-Path $resolvedRoot "server.mjs") -PathType Leaf)) {
    throw "Studio server.mjs was not found in the requested root."
  }
  $nodePath = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
  $serverProcess = Start-Process -FilePath $nodePath -WorkingDirectory $resolvedRoot -ArgumentList "server.mjs" -Environment @{ PORT = [string]$targetPort; IMAGE_STUDIO_MOCK_IMAGE_GENERATION = $null } -WindowStyle Hidden -PassThru -ErrorAction Stop
  if ($null -eq $serverProcess) { throw "Unable to start the Studio server process." }

  $deadline = (Get-Date).AddSeconds(20)
  do {
    if ($serverProcess.HasExited) { throw "Studio server exited with code $($serverProcess.ExitCode)." }
    Start-Sleep -Milliseconds 500
  } until ((Test-StudioServer -TargetPort $targetPort) -or (Get-Date) -gt $deadline)
}

if ($targetPort -ne $Port) {
  Write-Host "Port $Port is occupied by a different server. Opening current studio on port $targetPort."
}

if (-not (Test-StudioServer -TargetPort $targetPort)) {
  throw "Server startup timed out. Check the Node.js runtime and server configuration."
}

Start-Process "http://localhost:$targetPort" -ErrorAction Stop
