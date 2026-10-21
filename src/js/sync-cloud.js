(function () {
  /* ---- CLOUD SYNC (private Google Drive) ------------------------------------
     SEND the archive up, RECEIVE it back down: the import/export road with a cloud
     at the far end instead of a download. One file in HIS Drive,
     `lia-terminal-archive.json` - the same full-fidelity document /export json writes -
     created once, updated on every SEND, read back on RECEIVE through the IMPORT
     machinery (merges by stamp, skips what is already here, never duplicates).

     WHERE IT SITS HERE. This is the CLOUD ROAD of THE SYNC, and it shares one panel with the
     FOLDER ROAD (src/js/sync.js, which reads the chat backups on Patrikios' own disk, G:) - its
     section is drawn at the foot of #syncPanel, under the folder's own. Every id it touches is
     gd*, so the two roads never collide on the page; its record is its OWN key on this device
     (kv: lia_settings / sync_cloud - the folder road's record is lia_settings / sync), and the
     tokens it never prints live in the key ring under "google-drive" (src/keys/providers.json).
     The folder road asks for a folder; this road asks for a Google account, once: /cloud setup
     prints the whole recipe, and /cloud send | receive | log | setup | forget drives it from the
     line. src/js/main.js calls load() at boot (the OAuth popup's own return trip is handled
     there), and sync.js asks panel() to repaint every time the panel opens.

     PRIVACY SHAPE (same as the key ring's):
       - The OAuth CLIENT ID is a public identifier, not a secret: it lives in kv
         lia_settings / sync beside the file id and the run log. Nothing secret is
         ever in src/.
       - The TOKENS (access + refresh) are secrets: they live ONLY in the key ring
         (kv lia_settings / api_keys under "google-drive") - never printed, never in
         the transcript, never in the archive, never handed to her. chat.js already
         refuses to send anything shaped like a secret, and keyring.scrub() cleans
         every error string before it is printed.
       - SCOPE is drive.file: the terminal sees ONLY files it created itself. It
         cannot list, read, or touch anything else in the Drive.
       - The run log (TELEMETRY: when, which direction, how many bytes, ok or why
         not) is device-local metadata in the same sync record - counts and stamps,
         never words of his.

     SETUP (once, in the Google Cloud console - /cloud setup prints this too):
       1. New project, enable the Google Drive API.
       2. OAuth consent screen: External, just yourself as test user.
       3. Credentials -> Create OAuth client ID -> Web application. Add the exact
          redirect URL the SYNC panel shows (COPY it) as an Authorized redirect URI.
       4. Paste the client ID into the SYNC panel and press CONNECT - a popup asks
          Google for permission, then this page (same address, inside the popup)
          finishes the exchange by itself. Close the popup; the deck is connected.
     ------------------------------------------------------------------------- */

  var FOLDER = "lia_settings";
  var KEY = "sync_cloud";
  var PROVIDER = "google-drive";
  var FILE_NAME = "lia-terminal-archive.json";
  var SCOPE = "https://www.googleapis.com/auth/drive.file";
  var AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
  var TOKEN_URL = "https://oauth2.googleapis.com/token";
  var DRIVE = "https://www.googleapis.com/drive/v3";
  var UPLOAD = "https://www.googleapis.com/upload/drive/v3";
  var RUNS_MAX = 40;

  var cfg = { clientId: "", fileId: "", runs: [] };
  var ready = false;
  var loadP = null;
  var forgetArmed = 0;

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function ring() { return window.keyring || null; }

  function redirectUri() {
    try { return String(location.href).split(/[?#]/)[0]; }
    catch (e) { return ""; }
  }

  async function persist() {
    var k = kv();
    if (!k) return false;
    try { await k.set(KEY, cfg); return true; } catch (e) { return false; }
  }

  function run(dir, name, bytes, ok, note) {
    cfg.runs.push({ at: Date.now(), dir: dir, name: String(name || ""), bytes: Number(bytes) || 0, ok: !!ok, note: String(note || "").slice(0, 160) });
    if (cfg.runs.length > RUNS_MAX) cfg.runs = cfg.runs.slice(-RUNS_MAX);
    persist().catch(function () {});
  }

  // THE BAR (src/js/progress.js). The cloud road's slow part is the network, and it has no count to
  // give: one file up, or one file back, is one request that can take a while on a bad connection.
  // So it is an indeterminate bar under its own id ("cloud"), opened for the whole errand and closed
  // by fail() as well as by the success path - a send that fails must not leave its bar on the deck.
  function pbar(label) {
    try {
      if (window.progress) return window.progress.begin(label, {
        id: "cloud",
        detail: "THE CLOUD ROAD - one file in your own Drive; nothing else can be touched (drive.file)",
      });
    } catch (e) {}
    return null;
  }
  function pbarDone() {
    try { if (window.progress) window.progress.finish("cloud"); } catch (e) {}
  }

  function b64url(bytes) {
    var s = "";
    var b = new Uint8Array(bytes);
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function randomVerifier() {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    var out = "";
    try {
      var r = new Uint8Array(64);
      crypto.getRandomValues(r);
      for (var i = 0; i < r.length; i++) out += chars[r[i] % chars.length];
      return out;
    } catch (e) {
      for (var j = 0; j < 64; j++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    }
  }

  async function challengeOf(verifier) {
    var data = new TextEncoder().encode(verifier);
    var digest = await crypto.subtle.digest("SHA-256", data);
    return b64url(digest);
  }

  function tokens() {
    var r = ring();
    if (!r) return null;
    try {
      var raw = r.get(PROVIDER);
      if (!raw) return null;
      var t = JSON.parse(raw);
      if (!t || !t.access) return null;
      return t;
    } catch (e) { return null; }
  }

  function connected() { return !!tokens(); }

  async function tokenExchange(body) {
    var res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body
    });
    if (!res.ok) {
      var txt = "";
      try { txt = await res.text(); } catch (e) {}
      throw new Error("GOOGLE REFUSED (" + res.status + ") " + String(txt).replace(/\s+/g, " ").slice(0, 140));
    }
    return await res.json();
  }

  async function ensureToken() {
    var t = tokens();
    if (!t) throw new Error("NOT CONNECTED :: PRESS SYNC (THE DECK BUTTON), THEN CONNECT, FIRST.");
    if (t.exp && Date.now() < Number(t.exp) - 120000) return t.access;
    if (!t.refresh) throw new Error("THE SESSION EXPIRED AND NO REFRESH WAS KEPT :: CONNECT AGAIN.");
    var body = "client_id=" + encodeURIComponent(cfg.clientId)
      + "&grant_type=refresh_token"
      + "&refresh_token=" + encodeURIComponent(t.refresh);
    var j = await tokenExchange(body);
    var nt = { access: j.access_token, refresh: t.refresh, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    var r = ring();
    if (r) await r.set(PROVIDER, JSON.stringify(nt), { label: "OAuth tokens - never printed" });
    return nt.access;
  }

  async function drive(path, opts) {
    opts = opts || {};
    var access = await ensureToken();
    var init = { method: opts.method || "GET", headers: { "Authorization": "Bearer " + access } };
    if (opts.contentType) init.headers["Content-Type"] = opts.contentType;
    if (opts.body !== undefined) init.body = opts.body;
    var res = await fetch(DRIVE + path, init);
    if (res.status === 401 && !opts.retried) {
      var t = tokens();
      if (t && t.refresh) {
        var body = "client_id=" + encodeURIComponent(cfg.clientId)
          + "&grant_type=refresh_token"
          + "&refresh_token=" + encodeURIComponent(t.refresh);
        try {
          var j = await tokenExchange(body);
          var nt = { access: j.access_token, refresh: t.refresh, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
          var r = ring();
          if (r) await r.set(PROVIDER, JSON.stringify(nt), { label: "OAuth tokens - never printed" });
          opts.retried = true;
          return drive(path, opts);
        } catch (e) {}
      }
    }
    return res;
  }

  async function driveUpload(path, contentType, body) {
    var access = await ensureToken();
    return await fetch(UPLOAD + path, {
      method: cfg.fileId && /\/files\//.test(path) ? "PATCH" : "POST",
      headers: { "Authorization": "Bearer " + access, "Content-Type": contentType },
      body: body
    });
  }

  async function load() {
    if (loadP) return loadP;
    loadP = (async function () {
      var k = kv();
      if (k) {
        try {
          var saved = await k.get(KEY);
          if (saved && typeof saved === "object") {
            if (typeof saved.clientId === "string") cfg.clientId = saved.clientId;
            if (typeof saved.fileId === "string") cfg.fileId = saved.fileId;
            if (Array.isArray(saved.runs)) cfg.runs = saved.runs.slice(-RUNS_MAX);
          }
        } catch (e) {}
      }
      // THE POPUP'S OWN FINISH. The consent screen returns here (same address, inside the
      // popup) with ?code=... - the pending verifier is in the shared kv, so the exchange
      // completes right here and the popup only needs closing.
      try {
        var q = new URLSearchParams(String(location.search || ""));
        var code = q.get("code");
        var oauthState = q.get("state");
        if (code && oauthState === "lia-sync" && cfg.pending && cfg.pending.verifier) {
          var verifier = cfg.pending.verifier;
          cfg.pending = null;
          await persist();
          var body = "client_id=" + encodeURIComponent(cfg.clientId)
            + "&code=" + encodeURIComponent(code)
            + "&code_verifier=" + encodeURIComponent(verifier)
            + "&grant_type=authorization_code"
            + "&redirect_uri=" + encodeURIComponent(redirectUri());
          var j = await tokenExchange(body);
          var r = ring();
          if (r) await r.set(PROVIDER, JSON.stringify({
            access: j.access_token, refresh: j.refresh_token || "",
            exp: Date.now() + (Number(j.expires_in) || 3600) * 1000
          }), { label: "OAuth tokens - never printed" });
          run("auth", "google-drive", 0, true, "connected");
          if (typeof print === "function") print('SYSTEM', "SYNC :: CONNECTED TO YOUR GOOGLE DRIVE :: THIS WINDOW CAN BE CLOSED - THE DECK IS CONNECTED.");
          try { window.history.replaceState({}, "", redirectUri()); } catch (e) {}
        } else if (q.get("error")) {
          if (typeof print === "function") print('SYSTEM', "SYNC :: GOOGLE SAID NO :: " + String(q.get("error")).replace(/_/g, " ").toUpperCase());
          try { window.history.replaceState({}, "", redirectUri()); } catch (e) {}
        }
      } catch (e) { console.warn("sync callback failed", e); }
      ready = true;
      syncPanel();
      return state();
    })();
    return loadP;
  }

  function state() {
    return {
      ready: ready,
      connected: connected(),
      hasClientId: !!cfg.clientId,
      fileId: cfg.fileId || "",
      runs: cfg.runs.length,
      last: cfg.runs.length ? cfg.runs[cfg.runs.length - 1] : null
    };
  }

  function summary() {
    var s = state();
    return "SYNC :: " + (s.connected ? "CONNECTED TO YOUR GOOGLE DRIVE" : "NOT CONNECTED")
      + (s.fileId ? " :: CLOUD FILE KEPT" : "")
      + (s.last ? " :: LAST " + String(s.last.dir).toUpperCase() + " " + (s.last.ok ? "OK" : "FAILED") : " :: NOTHING SENT YET");
  }

  function setupText() {
    return "SYNC SETUP (ONCE) :: YOUR DRIVE, YOUR PROJECT - NOTHING OF OURS.\n"
      + "  1. console.cloud.google.com -> new project -> enable the GOOGLE DRIVE API.\n"
      + "  2. OAuth consent screen: External, add yourself as a test user.\n"
      + "  3. Credentials -> Create OAuth client ID -> Web application -> add this exact redirect URL:\n"
      + "     " + redirectUri() + "\n"
      + "     (SYNC panel: COPY takes it to the clipboard.)\n"
      + "  4. Paste the client ID into the SYNC panel, press CONNECT, approve in the popup.\n"
      + "SCOPE IS drive.file: THE TERMINAL SEES ONLY THE ONE FILE IT CREATES ITSELF (" + FILE_NAME + "). TOKENS LIVE IN THE KEY RING ON THIS DEVICE ONLY.";
  }

  // ---- the panel ------------------------------------------------------------

  function syncPanel() {
    var p = el("syncPanel");
    if (!p || p.hidden) return;
    var idBox = el("gdClientId"), st = el("gdState"), log = el("gdLog"), red = el("gdRedirect");
    if (red) red.value = redirectUri();
    if (idBox && document.activeElement !== idBox && !idBox.value) idBox.value = cfg.clientId || "";
    if (st) st.textContent = summary();
    if (log) {
      var rows = cfg.runs.slice(-8).reverse();
      log.textContent = rows.length ? rows.map(function (r) {
        var when = "";
        try { when = window.logTime ? window.logTime.stamp(r.at) : new Date(r.at).toLocaleString(); } catch (e) { when = new Date(r.at).toLocaleString(); }
        return "[" + when + "] " + String(r.dir).toUpperCase() + " " + r.name + " " + fmtSize(r.bytes) + " " + (r.ok ? "OK" : "FAILED") + (r.note ? " :: " + r.note : "");
      }).join("\n") : "NO RUNS YET - SEND PUTS THE ARCHIVE UP, RECEIVE BRINGS IT BACK.";
    }
  }

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }

  function isOpen() { var p = el("syncPanel"); return !!(p && !p.hidden); }

  function open() {
    var p = el("syncPanel");
    if (!p) return;
    if (window.instr && window.instr.isOpen && window.instr.isOpen()) window.instr.close();
    if (window.keyring && window.keyring.isOpen && window.keyring.isOpen()) window.keyring.close();
    if (typeof closeForge === "function" && el("createPanel") && !el("createPanel").hidden) closeForge();
    p.hidden = false;
    syncPanel();
    if (typeof syncDeckSpace === "function") syncDeckSpace();
  }

  function close() {
    var p = el("syncPanel");
    if (p) p.hidden = true;
    forgetArmed = 0;
    if (typeof syncDeckSpace === "function") syncDeckSpace();
  }

  function toggle() { if (isOpen()) close(); else open(); }

  // ---- the work ---------------------------------------------------------------

  async function buildDoc() {
    if (!window.root || !window.root.kv) throw new Error("NO ARCHIVE STORE ON THIS PAGE.");
    const logs = await window.root.kv.sacred_archive.get("master_log") || [];
    return { app: "LIA TERMINAL", kind: "sacred-archive", version: 1, exportedAt: Date.now(), count: logs.length, entries: logs };
  }

  async function send() {
    var doc;
    try { doc = await buildDoc(); }
    catch (e) { fail("up", (e && e.message) || e); return; }
    const text = JSON.stringify(doc);
    const bytes = (typeof TextEncoder !== "undefined") ? new TextEncoder().encode(text).length : text.length;
    pbar("SENDING THE ARCHIVE TO YOUR DRIVE");
    print('SYSTEM', "SYNC :: SENDING " + doc.count + " TURNS (" + fmtSize(bytes) + ") TO YOUR DRIVE...");
    try {
      var res;
      if (cfg.fileId) {
        res = await driveUpload("/files/" + encodeURIComponent(cfg.fileId) + "?uploadType=media", "application/json", text);
        if (!res.ok) throw new Error("UPDATE REFUSED (" + res.status + ")");
      } else {
        var boundary = "lia" + Date.now().toString(36);
        var meta = JSON.stringify({ name: FILE_NAME, mimeType: "application/json", appProperties: { app: "lia-terminal" } });
        var body = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + meta
          + "\r\n--" + boundary + "\r\nContent-Type: application/json\r\n\r\n" + text
          + "\r\n--" + boundary + "--";
        res = await driveUpload("/files?uploadType=multipart", "multipart/related; boundary=" + boundary, body);
        if (!res.ok) throw new Error("UPLOAD REFUSED (" + res.status + ")");
        var j = await res.json();
        if (j && j.id) { cfg.fileId = String(j.id); await persist(); }
      }
      run("up", FILE_NAME, bytes, true, doc.count + " turns");
      var r = ring();
      if (r && r.touch) r.touch(PROVIDER);
      print('SYSTEM', "SYNC :: SENT :: " + doc.count + " TURNS (" + fmtSize(bytes) + ") ARE IN YOUR DRIVE AS " + FILE_NAME + ". RECEIVE ON ANY DEVICE BRINGS THEM BACK.");
    } catch (e) {
      fail("up", (e && e.message) || e);
      return;
    }
    pbarDone();
    syncPanel();
  }

  function fail(dir, note) {
    var r = ring();
    var clean = r ? r.scrub(String(note)) : String(note);
    run(dir, FILE_NAME, 0, false, clean.slice(0, 120));
    pbarDone();
    print('SYSTEM', "SYNC :: " + (dir === "up" ? "SEND" : "RECEIVE") + " FAILED :: " + clean);
    syncPanel();
  }

  async function findFileId() {
    if (cfg.fileId) return cfg.fileId;
    var res = await drive("/files?q=" + encodeURIComponent("name = '" + FILE_NAME + "' and trashed = false") + "&fields=" + encodeURIComponent("files(id, name, modifiedTime)") + "&spaces=drive");
    if (!res.ok) throw new Error("THE DRIVE WOULD NOT LIST FILES (" + res.status + ")");
    var j = await res.json();
    if (!j.files || !j.files.length) throw new Error("NO " + FILE_NAME + " IN YOUR DRIVE YET - SEND FIRST.");
    cfg.fileId = String(j.files[0].id);
    await persist();
    return cfg.fileId;
  }

  async function receive() {
    pbar("TAKING THE ARCHIVE BACK FROM YOUR DRIVE");
    print('SYSTEM', "SYNC :: ASKING YOUR DRIVE FOR " + FILE_NAME + "...");
    try {
      var id = await findFileId();
      var res = await drive("/files/" + encodeURIComponent(id) + "?alt=media");
      if (!res.ok) {
        if (res.status === 404) { cfg.fileId = ""; await persist(); throw new Error("THE CLOUD FILE IS GONE - SEND AGAIN TO MAKE IT."); }
        throw new Error("THE DRIVE WOULD NOT HAND IT OVER (" + res.status + ")");
      }
      var text = await res.text();
      var r = ring();
      if (r && r.touch) r.touch(PROVIDER);
      run("down", FILE_NAME, text.length, true, "received");
      syncPanel();
      if (window.importArchiveFiles) await window.importArchiveFiles([new File([text], FILE_NAME, { type: "application/json" })]);
      else print('SYSTEM', "SYNC :: RECEIVED " + fmtSize(text.length) + " - BUT THE IMPORTER IS OFFLINE, SO IT WAS NOT READ IN.");
    } catch (e) {
      fail("down", (e && e.message) || e);
    }
    pbarDone();
  }

  async function connect() {
    var idBox = el("gdClientId");
    var id = (idBox && idBox.value.trim()) || cfg.clientId || "";
    if (!id) { print('SYSTEM', "SYNC :: PASTE THE OAUTH CLIENT ID FIRST (SYNC PANEL - /cloud setup SAYS WHERE IT COMES FROM)."); open(); return; }
    if (id !== cfg.clientId) { cfg.clientId = id; await persist(); }
    var verifier = randomVerifier();
    var challenge;
    try { challenge = await challengeOf(verifier); }
    catch (e) { print('SYSTEM', "SYNC :: THIS BROWSER CANNOT DO THE PROOF (NO SUBTLECRYPTO) - CONNECT FROM A SECURE PAGE INSTEAD."); return; }
    cfg.pending = { verifier: verifier, at: Date.now() };
    await persist();
    var url = AUTH_URL + "?client_id=" + encodeURIComponent(cfg.clientId)
      + "&redirect_uri=" + encodeURIComponent(redirectUri())
      + "&response_type=code"
      + "&scope=" + encodeURIComponent(SCOPE)
      + "&state=lia-sync"
      + "&access_type=offline"
      + "&prompt=consent"
      + "&code_challenge=" + encodeURIComponent(challenge)
      + "&code_challenge_method=S256";
    var pop = null;
    try { pop = window.open(url, "lia-sync", "width=520,height=640"); } catch (e) {}
    if (!pop) { print('SYSTEM', "SYNC :: THE POPUP WAS BLOCKED - ALLOW POPUPS FOR THIS PAGE AND PRESS CONNECT AGAIN."); return; }
    print('SYSTEM', "SYNC :: APPROVE IN THE POPUP, THEN CLOSE IT - THE DECK CONNECTS BY ITSELF.");
    var waited = 0;
    var tick = setInterval(function () {
      waited += 1500;
      if (connected()) {
        clearInterval(tick);
        run("auth", "google-drive", 0, true, "connected");
        print('SYSTEM', "SYNC :: CONNECTED TO YOUR GOOGLE DRIVE.");
        syncPanel();
        return;
      }
      try { if (pop.closed && waited > 10000) { clearInterval(tick); syncPanel(); } } catch (e) {}
      if (waited >= 180000) clearInterval(tick);
    }, 1500);
  }

  async function forget(sure) {
    var r = ring();
    if (!r || !r.has(PROVIDER)) { print('SYSTEM', "SYNC :: NOT CONNECTED - THERE IS NOTHING TO FORGET."); return; }
    if (!sure || Date.now() - forgetArmed > 6000) {
      forgetArmed = Date.now();
      print('SYSTEM', "SYNC :: FORGET DROPS THE DRIVE TOKENS FROM THIS BROWSER (THE CLOUD FILE STAYS). PRESS AGAIN WITHIN 6S - /cloud forget yes.");
      syncPanel();
      return;
    }
    forgetArmed = 0;
    await r.remove(PROVIDER);
    run("auth", "google-drive", 0, true, "tokens forgotten on this device");
    print('SYSTEM', "SYNC :: FORGOTTEN ON THIS DEVICE :: THE DRIVE TOKENS ARE GONE FROM THE KEY RING. YOUR CLOUD FILE IS UNTOUCHED.");
    close();
  }

  // ---- commands -----------------------------------------------------------------

  function setup() { print('SYSTEM', setupText()); }

  async function words(verb, rest) {
    verb = String(verb || "").toLowerCase();
    if (!verb || verb === "status") { print('SYSTEM', summary() + "\n/cloud connect · send · receive · log · setup · forget"); open(); return; }
    if (verb === "open" || verb === "panel") { open(); return; }
    if (verb === "close") { close(); return; }
    if (verb === "setup" || verb === "help" || verb === "how") { setup(); open(); return; }
    if (verb === "connect" || verb === "login" || verb === "auth") { await connect(); return; }
    if (verb === "send" || verb === "up" || verb === "push" || verb === "backup") { await send(); return; }
    if (verb === "receive" || verb === "down" || verb === "pull" || verb === "fetch" || verb === "restore") { await receive(); return; }
    if (verb === "log" || verb === "runs" || verb === "telemetry") {
      var rows = cfg.runs.slice(-12).reverse();
      print('SYSTEM', "SYNC TELEMETRY (THIS DEVICE ONLY - STAMPS AND COUNTS, NEVER WORDS) ::\n"
        + (rows.length ? rows.map(function (r) {
          var when = "";
          try { when = window.logTime ? window.logTime.stamp(r.at) : new Date(r.at).toLocaleString(); } catch (e) { when = new Date(r.at).toLocaleString(); }
          return "  [" + when + "] " + String(r.dir).toUpperCase() + " " + r.name + " " + fmtSize(r.bytes) + " " + (r.ok ? "OK" : "FAILED") + (r.note ? " :: " + r.note : "");
        }).join("\n") : "  NO RUNS YET."));
      return;
    }
    if (verb === "forget" || verb === "logout" || verb === "disconnect") { await forget(String(rest || "").toLowerCase() === "yes"); return; }
    print('SYSTEM', "NO CLOUD COMMAND CALLED THAT :: /cloud connect · send · receive · log · setup · forget");
  }

  function wire() {
    var c = el("gdConnect");
    if (c && !c.dataset.wired) { c.dataset.wired = "1"; c.addEventListener("click", connect); }
    var s = el("gdSend");
    if (s && !s.dataset.wired) { s.dataset.wired = "1"; s.addEventListener("click", send); }
    var r = el("gdReceive");
    if (r && !r.dataset.wired) { r.dataset.wired = "1"; r.addEventListener("click", receive); }
    var x = el("gdClose");
    if (x && !x.dataset.wired) { x.dataset.wired = "1"; x.addEventListener("click", close); }
    var cp = el("gdCopy");
    if (cp && !cp.dataset.wired) {
      cp.dataset.wired = "1";
      cp.addEventListener("click", function () {
        var red = el("gdRedirect");
        var done = function (ok) { cp.textContent = ok ? "COPIED" : "COPY FAILED"; setTimeout(function () { cp.textContent = "COPY"; }, 1500); };
        try {
          if (red) red.select();
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(redirectUri()).then(function () { done(true); }, function () { done(false); });
          else if (document.execCommand) done(document.execCommand("copy"));
          else done(false);
        } catch (e) { done(false); }
      });
    }
    var sv = el("gdSaveId");
    if (sv && !sv.dataset.wired) {
      sv.dataset.wired = "1";
      sv.addEventListener("click", async function () {
        var idBox = el("gdClientId");
        cfg.clientId = idBox ? idBox.value.trim() : "";
        await persist();
        syncPanel();
        print('SYSTEM', cfg.clientId ? "SYNC :: CLIENT ID KEPT ON THIS DEVICE (IT IS PUBLIC, NOT A SECRET) - PRESS CONNECT." : "SYNC :: CLIENT ID CLEARED.");
      });
    }
    var fg = el("gdForget");
    if (fg && !fg.dataset.wired) {
      fg.dataset.wired = "1";
      fg.addEventListener("click", function () {
        if (Date.now() - forgetArmed > 6000) {
          forgetArmed = Date.now();
          fg.textContent = "SURE?";
          setTimeout(function () { fg.textContent = "FORGET"; }, 6000);
          print('SYSTEM', "SYNC :: FORGET DROPS THE DRIVE TOKENS FROM THIS BROWSER (THE CLOUD FILE STAYS). PRESS AGAIN WITHIN 6S.");
          return;
        }
        fg.textContent = "FORGET";
        forget(true);
      });
    }
    var idBox = el("gdClientId");
    if (idBox && !idBox.dataset.wired) {
      idBox.dataset.wired = "1";
      idBox.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); connect(); }
        e.stopPropagation();
      });
      ["keyup", "keypress"].forEach(function (ev) { idBox.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    }
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);
  wire();

  window.cloudSync = {
    load: load, ready: function () { return ready; },
    state: state, summary: summary, describe: function () {
      return summary() + "\nSEND PUTS THE ARCHIVE IN YOUR DRIVE (" + FILE_NAME + "), RECEIVE BRINGS IT BACK THROUGH IMPORT (MERGED BY STAMP, NEVER DUPLICATED). SCOPE IS drive.file - ONLY THAT ONE FILE. /cloud setup SAYS HOW TO CONNECT.";
    },
    status: summary, setup: setup,
    open: open, close: close, toggle: toggle, isOpen: isOpen,
    connect: connect, send: send, receive: receive, forget: forget,
    words: words, panel: syncPanel
  };
})();
