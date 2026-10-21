#!/usr/bin/env python3
"""MYTHOS VOICE BRIDGE - FasterWhisper ears for the browser.

Runs on YOUR machine beside mythos_daemon.py. Listens to an audio device
(your VB-CABLE output - her playback isolated off the mic, no recursive
loop), transcribes with FasterWhisper, and emits ONLY final segments as
server-sent events. Partials are never sent, never logged, never stored.

  pip install faster-whisper sounddevice numpy onnxruntime
  python3 fasterwhisper_server.py --device "CABLE Output" --model base

WINDOWS CABLE MAP (VB-CABLE, free driver, installed once by hand):
  playback device (TTS/system) -> CABLE Input
  this server --device "CABLE Output"  (hears ONLY playback)
  your microphone stays the mic       (hears ONLY you)
Nothing she says can come back as your words, and nothing you say reaches
her playback line. The in-app half of the same law is turn.sttHeld().

HOW AN UTTERANCE BECOMES A FINAL (v2 - the upstream lesson, see below):
  the energy gate opens on sound, blocks accumulate, and NOTHING is
  transcribed until the quiet after them lasts --min-silence-ms. Then the
  whole utterance goes to FasterWhisper ONCE, Silero VAD confirms it held
  real speech (noise-only utterances are dropped, not hallucinated), and one
  final PER SEGMENT is emitted - each with session id, segment id, start/end
  ms, text, final:true and the speaker tag, ready to append as JSONL.
  --inbox DIR turns finished session files into that JSONL without anyone
  doing it by hand: new audio lands, segments transcribe, <stem>.jsonl plus
  the audio land in --outbox, faults stay put with a .err note.

 LAMP-GATED FEEDBACK GUARD (v4.1 - the audio-bleed fix): her browser TTS
 cannot be tapped, so it cannot be subtracted - it plays through the
 speakers and gets back into the mic. The BARB speaking lamp drives the
 guard instead: the browser posts lamp ON to /api/barb when she starts
 and lamp OFF when she stops. While the lamp is lit, PATRIKIOS and MAYA
 finals are DISCARDED, not queued - any audio window overlapping lamp-ON
 never leaves the server. After lamp OFF the gate stays closed for
 --barb-tail-ms (default 400) to catch room echo, then reopens; every
 open/close lands in the session JSONL as a gate event with a timestamp.
 A lamp ON past --barb-max-ms (default 60000) with no off is forced OFF
 ("BARB lamp timeout") and the lanes reopen. --gate-mode mute (default)
 gates STT; duck drops mic gain 30dB instead, for later barge-in.

UPSTREAM (https://github.com/SYSTRAN/faster-whisper) provides the critical
functions this relies on - all adopted, none vendored:
  get_speech_timestamps + VadOptions (faster_whisper.vad): Silero VAD over
    an utterance - speech confirmed or dropped before a transcribe is spent.
  vad_filter + vad_parameters (transcribe()): the same VAD inside the
    transcribe, trimming silence off the segment it reads.
  condition_on_previous_text=False: the previous output is NOT fed back in,
    which is what stops the model looping one phrase over a long line.
  no_speech_threshold / log_prob_threshold / compression_ratio_threshold:
    the three guards against confident hallucinations on quiet cable.
  hotwords + initial_prompt: house names spelled right (Patrikios, Barbelo).
onnxruntime carries the Silero model; without it the server still runs on
the energy gate alone (VAD confirm skipped, vad_filter retried off) and
says so on the status road.

Same locks as the daemon: 127.0.0.1 only, bearer token (defaults to the
same ~/.mythos_daemon_token file, one secret for both), every final
printed to stdout as it lands. Only numpy/sounddevice/faster-whisper
beyond stdlib (+ onnxruntime for the VAD); without the core three it
refuses loud with the pip line.
"""
import argparse
import hmac
import json
import os
import queue
import sys
import threading
import time

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = "4.1"
RATE = 16000
BLOCK = 512
DUCK_GAIN = 10.0 ** (-30.0 / 20.0)

TOKEN = ""
SCHEME = "http"
SUBS = []
SUBS_LOCK = threading.Lock()
UTTER_Q = queue.Queue(maxsize=8)
MODEL_GUARD = threading.RLock()
MODEL = {"inst": None, "name": ""}
LANES = {}

SHARED = {
    "model": "base",
    "gate": 0.015,
    "min_silence_ms": 900,
    "min_speech_ms": 500,
    "max_utter_s": 30.0,
    "vad": True,
    "onnx": False,
    "vad_threshold": 0.5,
    "hotwords": "Patrikios Barbelo",
    "prompt": "",
    "utters": 0,
    "finals": 0,
    "dups": 0,
    "vad_drops": 0,
    "qdrops": 0,
    "faults": 0,
    "inbox_done": 0,
    "last_emit": "",
    "sid": "",
    "speaker": "",
    "compute_device": "cpu",
    "compute_type": "int8",
    "level": {"rms": 0.0, "peak": 0.0, "at": 0.0},
    "cap_at": 0.0,
    "live": False,
    "gated": 0,
    "unlabeled": 0,
    "barb_drops": 0,
    "barb_timeouts": 0,
    "barb_tail_ms": 350,
    "barb_max_ms": 60000,
    "gate_mode": "mute",
    "barb_callsign": True,
    "session_log": "",
}

