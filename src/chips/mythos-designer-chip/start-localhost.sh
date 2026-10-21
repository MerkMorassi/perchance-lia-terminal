#!/usr/bin/env bash
# MythOS Portable Localhost Runner
# Architecture: Mythos
# Standard: COMMPACK-MIL / Operational Bash Standard

set -e

echo "============================================================"
echo " MythOS Sovereign Engine - Localhost Testing Launch Routine"
echo "============================================================"

# 1. Verify Node.js Environment
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not detected in PATH. Install Node.js v18+ to proceed."
    exit 1
fi

NODE_VER=$(node -v)
echo "[INFO] Detected Node.js runtime: $NODE_VER"

# 2. Check for .env file
if [ ! -f ".env" ]; then
    echo "[INFO] No .env file detected. Creating .env from .env.example..."
    cp .env.example .env
    echo "[WARN] Please ensure GEMINI_API_KEY is configured inside .env if testing Gemini Live voice features."
fi

# 3. Check for dependencies
if [ ! -d "node_modules" ]; then
    echo "[INFO] node_modules directory missing. Running npm install..."
    npm install
fi

# 4. Check for Python Daemon Availability
if command -v python3 &> /dev/null; then
    echo "[INFO] Python 3 detected. You can optionally start the daemon in another terminal: python3 mythos_daemon.py"
elif command -v python &> /dev/null; then
    echo "[INFO] Python detected. You can optionally start the daemon in another terminal: python mythos_daemon.py"
fi

# 5. Build and Launch Server
echo "[INFO] Launching MythOS on http://localhost:3000..."
npm run dev
