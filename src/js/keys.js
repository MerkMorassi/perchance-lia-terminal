window.keyring = (function () {
  "use strict";

  /* API KEYRING — the place outside services' keys are kept.

     WHY THIS EXISTS
     Sooner or later the terminal will call something that is not Perchance: her voice through
     ElevenLabs, a Hugging Face model, Gemini embeddings for the LOREPACK factory. Every one of
     those wants a key, and a key in the source is a key given away (the generator's code is
     public), while a key in the transcript is a key in the archive and in her context. So there
     is exactly one place a key may live: IndexedDB on the device that typed it.

       kv `lia_settings` / `api_keys`  ->  { [providerId]: { secret, label, addedAt, lastUsedAt } }

     WHAT IT GUARANTEES
     · A secret is never printed, never returned in describe()/list(), never put in the transcript,
       never written to the archive, and never handed to her. Only mask() of it ever leaves this
       module, and chat.js refuses a message that looks like a raw key before it can be sent.
     · Nothing is uploaded. There is no export here on purpose; the key ring is device-local.
     · It is not stored in src/, so it does not ship with the generator.

     THE REGISTRY (src/keys/providers.json)
     Each provider declares WHERE its key goes on a request (header or query, its name, an optional
     scheme, static headers the provider demands) and HOW to probe it. That is the structure the
     integrations will sit on: no caller ever hardcodes an auth header, it calls auth(id) or
     request(id, url, opts) and the registry decides. A stored id with no registry entry still
     works — it falls back to `Authorization: Bearer <key>` and is labelled by its id.
     `browser`/`mode` in the registry record what a browser fetch from this origin actually did
     when probed with a dummy key (2026-09-17): direct = the provider answered the browser, so CORS
     is open (ElevenLabs, Hugging Face, OpenAI, Anthropic, Google, Stability); proxy = the fetch was
     refused and must be relayed (Replicate). request() reads `mode` and routes accordingly, using
     the super-fetch-plugin when the registry says proxy.

     Commands: /keys · /keys open · /keys test <ID> · /keys forget <ID>
     Panel: the KEYS ▾ button at the end of the lorebar.
     ------------------------------------------------------------------ */

  var FOLDER = "lia_settings";
  var KEY = "api_keys";
  var BYPASS_KEY = "key_bypass";
  var BYPASSABLE = ["elevenlabs", "google"];
  var MANIFEST = "src/keys/providers.json";

  // Used only if src/keys/providers.json cannot be read (offline, or the file moved). The full
  // registry is the JSON; this is the minimum needed for the panel to still be usable.
  var BUILTIN = [
    { id: "elevenlabs", label: "ElevenLabs", group: "VOICE", auth: { place: "header", name: "xi-api-key" }, hint: "starts with sk_", test: { method: "GET", url: "https://api.elevenlabs.io/v1/user" }, mode: "direct", use: "her spoken voice (text-to-speech)" },
    { id: "huggingface", label: "Hugging Face", group: "MODELS", auth: { place: "header", name: "Authorization", scheme: "Bearer" }, hint: "starts with hf_", test: { method: "GET", url: "https://huggingface.co/api/whoami-v2" }, mode: "direct", use: "inference API: hosted models, embeddings, Whisper" },
    { id: "openai", label: "OpenAI", group: "MODELS", auth: { place: "header", name: "Authorization", scheme: "Bearer" }, hint: "starts with sk-", test: { method: "GET", url: "https://api.openai.com/v1/models" }, mode: "direct", use: "chat, embeddings, transcription, speech" },
    { id: "google", label: "Google AI (Gemini)", group: "MODELS", auth: { place: "query", name: "key" }, hint: "starts with AIza", test: { method: "GET", url: "https://generativelanguage.googleapis.com/v1beta/models" }, mode: "direct", use: "Gemini text, vision and embeddings" }
  ];

  var registry = [];
  var secrets = {};        // id -> { secret, label, addedAt, lastUsedAt }
  var bypass = {};         // id -> true when calls to that provider are suppressed
  var ready = false;
  var selected = "";       // the id the panel's form is pointed at
  var revealed = false;
  var pendingForget = "";  // two-step FORGET, no native confirm() (it blocks the preview)
  var pendingAt = 0;

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function el(id) { return document.getElementById(id); }
  function norm(s) { return String(s == null ? "" : s).trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function when(ms) {
    if (!ms) return "-";
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  // The only form in which a secret is ever shown.
  function mask(secret) {
    var s = String(secret || "");
    if (s.length >= 12) return s.slice(0, 3) + "\u2026" + s.slice(-4);
    if (s.length >= 8) return "\u2022\u2022\u2022\u2022" + s.slice(-4);
    return "\u2022\u2022\u2022\u2022";
  }

  function scrub(text, id) {
    var s = String(text == null ? "" : text);
    var rec = secrets[id];
    if (rec && rec.secret) {
      s = s.split(rec.secret).join(mask(rec.secret));
      try { s = s.split(encodeURIComponent(rec.secret)).join(mask(rec.secret)); } catch (e) {}
    }
    return s;
  }

  // A message that looks like a raw key must never reach the transcript (and from there the
  // archive and her context). chat.js asks this before sending.
  var SECRET_PATTERNS = [
    /\bsk[-_][A-Za-z0-9_-]{16,}\b/,
    /\bhf_[A-Za-z0-9]{16,}\b/,
    /\br8_[A-Za-z0-9]{16,}\b/,
    /\bAIza[A-Za-z0-9_-]{20,}\b/,
    /\bxai-[A-Za-z0-9]{16,}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\b(?:api[_-]?key|access[_-]?token|secret[_-]?key)\b\s*[:=]\s*\S{16,}/i
  ];
  function looksLikeSecret(text) {
    var s = String(text || "");
    for (var i = 0; i < SECRET_PATTERNS.length; i++) if (SECRET_PATTERNS[i].test(s)) return true;
    for (var id in secrets) if (secrets[id].secret && s.indexOf(secrets[id].secret) !== -1) return true;
    return false;
  }

  // ---- registry ------------------------------------------------------------

  function loadRegistry(rows) {
    registry = (rows || []).filter(function (p) { return p && p.id; }).map(function (p) {
      return {
        id: norm(p.id), label: p.label || norm(p.id), group: p.group || "", docs: p.docs || "",
        auth: p.auth || { place: "header", name: "Authorization", scheme: "Bearer" },
        hint: p.hint || "", test: p.test || null, mode: p.mode || "direct",
        browser: p.browser || "", use: p.use || "", note: p.note || "", known: true
      };
    });
  }

  function provider(id) {
    var want = norm(id);
    for (var i = 0; i < registry.length; i++) if (registry[i].id === want) return registry[i];
    return {
      id: want, label: want || "(NO ID)", group: "OTHER", docs: "",
      auth: { place: "header", name: "Authorization", scheme: "Bearer" },
      hint: "", test: null, mode: "direct", browser: "", use: "not in the registry - it is sent as Authorization: Bearer", known: false
    };
  }

  function providers() { return registry.slice(); }

  // Every id worth offering in the panel: the registry, plus anything already held (so a key
  // stored before its provider was in the registry can still be selected, tested and removed).
  function allIds() {
    var ids = registry.map(function (p) { return p.id; });
    Object.keys(secrets).forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
    return ids;
  }

  // ---- storage ------------------------------------------------------------

  function validRecord(r) {
    return !!(r && typeof r === "object" && typeof r.secret === "string" && r.secret.trim());
  }

  async function load() {
    var k = kv();
    if (k) {
      try {
        var raw = await k.get(KEY);        secrets = {};
        if (raw && typeof raw === "object") {
          Object.keys(raw).forEach(function (id) {
            if (validRecord(raw[id])) {
              secrets[norm(id)] = {
                secret: String(raw[id].secret),
                label: String(raw[id].label == null ? "" : raw[id].label),
                addedAt: Number(raw[id].addedAt) || 0,
                lastUsedAt: Number(raw[id].lastUsedAt) || 0
              };
            }
          });
        }
      } catch (e) { console.warn("api keyring unreadable", e); }
      try {
        var bp = await k.get(BYPASS_KEY);
        bypass = {};
        if (bp && typeof bp === "object") {
          BYPASSABLE.forEach(function (id) { bypass[id] = !!bp[id]; });
        }
      } catch (e) { bypass = {}; }
    }
    try { if (await mirrorBackfill()) await persist(); } catch (e) {}
    try {
      var res = await fetch(MANIFEST, { cache: "no-store" });      if (!res.ok) throw new Error("HTTP " + res.status);
      var man = await res.json();
      loadRegistry((man && man.providers) || man || []);
    } catch (e) {
      console.warn("provider registry unreadable, using the built-in short list", e);
      loadRegistry(BUILTIN);
    }
    ready = true;
    return summary();
  }

  async function persist() {
    var k = kv();
    if (!k) return false;
    try { await k.set(KEY, secrets); await mirrorSync(); return true; }
    catch (e) { console.warn("api keyring not saved", e); return false; }
  }

  var MIRROR_KEY = "api_keys_mirror";
  var MIRROR_LS = "sias_keys";
  var folkRing = null;

  function mirrorStores() {
    var k = kv();
    var kvStore = {
      name: "kv",
      load: async function () {
        var v = k ? await k.get(MIRROR_KEY) : null;
        return (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
      },
      save: async function (o) { if (k) await k.set(MIRROR_KEY, o || {}); }
    };
    var lsStore = {
      name: "localStorage",
      load: async function () { return window.localStorage.getItem(MIRROR_LS); },
      save: async function (o) { window.localStorage.setItem(MIRROR_LS, JSON.stringify(o || {})); }
    };
    return [kvStore, lsStore];
  }

  function mirror() {
    if (folkRing) return folkRing;
    if (!window.MythosKeyring || typeof window.MythosKeyring.client !== "function") return null;
    try {
      folkRing = window.MythosKeyring.client({ slot: MIRROR_LS, stores: mirrorStores(), isBypassed: function (n) { return bypassed(n); } });
    } catch (e) { return null; }
    return folkRing;
  }

  async function mirrorSync() {
    var m = mirror();
    if (!m) return;
    try {
      var ids = Object.keys(secrets);
      for (var i = 0; i < ids.length; i++) m.set(ids[i], secrets[ids[i]].secret);
      var heldNames = m.names();
      for (var j = 0; j < heldNames.length; j++) if (!secrets[heldNames[j]]) m.clear(heldNames[j]);
    } catch (e) {}
  }

  async function mirrorBackfill() {
    var m = mirror();
    if (!m) return 0;
    var r;
    try { r = await m.restore(); } catch (e) { return 0; }
    if (!r || !r.ok) return 0;
    var added = 0, ids = r.keys || [];
    for (var i = 0; i < ids.length; i++) {
      var id = norm(ids[i]);
      if (!id || secrets[id]) continue;
      var v = m.get(ids[i]);
      if (!v) continue;
      secrets[id] = { secret: String(v), label: "", addedAt: 0, lastUsedAt: 0 };
      added++;
    }
    return added;
  }

  function mirrorStatus() {
    var m = mirror();
    if (!m) return { present: false, ids: [] };
    try { return { present: true, ids: m.names().sort() }; }
    catch (e) { return { present: true, ids: [] }; }
  }

  function held() { return Object.keys(secrets).length; }  function bypassed(id) { return !!bypass[norm(id)]; }
  function bypassLabel(id) { return norm(id) === "google" ? "GOOGLE AI (GEMINI)" : norm(id).toUpperCase(); }
  function bypassError(id) { return "BYPASSED :: " + bypassLabel(id) + " CALLS ARE SUPPRESSED IN THE KEYS PANEL - UNCHECK THE BYPASS TO LET THEM THROUGH. NOTHING WAS SENT."; }
  async function persistBypass() {
    var k = kv();
    if (!k) return false;
    try { await k.set(BYPASS_KEY, bypass); return true; }
    catch (e) { return false; }
  }
  async function setBypass(id, on) {
    var pid = norm(id);
    if (BYPASSABLE.indexOf(pid) === -1) return { ok: false, error: "NO BYPASS IS OFFERED FOR " + (pid || "THAT ID").toUpperCase() + " :: ELEVENLABS AND GOOGLE ONLY." };
    bypass[pid] = !!on;
    await persistBypass();
    syncBypass();
    return { ok: true, id: pid, on: !!on };
  }
  function bypassStatus() {
    return BYPASSABLE.map(function (id) { return "  " + bypassLabel(id) + " :: " + (bypass[id] ? "BYPASSED - NO CALLS LEAVE THIS BROWSER" : "LIVE"); }).join("\n");
  }
  function has(id) { return !!secrets[norm(id)] && !bypassed(id); }
  function get(id) { var r = secrets[norm(id)]; return r ? r.secret : null; }   // use sparingly; never print it
  function meta(id) {
    var r = secrets[norm(id)];
    return r ? { id: norm(id), label: r.label, addedAt: r.addedAt, lastUsedAt: r.lastUsedAt, masked: mask(r.secret) } : null;
  }

  function list() {
    return Object.keys(secrets).sort().map(function (id) {
      var p = provider(id);
      return { id: id, label: p.label, group: p.group, known: p.known, label_note: secrets[id].label, addedAt: secrets[id].addedAt, lastUsedAt: secrets[id].lastUsedAt, masked: mask(secrets[id].secret) };
    });
  }

  async function set(id, secret, info) {
    var pid = norm(id);
    if (!pid) return { ok: false, error: "NO PROVIDER ID." };
    var value = String(secret == null ? "" : secret).trim();
    if (!value) return { ok: false, error: "NOTHING PASTED - THERE IS NO KEY TO STORE." };
    var prev = secrets[pid];
    secrets[pid] = {
      secret: value,
      label: (info && typeof info.label === "string") ? info.label.slice(0, 60) : (prev ? prev.label : ""),
      addedAt: (prev && prev.addedAt) || Date.now(),
      lastUsedAt: (prev && prev.lastUsedAt) || 0
    };
    var saved = await persist();
    return { ok: true, id: pid, masked: mask(value), persisted: saved, provider: provider(pid) };
  }

  async function remove(id) {
    var pid = norm(id);
    if (!secrets[pid]) return { ok: false, error: "NO KEY IS HELD FOR " + (pid || "THAT ID").toUpperCase() + "." };
    var m = mask(secrets[pid].secret);
    delete secrets[pid];
    await persist();
    return { ok: true, id: pid, masked: m };
  }

  async function clear() {
    var n = held();
    secrets = {};
    await persist();
    return { ok: true, removed: n };
  }

  // Marks a key as used. Called by request(); never fails loudly.
  function touch(id) {
    var pid = norm(id);
    if (!secrets[pid]) return;
    secrets[pid].lastUsedAt = Date.now();
    persist().catch(function () {});
  }

  // ---- auth: the one place a key is attached to a request -------------------

  // Returns the pieces an integration needs, or { error }. Never log the result whole.
  function auth(id) {
    var pid = norm(id);
    if (bypassed(pid)) return { error: bypassError(pid) };
    var p = provider(pid);
    var rec = secrets[pid];
    if (!rec) return { error: "NO KEY IS HELD FOR " + (pid || "THAT ID").toUpperCase() + " :: STORE IT IN THE KEYS PANEL (KEYS \u25be) FIRST." };
    var a = p.auth || {};
    var headers = {};
    if (a.extra) Object.keys(a.extra).forEach(function (n) { headers[n] = String(a.extra[n]); });
    var value = (a.scheme ? String(a.scheme) + " " : "") + rec.secret;
    var query = null;
    if (a.place === "query") query = { name: a.name || "key", value: rec.secret };
    else headers[a.name || "Authorization"] = value;
    return { id: pid, provider: p, place: a.place === "query" ? "query" : "header", headers: headers, query: query, secret: rec.secret };
  }

  // Hand back a URL + header set with the key in the right place. The usual entry point for
  // integration code that wants to manage its own fetch.
  function attach(id, url, headers) {
    var a = auth(id);
    if (a.error) throw new Error("KEYRING :: " + a.error);
    var h = {};
    Object.keys(headers || {}).forEach(function (n) { h[n] = headers[n]; });
    Object.keys(a.headers).forEach(function (n) { h[n] = a.headers[n]; });
    var u = String(url || "");
    if (a.query) u += (u.indexOf("?") === -1 ? "?" : "&") + encodeURIComponent(a.query.name) + "=" + encodeURIComponent(a.query.value);
    return { url: u, headers: h };
  }

  // Perform a request through the key ring. Returns the Response (or throws). The registry's
  // `mode` decides the road: "proxy" goes through the super-fetch relay, anything else is a
  // direct browser fetch. Callers never assemble auth themselves.
  async function request(id, url, opts) {
    var p = provider(id);
    if (bypassed(p.id)) throw new Error("KEYRING :: " + bypassError(p.id));
    var o = {};
    Object.keys(opts || {}).forEach(function (k) { o[k] = opts[k]; });
    var prepared = attach(id, url, o.headers);
    var init = { method: o.method || "GET", headers: prepared.headers };
    if (o.body !== undefined && o.body !== null) init.body = o.body;
    touch(id);
    if (p.mode === "proxy") {
      if (!window.root || typeof window.root.superFetch !== "function") {
        throw new Error("KEYRING :: " + p.id.toUpperCase() + " NEEDS THE RELAY (super-fetch-plugin), BUT IT IS NOT LOADED.");
      }
      return await window.root.superFetch(prepared.url, init);
    }
    return await fetch(prepared.url, init);
  }

  // Probe a key without any integration existing: the registry's test endpoint.
  async function test(id) {
    var pid = norm(id) || selected;
    if (bypassed(pid)) return { ok: false, id: pid, label: provider(pid).label, error: bypassError(pid) };
    var p = provider(pid);
    if (!secrets[pid]) return { ok: false, id: pid, label: p.label, error: "NO KEY IS HELD FOR " + (pid || "THAT ID").toUpperCase() + "." };
    if (!p.test || !p.test.url) return { ok: false, id: pid, label: p.label, error: "NO PROBE IS WIRED FOR " + pid.toUpperCase() + " :: THE KEY IS STORED, BUT NOTHING HERE CAN CHECK IT." };
    var started = Date.now();
    try {
      var res = await request(pid, p.test.url, { method: p.test.method || "GET" });
      var ms = Date.now() - started;
      var snippet = "";
      try {
        // The body matters on a refusal too - providers explain themselves there (e.g. ElevenLabs
        // says when a key ID was pasted instead of the key itself), and that text is the useful part.
        snippet = scrub(String(await res.text()).replace(/\s+/g, " ").slice(0, res.ok ? 160 : 220), pid);
      } catch (e) {}
      return { ok: !!res.ok, status: res.status, ms: ms, id: pid, label: p.label, mode: p.mode, snippet: snippet };
    } catch (e) {
      return { ok: false, id: pid, label: p.label, mode: p.mode, error: scrub((e && e.message) ? e.message : e, pid) };
    }
  }

  // ---- text for the terminal -----------------------------------------------

  function summary() {
    return held()
      ? "API KEYRING :: " + held() + " KEY" + (held() === 1 ? "" : "S") + " HELD ON THIS DEVICE"
      : "API KEYRING :: EMPTY";
  }

  function describe() {
    if (!held()) {
      return summary() + "\nNOTHING IS STORED YET. THE KEYS PANEL KEEPS API KEYS IN THIS BROWSER ONLY - THEY NEVER ENTER THE TRANSCRIPT, THE ARCHIVE, OR HER CONTEXT."
        + "\n/keys open TO MANAGE THEM. PASTE A KEY IN THE PANEL, NEVER IN THE INPUT LINE.";
    }
    return summary() + "\n" + list().map(function (r) {
      return "  " + r.id.toUpperCase() + " :: " + r.masked
        + " :: ADDED " + when(r.addedAt) + " :: LAST USED " + when(r.lastUsedAt)
        + (r.label_note ? " :: " + r.label_note : "")
        + (r.known ? "" : " :: NOT IN THE REGISTRY");
    }).join("\n")
      + "\nKEYS LIVE IN THIS BROWSER (kv " + FOLDER + " / " + KEY + ") AND NOWHERE ELSE."
      + "\nCALL SUPPRESSION ::\n" + bypassStatus()
      + "\n/keys open TO MANAGE THEM, /keys test <ID> TO PROBE ONE, /keys forget <ID> TO DROP ONE, /keys bypass <elevenlabs|google> <on|off> TO SUPPRESS ITS CALLS.";
  }

  function report(keyword) {
    var arg = String(keyword == null ? "" : keyword).trim();
    var low = arg.toLowerCase();
    if (!arg) { selected = selected || (allIds()[0] || ""); render(); open(); return; }
    if (low === "open") { open(); return; }
    if (low === "list") { print("SYSTEM", describe()); return; }
    if (low === "close") { close(); return; }
    var parts = arg.split(/\s+/);
    var verb = String(parts[0] || "").toLowerCase();
    var rest = parts.slice(1).join(" ").trim();
    if (verb === "test" || verb === "check") {
      if (!rest) { print("SYSTEM", "USAGE: /keys test <PROVIDER-ID>"); return; }
      print("SYSTEM", "CHECKING " + norm(rest).toUpperCase() + " ...");
      test(rest).then(function (r) { print("SYSTEM", reportTest(r)); }).catch(function (e) { print("SYSTEM", "CHECK FAILED :: " + ((e && e.message) ? e.message : e)); });
      return;
    }
    if (verb === "forget" || verb === "remove" || verb === "drop") {
      if (!rest) { print("SYSTEM", "USAGE: /keys forget <PROVIDER-ID>"); return; }
      remove(rest).then(function (r) {
        print("SYSTEM", r.ok ? "KEY DROPPED :: " + r.id.toUpperCase() + " :: " + r.masked + " IS NO LONGER HELD HERE." : "NOTHING TO DROP :: " + r.error);
        render();
      });
      return;
    }
    if (verb === "bypass") {
      var bp = rest.split(/\s+/).filter(Boolean);
      if (!bp.length) { print("SYSTEM", "CALL SUPPRESSION ::\n" + bypassStatus() + "\nUSAGE: /keys bypass <elevenlabs|google> <on|off>"); return; }
      var bid = norm(bp[0]);
      if (BYPASSABLE.indexOf(bid) === -1) { print("SYSTEM", "NO BYPASS IS OFFERED FOR " + (bid || "THAT ID").toUpperCase() + " :: ELEVENLABS AND GOOGLE ONLY."); return; }
      if (bp.length < 2) { print("SYSTEM", bypassLabel(bid) + " :: " + (bypassed(bid) ? "BYPASSED - NO CALLS LEAVE THIS BROWSER." : "LIVE.") + "\nUSAGE: /keys bypass " + bid + " <on|off>"); return; }
      var want = String(bp[1]).toLowerCase();
      if (want !== "on" && want !== "off" && want !== "yes" && want !== "no") { print("SYSTEM", "USAGE: /keys bypass " + bid + " <on|off>"); return; }
      setBypass(bid, want === "on" || want === "yes").then(function (r) {
        print("SYSTEM", r.ok ? (bypassLabel(r.id) + (r.on ? " :: BYPASSED - ITS CALLS ARE SUPPRESSED, NOTHING WILL BE SENT." : " :: LIVE AGAIN - ITS CALLS GO THROUGH.")) : r.error);
        render();
      });
      return;
    }
    print("SYSTEM", "USAGE: /keys \u00b7 /keys open \u00b7 /keys test <ID> \u00b7 /keys forget <ID> \u00b7 /keys bypass <elevenlabs|google> <on|off>");
  }

  function reportTest(r) {
    var name = String(r.label || r.id || "").toUpperCase();
    if (r.error) {
      // "no key held" / "no probe wired" are our own refusals, not a provider that failed to
      // answer - so the network hint must not appear, or it reads as a false diagnosis.
      if (/^NO KEY IS HELD/.test(r.error) || /^NO PROBE IS WIRED/.test(r.error) || /^BYPASSED ::/.test(r.error)) return "KEY CHECK :: " + name + " :: " + r.error;
      return "KEY CHECK :: " + name + " :: NO ANSWER :: " + r.error
        + (provider(r.id).mode === "proxy" ? "" : "\nTHAT IS A NETWORK OR CORS FAILURE, NOT A REJECTION - THE REGISTRY SAYS mode 'direct'; TRY SETTING IT TO 'proxy'.");
    }
    if (r.ok) return "KEY CHECK :: " + name + " :: ACCEPTED (HTTP " + r.status + ", " + r.ms + "MS)"
      + (r.snippet ? "\nREPLY :: " + r.snippet : "");
    // A scoped key: alive, but created without the permission this particular probe needs. That is
    // not a dead key, and saying so would send the user chasing a working credential.
    if (r.status === 401 && /missing_permissions/.test(r.snippet || "")) {
      return "KEY CHECK :: " + name + " :: THE KEY IS LIVE, BUT IT WAS CREATED WITHOUT THE PERMISSION THIS CHECK NEEDS (HTTP 401, " + r.ms + "MS)."
        + "\nTHE PROVIDER SAID :: " + (r.snippet || "")
        + "\nTHAT ONLY AFFECTS THE CHECK - AN INTEGRATION THAT NEEDS A DIFFERENT PERMISSION CAN STILL USE THIS KEY. EDIT THE KEY IN THE PROVIDER'S DASHBOARD (OR MAKE A NEW ONE) TO ADD WHAT IS MISSING.";
    }
    // A KEY THAT IS FINE AND AN ACCOUNT THAT IS EMPTY. Measured on ElevenLabs 2026-09-21: a live key,
    // text-to-speech and speech-to-text both authorized, and every call answered "This request exceeds
    // your quota of 10000. You have 0 credits remaining". Reporting that as "the provider did not
    // accept this key" would send him to re-issue a key that is not the problem.
    // A KEY THAT IS FINE AND A PLAN THAT IS NOT. Same family as the quota branch below, different
    // cause: nothing is wrong with the key, the account simply may not use this. Measured on
    // ElevenLabs 2026-09-21: a library voice answers HTTP 402 paid_plan_required. Re-issuing the key
    // would change nothing, so it must not read as a rejection.
    if (/paid_plan_required|library voice/i.test(r.snippet || "")) {
      return "KEY CHECK :: " + name + " :: THE KEY IS LIVE, BUT THIS ACCOUNT'S PLAN DOES NOT INCLUDE WHAT THE CHECK ASKED FOR (HTTP " + r.status + ", " + r.ms + "MS)."
        + "\nTHE PROVIDER SAID :: " + (r.snippet || "")
        + "\nTHAT IS A PLAN STATE, NOT A BAD KEY - DO NOT RE-ISSUE IT.";
    }
    if (r.status === 402 || /quota_exceeded|exceeds your quota|out of credits|insufficient (credits|balance)/i.test(r.snippet || "")) {
      return "KEY CHECK :: " + name + " :: THE KEY IS LIVE, BUT THE ACCOUNT HAS NO QUOTA LEFT (HTTP " + r.status + ", " + r.ms + "MS)."
        + "\nTHE PROVIDER SAID :: " + (r.snippet || "")
        + "\nNOTHING OF THIS KIND WILL SUCCEED UNTIL THE PLAN OR THE CREDITS ARE TOPPED UP. THAT IS AN ACCOUNT STATE, NOT A BAD KEY - DO NOT RE-ISSUE IT.";
    }
    return "KEY CHECK :: " + name + " :: REJECTED (HTTP " + r.status + ", " + r.ms + "MS) - THE PROVIDER DID NOT ACCEPT THIS KEY."
      + (r.snippet ? "\nTHE PROVIDER SAID :: " + r.snippet : "");
  }

  // ---- the panel -----------------------------------------------------------

  function isOpen() { var p = el("keysPanel"); return !!(p && !p.hidden); }

  function groupedIds() {
    var order = ["VOICE", "MODELS", "IMAGE", "OTHER", ""];
    var ids = allIds();
    var byGroup = {};
    ids.forEach(function (id) {
      var g = provider(id).group;
      if (order.indexOf(g) === -1) g = "OTHER";
      (byGroup[g] = byGroup[g] || []).push(id);
    });
    var out = [];
    order.forEach(function (g) {
      if (!byGroup[g]) return;
      out.push({ group: g, ids: byGroup[g].sort() });
      delete byGroup[g];
    });
    Object.keys(byGroup).forEach(function (g) { out.push({ group: g, ids: byGroup[g].sort() }); });
    return out;
  }

  function renderProvider() {
    var sel = el("kpProvider");
    if (!sel) return;
    sel.textContent = "";
    groupedIds().forEach(function (g) {
      var holder = g.group ? document.createElement("optgroup") : sel;
      if (g.group) holder.label = g.group;
      g.ids.forEach(function (id) {
        var p = provider(id);
        var o = document.createElement("option");
        o.value = id;
        o.textContent = p.label.toUpperCase() + (has(id) ? " \u25cf" : "");
        o.title = p.known ? (p.use || "") : "not in the registry";
        holder.appendChild(o);
      });
      if (g.group) sel.appendChild(holder);
    });
    var other = document.createElement("option");
    other.value = "__other__";
    other.textContent = "OTHER PROVIDER (TYPE AN ID)";
    sel.appendChild(other);
    var custom = el("kpCustomId");
    var want = selected || allIds()[0] || "";
    if (want && idsInclude(want)) sel.value = want;
    else if (want) { sel.value = "__other__"; if (custom) custom.value = want; }
    syncProvider(true);
  }

  function idsInclude(id) {
    var ids = allIds();
    for (var i = 0; i < ids.length; i++) if (ids[i] === id) return true;
    return false;
  }

  function formId() {
    var sel = el("kpProvider");
    if (!sel) return "";
    if (sel.value === "__other__") {
      var c = el("kpCustomId");
      return norm(c ? c.value : "");
    }
    return norm(sel.value);
  }

  function syncProvider(keepSecret) {
    var id = formId();
    var p = provider(id);
    var customRow = el("kpCustomRow");
    if (customRow) customRow.hidden = (el("kpProvider") && el("kpProvider").value !== "__other__");
    var use = el("kpUse");
    if (use) use.textContent = p.known
      ? (p.use || "").toUpperCase()
      : "NOT IN THE REGISTRY :: SENT AS AUTHORIZATION: BEARER";
    var hint = el("kpSecretHint");
    if (hint) hint.textContent = p.hint ? "KEY " + String(p.hint).toUpperCase() : (p.docs ? "KEY FOR " + p.label.toUpperCase() : "");
    var meta = secrets[id];
    var lab = el("kpLabel");
    if (lab) lab.value = meta && meta.label ? meta.label : "";
    var st = el("kpState2");
    if (st) st.textContent = meta ? "HELD :: " + mask(meta.secret) + " :: ADDED " + when(meta.addedAt) : "NOT HELD";
    if (!keepSecret) { var s = el("kpSecret"); if (s) s.value = ""; setReveal(false); }
    var t = el("kpTest"), r = el("kpRemove");
    if (t) t.disabled = !meta;
    if (r) r.disabled = !meta;
  }

  function renderList() {
    var box = el("kpList");
    if (!box) return;
    box.textContent = "";
    var rows = list();
    if (!rows.length) {
      var empty = document.createElement("div");
      empty.className = "kpEmpty";
      empty.textContent = "NOTHING IS STORED YET. PICK A PROVIDER, PASTE ITS KEY, AND STORE IT - IT STAYS IN THIS BROWSER AND NOWHERE ELSE.";
      box.appendChild(empty);
      return;
    }
    rows.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "kpEntry" + (r.id === formId() ? " on" : "");
      row.dataset.id = r.id;
      var name = document.createElement("span");
      name.className = "kpName";
      name.textContent = r.id.toUpperCase() + (r.known ? "" : " \u00b7 UNREGISTERED");
      var masked = document.createElement("span");
      masked.className = "kpMask";
      masked.textContent = r.masked;
      var meta = document.createElement("span");
      meta.className = "kpMeta";
      meta.textContent = "ADDED " + when(r.addedAt) + " \u00b7 USED " + when(r.lastUsedAt);
      var pick = document.createElement("button");
      pick.type = "button";
      pick.className = "kpPick";
      pick.textContent = "SELECT";
      pick.onclick = function () { pickId(r.id); };
      row.onclick = function (e) { if (e.target !== pick) pickId(r.id); };
      row.appendChild(name);
      row.appendChild(masked);
      row.appendChild(meta);
      row.appendChild(pick);
      box.appendChild(row);
    });
  }

  function pickId(id) {
    selected = norm(id);
    var sel = el("kpProvider");
    if (sel) {
      if (idsInclude(selected)) { sel.value = selected; }
      else { sel.value = "__other__"; var c = el("kpCustomId"); if (c) c.value = selected; }
    }
    syncProvider(false);
    renderList();
    var s = el("kpSecret");
    if (s) s.focus();
  }

  function setReveal(on) {
    revealed = !!on;
    var s = el("kpSecret"), b = el("kpReveal");
    if (s) s.type = revealed ? "text" : "password";
    if (b) b.textContent = revealed ? "HIDE" : "SHOW";
  }

  function setState() {
    var st = el("kpState");
    if (st) st.textContent = held() ? held() + " KEY" + (held() === 1 ? "" : "S") + " ON THIS DEVICE" : "EMPTY";
  }

  function render() { renderProvider(); renderList(); setState(); syncBypass(); fit(); }

  function syncBypass() {
    BYPASSABLE.forEach(function (id) {
      var box = el(id === "elevenlabs" ? "kpBypassEleven" : "kpBypassGoogle");
      if (box) box.checked = !!bypass[id];
    });
    var st = el("kpBypassState");
    if (st) {
      var off = BYPASSABLE.filter(function (id) { return bypass[id]; });
      st.textContent = off.length ? "SUPPRESSED :: " + off.map(bypassLabel).join(" + ") : "NOTHING SUPPRESSED";
    }
  }

  async function flipBypass(id, on) {
    var r = await setBypass(id, on);
    print("SYSTEM", r.ok ? (bypassLabel(r.id) + (r.on ? " :: BYPASSED - ITS CALLS ARE SUPPRESSED, NOTHING WILL BE SENT." : " :: LIVE AGAIN - ITS CALLS GO THROUGH.")) : r.error);
    render();
    return r;
  }

  // The panel floats above the command deck, so it can only be as tall as the room the deck
  // leaves it - same rule as the SYSTEM panel.
  function fit() {
    var p = el("keysPanel"), deck = el("command-deck");
    if (!p || p.hidden || !deck) return;
    var room = Math.round(deck.getBoundingClientRect().top - 12);
    p.style.maxHeight = Math.max(200, room) + "px";
  }

  function open() {
    var p = el("keysPanel");
    if (!p) return;
    p.hidden = false;
    // one deck panel at a time
    var sys = el("systemPanel"), forge = el("createPanel");
    if (sys && !sys.hidden && window.instr && typeof window.instr.close === "function") window.instr.close();
    if (forge && !forge.hidden && typeof closeForge === "function") closeForge();
    if (!selected) selected = allIds()[0] || "";
    render();
    print("SYSTEM", summary() + "\nKEYS ARE KEPT IN THIS BROWSER ONLY - NEVER PRINTED, NEVER IN THE TRANSCRIPT OR THE ARCHIVE, NEVER HANDED TO HER. PASTE THEM INTO THE BOX ABOVE, NEVER INTO THE INPUT LINE."
      + "\nTHE REGISTRY DECIDES WHERE EACH KEY GOES ON A REQUEST (HEADER OR QUERY) AND HOW IT IS PROBED, SO NO INTEGRATION EVER HARDCODES AUTH.");
  }

  function close() {
    var p = el("keysPanel");
    if (p) p.hidden = true;
    setReveal(false);
    var s = el("kpSecret");
    if (s) s.value = "";
  }

  function toggle() { if (isOpen()) close(); else open(); }

  async function save() {
    var id = formId();
    var s = el("kpSecret");
    var lab = el("kpLabel");
    if (!id) { print("SYSTEM", "PICK A PROVIDER FIRST (OR TYPE AN ID UNDER 'OTHER PROVIDER')."); return; }
    var res = await set(id, s ? s.value : "", { label: lab ? lab.value : "" });
    if (!res.ok) { print("SYSTEM", res.error); return; }
    if (s) s.value = "";
    setReveal(false);
    selected = res.id;
    print("SYSTEM", "KEY STORED :: " + res.provider.label.toUpperCase() + " :: " + res.masked
      + " :: KEPT IN THIS BROWSER ONLY (" + (res.persisted ? "SAVED" : "NOT PERSISTED - STORAGE UNAVAILABLE") + ")."
      + "\nIT WILL NEVER BE PRINTED, PUT IN THE TRANSCRIPT, OR SENT TO HER. /keys test " + res.id + " TO PROBE IT.");
    render();
  }

  async function runTest() {
    var id = formId();
    if (!id) { print("SYSTEM", "PICK A PROVIDER FIRST."); return; }
    print("SYSTEM", "CHECKING " + id.toUpperCase() + " ...");
    var r = await test(id);
    print("SYSTEM", reportTest(r));
    render();
  }

  // Two clicks, six seconds apart at most: a native confirm() would block the live preview.
  async function forget() {
    var id = formId();
    if (!id) { print("SYSTEM", "PICK A PROVIDER FIRST."); return; }
    if (!secrets[id]) { print("SYSTEM", "NO KEY IS HELD FOR " + id.toUpperCase() + "."); return; }
    var now = Date.now();
    if (pendingForget !== id || now - pendingAt > 6000) {
      pendingForget = id;
      pendingAt = now;
      print("SYSTEM", "FORGET " + id.toUpperCase() + " :: PRESS FORGET KEY AGAIN WITHIN SIX SECONDS AND IT IS DROPPED FROM THIS BROWSER.");
      return;
    }
    pendingForget = "";
    var res = await remove(id);
    print("SYSTEM", res.ok ? "KEY DROPPED :: " + res.id.toUpperCase() + " :: " + res.masked + " IS NO LONGER HELD HERE." : res.error);
    render();
  }

  // The provider dropdown / the custom-id box changed: point the form at the new id and clear
  // whatever was typed for the old one.
  function choose() {
    selected = formId();
    syncProvider(false);
    renderList();
  }

  return {
    load: load, ready: function () { return ready; }, summary: summary, describe: describe,
    providers: providers, provider: provider, allIds: allIds,
    held: held, has: has, get: get, meta: meta, list: list, mask: mask, when: when,
    set: set, remove: remove, clear: clear, persist: persist, touch: touch,
    mirror: mirrorStatus,
    auth: auth, attach: attach, request: request, test: test,
    bypassed: bypassed, setBypass: setBypass, bypassStatus: bypassStatus, flipBypass: flipBypass, syncBypass: syncBypass,
    looksLikeSecret: looksLikeSecret, scrub: scrub,
    report: report, reportTest: reportTest,
    open: open, close: close, toggle: toggle, isOpen: isOpen, render: render, fit: fit,
    select: pickId, choose: choose, save: save, runTest: runTest, forget: forget, setReveal: setReveal,
    selectedId: function () { return selected; }
  };
})();
