#!/usr/bin/env python3
"""MYTHOS DAEMON - your computer's hands for the browser.

Runs on YOUR machine (localhost only), takes orders from MythosLocal
(the localbridge chip) or from the little console it serves at /.

  python3 mythos_daemon.py            # prints the token once, serves :8765
  python3 mythos_daemon.py --port 9999 --token-file ~/.mythos_token

SECURITY, read before you run: this daemon runs shell/python/node,
reads and writes any file YOU can reach, and runs SQL. That is the
whole point - it is you, over the loopback. It stays safe three ways:
  1. It binds 127.0.0.1 only. Remote bind needs --i-know and is logged.
  2. Every call needs the bearer token (printed once, file mode 600).
  3. Every mutating call needs "confirm": true AND is printed to stdout.
Only stdlib is used. No dependencies to audit.
"""
import argparse
import base64
import fnmatch
import hmac
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = "1"
MAX_BODY = 10 * 1024 * 1024
MAX_OUT = 64 * 1024
MAX_ROWS = 500

TOKEN = ""
HERE = os.path.dirname(os.path.abspath(__file__))


def log(*parts):
    print("[%s]" % time.strftime("%H:%M:%S"), *parts, flush=True)


def err(message, code=400, need=None, hint=None):
    body = {"ok": False, "error": message}
    if need:
        body["need"] = need
    if hint:
        body["hint"] = hint
    return code, body


def wants_confirm(body, what):
    if isinstance(body, dict) and body.get("confirm") is True:
        return None
    return err("refused", code=409, need="confirm",
               hint=what + " - resend with confirm:true")


def entry_info(path):
    st = os.stat(path)
    return {"name": os.path.basename(path),
            "dir": os.path.isdir(path),
            "size": st.st_size,
            "mtime": int(st.st_mtime)}


def op_list(p):
    if not p or not os.path.exists(p):
        return err("NO SUCH PATH - %s" % p[:120])
    if os.path.isfile(p):
        info = entry_info(p)
        return 200, {"ok": True, "entries": [info],
                     "receipt": "1 FILE :: %s" % info["name"]}
    try:
        names = sorted(os.listdir(p))
    except Exception as e:
        return err("LIST FAILED - %s" % str(e)[:100])
    out = []
    for n in names[:1000]:
        try:
            out.append(entry_info(os.path.join(p, n)))
        except Exception:
            pass
    return 200, {"ok": True, "path": p, "entries": out,
                 "receipt": "%d ENTRIES :: %s" % (len(out), p[:80])}


def op_read(p, body):
    if not p or not os.path.isfile(p):
        return err("NO SUCH FILE - %s" % str(p)[:120])
    cap = body.get("maxBytes", 2 * 1024 * 1024)
    try:
        cap = int(cap)
    except Exception:
        cap = 2 * 1024 * 1024
    try:
        size = os.path.getsize(p)
    except Exception as e:
        return err("STAT FAILED - %s" % str(e)[:100])
    if size > cap:
        return err("FILE TOO BIG (%d B) - RAISE maxBytes" % size)
    try:
        with open(p, "rb") as f:
            raw = f.read()
    except Exception as e:
        return err("READ FAILED - %s" % str(e)[:100])
    if body.get("as") == "base64":
        return 200, {"ok": True, "name": os.path.basename(p),
                     "size": len(raw), "base64": base64.b64encode(raw).decode(),
                     "receipt": "READ %d B (BASE64) :: %s" % (len(raw), p[:80])}
    try:
        text = raw.decode("utf-8")
    except Exception:
        text = raw.decode("utf-8", errors="replace")
    return 200, {"ok": True, "name": os.path.basename(p),
                 "size": len(raw), "text": text,
                 "receipt": "READ %d B :: %s" % (len(raw), p[:80])}


