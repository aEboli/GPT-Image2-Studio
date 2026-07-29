$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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