BARB = {
    "speaking": False,
    "since": 0.0,
    "intervals": [],
    "open_logged": True,
    "lock": threading.Lock(),
}


def gate_append(state, reason):
    path = SHARED.get("session_log") or ""
    if not path:
        return
    try:
        line = json.dumps({"t": int(time.time() * 1000), "event": "gate",
                           "state": state, "reason": reason})
        with open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception as e:
        log("SESSION LOG FAULT - %s" % str(e)[:80])


def barb_intervals():
    with BARB["lock"]:
        return list(BARB["intervals"])


def barb_speaking_now():
    with BARB["lock"]:
        return bool(BARB["speaking"])


def barb_set(on):
    now = time.time()
    with BARB["lock"]:
        if on:
            if not BARB["speaking"]:
                BARB["speaking"] = True
                BARB["since"] = now
                BARB["open_logged"] = False
                gate_append("closed", "barb_speaking")
                log("BARB-GATE :: lamp ON - PATRIKIOS and MAYA lanes gated")
            return "closed"
        if BARB["speaking"]:
            BARB["speaking"] = False
            BARB["intervals"].append((BARB["since"], now))
            del BARB["intervals"][:-20]
            tail = float(SHARED["barb_tail_ms"]) / 1000.0
            log("BARB-GATE :: lamp OFF - lanes reopen in %dms"
                % int(SHARED["barb_tail_ms"]))

            def reopen():
                time.sleep(tail)
                with BARB["lock"]:
                    if not BARB["speaking"] and not BARB["open_logged"]:
                        BARB["open_logged"] = True
                        gate_append("open", "tail_elapsed")
                        log("BARB-GATE :: lanes open")
            th = threading.Thread(target=reopen, daemon=True)
            th.start()
            return "tail"
        return "open"


def barb_closed_reason(win_start, win_end, now):
    tail = float(SHARED["barb_tail_ms"]) / 1000.0
    with BARB["lock"]:
        if BARB["speaking"]:
            if win_end >= BARB["since"]:
                return "barb_speaking"
            return ""
        spans = list(BARB["intervals"])
    for a, b in spans:
        if win_start < b + tail and win_end > a:
            return "barb_tail" if now >= b else "barb_speaking"
    return ""


def barb_watchdog():
    while True:
        try:
            time.sleep(1.0)
            now = time.time()
            fire = False
            with BARB["lock"]:
                if BARB["speaking"] and (now - BARB["since"]) * 1000.0 > float(SHARED["barb_max_ms"]):
                    BARB["speaking"] = False
                    BARB["intervals"].append((BARB["since"], now))
                    del BARB["intervals"][:-20]
                    BARB["open_logged"] = True
                    fire = True
            if fire:
                SHARED["barb_timeouts"] += 1
                log("BARB lamp timeout - lamp forced OFF, lanes reopened")
                gate_append("open", "barb_timeout")
        except Exception:
            pass


def log(*parts):
    print("[%s]" % time.strftime("%H:%M:%S"), *parts, flush=True)


SRV_HOST = "127.0.0.1"
SRV_PORT = 8766


def args_host_port():
    return SRV_HOST, SRV_PORT


def lane_status():
    out = {}
    try:
        for name, L in LANES.items():
            lv = (L or {}).get("level") or {}
            at = lv.get("at", 0) or 0
            out[name] = {"open": bool((L or {}).get("open")),
                         "tag": str((L or {}).get("tag", "") or ""),
                         "device": str((L or {}).get("want", "") or ""),
                         "capturing": (time.time() - at) < 3.0}
    except Exception:
        pass
    return out


def need_deps():
    try:
        import numpy  # noqa: F401
        import sounddevice  # noqa: F401
        import faster_whisper  # noqa: F401
    except Exception as e:
        return ("REFUSED - missing voice libraries: %s\n"
                "install: pip install faster-whisper sounddevice numpy" % e)
    try:
        import onnxruntime  # noqa: F401
        SHARED["onnx"] = True
    except Exception:
        SHARED["onnx"] = False
    return None


def vad_mode():
    if not SHARED["vad"]:
        return "off"
    return "silero" if SHARED["onnx"] else "energy-only"


def get_model(name):
    with MODEL_GUARD:
        if MODEL["inst"] is None or MODEL["name"] != name:
            from faster_whisper import WhisperModel
            log("loading model %s [%s/%s] (first run downloads it) ..."
                % (name, SHARED["compute_device"], SHARED["compute_type"]))
            MODEL["inst"] = WhisperModel(name, device=SHARED["compute_device"],
                                         compute_type=SHARED["compute_type"])
            MODEL["name"] = name
        return MODEL["inst"]


def transcribe_opts():
    o = dict(language="en", beam_size=1, vad_filter=True,
             vad_parameters=dict(min_silence_duration_ms=500),
             condition_on_previous_text=False,
             no_speech_threshold=0.6, log_prob_threshold=-1.0,
             compression_ratio_threshold=2.4)
    if SHARED["hotwords"]:
        o["hotwords"] = SHARED["hotwords"]
    if SHARED["prompt"]:
        o["initial_prompt"] = SHARED["prompt"]
    return o