def op_write(p, body):
    gate = wants_confirm(body, "WRITING %s" % str(p)[:80])
    if gate:
        return gate
    if not p:
        return err("NO PATH GIVEN - NOTHING WRITTEN")
    if os.path.isdir(p):
        return err("THAT IS A FOLDER - NOT OVERWRITTEN")
    if "base64" in body and body["base64"] is not None:
        try:
            raw = base64.b64decode(body["base64"])
        except Exception:
            return err("BAD BASE64 - NOTHING WRITTEN")
    elif "text" in body and body["text"] is not None:
        raw = str(body["text"]).encode("utf-8")
    else:
        return err("NOTHING TO WRITE - GIVE text OR base64")
    if len(raw) > MAX_BODY:
        return err("TOO BIG - OVER THE 10MB CEILING")
    try:
        parent = os.path.dirname(os.path.abspath(p))
        os.makedirs(parent, exist_ok=True)
        with open(p, "wb") as f:
            f.write(raw)
    except Exception as e:
        return err("WRITE FAILED - %s" % str(e)[:100])
    log("WRITE", len(raw), "B ->", p)
    return 200, {"ok": True, "written": len(raw),
                 "receipt": "WROTE %d B :: %s" % (len(raw), p[:80])}


def op_mkdir(p, body):
    gate = wants_confirm(body, "MAKING FOLDER %s" % str(p)[:80])
    if gate:
        return gate
    if not p:
        return err("NO PATH GIVEN - NOTHING MADE")
    try:
        os.makedirs(p, exist_ok=True)
    except Exception as e:
        return err("MKDIR FAILED - %s" % str(e)[:100])
    log("MKDIR", p)
    return 200, {"ok": True, "receipt": "FOLDER READY :: %s" % str(p)[:80]}


def guarded_remove(p):
    full = os.path.abspath(p)
    home = os.path.abspath(os.path.expanduser("~"))
    if full in ("/", home) or full == HERE:
        return "THAT ONE IS NEVER REMOVED - %s" % full
    return None


def op_move(p, body):
    gate = wants_confirm(body, "MOVING %s" % str(p)[:80])
    if gate:
        return gate
    dest = body.get("to", "")
    if not p or not dest:
        return err("GIVE path AND to - NOTHING MOVED")
    try:
        shutil.move(p, dest)
    except Exception as e:
        return err("MOVE FAILED - %s" % str(e)[:100])
    log("MOVE", p, "->", dest)
    return 200, {"ok": True,
                 "receipt": "MOVED %s -> %s" % (str(p)[:60], str(dest)[:60])}


def op_copy(p, body):
    gate = wants_confirm(body, "COPYING %s" % str(p)[:80])
    if gate:
        return gate
    dest = body.get("to", "")
    if not p or not dest:
        return err("GIVE path AND to - NOTHING COPIED")
    try:
        if os.path.isdir(p):
            shutil.copytree(p, dest)
        else:
            parent = os.path.dirname(os.path.abspath(dest))
            os.makedirs(parent, exist_ok=True)
            shutil.copy2(p, dest)
    except Exception as e:
        return err("COPY FAILED - %s" % str(e)[:100])
    log("COPY", p, "->", dest)
    return 200, {"ok": True,
                 "receipt": "COPIED %s -> %s" % (str(p)[:60], str(dest)[:60])}


def op_remove(p, body):
    gate = wants_confirm(body, "REMOVING %s" % str(p)[:80])
    if gate:
        return gate
    if not p or not os.path.exists(p):
        return err("NO SUCH PATH - %s" % str(p)[:120])
    stop = guarded_remove(p)
    if stop:
        return err(stop)
    try:
        if os.path.isfile(p) or os.path.islink(p):
            os.remove(p)
        elif body.get("recursive") is True:
            shutil.rmtree(p)
        else:
            os.rmdir(p)
    except Exception as e:
        return err("REMOVE FAILED - %s" % str(e)[:120])
    log("REMOVE", p)
    return 200, {"ok": True,
                 "receipt": "REMOVED %s" % str(p)[:100]}


