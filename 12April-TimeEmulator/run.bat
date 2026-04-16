@echo off
echo ===================================================
echo Time Emulator - Local Runner
echo ===================================================
echo.

echo Checking for existing processes on port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| find ":3001 ^| FINDING:*"') do (
    echo Terminating process %%a running on port 3001...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Installing dependencies...
call npm install

echo.
echo Starting development server...
echo Note: If using Ollama, ensure OLLAMA_ORIGINS="*" is set in your environment
echo so the browser can connect to the local Ollama API.
echo.
call npm run dev

pause
