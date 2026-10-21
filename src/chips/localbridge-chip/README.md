# MYTHOS LOCALBRIDGE - the whole machine, through one small daemon (for ANY host)

The browser cannot run Node, Python, SQLite, or touch paths nobody picked —
that is the web's own lock, not ours. So the bridge is two pieces: a tiny
Python daemon that runs ON your machine (it IS you — same files, same
tools), and a drop-in client chip that talks to it. Together they do what
you do by hand: run jobs, query databases, find and extract files and code,
organize anything, anywhere.

## start (one command, on your machine)

```sh
python3 mythos_daemon.py
# MYTHOS DAEMON v1 - http://127.0.0.1:8765/ - token: <printed once>
```

Open `http://127.0.0.1:8765/` — the daemon serves its own little console
(status, list, find, run, sql), so there is no mixed-content fight with
https pages. The token lives in `~/.mythos_daemon_token` (mode 600).

## use (any host page)

```html
<script src="mythos-localbridge-standalone.js"></script>
<script>
  var local = MythosLocal.client({ base: "http://127.0.0.1:8765", token: PASTE_ONCE });
  print((await local.status()).receipt); // LOCAL :: DAEMON AWAKE v1
  print((await local.ls("Z:/Photos")).receipt); // LOCAL :: 412 ENTRIES :: Z:/Photos
  var f = await local.find({ root: "Z:/", glob: "*.py", grep: "mythos" });
  print(f.receipt); // LOCAL :: WALKED 9001, 14 HOLD THE PATTERN
  var code = await local.readFile(f.hits[0].path);
  var job = await local.exec({ runner: "python", code: "print(2+2)", confirm: true });
  print(job.out); // 4
  var rows = await local.sql({ db: "Z:/vault.db", sql: "SELECT name FROM sqlite_master LIMIT 20" });
  print(rows.receipt); // LOCAL :: 20 ROWS :: Z:/vault.db
</script>
```

## the contract

- `status()` — awake check. Unreachable daemon refuses loud with the exact
  start command; wrong token refuses loud (`TOKEN REFUSED`).
- `ls(path)` / `stat(path)` / `readFile(path, {maxBytes, as})` — look
  anywhere you can reach. Reads cap at 2MB unless raised; `as:"base64"`
  for binaries.
- `find({root, glob, regex, grep, max, depth})` — locate files by name and
  extract the exact lines holding a pattern (code, notes, anything).
- `writeFile` / `mkdir` / `move` / `copy` / `remove({recursive})` — organize
  anywhere. Every one needs `confirm:true` (two-step: first call names the
  act and stands down), and the daemon demands it again server-side.
  `/`, your home, and the daemon's own folder are never removed.
- `exec({runner:"shell"|"python"|"node", code|cmd, cwd, timeout, confirm})` —
  real local jobs; node refused loud when not installed; 60s timeout
  default (300 max); stdout/stderr capped at 64KB.
- `sql({db, sql, params, write})` — SQLite through stdlib. Reads open the
  database read-only; writes need `write:true` + `confirm:true`.
- Nothing here uploads anything — the daemon binds 127.0.0.1 only (remote
  bind needs `--i-know` and is shouted in the log), and every mutation is
  printed to the daemon's stdout as it lands.

## the https footnote (honest)

An https page (like the SIA terminal) cannot `fetch()` an `http://`
daemon — the browser calls it mixed content. Three ways through: (1) use
the daemon's own console at `http://127.0.0.1:8765/` (always works);
(2) serve the daemon with TLS (`--cert/--key`, one-time mkcert step) and
point the client at `https://`; (3) call it from an `http://` host page.
The client tries whatever `base` you give it and names the failure loud.

## deliberately left out

- No remote access by design — no accounts, no TLS-by-default, no tunnel.
  Exposing this daemon to a network means anyone with the token IS you.
- One statement per `sql` call; 500 rows back max; 10MB bodies; no
  streaming. Batch jobs go through `exec`, not the API.
- The daemon inherits YOUR user, YOUR env, YOUR shell. It never sandboxes
  — sandboxing you from yourself would break the promise.
