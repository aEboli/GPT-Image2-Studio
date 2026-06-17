@echo off
setlocal

set "ROOT=%~dp0"
set "SCRIPT=%ROOT%launch-studio.ps1"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Port 3600

endlocal