def run_transcribe(model, audio):
    with MODEL_GUARD:
        try:
            segs, _ = model.transcribe(audio, **transcribe_opts())
        except Exception as e:
            msg = str(e)
            if "vad" in msg.lower() or "onnx" in msg.lower():
                try:
                    o = transcribe_opts()
                    o["vad_filter"] = False
                    segs, _ = model.transcribe(audio, **o)
                except Exception as e2:
                    msg = str(e2)
                    SHARED["faults"] += 1
                    log("transcribe fault - %s" % msg[:100])
                    return "", []
            else:
                SHARED["faults"] += 1
                log("transcribe fault - %s" % msg[:100])
                return "", []
        out = []
        for s in segs:
            try:
                t = s.text.strip()
            except Exception:
                t = ""
            if t:
                out.append((int(round(s.start * 1000)),
                            int(round(s.end * 1000)), t))
        return " ".join(t for _, _, t in out).strip(), out


def emit(final):
    line = "data: %s\n\n" % json.dumps(final)
    raw = line.encode("utf-8")
    dead = []
    with SUBS_LOCK:
        subs = list(SUBS)
    for q in subs:
        try:
            q.put_nowait(raw)
        except Exception:
            dead.append(q)
    if dead:
        with SUBS_LOCK:
            for q in dead:
                try:
                    SUBS.remove(q)
                except Exception:
                    pass


def vad_confirms(audio):
    try:
        from faster_whisper.vad import get_speech_timestamps, VadOptions
        opts = VadOptions(threshold=float(SHARED["vad_threshold"]),
                          min_speech_duration_ms=200,
                          min_silence_duration_ms=500,
                          speech_pad_ms=200)
        return get_speech_timestamps(audio, opts)
    except Exception as e:
        log("VAD fault (%s) - transcribing anyway" % str(e)[:80])
        return [True]


def session_append(final):
    path = SHARED.get("session_log") or ""
    if not path:
        return
    try:
        line = json.dumps({"t": int(time.time() * 1000),
                           "session_id": final.get("sid", ""),
                           "lane": final.get("lane", ""),
                           "speaker": final.get("speaker", final.get("src", "")),
                           "start_ms": final.get("start_ms", 0),
                           "end_ms": final.get("end_ms", 0),
                           "text": final.get("text", "")})
        with open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception as e:
        log("SESSION LOG FAULT - %s" % str(e)[:80])


def handle_utterance(model, audio, why, lane="maya"):
    secs = float(audio.size) / RATE
    if secs * 1000.0 < SHARED["min_speech_ms"]:
        return
    tag = ""
    try:
        tag = str((LANES.get(lane) or {}).get("tag", "") or SHARED["speaker"])
    except Exception:
        tag = SHARED["speaker"]
    if not SHARED["live"]:
        SHARED["gated"] += 1
        return
    now = time.time()
    if SHARED["gate_mode"] == "mute":
        why_gate = barb_closed_reason(now - secs, now, now)
        if why_gate:
            SHARED["barb_drops"] += 1
            log("BARB-GATE :: %.1fs [%s] overlapping lamp-ON (%s) - dropped, not transcribed" % (secs, lane, why_gate))
            return
    if not tag:
        if SHARED.get("require_speaker"):
            SHARED["unlabeled"] += 1
            log("UNLABELED :: final without a speaker dropped (%d) - pass --speaker" % SHARED["unlabeled"])
            return
        tag = "UNLABELED"
        SHARED["unlabeled"] += 1
    SHARED["utters"] += 1
    if SHARED["vad"] and SHARED["onnx"]:
        if not vad_confirms(audio):
            SHARED["vad_drops"] += 1
            log("VAD :: no speech in %.1fs (%s) - dropped, not transcribed"
                % (secs, why))
            return
    text, seglist = run_transcribe(model, audio)
    if not text:
        return
    if text == SHARED["last_emit"]:
        SHARED["dups"] += 1
        log("DUP :: consecutive repeat - not re-emitted :: %s" % text[:80])
        return
    SHARED["last_emit"] = text
    now = int(time.time() * 1000)
    for i, (a_ms, b_ms, stext) in enumerate(seglist):
        SHARED["finals"] += 1
        final = {"final": True, "text": stext, "t": now,
                 "sid": SHARED["sid"], "seg": i,
                 "start_ms": a_ms, "end_ms": b_ms,
                 "lane": lane, "speaker": tag,
                 "src": SHARED["speaker"]}
        log("FINAL :: [%s/%s %d-%dms] %s" % (lane, tag, a_ms, b_ms, stext[:140]))
        try:
            session_append(final)
        except Exception:
            pass
        emit(final)


def worker_loop(model_name):
    model = get_model(model_name)
    while True:
        try:
            item = UTTER_Q.get()
        except Exception:
            continue
        try:
            if isinstance(item, (list, tuple)) and len(item) == 3:
                audio, why, lane = item
            else:
                audio, why, lane = item[0], item[1], "maya"
        except Exception:
            continue
        try:
            handle_utterance(model, audio, why, lane)
        except Exception as e:
            SHARED["faults"] += 1
            log("utterance fault - %s" % str(e)[:100])


AUDIO_EXTS = (".wav", ".mp3", ".m4a", ".ogg", ".flac", ".opus")


