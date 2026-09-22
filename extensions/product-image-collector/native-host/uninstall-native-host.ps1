$ErrorActionPreference = "Stop"
#Requires -Version 7.4
Set-StrictMode -Version Latest
if (-not $IsWindows) { throw "此脚本需要 Windows 和 PowerShell 7.4 或更高版本。" }
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw "LOCALAPPDATA 未设置。" }

$hostName = "com.aeboli.gpt_image2_studio.product_image_clipboard"
$targetDir = Join-Path $env:LOCALAPPDATA "GPT-Image2-Studio\ProductImageClipboardHost"

foreach ($registryPath in @(
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName",
  "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
)) {
  if (Test-Path -LiteralPath $registryPath) {
    Remove-Item -LiteralPath $registryPath -Recurse -Force
  }
}

if (Test-Path -LiteralPath $targetDir) {
  Remove-Item -LiteralPath $targetDir -Recurse -Force
}

Write-Host "本地剪贴板助手已卸载。" -ForegroundColor Green