def handle_fs(body):
    op = (body.get("op") or "").lower()
    p = body.get("path", "")
    if not isinstance(p, str):
        p = str(p)
    if op in ("list", "ls"):
        return op_list(p)
    if op == "stat":
        if not p or not os.path.exists(p):
            return err("NO SUCH PATH - %s" % str(p)[:120])
        try:
            info = entry_info(p)
        except Exception as e:
            return err("STAT FAILED - %s" % str(e)[:100])
        return 200, {"ok": True, "stat": info, "receipt": "STAT :: %s" % p[:80]}
    if op == "read":
        return op_read(p, body)
    if op == "write":
        return op_write(p, body)
    if op == "mkdir":
        return op_mkdir(p, body)
    if op == "move":
        return op_move(p, body)
    if op == "copy":
        return op_copy(p, body)
    if op in ("remove", "rm", "delete"):
        return op_remove(p, body)
    return err("NO SUCH OP - %s (list/stat/read/write/mkdir/move/copy/remove)" % op[:40])


def handle_find(body):
    root = body.get("root", "")
    if not root or not os.path.isdir(root):
        return err("BAD ROOT - %s" % str(root)[:120])
    glob = body.get("glob") or ""
    regex = body.get("regex") or ""
    grep = body.get("grep") or ""
    if not glob and not regex and not grep:
        return err("GIVE glob, regex, OR grep - NOTHING TO MATCH")
    rx = None
    if regex:
        try:
            rx = re.compile(regex)
        except Exception:
            return err("BAD REGEX - NOT COMPILED")
    grx = None
    if grep:
        try:
            grx = re.compile(grep)
        except Exception:
            return err("BAD GREP - NOT COMPILED")
    try:
        maxhits = max(1, min(1000, int(body.get("max", 200))))
    except Exception:
        maxhits = 200
    try:
        maxdepth = body.get("depth")
        maxdepth = None if maxdepth is None else int(maxdepth)
    except Exception:
        maxdepth = None
    hits = []
    walked = 0
    for dirpath, dirnames, filenames in os.walk(root):
        if maxdepth is not None:
            rel = os.path.relpath(dirpath, root)
            depth = 0 if rel == "." else rel.count(os.sep) + 1
            if depth > maxdepth:
                dirnames[:] = []
                continue
        for n in filenames:
            walked += 1
            full = os.path.join(dirpath, n)
            if glob and not fnmatch.fnmatch(n, glob):
                continue
            if rx and not rx.search(full):
                continue
            if grx:
                try:
                    if os.path.getsize(full) > 1024 * 1024:
                        continue
                    with open(full, "r", errors="replace") as f:
                        lines = []
                        for i, line in enumerate(f):
                            if grx.search(line):
                                lines.append({"n": i + 1, "text": line.strip()[:200]})
                                if len(lines) >= 5:
                                    break
                    if not lines:
                        continue
                    hits.append({"path": full, "lines": lines})
                except Exception:
                    continue
            else:
                try:
                    hits.append({"path": full, "size": os.path.getsize(full)})
                except Exception:
                    continue
            if len(hits) >= maxhits:
                break
        if len(hits) >= maxhits:
            break
    return 200, {"ok": True, "hits": hits, "walked": walked,
                 "receipt": "WALKED %d, %d HOLD THE PATTERN" % (walked, len(hits))}


