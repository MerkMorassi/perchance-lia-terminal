@echo off
REM MythOS Portable Localhost Runner (Windows)
REM Architecture: Mythos

echo ============================================================
echo  MythOS Sovereign Engine - Windows Localhost Launch Routine
echo ============================================================

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in PATH. Install Node.js v18+ from https://nodejs.org/
    pause
    exit /b 1
)

if not exist ".env" (
    echo [INFO] No .env found. Creating .env from .env.example...
    copy .env.example .env >nul
    echo [WARN] Open .env and set GEMINI_API_KEY if testing Gemini Live voice features.
)

if not exist "node_modules" (
    echo [INFO] Installing npm dependencies...
    call npm install
)

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [INFO] Python detected on host.
    echo [INFO] To run the Python daemon bridge concurrently, execute: start python mythos_daemon.py
)

echo [INFO] Starting MythOS Node.js Express server on http://localhost:3000...
call npm run dev
pause
