window.MythosKeyring = (function () {
"use strict";
var EMBEDDED = {
  "version": 1,
  "note": "The API KEYRING registry. Each entry tells keys.js (a) where a key of that provider goes on an outgoing request - a header or a query parameter, its name, an optional scheme, and any static headers the provider demands - and (b) how to probe the key so the KEYRING panel can answer 'is this key alive?' without any integration code existing yet. `browser` records what a browser fetch from THIS generator's origin actually did (measured 2026-09-17, dummy keys): direct = the provider answered the browser (401/400 = a real HTTP answer, so CORS is open); proxy = the fetch was refused by CORS and a relay (root.superFetch, the super-fetch-plugin) is needed. Integration code should read `mode`: when it is 'proxy', call keyring.request() and it will route through the relay by itself. Nothing here is a secret; keys live only in this device's IndexedDB (kv lia_settings / api_keys).",
  "providers": [
    {
      "id": "elevenlabs",
      "label": "ElevenLabs",
      "group": "VOICE",
      "docs": "https://elevenlabs.io/docs/api-reference/text-to-speech",
      "auth": { "place": "header", "name": "xi-api-key" },
      "hint": "starts with sk_",
      "test": { "method": "GET", "url": "https://api.elevenlabs.io/v1/user" },
      "testNote": "the account check needs a key created with the 'user read' permission, and listing voices needs 'voices read'. A key without them still SPEAKS (text_to_speech is a separate permission) - that is why the shipped voice palette exists.",
      "browser": "direct",
      "mode": "direct",
      "use": "her spoken voice (text-to-speech), speech-to-text, and the conversational agents"
    },
    {
      "id": "huggingface",
      "label": "Hugging Face",
      "group": "MODELS",
      "docs": "https://huggingface.co/docs/api-inference",
      "auth": { "place": "header", "name": "Authorization", "scheme": "Bearer" },
      "hint": "starts with hf_",
      "test": { "method": "GET", "url": "https://huggingface.co/api/whoami-v2" },
      "browser": "direct",
      "mode": "direct",
      "use": "inference API: any hosted text, vision, or embedding model - Whisper for his microphone"
    },
    {
      "id": "openai",
      "label": "OpenAI",
      "group": "MODELS",
      "docs": "https://platform.openai.com/docs/api-reference",
      "auth": { "place": "header", "name": "Authorization", "scheme": "Bearer" },
      "hint": "starts with sk-",
      "test": { "method": "GET", "url": "https://api.openai.com/v1/models" },
      "browser": "direct",
      "mode": "direct",
      "use": "chat, embeddings, transcription, and speech"
    },
    {
      "id": "anthropic",
      "label": "Anthropic",
      "group": "MODELS",
      "docs": "https://docs.anthropic.com/en/api/getting-started",
      "auth": {
        "place": "header",
        "name": "x-api-key",
        "extra": { "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }
      },
      "hint": "starts with sk-ant-",
      "test": { "method": "GET", "url": "https://api.anthropic.com/v1/models" },
      "browser": "direct",
      "mode": "direct",
      "use": "Claude models - the browser call only works with the dangerous-direct-browser-access header, which is already declared above"
    },
    {
      "id": "google",
      "label": "Google AI (Gemini)",
      "group": "MODELS",
      "docs": "https://ai.google.dev/gemini-api/docs",
      "auth": { "place": "query", "name": "key" },
      "hint": "starts with AIza",
      "test": { "method": "GET", "url": "https://generativelanguage.googleapis.com/v1beta/models" },
      "browser": "direct",
      "mode": "direct",
      "use": "Gemini text, vision, and the gemini-embedding models the LOREPACK FACTORY mints with. This key rides in the URL, so treat any request log as a secret"
    },
    {
      "id": "google-drive",
      "label": "Google Drive (OAuth)",
      "group": "CLOUD",
      "docs": "https://developers.google.com/drive/api/guides/about-sdk",
      "auth": { "place": "header", "name": "Authorization", "scheme": "Bearer" },
      "hint": "OAuth tokens - connected from the SYNC panel, never pasted",
      "test": { "method": "GET", "url": "https://www.googleapis.com/drive/v3/about?fields=user" },
      "browser": "direct",
      "mode": "direct",
      "use": "private cloud sync of the archive (SYNC send/receive). Scope is drive.file: only the one file the terminal creates itself"
    },
    {
      "id": "stability",
      "label": "Stability AI",
      "group": "IMAGE",
      "docs": "https://platform.stability.ai/docs/api-reference",
      "auth": { "place": "header", "name": "Authorization", "scheme": "Bearer" },
      "hint": "starts with sk-",
      "test": { "method": "GET", "url": "https://api.stability.ai/v1/user/account" },
      "browser": "direct",
      "mode": "direct",
      "use": "image generation and upscaling, as an alternative to the built-in forge"
    },
    {
      "id": "replicate",
      "label": "Replicate",
      "group": "MODELS",
      "docs": "https://replicate.com/docs/reference/http",
      "auth": { "place": "header", "name": "Authorization", "scheme": "Bearer" },
      "hint": "starts with r8_",
      "test": { "method": "GET", "url": "https://api.replicate.com/v1/account" },
      "browser": "proxy",
      "mode": "proxy",
      "use": "hosted models of every kind. Replicate refuses browser-origin calls, so requests go through the relay (super-fetch-plugin)"
    },
    {
      "id": "modelslab",
      "label": "Models Lab",
      "group": "IMAGE",
      "docs": "https://docs.modelslab.com/",
      "auth": { "place": "query", "name": "key" },
      "hint": "",
      "test": null,
      "browser": "direct",
      "mode": "direct",
      "use": "image and video generation. No probe is wired (its account endpoint answers before it reads a key), so the panel will hold this key without checking it"
    },
    {
      "id": "groq",
      "label": "Groq",
      "group": "MODELS",
      "docs": "https://console.groq.com/docs/api-reference",
      "auth": { "place": "header", "name": "Authorization", "scheme": "Bearer" },
      "hint": "starts with gsk_",
      "test": { "method": "GET", "url": "https://api.groq.com/openai/v1/models" },
      "browser": "direct",
      "mode": "direct",
      "use": "Groq chat (OpenAI-compatible API) - the /groq lane, her fastest brain"
    },
    {
      "id": "gatekeeper",
      "label": "PRIAPOS Authority (GateKeeper)",
      "group": "ACCESS",
      "docs": "https://github.com/MerkMorassi/GATEKEEPER-MVP-1.4",
      "auth": { "place": "header", "name": "X-API-Key" },
      "hint": "the Authority's API key (READ_ONLY is enough for the door)",
      "test": null,
      "browser": "",
      "mode": "direct",
      "use": "PRIAPOS, the first door: the key the INSPECT road sends as X-API-Key when a gk_ pass is presented. The module tries a direct browser call first and the relay itself if the Authority refuses the origin. No probe is wired (the Authority's URL is his own server, set with /gatekeeper authority) - /gatekeeper keytest proves the key instead"
    },
    {
      "id": "openl",
      "label": "OpenL (RapidAPI)",
      "group": "MODELS",
      "docs": "https://rapidapi.com/lvwzhen/api/openl-translate",
      "auth": { "place": "header", "name": "X-RapidAPI-Key", "extra": { "X-RapidAPI-Host": "openl-translate.p.rapidapi.com" } },
      "hint": "RapidAPI key (X-RapidAPI-Key) - pasted in the panel, never in the input line",
      "test": { "method": "GET", "url": "https://openl-translate.p.rapidapi.com/translate/languages" },
      "browser": "",
      "mode": "direct",
      "use": "the dead-languages road: OpenL AI translation (171 languages, Ancient Greek as grc) via RapidAPI - the first road /xlate tries when this key is held, MyMemory when it is not"
    }
  ]
};
function client(opts) {
opts = opts || {};
var HOST = (typeof window !== "undefined") ? window : {};
var SEAM = { root: opts.root || HOST.root || null };
function SUPER() { return opts.superFetch || (SEAM.root && SEAM.root.superFetch) || null; }
var STORE = null;
if (opts.store && typeof opts.store.get === "function" && typeof opts.store.set === "function") STORE = opts.store;
else if (opts.kvFolder && typeof opts.kvFolder.get === "function") { (function () { var f = opts.kvFolder, k = opts.slot || "api_keys"; STORE = { get: function () { return f.get(k); }, set: function (s) { return f.set(k, s); } }; })(); }
var MEMSECRETS = {};
var FOLDER = "lia_settings", KEY = "api_keys";
var BUILTIN = [
    { id: "elevenlabs", label: "ElevenLabs", group: "VOICE", auth: { place: "header", name: "xi-api-key" }, hint: "starts with sk_", test: { method: "GET", url: "https://api.elevenlabs.io/v1/user" }, mode: "direct", use: "her spoken voice (text-to-speech)" },
    { id: "huggingface", label: "Hugging Face", group: "MODELS", auth: { place: "header", name: "Authorization", scheme: "Bearer" }, hint: "starts with hf_", test: { method: "GET", url: "https://huggingface.co/api/whoami-v2" }, mode: "direct", use: "inference API: hosted models, embeddings, Whisper" },
    { id: "openai", label: "OpenAI", group: "MODELS", auth: { place: "header", name: "Authorization", scheme: "Bearer" }, hint: "starts with sk-", test: { method: "GET", url: "https://api.openai.com/v1/models" }, mode: "direct", use: "chat, embeddings, transcription, speech" },
    { id: "google", label: "Google AI (Gemini)", group: "MODELS", auth: { place: "query", name: "key" }, hint: "starts with AIza", test: { method: "GET", url: "https://generativelanguage.googleapis.com/v1beta/models" }, mode: "direct", use: "Gemini text, vision and embeddings" }
  ];

  var registry = [];
  var secrets = {};        // id -> { secret, label, addedAt, lastUsedAt }
  var ready = false;
  var selected = "";       // the id the panel's form is pointed at
  var revealed = false;
  var pendingForget = "";  // two-step FORGET, no native confirm() (it blocks the preview)
  var pendingAt = 0;

  
  
  function norm(s) { return String(s == null ? "" : s).trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function when(ms) {
    if (!ms) return "-";
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

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

  function allIds() {
    var ids = registry.map(function (p) { return p.id; });
    Object.keys(secrets).forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
    return ids;
  }


  function validRecord(r) {
    return !!(r && typeof r === "object" && typeof r.secret === "string" && r.secret.trim());
  }

  async function load() {
    secrets = {};
    try {
      var raw = STORE ? await STORE.get() : MEMSECRETS;
      if (raw && typeof raw === "object") {
        Object.keys(raw).forEach(function (id) {
          if (validRecord(raw[id])) {
            secrets[norm(id)] = { secret: String(raw[id].secret), label: String(raw[id].label == null ? "" : raw[id].label), addedAt: Number(raw[id].addedAt) || 0, lastUsedAt: Number(raw[id].lastUsedAt) || 0 };
          }
        });
      }
    } catch (e) {}
    var rows = opts.registry || EMBEDDED;
    loadRegistry(rows && rows.providers ? rows.providers : rows);
    ready = true;
    return summary();
  }

  async function persist() {
    try { if (STORE) await STORE.set(JSON.parse(JSON.stringify(secrets))); else MEMSECRETS = JSON.parse(JSON.stringify(secrets)); return true; }
    catch (e) { return false; }
  }

  function held() { return Object.keys(secrets).length; }
  function has(id) { return !!secrets[norm(id)]; }
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

  function touch(id) {
    var pid = norm(id);
    if (!secrets[pid]) return;
    secrets[pid].lastUsedAt = Date.now();
    persist().catch(function () {});
  }


  function auth(id) {
    var pid = norm(id);
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

  async function request(id, url, opts) {
    var p = provider(id);
    var o = {};
    Object.keys(opts || {}).forEach(function (k) { o[k] = opts[k]; });
    var prepared = attach(id, url, o.headers);
    var init = { method: o.method || "GET", headers: prepared.headers };
    if (o.body !== undefined && o.body !== null) init.body = o.body;
    touch(id);
    if (p.mode === "proxy") {
      if (typeof SUPER() !== "function") {
        throw new Error("KEYRING :: " + p.id.toUpperCase() + " NEEDS THE RELAY (super-fetch-plugin), BUT IT IS NOT LOADED.");
      }
      return await SUPER()(prepared.url, init);
    }
    return await fetch(prepared.url, init);
  }

  async function test(id) {
    var pid = norm(id) || selected;
    var p = provider(pid);
    if (!secrets[pid]) return { ok: false, id: pid, label: p.label, error: "NO KEY IS HELD FOR " + (pid || "THAT ID").toUpperCase() + "." };
    if (!p.test || !p.test.url) return { ok: false, id: pid, label: p.label, error: "NO PROBE IS WIRED FOR " + pid.toUpperCase() + " :: THE KEY IS STORED, BUT NOTHING HERE CAN CHECK IT." };
    var started = Date.now();
    try {
      var res = await request(pid, p.test.url, { method: p.test.method || "GET" });
      var ms = Date.now() - started;
      var snippet = "";
      try {
        snippet = scrub(String(await res.text()).replace(/\s+/g, " ").slice(0, res.ok ? 160 : 220), pid);
      } catch (e) {}
      return { ok: !!res.ok, status: res.status, ms: ms, id: pid, label: p.label, mode: p.mode, snippet: snippet };
    } catch (e) {
      return { ok: false, id: pid, label: p.label, mode: p.mode, error: scrub((e && e.message) ? e.message : e, pid) };
    }
  }


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
      + "\n/keys open TO MANAGE THEM, /keys test <ID> TO PROBE ONE, /keys forget <ID> TO DROP ONE.";
  }

  
function reportTest(r) {
    var name = String(r.label || r.id || "").toUpperCase();
    if (r.error) {
      if (/^NO KEY IS HELD/.test(r.error) || /^NO PROBE IS WIRED/.test(r.error)) return "KEY CHECK :: " + name + " :: " + r.error;
      return "KEY CHECK :: " + name + " :: NO ANSWER :: " + r.error
        + (provider(r.id).mode === "proxy" ? "" : "\nTHAT IS A NETWORK OR CORS FAILURE, NOT A REJECTION - THE REGISTRY SAYS mode 'direct'; TRY SETTING IT TO 'proxy'.");
    }
    if (r.ok) return "KEY CHECK :: " + name + " :: ACCEPTED (HTTP " + r.status + ", " + r.ms + "MS)"
      + (r.snippet ? "\nREPLY :: " + r.snippet : "");
    if (r.status === 401 && /missing_permissions/.test(r.snippet || "")) {
      return "KEY CHECK :: " + name + " :: THE KEY IS LIVE, BUT IT WAS CREATED WITHOUT THE PERMISSION THIS CHECK NEEDS (HTTP 401, " + r.ms + "MS)."
        + "\nTHE PROVIDER SAID :: " + (r.snippet || "")
        + "\nTHAT ONLY AFFECTS THE CHECK - AN INTEGRATION THAT NEEDS A DIFFERENT PERMISSION CAN STILL USE THIS KEY. EDIT THE KEY IN THE PROVIDER'S DASHBOARD (OR MAKE A NEW ONE) TO ADD WHAT IS MISSING.";
    }
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

  
function words(arg) {
var a = String(arg == null ? "" : arg).trim();
if (!a || /^list$/i.test(a)) return describe();
var m = a.match(/^(test|forget|remove|drop)\s+(\S+)\s*$/i);
if (m) {
if (/^test$/i.test(m[1])) return test(m[2]).then(reportTest);
return remove(m[2]).then(function (r) { return r.ok ? ("KEY DROPPED :: " + r.id.toUpperCase() + " :: " + r.masked + " IS NO LONGER HELD HERE.") : ("NOTHING TO DROP :: " + r.error); });
}
return "USAGE :: keys · keys test <ID> · keys forget <ID>";
}
return { load: load, reload: load, set: set, get: get, has: has, held: held, remove: remove, clear: clear, meta: meta, list: list, providers: providers, provider: provider, allIds: allIds, auth: auth, attach: attach, request: request, test: test, reportTest: reportTest, mask: mask, scrub: scrub, looksLikeSecret: looksLikeSecret, summary: summary, describe: describe, touch: touch, words: words };
}
return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosKeyring;
