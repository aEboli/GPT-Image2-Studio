@echo off
chcp 65001 >nul
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-native-host.ps1"
if errorlevel 1 (
  echo.
  echo 本地剪贴板助手卸载失败，请保留此窗口中的错误信息。
  pause
  exit /b 1
)
echo.
pause