def handle_exec(body):
    gate = wants_confirm(body, "RUNNING %s JOB" % str(body.get("runner") or "shell")[:20])
    if gate:
        return gate
    runner = (body.get("runner") or "shell").lower()
    code = body.get("code") or body.get("cmd") or ""
    if not code:
        return err("NOTHING TO RUN - GIVE code OR cmd")
    cwd = body.get("cwd") or os.path.expanduser("~")
    if not os.path.isdir(cwd):
        return err("BAD CWD - %s" % str(cwd)[:120])
    try:
        timeout = int(body.get("timeout", 60))
    except Exception:
        timeout = 60
    timeout = max(1, min(300, timeout))
    try:
        if runner == "python":
            proc = subprocess.run([sys.executable, "-c", code], cwd=cwd,
                                  capture_output=True, text=True, timeout=timeout)
        elif runner == "node":
            node = shutil.which("node")
            if not node:
                return err("NODE NOT FOUND ON THIS MACHINE - INSTALL IT FIRST")
            proc = subprocess.run([node, "-e", code], cwd=cwd,
                                  capture_output=True, text=True, timeout=timeout)
        elif runner in ("shell", "sh", "bash"):
            proc = subprocess.run(code, shell=True, cwd=cwd,
                                  capture_output=True, text=True, timeout=timeout)
        else:
            return err("NO SUCH RUNNER - shell, python, node")
    except subprocess.TimeoutExpired:
        return err("JOB TIMED OUT AFTER %dS - KILLED" % timeout)
    except Exception as e:
        return err("JOB FAILED TO START - %s" % str(e)[:100])
    out = (proc.stdout or "")[-MAX_OUT:]
    err_out = (proc.stderr or "")[-MAX_OUT:]
    log("EXEC", runner, "rc=%d" % proc.returncode, str(code)[:100])
    return 200, {"ok": True, "rc": proc.returncode, "out": out, "err": err_out,
                 "receipt": "JOB DONE RC=%d (%d OUT, %d ERR)" % (proc.returncode, len(out), len(err_out))}


def handle_sql(body):
    db = body.get("db", "")
    sql = body.get("sql", "")
    if not db:
        return err("NO DATABASE GIVEN - NOWHERE TO ASK")
    if not sql:
        return err("NO SQL GIVEN - NOTHING ASKED")
    write = body.get("write") is True
    if write:
        gate = wants_confirm(body, "WRITING TO %s" % str(db)[:80])
        if gate:
            return gate
    params = body.get("params") or []
    try:
        if write:
            con = sqlite3.connect(db)
        else:
            con = sqlite3.connect("file:%s?mode=ro" % db, uri=True)
    except Exception as e:
        return err("DB WOULD NOT OPEN - %s" % str(e)[:100])
    try:
        cur = con.execute(sql, params)
        if cur.description:
            cols = [d[0] for d in cur.description]
            rows = [list(r) for r in cur.fetchmany(MAX_ROWS)]
            con.close()
            return 200, {"ok": True, "cols": cols, "rows": rows,
                         "receipt": "%d ROWS :: %s" % (len(rows), str(db)[:60])}
        con.commit()
        changed = cur.rowcount
        con.close()
    except Exception as e:
        try:
            con.close()
        except Exception:
            pass
        return err("SQL FAILED - %s" % str(e)[:160])
    log("SQL", "write" if write else "read", db, str(sql)[:100])
    return 200, {"ok": True, "changed": changed,
                 "receipt": "WROTE %s CHANGES :: %s" % (changed, str(db)[:60])}


