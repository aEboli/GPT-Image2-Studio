@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PORTS=%*"
if "%PORTS%"=="" set "PORTS=3600 3601 3602 3603 3604 3605 3606"

echo Closing local Image Studio services on ports: %PORTS%
set "FOUND=0"

for %%P in (%PORTS%) do (
  call :STOP_PORT "%%~P"
)

echo.
if "%FOUND%"=="0" (
  echo No matching listening services found.
) else (
  echo Done.
)

exit /b 0

:STOP_PORT
set "TARGET_PORT=%~1"
set "PORT_FOUND=0"
echo.
echo Checking port %TARGET_PORT%...

for /f "tokens=5" %%A in ('netstat -ano -p tcp ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
  set "PID=%%A"
  if not "!PID!"=="" (
    set "FOUND=1"
    set "PORT_FOUND=1"
    echo Stopping PID !PID! on port %TARGET_PORT%...
    taskkill /PID !PID! /T /F >nul 2>&1
    if errorlevel 1 (
      echo Failed to stop PID !PID!. Try running this file as Administrator.
    ) else (
      echo Stopped PID !PID!.
    )
  )
)

if "%PORT_FOUND%"=="0" echo No listener on port %TARGET_PORT%.
exit /b 0