def load_audio_file(path):
    import numpy as np
    ext = os.path.splitext(path)[1].lower()
    if ext == ".wav":
        import wave
        with wave.open(path, "rb") as w:
            n = w.getnframes()
            ch = w.getnchannels()
            rate = w.getframerate()
            width = w.getsampwidth()
            raw = w.readframes(n)
        if width == 1:
            audio = np.frombuffer(raw, dtype=np.uint8).astype("float32")
            audio = (audio - 128.0) / 128.0
        elif width == 2:
            audio = np.frombuffer(raw, dtype=np.int16).astype("float32") / 32768.0
        elif width == 4:
            audio = np.frombuffer(raw, dtype=np.int32).astype("float32") / 2147483648.0
        else:
            raise ValueError("WAV width %d unsupported" % width)
        if ch > 1:
            audio = audio.reshape(-1, ch).mean(axis=1).astype("float32")
        if rate != RATE:
            old = np.linspace(0.0, 1.0, num=audio.size)
            new = np.linspace(0.0, 1.0, num=int(audio.size * RATE / rate))
            audio = np.interp(new, old, audio).astype("float32")
        return audio
    import shutil
    import subprocess
    if not shutil.which("ffmpeg"):
        raise ValueError("ffmpeg missing - convert to WAV first")
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar",
           str(RATE), "-f", "s16le", "-"]
    raw = subprocess.run(cmd, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, timeout=600).stdout
    return np.frombuffer(raw, dtype=np.int16).astype("float32") / 32768.0


def inbox_loop(inbox, outbox, model_name):
    model = get_model(model_name)
    seen_size = {}
    log("inbox watching %s -> %s" % (inbox, outbox))
    while True:
        try:
            names = sorted(os.listdir(inbox))
        except Exception as e:
            log("inbox unreadable - %s" % str(e)[:80])
            time.sleep(5)
            continue
        for name in names:
            if os.path.splitext(name)[1].lower() not in AUDIO_EXTS:
                continue
            stem = os.path.splitext(name)[0]
            if os.path.exists(os.path.join(outbox, stem + ".jsonl")):
                continue
            if os.path.exists(os.path.join(inbox, stem + ".err")):
                continue
            full = os.path.join(inbox, name)
            try:
                size = os.path.getsize(full)
            except Exception:
                continue
            if seen_size.get(full) != size:
                seen_size[full] = size
                continue
            try:
                audio = load_audio_file(full)
                text, seglist = run_transcribe(model, audio)
                if not text:
                    raise ValueError("empty transcript")
                lines = []
                for i, (a_ms, b_ms, stext) in enumerate(seglist):
                    lines.append(json.dumps({
                        "session_id": stem, "segment_id": i,
                        "start_ms": a_ms, "end_ms": b_ms,
                        "text": stext, "final": True,
                        "speaker": SHARED["speaker"]}))
                jl = os.path.join(outbox, stem + ".jsonl")
                with open(jl, "w", encoding="utf-8") as f:
                    f.write("\n".join(lines) + "\n")
                try:
                    os.rename(full, os.path.join(outbox, name))
                except Exception:
                    pass
                seen_size.pop(full, None)
                SHARED["inbox_done"] += 1
                log("INBOX :: %s -> %d segments" % (name, len(lines)))
            except Exception as e:
                msg = str(e)[:160]
                log("INBOX FAULT :: %s - %s" % (name, msg))
                try:
                    with open(os.path.join(inbox, stem + ".err"), "w") as f:
                        f.write(msg)
                except Exception:
                    pass
        time.sleep(2)


def resolve_device(sd, want):
    if isinstance(want, int):
        return want
    t = str(want).strip()
    if t.lstrip("+-").isdigit():
        try:
            return int(t)
        except Exception:
            pass
    try:
        devs = sd.query_devices()
    except Exception:
        return want
    hits = [i for i, d in enumerate(devs)
            if d.get("max_input_channels", 0) > 0 and t.lower() in str(d.get("name", "")).lower()]
    if len(hits) == 1:
        return hits[0]
    if len(hits) > 1:
        for i in hits:
            if "wasapi" in str(devs[i].get("name", "")).lower():
                return i
        return hits[0]
    return want


