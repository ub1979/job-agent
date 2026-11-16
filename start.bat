@echo off
setlocal
cd /d "%~dp0"
where uv >nul 2>&1
if errorlevel 1 (
  echo Install uv from https://docs.astral.sh/uv/getting-started/installation/
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22.12 or newer from https://nodejs.org/
  pause
  exit /b 1
)
uv sync --frozen --python 3.13
if errorlevel 1 goto fail
pushd web
if not exist node_modules (
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto webfail
)
call npm run build
if errorlevel 1 goto webfail
popd
set "JOB_AGENT_PORT=%~1"
if not defined JOB_AGENT_PORT set "JOB_AGENT_PORT=9210"
".venv\Scripts\python.exe" scripts\launch.py start "%JOB_AGENT_PORT%"
if errorlevel 1 goto fail
exit /b 0
:webfail
popd
:fail
echo Job Agent could not start. Review the error above.
pause
exit /b 1
