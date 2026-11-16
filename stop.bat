@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Job Agent has not been set up here. Run start.bat first.
  exit /b 0
)
".venv\Scripts\python.exe" scripts\launch.py stop
if errorlevel 1 (
  pause
  exit /b 1
)
