#!/bin/sh
cd "$(dirname "$0")"
python3 -c "import numpy, sounddevice, faster_whisper" 2>/dev/null || {
  echo "REFUSED - missing voice libraries."
  echo "install: pip install faster-whisper sounddevice numpy onnxruntime"
  exit 1
}
# COOM BRIDGE v4.1: MAYA lane on --device (the call), PATRIKIOS lane on
# --lane-patrikios (his mic). The BARB lamp arrives over /api/barb from the
# browser by itself - no flag needed for it.
exec python3 fasterwhisper_server.py --model base --device "CABLE Output" "$@"
