@echo off
rem Double-click this to run the SDSI portal. Keep the window open while using the site.
setlocal
cd /d "%~dp0"
title SDSI Data Entry portal

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed, or Windows cannot find it.
  echo.
  echo   Install the LTS version from https://nodejs.org, accept the default
  echo   options, then close this window and double-click this file again.
  echo.
  pause
  exit /b 1
)

rem node:sqlite, which this site stores its data in, needs Node 22.13 or newer.
for /f "tokens=1,2 delims=v." %%a in ('node --version') do (
  set MAJOR=%%a
  set MINOR=%%b
)
if %MAJOR% LSS 22 goto :tooold
if %MAJOR% EQU 22 if %MINOR% LSS 13 goto :tooold

echo.
echo   Starting the SDSI portal. Leave this window open.
echo   To stop the site, close this window or press Ctrl+C.
echo.
node server.js
echo.
echo   The site has stopped.
pause
exit /b 0

:tooold
echo.
for /f %%v in ('node --version') do echo   This computer has Node %%v, but the site needs 22.13 or newer.
echo.
echo   Install the LTS version from https://nodejs.org, then double-click
echo   this file again.
echo.
pause
exit /b 1