def capture_loop(device, lane="maya"):
    import numpy as np
    import sounddevice as sd
    device = resolve_device(sd, device)
    try:
        LANES[lane]["idx"] = device
        LANES[lane]["open"] = True
    except Exception:
        pass
    log("ears open [%s] on %s (vad %s, silence %dms)" %
        (lane, device, vad_mode(), SHARED["min_silence_ms"]))
    utter = np.zeros(0, dtype=np.float32)
    quiet_ms = 0.0
    has_voice = False
    try:
        dev_rate = int(sd.query_devices(device, "input").get("default_samplerate") or RATE)
    except Exception:
        dev_rate = RATE
    if dev_rate <= 0:
        dev_rate = RATE
    block_ms = 1000.0 * BLOCK / dev_rate
    stream = sd.InputStream(samplerate=dev_rate, channels=1, dtype="float32",
                            blocksize=BLOCK, device=device)
    with stream:
        try:
            actual = int(getattr(stream, "samplerate", 0) or dev_rate)
        except Exception:
            actual = dev_rate
        if actual <= 0:
            actual = dev_rate
        ratio = RATE / actual if actual != RATE else 1.0
        while True:
            data, _ = stream.read(BLOCK)
            mono = np.asarray(data, dtype=np.float32).reshape(-1)
            if ratio != 1.0 and mono.size > 1:
                n = max(1, int(round(mono.size * ratio)))
                mono = np.interp(np.linspace(0.0, 1.0, n),
                                 np.linspace(0.0, 1.0, mono.size), mono).astype(np.float32)
            if SHARED["gate_mode"] == "duck":
                try:
                    if barb_closed_reason(time.time() - 0.05, time.time(), time.time()):
                        mono = (mono * DUCK_GAIN).astype(np.float32)
                except Exception:
                    pass
            utter = np.concatenate([utter, mono])
            energy = float((mono ** 2).mean()) if mono.size else 0.0
            rms = energy ** 0.5 if energy > 0.0 else 0.0
            try:
                lv = LANES[lane]["level"]
            except Exception:
                lv = SHARED["level"]
            lv["rms"] = rms
            lv["at"] = time.time()
            if rms > lv["peak"]:
                lv["peak"] = rms
            else:
                lv["peak"] = lv["peak"] * 0.995
            if lane == "maya":
                SHARED["level"]["rms"] = rms
                SHARED["level"]["at"] = lv["at"]
                SHARED["level"]["peak"] = lv["peak"]
                SHARED["cap_at"] = lv["at"]
            if energy >= SHARED["gate"]:
                has_voice = True
                quiet_ms = 0.0
            else:
                quiet_ms += block_ms
            if not has_voice:
                if utter.size > RATE:
                    utter = utter[-RATE:]
                quiet_ms = 0.0
                continue
            if utter.size >= int(RATE * SHARED["max_utter_s"]):
                try:
                    UTTER_Q.put_nowait((utter, "MAX", lane))
                except Exception:
                    SHARED["qdrops"] += 1
                    log("QUEUE FULL - %.1fs utterance dropped" %
                        (utter.size / RATE))
                utter = np.zeros(0, dtype=np.float32)
                quiet_ms = 0.0
                has_voice = False
                continue
            if (utter.size >= int(RATE * SHARED["min_speech_ms"] / 1000.0)
                    and quiet_ms >= SHARED["min_silence_ms"]):
                try:
                    UTTER_Q.put_nowait((utter, "END", lane))
                except Exception:
                    SHARED["qdrops"] += 1
                    log("QUEUE FULL - %.1fs utterance dropped" %
                        (utter.size / RATE))
                utter = np.zeros(0, dtype=np.float32)
                quiet_ms = 0.0
                has_voice = False


