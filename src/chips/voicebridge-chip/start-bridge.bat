cd /d %~dp0
if not exist sessions mkdir sessions
python -c "import numpy, sounddevice, faster_whisper" 2>nul || (
  echo REFUSED - missing voice libraries.
  echo install: pip install faster-whisper sounddevice numpy onnxruntime
  pause
  exit /b 1
)
python fasterwhisper_server.py --model base --device "CABLE Output" --session-log sessions\session.jsonl %*
pause
