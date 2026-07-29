$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$hostName = "com.aeboli.gpt_image2_studio.product_image_clipboard"
$extensionId = "gbdkgkooddcicpkikaklapgeakhjjcan"
$allowedOrigin = "chrome-extension://gbdkgkooddcicpkikaklapgeakhjjcan/"
$sourceExe = Join-Path $PSScriptRoot "ProductImageClipboardHost.exe"
$targetDir = Join-Path $env:LOCALAPPDATA "GPT-Image2-Studio\ProductImageClipboardHost"
$targetExe = Join-Path $targetDir "ProductImageClipboardHost.exe"
$manifestPath = Join-Path $targetDir "$hostName.json"

if (-not (Test-Path -LiteralPath $sourceExe -PathType Leaf)) {
  throw "安装包缺少 ProductImageClipboardHost.exe，请重新下载完整插件包。"
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Copy-Item -LiteralPath $sourceExe -Destination $targetExe -Force

$manifest = [ordered]@{
  name = $hostName
  description = "GPT-Image2-Studio 商品图多文件剪贴板助手"
  path = $targetExe
  type = "stdio"
  allowed_origins = @($allowedOrigin)
} | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($manifestPath, $manifest, [System.Text.UTF8Encoding]::new($false))

foreach ($registryPath in @(
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName",
  "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
)) {
  New-Item -Path $registryPath -Force | Out-Null
  Set-Item -Path $registryPath -Value $manifestPath
}

Write-Host "本地剪贴板助手安装成功。" -ForegroundColor Green
Write-Host "扩展 ID：$extensionId"
Write-Host "无需启动或打开 Studio，重新点击插件中的“复制图片”即可。"
