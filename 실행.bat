@echo off
cd /d "%~dp0"

where node >nul 2>&1
if not errorlevel 1 (
    start "" /min cmd /c "node server.js"
    goto open
)

where python >nul 2>&1
if not errorlevel 1 (
    start "" /min cmd /c "python server.py"
    goto open
)

echo Node.js or Python is required.
pause
exit

:open
timeout /t 1 /nobreak >nul
start "" "http://localhost:8080"
