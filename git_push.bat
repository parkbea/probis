@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo =============================================
echo   koFlow - Git Commit and Push
echo =============================================
echo.

git status --short
echo.

set /p MSG="Commit message: "

if "%MSG%"=="" (
  echo No message entered. Cancelled.
  pause
  exit
)

git add -A
git commit -m "%MSG%"

if %errorlevel% neq 0 (
  echo.
  echo Commit failed.
  pause
  exit
)

git push origin main

if %errorlevel% neq 0 (
  echo.
  echo Push failed.
  pause
  exit
)

echo.
echo Done! Pushed to GitHub.
timeout /t 2 /nobreak > nul
