#!/usr/bin/env python3
"""
MythOS Localhost Python Daemon Bridge (VOXCONPACK Companion)
Architecture: Mythos
Status: Operational Daemon
Port: 8000 (binds to 127.0.0.1)

Provides the local Python execution server for VOXCONPACK and Express backend.
Uses standard Python library (zero external pip dependencies required).
"""

import sys
import os
import json
import time
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

HOST = "127.0.0.1"
PORT = 8000
START_TIME = time.time()

class MythosDaemonHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code, payload):
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path in ("/", "/api/health", "/health"):
            self._send_json(200, {
                "status": "online",
                "daemon": "MythOS Python Bridge Daemon",
                "version": "0.1.0",
                "pythonVersion": sys.version,
                "platform": sys.platform,
                "uptimeSeconds": round(time.time() - START_TIME, 2),
                "cwd": os.getcwd(),
                "endpoints": [
                    "GET /api/health",
                    "GET /api/status",
                    "POST /api/execute"
                ]
            })
        elif self.path == "/api/status":
            self._send_json(200, {
                "clusterNode": "localhost-node-primary",
                "telemetry": {
                    "warpFieldCoherence": 0.998,
                    "plasmaFlowRate": 85.0,
                    "coreTemperature": 3400,
                    "subspaceEntropy": 0.042
                },
                "activeDrives": ["C:", "D:", "Z:"] if sys.platform == "win32" else ["/"],
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            })
        else:
            self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        if self.path == "/api/execute":
            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
            try:
                data = json.loads(raw_body)
            except Exception as e:
                return self._send_json(400, {"error": f"Invalid JSON body: {str(e)}"})

            script = data.get("script", "")
            args = data.get("args", "")

            if not script:
                return self._send_json(400, {"error": "Missing 'script' in request payload"})

            # Built-in simulated telemetry commands
            if script in ("ingest_telemetry.py", "telemetry"):
                return self._send_json(200, {
                    "status": "success",
                    "routine": "telemetry_ingestion",
                    "metrics": {
                        "warpCoreOutput": "1.21 GW",
                        "fieldCoherence": 0.9985,
                        "thermalLatticeTemp": "3,418 K",
                        "containmentIntegrity": "99.9%"
                    },
                    "timestamp": time.time()
                })
            elif script in ("calc_flux.py", "flux"):
                return self._send_json(200, {
                    "status": "success",
                    "routine": "flux_calculation",
                    "magneticVector": [0.002, 0.451, 0.992],
                    "plasmaDensity": "4.82e14 ions/cm3",
                    "timestamp": time.time()
                })

            # Check if script is a file on disk
            if os.path.exists(script):
                try:
                    py_bin = sys.executable or "python"
                    res = subprocess.run(
                        [py_bin, script] + (args.split() if args else []),
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    return self._send_json(200, {
                        "status": "success" if res.returncode == 0 else "error",
                        "returnCode": res.returncode,
                        "stdout": res.stdout.strip(),
                        "stderr": res.stderr.strip()
                    })
                except Exception as ex:
                    return self._send_json(500, {"status": "error", "message": str(ex)})

            # Otherwise, evaluate as Python code snippet
            try:
                py_bin = sys.executable or "python"
                res = subprocess.run(
                    [py_bin, "-c", script],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                return self._send_json(200, {
                    "status": "success" if res.returncode == 0 else "error",
                    "returnCode": res.returncode,
                    "stdout": res.stdout.strip(),
                    "stderr": res.stderr.strip()
                })
            except Exception as ex:
                return self._send_json(500, {"status": "error", "message": str(ex)})
        else:
            self._send_json(404, {"error": "Endpoint not found"})

    def log_message(self, format, *args):
        # Clean formatted logging for terminal
        sys.stderr.write(f"[MythOS Python Daemon] {self.address_string()} - {format % args}\n")

def main():
    server = HTTPServer((HOST, PORT), MythosDaemonHandler)
    print("=" * 60)
    print(f" MythOS Python Bridge Daemon (VOXCONPACK)")
    print(f" Listening on http://{HOST}:{PORT}")
    print(f" Endpoints: /api/health, /api/status, /api/execute")
    print(f" Press Ctrl+C to terminate.")
    print("=" * 60)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDaemon terminated cleanly.")
        server.server_close()

if __name__ == "__main__":
    main()