class Handler(BaseHTTPRequestHandler):
    server_version = "MythosVoiceBridge/" + VERSION

    def send_json(self, code, obj):
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "authorization, content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_json(204, {"ok": True})

    def authed(self):
        try:
            if self.command == "GET":
                q = self.path.split("?", 1)
                if len(q) > 1:
                    for part in q[1].split("&"):
                        if part.startswith("token="):
                            return hmac.compare_digest(part[6:], TOKEN)
            got = self.headers.get("Authorization") or ""
            if got.startswith("Bearer "):
                return hmac.compare_digest(got[7:], TOKEN)
            return False
        except Exception:
            return False

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/?"):
            raw = CONSOLE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if self.path.startswith("/api/status"):
            if not self.authed():
                self.send_json(401, {"ok": False, "error": "TOKEN REFUSED"})
                return
            self.send_json(200, {"ok": True, "version": VERSION, "rate": RATE,
                                 "vad": vad_mode(),
                                 "base": "%s://%s:%d" % (SCHEME, args_host_port()[0], args_host_port()[1]),
                                 "live": SHARED["live"],
                                 "sid": SHARED["sid"],
                                 "speaker": SHARED["speaker"],
                                 "compute": "%s/%s" % (SHARED["compute_device"],
                                                       SHARED["compute_type"]),
                                 "gate": SHARED["gate"],
                                 "min_silence_ms": SHARED["min_silence_ms"],
                                 "lanes": lane_status(),
                                 "gated": SHARED["gated"],
                                 "unlabeled": SHARED["unlabeled"],
                                 "barb": {"speaking": barb_speaking_now(),
                                          "gated": bool(barb_closed_reason(time.time() - 0.05, time.time(), time.time())),
                                          "mode": SHARED["gate_mode"],
                                          "tail_ms": SHARED["barb_tail_ms"],
                                          "max_ms": SHARED["barb_max_ms"],
                                          "callsign": SHARED["barb_callsign"]},
                                 "barb_drops": SHARED["barb_drops"],
                                 "barb_timeouts": SHARED["barb_timeouts"],
                                 "session_log": SHARED["session_log"] or "",
                                 "utters": SHARED["utters"],
                                 "finals": SHARED["finals"],
                                 "dups": SHARED["dups"],
                                 "vad_drops": SHARED["vad_drops"],
                                 "qdrops": SHARED["qdrops"],
                                 "faults": SHARED["faults"],
                                 "inbox_done": SHARED["inbox_done"],
                                 "receipt": "BRIDGE EARS OPEN v%s (VAD %s)"
                                 % (VERSION, vad_mode())})
            return
        if self.path.startswith("/api/level"):
            if not self.authed():
                self.send_json(401, {"ok": False, "error": "TOKEN REFUSED"})
                return
            lane = "maya"
            try:
                q = self.path.split("?", 1)[1] if "?" in self.path else ""
                for part in q.split("&"):
                    if part.startswith("lane="):
                        lane = part[5:].strip().lower() or "maya"
            except Exception:
                pass
            if lane == "merk":
                lane = "patrikios"
            now = time.time()
            lv = None
            try:
                lv = (LANES.get(lane) or {}).get("level")
            except Exception:
                lv = None
            if not lv:
                lv = SHARED["level"]
            self.send_json(200, {"ok": True, "lane": lane,
                                 "capturing": (now - (lv.get("at", 0) or 0)) < 3.0,
                                 "rms": round(lv["rms"], 5), "peak": round(lv["peak"], 5),
                                 "at": int((lv.get("at", 0) or 0) * 1000), "rate": RATE})
            return
        if self.path.startswith("/api/live"):
            if not self.authed():
                self.send_json(401, {"ok": False, "error": "TOKEN REFUSED"})
                return
            on = None
            try:
                q = self.path.split("?", 1)[1] if "?" in self.path else ""
                for part in q.split("&"):
                    if part.startswith("on="):
                        on = part[3:].strip().lower()
            except Exception:
                pass
            if on in ("1", "on", "yes", "true", "live"):
                SHARED["live"] = True
            elif on in ("0", "off", "no", "false", "armed"):
                SHARED["live"] = False
            log("GATE :: %s" % ("LIVE - finals flow" if SHARED["live"] else "ARMED - finals held at the gate"))
            self.send_json(200, {"ok": True, "live": SHARED["live"],
                                 "receipt": "GATE LIVE - FINALS FLOW" if SHARED["live"] else "GATE ARMED - FINALS HELD"})
            return
        if self.path.startswith("/api/barb"):
            if not self.authed():
                self.send_json(401, {"ok": False, "error": "TOKEN REFUSED"})
                return
            on = None
            try:
                q = self.path.split("?", 1)[1] if "?" in self.path else ""
                for part in q.split("&"):
                    if part.startswith("on="):
                        on = part[3:].strip().lower()
            except Exception:
                pass
            if on in ("1", "on", "yes", "true"):
                st = barb_set(True)
            elif on in ("0", "off", "no", "false"):
                st = barb_set(False)
            else:
                st = "closed" if barb_closed_reason(time.time() - 0.05, time.time(), time.time()) else "open"
            self.send_json(200, {"ok": True, "barb": st,
                                 "speaking": barb_speaking_now(),
                                 "receipt": "BARB LAMP " + st.upper()})
            return
        if self.path.startswith("/events"):
            if not self.authed():
                self.send_json(401, {"ok": False, "error": "TOKEN REFUSED"})
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            q = queue.Queue(maxsize=64)
            with SUBS_LOCK:
                SUBS.append(q)
            try:
                self.wfile.write(b"data: {\"hello\": true}\n\n")
                self.wfile.flush()
                while True:
                    raw = q.get()
                    self.wfile.write(raw)
                    self.wfile.flush()
            except Exception:
                pass
            finally:
                with SUBS_LOCK:
                    try:
                        SUBS.remove(q)
                    except Exception:
                        pass
            return
        self.send_json(404, {"ok": False, "error": "NOTHING HERE"})

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except Exception:
            n = 0
        if n <= 0 or n > 10 * 1024 * 1024:
            self.send_json(400, {"ok": False, "error": "BAD BODY"})
            return
        if not self.authed():
            self.send_json(401, {"ok": False, "error": "TOKEN REFUSED"})
            return
        if self.path == "/api/transcribe":
            try:
                raw = self.rfile.read(n)
            except Exception:
                self.send_json(400, {"ok": False, "error": "UNREADABLE BODY"})
                return
            try:
                import numpy as np
                audio = np.frombuffer(raw, dtype=np.int16).astype("float32") / 32768.0
                model = get_model(SHARED["model"])
                text, _ = run_transcribe(model, audio)
            except Exception as e:
                self.send_json(500, {"ok": False,
                                     "error": "TRANSCRIBE FAILED - %s" % str(e)[:120]})
                return
            log("ONE-SHOT :: %s" % text[:160])
            self.send_json(200, {"ok": True, "final": True, "text": text,
                                 "receipt": "TRANSCRIBED %d CHARS" % len(text)})
            return
        self.send_json(404, {"ok": False, "error": "NO SUCH ROAD"})

    def log_message(self, *a):
        pass


CONSOLE = """<!doctype html><html><head><meta charset="utf-8">
<title>MYTHOS VOICE BRIDGE</title>
<style>body{background:#000;color:#0f0;font:14px monospace;max-width:800px;margin:20px}
input,button{background:#001100;color:#0f0;border:1px solid #0f0;font:inherit}
pre{white-space:pre-wrap;border:1px solid #060;padding:8px;min-height:200px}</style>
</head><body><h3>MYTHOS VOICE BRIDGE</h3>
<p>token <input id="t" size="40" type="password"> <button onclick="go()">listen</button></p>
<pre id="o">finals print here - partials never leave the server.</pre>
<script>
function go(){ var t = document.getElementById("t").value;
  var es = new EventSource("/events?token=" + encodeURIComponent(t));
  es.onmessage = function (e) { var o = document.getElementById("o");
    try { var d = JSON.parse(e.data); if (d.text) o.textContent += "\\n" + d.text; }
    catch (x) {} };
  es.onerror = function () { document.getElementById("o").textContent += "\\n[stream shut - token?]"; es.close(); }; }
</script></body></html>"""


