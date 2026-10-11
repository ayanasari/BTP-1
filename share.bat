@echo off
rem Double-click this to put the SDSI portal on the internet for a while.
rem It starts the site in one window, then opens a public web address that
rem anyone can use. Closing either window takes the site back offline.
setlocal
cd /d "%~dp0"
title SDSI portal - public address

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed. Install the LTS version from
  echo   https://nodejs.org, then run this again.
  echo.
  pause
  exit /b 1
)

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo.
  echo   cloudflared is not installed. It is the piece that gives your
  echo   laptop a public web address.
  echo.
  echo   Install it by running this line in PowerShell:
  echo.
  echo       winget install -e --id Cloudflare.cloudflared
  echo.
  echo   Then CLOSE PowerShell, open it again, and run this file once more.
  echo.
  pause
  exit /b 1
)

rem Marks the session cookie Secure. Correct for the public address, and
rem harmless on localhost, which browsers already treat as secure.
set "HTTPS=1"

echo.
echo   Starting the site...
rem If a server window is already open from last time, this one exits straight
rem away saying the port is in use - which is harmless, the first one still serves.
start "SDSI portal server" cmd /k node server.js

rem Wait for the server to answer before opening it to the world. No pipes in here:
rem cmd passes them through to PowerShell unevenly from inside a quoted string.
powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 40;$i++){ try{ $null = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:4000/login.html' -TimeoutSec 2; $ok=$true; break } catch { Start-Sleep -Milliseconds 500 } }; if(-not $ok){ exit 1 }"
if errorlevel 1 (
  echo.
  echo   Could not confirm the site is up. If the other window titled
  echo   "SDSI portal server" shows an error, fix that first. Otherwise
  echo   this is just the check being unreliable - carrying on anyway.
  echo.
)

echo   The site is running on this computer.
echo.
echo   ============================================================
echo    Opening a public address. Look for the box below: the line
echo    ending in trycloudflare.com is the link to share.
echo.
echo    It is a NEW address every time you run this.
echo    Keep BOTH windows open while people are using the site.
echo   ============================================================
echo.

cloudflared tunnel --url http://localhost:4000

echo.
echo   The public address has closed. The site is offline for everyone
echo   else, but still running on this computer at http://localhost:4000
echo.
pause
