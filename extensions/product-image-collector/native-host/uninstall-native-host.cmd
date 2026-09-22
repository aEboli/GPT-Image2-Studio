@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
set "SCRIPT=%~dp0uninstall-native-host.ps1"
if not exist "%SCRIPT%" (
  echo Error: script was not found: "%SCRIPT%"
  exit /b 2
)
where pwsh.exe >nul 2>nul
if errorlevel 1 (
  echo Error: install PowerShell 7.4 or newer from https://aka.ms/powershell.
  exit /b 9009
)
pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" echo Error: Studio script failed with exit code %EXIT_CODE%.
pause
endlocal & exit /b %EXIT_CODE%