def load_token(path, given):
    import secrets
    if given:
        return given
    try:
        with open(os.path.join(os.getcwd(), ".env"), "r", encoding="utf-8") as f:
            for ln in f.read().splitlines():
                ln = ln.strip()
                if ln.startswith("TOKEN=") and len(ln) > 6:
                    return ln[6:].strip().strip("\"'")
    except Exception:
        pass
    full = os.path.abspath(os.path.expanduser(path))
    try:
        with open(full, "r") as f:
            old = f.read().strip()
        if old:
            return old
    except Exception:
        pass
    new = secrets.token_hex(32)
    try:
        with open(full, "w") as f:
            f.write(new)
        os.chmod(full, 0o600)
    except Exception as e:
        print("TOKEN FILE WOULD NOT SAVE - %s" % e, flush=True)
        print("TOKEN (unsaved - pass --token to reuse): %s" % new, flush=True)
        return new
    return new


def main():
    ap = argparse.ArgumentParser(description="MYTHOS VOICE BRIDGE - FasterWhisper ears")
    ap.add_argument("--device", default="CABLE Output",
                    help="capture device for the MAYA lane (default CABLE Output)")
    ap.add_argument("--lane-patrikios", default="",
                    help="capture device for the PATRIKIOS lane - his mic (default empty = lane closed)")
    ap.add_argument("--lane-merk", default="",
                    help="deprecated alias for --lane-patrikios")
    ap.add_argument("--lane-maya", default="",
                    help="capture device for the MAYA lane - the call output (default: --device)")
    ap.add_argument("--tag-patrikios", default="",
                    help="speaker tag stamped on PATRIKIOS lane finals (default SPK-PATRIKIOS)")
    ap.add_argument("--tag-merk", default="",
                    help="deprecated alias for --tag-patrikios")
    ap.add_argument("--tag-maya", default="SPK-MAYA",
                    help="speaker tag stamped on MAYA lane finals")
    ap.add_argument("--require-speaker", action="store_true",
                    help="drop finals with no speaker tag instead of stamping UNLABELED")
    ap.add_argument("--session-log", default="",
                    help="JSONL file every final is appended to (default empty = off)")
    ap.add_argument("--cert", default="",
                    help="TLS certificate file - with --key serves HTTPS/WSS (default empty = plain HTTP)")
    ap.add_argument("--key", default="",
                    help="TLS private key file for --cert")
    ap.add_argument("--model", default="base")
    ap.add_argument("--port", type=int, default=8766)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--token", default="")
    ap.add_argument("--token-file", default="~/.mythos_daemon_token")
    ap.add_argument("--no-mic", action="store_true",
                    help="no capture thread - serve only (one-shot /transcribe)")
    ap.add_argument("--gate", type=float, default=0.015,
                    help="energy that opens an utterance (default 0.015)")
    ap.add_argument("--min-silence-ms", type=int, default=900,
                    help="quiet that ends an utterance (default 900)")
    ap.add_argument("--min-speech-ms", type=int, default=500,
                    help="shorter utterances are never transcribed (default 500)")
    ap.add_argument("--max-utter-s", type=float, default=30.0,
                    help="longest utterance before a forced transcribe (default 30)")
    ap.add_argument("--vad", dest="vad", action="store_true",
                    help="Silero VAD confirms speech before transcribing (default on)")
    ap.add_argument("--no-vad", dest="vad", action="store_false",
                    help="skip the VAD confirm - energy gate only")
    ap.set_defaults(vad=True)
    ap.add_argument("--vad-threshold", type=float, default=0.5,
                    help="Silero speech probability floor (default 0.5)")
    ap.add_argument("--hotwords", default="Patrikios Barbelo",
                    help="names the model should spell right (default: house names)")
    ap.add_argument("--initial-prompt", default="",
                    help="context prompt for every transcribe (default empty)")
    ap.add_argument("--session", default="",
                    help="session id stamped on every final (default: bridge-STARTTIME)")
    ap.add_argument("--speaker", default="",
                    help="speaker tag stamped on every final - run one server per cable side (default empty)")
    ap.add_argument("--compute-device", default="cpu",
                    help="cpu or cuda - cuda needs the CUDA build + cuDNN (default cpu)")
    ap.add_argument("--compute-type", default="int8",
                    help="e.g. int8 for cpu, float16 for cuda (default int8)")
    ap.add_argument("--inbox", default="",
                    help="watched folder: new audio files transcribe to JSONL in --outbox")
    ap.add_argument("--outbox", default="",
                    help="where inbox JSONL + finished audio land (default: <inbox>/done)")
    ap.add_argument("--barb-tail-ms", type=int, default=350,
                    help="lanes stay gated this long after the BARB lamp goes OFF (default 350)")
    ap.add_argument("--barb-max-ms", type=int, default=60000,
                    help="lamp ON past this with no off forces OFF + reopen (default 60000)")
    ap.add_argument("--gate-mode", default="mute", choices=["mute", "duck"],
                    help="mute drops STT overlapping the lamp; duck drops mic gain 30dB instead (default mute)")
    ap.add_argument("--barb-callsign", default="on", choices=["on", "off"],
                    help="spoken 'Barbelo:' prefix on her TTS (default on)")
    args = ap.parse_args()
    if args.host != "127.0.0.1":
        print("REFUSED - only 127.0.0.1. Staying shut.", flush=True)
        sys.exit(1)
    missing = need_deps()
    if missing:
        print(missing, flush=True)
        sys.exit(1)
    global TOKEN, SCHEME, SRV_HOST, SRV_PORT
    TOKEN = load_token(args.token_file, args.token)
    SRV_HOST, SRV_PORT = args.host, args.port
    SHARED["model"] = args.model
    SHARED["gate"] = args.gate
    SHARED["min_silence_ms"] = args.min_silence_ms
    SHARED["min_speech_ms"] = args.min_speech_ms
    SHARED["max_utter_s"] = args.max_utter_s
    SHARED["vad"] = args.vad
    SHARED["vad_threshold"] = args.vad_threshold
    SHARED["hotwords"] = args.hotwords
    SHARED["prompt"] = args.initial_prompt
    SHARED["sid"] = args.session or ("bridge-" + time.strftime("%Y%m%d-%H%M%S"))
    SHARED["speaker"] = args.speaker
    SHARED["require_speaker"] = bool(args.require_speaker)
    SHARED["session_log"] = os.path.abspath(os.path.expanduser(args.session_log)) if args.session_log else ""
    SHARED["compute_device"] = args.compute_device
    SHARED["compute_type"] = args.compute_type
    SHARED["barb_tail_ms"] = max(0, int(args.barb_tail_ms))
    SHARED["barb_max_ms"] = max(1000, int(args.barb_max_ms))
    SHARED["gate_mode"] = args.gate_mode
    SHARED["barb_callsign"] = str(args.barb_callsign).lower() != "off"
    maya_dev = args.lane_maya or args.device
    LANES["maya"] = {"want": maya_dev, "idx": None, "open": False, "tag": args.tag_maya,
                     "level": {"rms": 0.0, "peak": 0.0, "at": 0.0}}
    patri_dev = args.lane_patrikios or args.lane_merk
    if args.lane_merk and not args.lane_patrikios:
        print("WARNING --lane-merk is deprecated, use --lane-patrikios.", flush=True)
    patri_tag = args.tag_patrikios or args.tag_merk or "SPK-PATRIKIOS"
    if args.tag_merk and not args.tag_patrikios:
        print("WARNING --tag-merk is deprecated, use --tag-patrikios.", flush=True)
    if patri_dev:
        LANES["patrikios"] = {"want": patri_dev, "idx": None, "open": False, "tag": patri_tag,
                              "level": {"rms": 0.0, "peak": 0.0, "at": 0.0}}
    if args.cert:
        if not args.key:
            print("REFUSED - --cert needs --key.", flush=True)
            sys.exit(1)
        try:
            import ssl
            SCHEME = "https"
        except Exception as e:
            print("REFUSED - TLS unavailable: %s" % e, flush=True)
            sys.exit(1)
    base = "%s://%s:%d/" % (SCHEME, args.host, args.port)
    print("MYTHOS VOICE BRIDGE v%s - %s - token: %s" % (VERSION, base, TOKEN), flush=True)
    print("Console: open %s in your browser." % base, flush=True)
    print("LANES :: %s" % ", ".join("%s=%s [%s]" % (n, L["want"], L["tag"]) for n, L in LANES.items()), flush=True)
    print("GATE :: ARMED - finals held until /api/live?on=1.", flush=True)
    if SHARED["session_log"]:
        print("SESSION LOG :: %s" % SHARED["session_log"], flush=True)
    if SHARED["vad"] and not SHARED["onnx"]:
        print("VAD energy-only - pip install onnxruntime for the Silero confirm.", flush=True)
    print("BARB-GATE :: lamp drives PATRIKIOS+MAYA (mode %s, tail %dms, max %dms, callsign %s)."
          % (SHARED["gate_mode"], SHARED["barb_tail_ms"], SHARED["barb_max_ms"],
             "on" if SHARED["barb_callsign"] else "off"), flush=True)
    wt = threading.Thread(target=barb_watchdog, daemon=True)
    wt.start()
    if not args.no_mic:
        for lane in ("maya", "patrikios"):
            if lane in LANES and LANES[lane]["want"]:
                th = threading.Thread(target=capture_loop, args=(LANES[lane]["want"], lane,), daemon=True)
                th.start()
        wt = threading.Thread(target=worker_loop, args=(args.model,), daemon=True)
        wt.start()
    else:
        print("NO CAPTURE - one-shot /transcribe only.", flush=True)
    if args.inbox:
        inbox = os.path.abspath(os.path.expanduser(args.inbox))
        outbox = os.path.abspath(os.path.expanduser(args.outbox)) if args.outbox else os.path.join(inbox, "done")
        try:
            os.makedirs(outbox, exist_ok=True)
            if not os.path.isdir(inbox):
                os.makedirs(inbox, exist_ok=True)
        except Exception as e:
            print("INBOX REFUSED - %s" % e, flush=True)
            sys.exit(1)
        it = threading.Thread(target=inbox_loop, args=(inbox, outbox, args.model,), daemon=True)
        it.start()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    srv.daemon_threads = True
    if SCHEME == "https":
        import ssl
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(args.cert, args.key)
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        if SHARED["session_log"]:
            print("SESSION LOG flushed :: %s (%d finals)" % (SHARED["session_log"], SHARED["finals"]), flush=True)
        print("SHUT.", flush=True)


if __name__ == "__main__":
    main()
