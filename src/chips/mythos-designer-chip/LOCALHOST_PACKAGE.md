# MythOS Portable Localhost Package (VOXCONPACK)

## Technical Reference & Deployment Standard

**Status:** Operational Reference  
**Version:** 1.0  
**Architecture:** Mythos  
**Governance:** COMMPACK-MIL / The Sovereign Code Architect Protocol  
**Principle:** ALL SIGNAL. NO NOISE.™

---

## 1. Bottom Line Up Front (BLUF)

This package contains the complete full-stack configuration required to run, test, and develop MythOS on a local host workstation running Node.js, Express, and Python.

The server operates on port `3000` via Express and Vite middleware. The companion Python daemon operates on port `8000`.

---

## 2. Package Manifest

| File / Directory | Operational Function |
| :--- | :--- |
| `server.ts` | Express HTTP & WebSocket server, host asset router, and Gemini Live bridge. |
| `package.json` | Project dependencies, compiler scripts (`dev`, `build`, `start`, `lint`). |
| `mythos_daemon.py` | Standalone Python HTTP daemon bridge (zero-dependency, standard library). |
| `start-localhost.sh` | Automated Linux / macOS workstation launcher script. |
| `start-localhost.bat` | Automated Windows workstation launcher script. |
| `.env.example` | Environment variable template for API credentials. |
| `VOXCONPACK.md` | Architectural specification for Voice Command & Control. |
| `dist/server.cjs` | Bundled, standalone CommonJS production backend output. |

---

## 3. Workstation Prerequisites

The host machine must provide the following runtimes:

1. **Node.js**: Version 18.0.0 or higher (`node -v`).
2. **NPM**: Version 9.0.0 or higher (`npm -v`).
3. **Python (Optional for Python bridge)**: Version 3.9 or higher (`python --version` or `python3 --version`).

---

## 4. Quickstart Execution Routine

### Method A: Automated Workstation Launcher

#### Linux / macOS:
```bash
chmod +x start-localhost.sh mythos_daemon.py
./start-localhost.sh
```

#### Windows:
Double-click `start-localhost.bat` or execute in PowerShell / Command Prompt:
```cmd
start-localhost.bat
```

---

### Method B: Manual CLI Execution

#### Step 1: Install Dependencies
```bash
npm install
```

#### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate `GEMINI_API_KEY` inside `.env` to enable Gemini Live bidirectional voice interaction:
```env
GEMINI_API_KEY="your_api_key_here"
```

#### Step 3: Launch Local Node.js Express Server
For development mode (with hot TypeScript compilation):
```bash
npm run dev
```

For production compiled build:
```bash
npm run build
npm start
```
The application will be accessible at:
```
http://localhost:3000
```

#### Step 4: Launch Companion Python Bridge Daemon (Concurrent Terminal)
In a separate terminal window, start the local Python daemon:
```bash
python mythos_daemon.py
# or
python3 mythos_daemon.py
```
The daemon will acknowledge:
```
MythOS Python Bridge Daemon (VOXCONPACK)
Listening on http://127.0.0.1:8000
```

---

## 5. Localhost Verification & Test Procedures

### Test 1: Express Health & Host Diagnostic
Query the backend diagnostic endpoint:
```bash
curl http://localhost:3000/api/host/status
```
Expected output: JSON containing Node version, platform, architecture, Python version, and supported drive mappings.

### Test 2: Localhost Asset Ingestion (Drive Letters & Paths)
Test local disk asset retrieval:
```bash
curl "http://localhost:3000/api/host/asset?path=Z:/test.png"
```
- If the file exists on the host disk, the server returns base64 image data.
- If the file path is simulated or unmounted, the server generates and returns a tactical vector graphic schematic for display on the MSD canvas.

### Test 3: Python Execution Subprocess Bridge
Send an execution request through the Express bridge:
```bash
curl -X POST http://localhost:3000/api/host/execute-python \
  -H "Content-Type: application/json" \
  -d '{"script": "ingest_telemetry.py"}'
```
Expected output:
```json
{
  "success": true,
  "source": "python_local_daemon",
  "output": {
    "status": "success",
    "routine": "telemetry_ingestion",
    "metrics": {
      "warpCoreOutput": "1.21 GW",
      "fieldCoherence": 0.9985
    }
  }
}
```

### Test 4: Voice Transceiver WebSocket Verification
Open `http://localhost:3000` in Google Chrome or Microsoft Edge. Navigate to the **VOXCONPACK** module or engage the persistent microphone toggle in the header. Spoken commands will stream to the Node.js WebSocket router and trigger local dispatch events.