CONSOLE = """<!doctype html><html><head><meta charset="utf-8">
<title>MYTHOS DAEMON</title>
<style>body{background:#000;color:#0f0;font:14px monospace;max-width:900px;margin:20px}
input,textarea,button{background:#001100;color:#0f0;border:1px solid #0f0;font:inherit}
textarea{width:100%;height:70px}pre{white-space:pre-wrap;border:1px solid #060;padding:8px}</style>
</head><body><h3>MYTHOS DAEMON</h3>
<p>token <input id="t" size="40" type="password"> <button onclick="ping()">status</button></p>
<p>path/root <input id="p" size="60" value=""></p>
<p><button onclick="go('list')">list</button> <button onclick="go('find')">find *.py</button>
<button onclick="go('exec')">run python</button> <button onclick="go('sql')">sql</button></p>
<p>extra (json for find/exec/sql):</p><textarea id="x">{}</textarea>
<pre id="o">orders print here.</pre>
<script>
var B = location.origin;
function hd(){ return {"Content-Type":"application/json","Authorization":"Bearer "+document.getElementById("t").value}; }
function show(d){ document.getElementById("o").textContent = JSON.stringify(d,null,1).slice(0,4000); }
async function post(path,body){ var r = await fetch(B+path,{method:"POST",headers:hd(),body:JSON.stringify(body)}); show(await r.json()); }
function ping(){ post("/api/status",{}); }
function go(w){ var p = document.getElementById("p").value, x = {};
  try{ x = JSON.parse(document.getElementById("x").value||"{}"); }catch(e){}
  if(w==="list") post("/api/fs",{op:"list",path:p});
  if(w==="find") post("/api/find",Object.assign({root:p||".",glob:"*.py",max:50},x));
  if(w==="exec") post("/api/exec",Object.assign({runner:"python",code:"print(2+2)",confirm:true},x));
  if(w==="sql") post("/api/sql",Object.assign({db:p,sql:"SELECT name FROM sqlite_master LIMIT 20"},x)); }
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    server_version = "MythosDaemon/" + VERSION

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

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/?"):
            raw = CONSOLE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        self.send_json(404, {"ok": False, "error": "NOTHING HERE - POST /api/..."})

    def read_body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except Exception:
            n = 0
        if n <= 0:
            return {}
        if n > MAX_BODY:
            return None
        try:
            raw = self.rfile.read(n)
        except Exception:
            return None
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return None

    def do_POST(self):
        body = self.read_body()
        if body is None:
            self.send_json(400, {"ok": False, "error": "BAD BODY - JSON, UNDER 10MB"})
            return
        if not isinstance(body, dict):
            self.send_json(400, {"ok": False, "error": "BAD BODY - SEND A JSON OBJECT"})
            return
        if self.path == "/api/status":
            if not self.authed():
                self.send_json(401, {"ok": False, "error": "TOKEN REFUSED"})
                return
            self.send_json(200, {"ok": True, "version": VERSION,
                                 "receipt": "DAEMON AWAKE v%s" % VERSION})
            return
        if not self.authed():
            self.send_json(401, {"ok": False, "error": "TOKEN REFUSED"})
            return
        if self.path == "/api/fs":
            code, obj = handle_fs(body)
        elif self.path == "/api/find":
            code, obj = handle_find(body)
        elif self.path == "/api/exec":
            code, obj = handle_exec(body)
        elif self.path == "/api/sql":
            code, obj = handle_sql(body)
        else:
            code, obj = 404, {"ok": False, "error": "NO SUCH ROAD"}
        self.send_json(code, obj)

    def authed(self):
        try:
            got = self.headers.get("Authorization") or ""
            if not got.startswith("Bearer "):
                return False
            return hmac.compare_digest(got[7:], TOKEN)
        except Exception:
            return False

    def log_message(self, *a):
        pass


def load_token(path, given):
    import secrets
    if given:
        return given
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
    ap = argparse.ArgumentParser(description="MYTHOS DAEMON - your computer's hands")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--token", default="")
    ap.add_argument("--token-file", default="~/.mythos_daemon_token")
    ap.add_argument("--cert", default="")
    ap.add_argument("--key", default="")
    ap.add_argument("--i-know", action="store_true",
                    help="allow non-loopback bind (logged, your risk)")
    args = ap.parse_args()
    if args.host != "127.0.0.1":
        if not args.i_know:
            print("REFUSED - only 127.0.0.1 without --i-know. Staying shut.", flush=True)
            sys.exit(1)
        print("WARNING - remote bind %s. Your risk, logged." % args.host, flush=True)
    global TOKEN
    TOKEN = load_token(args.token_file, args.token)
    print("MYTHOS DAEMON v%s - http://%s:%d/ - token: %s" % (VERSION, args.host, args.port, TOKEN), flush=True)
    print("Console: open http://%s:%d/ in your browser." % (args.host, args.port), flush=True)
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    srv.daemon_threads = True
    if args.cert:
        import ssl
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(args.cert, args.key or None)
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
        print("TLS ON - use https and point MythosLocal at it.", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("SHUT.", flush=True)


if __name__ == "__main__":
    main()
