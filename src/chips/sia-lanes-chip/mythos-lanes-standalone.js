window.MythosLanes = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var HOST = (typeof window !== "undefined") ? window : {};
function KEYRING() { return opts.keyring || HOST.keyring || null; }
var SEAM = { attach: opts.sampleFrames ? { sampleFrames: opts.sampleFrames } : (HOST.attach || null) };
function FETCH(u, i) { var f = opts.fetchFn || fetch; return f(u, i); }
var STORE = null;
if (opts.store && typeof opts.store.get === "function" && typeof opts.store.set === "function") STORE = opts.store;
var MEM = { groq: {}, local: {} };
async function gsettings() {
  try {
    var gv = STORE ? await STORE.get() : MEM;
    return (gv && gv.groq) || {};
  } catch (e) { return {}; }
}
async function gsaveSettings(s) {
  try {
    if (STORE) {
      var gv2 = (await STORE.get()) || {};
      gv2.groq = s;
      await STORE.set(gv2);
    } else { MEM.groq = s; }
  } catch (e) {}
}
async function lsettings() {
  try {
    var lv = STORE ? await STORE.get() : MEM;
    return (lv && lv.local) || {};
  } catch (e) { return {}; }
}
async function lsaveSettings(s) {
  try {
    if (STORE) {
      var lv2 = (await STORE.get()) || {};
      lv2.local = s;
      await STORE.set(lv2);
    } else { MEM.local = s; }
  } catch (e) {}
}
function groqLane() {

  var FOLDER = "lia_settings";
  var SLOT = "groq";
  var API = "https://api.groq.com/openai/v1";
  var DEFAULT_MODEL = "llama-3.3-70b-versatile";
  
  
  
  
  async function model() {
    var s = await gsettings();
    return s.model || DEFAULT_MODEL;
  }
  function needKey() {
    if (!KEYRING()) throw new Error("THE KEYRING IS OFFLINE (src/js/keys.js).");
  }
  async function chat(text, opts) {
    needKey();
    opts = opts || {};
    var m = opts.model || await model();
    var res = await KEYRING().request("groq", API + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: m,
        messages: [{ role: "user", content: String(text) }],
        temperature: (opts.temperature === undefined ? 0.7 : opts.temperature),
        max_tokens: (opts.maxTokens || 1024)
      })
    });
    var body = await res.text();
    if (!res.ok) throw new Error("GROQ REFUSED (" + res.status + ") :: " + body.slice(0, 220));
    var data;
    try { data = JSON.parse(body); } catch (e) { throw new Error("GROQ ANSWERED NON-JSON."); }
    var out = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!out) throw new Error("GROQ ANSWERED WITHOUT A REPLY.");
    return { text: String(out).trim(), model: m };
  }
  async function models() {
    needKey();
    var res = await KEYRING().request("groq", API + "/models", { method: "GET" });
    var body = await res.text();
    if (!res.ok) throw new Error("GROQ REFUSED (" + res.status + ") :: " + body.slice(0, 220));
    var data;
    try { data = JSON.parse(body); } catch (e) { throw new Error("GROQ ANSWERED NON-JSON."); }
    return (data.data || []).map(function (m) { return m.id; }).filter(Boolean).sort();
  }
  function help() {
    return "GROQ (src/js/groq.js - the MODELS lane; key in the KEYRING panel, never pasted here) :: OPENAI-COMPATIBLE CHAT, DIRECT FROM THIS BROWSER.\n"
      + "  /groq status :: KEY HELD? WHICH MODEL IS SET?\n"
      + "  /groq test :: THE KEYRING PROBES THE KEY (GET /models)\n"
      + "  /groq models :: EVERY CHAT MODEL ON THE ACCOUNT, LIVE\n"
      + "  /groq model [id] :: NAME THE MODEL SHE SENDS WITH (BARE PRINTS THE SET ONE)\n"
      + "  /groq chat <text> :: ONE SHOT THROUGH THE SET MODEL - THE LANE PROVING ITSELF, NOT HER VOICE";
  }
  async function words(arg) {
    if (!KEYRING()) return "THE KEYRING IS OFFLINE (src/js/keys.js).";
    var parts = String(arg || "").trim().split(/\s+/).filter(Boolean);
    var verb = (parts[0] || "").toLowerCase();
    if (!verb || verb === "help") {
      var sm = await model();
      return help() + "\n\nMODEL IN FORCE :: " + sm;
    }
    if (verb === "status") {
      var probe = await KEYRING().test("groq");
      return "GROQ :: " + (probe.ok ? "KEY ALIVE (" + probe.status + ", " + probe.ms + " MS, " + probe.mode + ")" : "KEY NOT PROVEN :: " + (probe.error || probe.snippet || "UNKNOWN"))
        + "\nMODEL IN FORCE :: " + await model();
    }
    if (verb === "test") {
      var t = await KEYRING().test("groq");
      return "GROQ PROBE :: " + (t.ok ? "ALIVE (" + t.status + ", " + t.ms + " MS)" : "FAILED :: " + (t.error || t.snippet || "UNKNOWN"))
        + (t.snippet && !t.ok ? "\n" + t.snippet : "");
    }
    if (verb === "models") {
      try {
        var list = await models();
        var cur = await model();
        return "GROQ MODELS (" + list.length + ") ::\n" + list.map(function (m) { return (m === cur ? "* " : "  ") + m; }).join("\n") + "\n/model <id> SETS THE STARRED ONE.";
      } catch (e) { return "MODELS NOT LISTED :: " + e.message; }
    }
    if (verb === "model") {
      if (!parts[1]) return "MODEL IN FORCE :: " + await model();
      var s = await gsettings();
      s.model = parts.slice(1).join(" ");
      await gsaveSettings(s);
      return "MODEL IN FORCE :: " + s.model;
    }
    if (verb === "chat") {
      var q = String(arg || "").replace(/^\s*chat\s*/i, "").trim();
      if (!q) return "CHAT WHAT? /groq chat <text>";
      try {
        var r = await chat(q);
        return "[" + r.model + "]\n" + r.text;
      } catch (e) { return "GROQ CHAT FAILED :: " + e.message; }
    }
    return "UNKNOWN GROQ VERB :: " + help();
  }
  
return { chat: chat, models: models, model: model, words: words, help: help };
}
function localLane() {

  var FOLDER = "lia_settings";
  var SLOT = "local";
  var DEFAULT_BASE = "http://192.168.56.1:1234";
  
  
  
  
  async function baseUrl() {
    var s = await lsettings();
    return (s.baseUrl || DEFAULT_BASE).replace(/\/+$/, "").replace(/\/v1$/, "");
  }
  async function apiKey() {
    var s = await lsettings();
    return s.apiKey || "";
  }
  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    return apiKey().then(function (k) {
      if (k) h.Authorization = "Bearer " + k;
      return h;
    });
  }
  async function model() {
    var s = await lsettings();
    return s.model || "";
  }
  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result || "")); };
      fr.onerror = function () { reject(fr.error || new Error("unreadable")); };
      fr.readAsDataURL(blob);
    });
  }
  async function chat(text, opts) {
    opts = opts || {};
    var base = opts.baseUrl || await baseUrl();
    var m = opts.model || await model();
    if (!m) throw new Error("NO MODEL SET - /local models LISTS WHAT THE SERVER HOLDS, /local model <id> SETS ONE.");
    var content;
    var imgs = opts.images || [];
    var multimodal = null;
    var isAtomic = /1337|atomic/i.test(base);
    if (imgs.length && isAtomic) {
      var parts = [String(text)];
      multimodal = [];
      for (var ai = 0; ai < imgs.length; ai++) {
        var du2 = (typeof imgs[ai] === "string") ? imgs[ai] : await blobToDataURL(imgs[ai]);
        multimodal.push(String(du2).replace(/^data:[^,]+,/, ""));
        parts.push("<__media__>");
      }
      content = parts.join("\n");
    } else if (imgs.length) {
      content = [{ type: "text", text: String(text) }];
      for (var i = 0; i < imgs.length; i++) {
        var du = (typeof imgs[i] === "string") ? imgs[i] : await blobToDataURL(imgs[i]);
        content.push({ type: "image_url", image_url: { url: du } });
      }
    } else {
      content = String(text);
    }
    var payload = {
      model: m,
      messages: [{ role: "user", content: content }],
      temperature: (opts.temperature === undefined ? 0.7 : opts.temperature),
      max_tokens: (opts.maxTokens || 1024)
    };
    if (multimodal) payload.multimodal_data = multimodal;
    var res = await FETCH(base + "/v1/chat/completions", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload)
    });
    var body = await res.text();
    if (!res.ok) throw new Error("LOCAL SERVER REFUSED (" + res.status + ") :: " + body.slice(0, 220));
    var data;
    try { data = JSON.parse(body); } catch (e) { throw new Error("LOCAL SERVER ANSWERED NON-JSON."); }
    var out = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!out) throw new Error("LOCAL SERVER ANSWERED WITHOUT A REPLY.");
    return { text: String(out).trim(), model: (data.model || m) };
  }
  async function models(base) {
    base = base || await baseUrl();
    var res = await FETCH(base + "/v1/models", { headers: await authHeaders() });
    var body = await res.text();
    if (!res.ok) throw new Error("LOCAL SERVER REFUSED (" + res.status + ") :: " + body.slice(0, 220));
    var data;
    try { data = JSON.parse(body); } catch (e) { throw new Error("LOCAL SERVER ANSWERED NON-JSON."); }
    return (data.data || []).map(function (m) { return m.id; }).filter(Boolean).sort();
  }
  function lanNote() {
    return "HTTPS-PAGE LIMIT :: THIS PAGE IS SERVED OVER HTTPS, AND A BROWSER REFUSES PLAIN-HTTP LAN CALLS (MIXED CONTENT + PRIVATE-NETWORK RULES) - SO AN HTTP-ONLY SERVER ON YOUR LAN IS UNREACHABLE FROM HERE NO MATTER WHAT. THE LANE WORKS THE MOMENT THE ENDPOINT IS HTTPS-REACHABLE (A TUNNEL, TAILSCALE SERVE, OR ANY HOSTED OPENAI-COMPATIBLE SERVER). THE MOTHERSHIP APP RUNS LOCAL, SO IT HAS NO SUCH LIMIT.";
  }
  function pickMedia() {
    return new Promise(function (resolve) {
      var inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/*,video/*";
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        resolve(f || null);
      };
      inp.click();
    });
  }
  function help() {
    return "LOCAL (src/js/local.js - the uncensored road; OpenAI-compatible) :: LM STUDIO, ATOMIC CHAT, ANYTHING WITH /v1.\n"
      + "  ATOMIC :: /local base http://127.0.0.1:1337 (NO /v1 - THE LANE ADDS IT) + /local key <ATOMIC-LOCAL-API-KEY> + TRUSTED HOSTS IN THE APP MUST ALLOW THIS PAGE, THEN /local models + /local model <id>.\n"
      + "  /local status :: SERVER ANSWERING? BASE? MODEL?\n"
      + "  /local test :: END-TO-END PROOF (10-TOKEN HELLO THROUGH THE SET MODEL)\n"
      + "  /local models :: WHAT THE SERVER HOLDS RIGHT NOW\n"
      + "  /local model [id] :: NAME THE MODEL SHE SENDS WITH\n"
      + "  /local base [url] :: POINT AT ANOTHER SERVER (BARE PRINTS THE SET ONE)\n"
      + "  /local key [k] :: THE SERVER'S API KEY, IF IT ASKS ONE (BARE SAYS SET OR NOT SET - THE KEY ITSELF IS NEVER PRINTED)\n"
      + "  /local chat <text> :: ONE SHOT THROUGH THE SET MODEL - NOT HER VOICE\n"
      + "  /local see [question] :: PICKS A PICTURE OR CLIP AND SHOWS IT TO THE SET MODEL (A CLIP GOES AS 4 STILLS - THE SAME sampleFrames ROAD HER EYES USE; NEEDS A VISION-CAPABLE MODEL)"
      + lanNote();
  }
  async function words(arg) {
    var parts = String(arg || "").trim().split(/\s+/).filter(Boolean);
    var verb = (parts[0] || "").toLowerCase();    if (!verb || verb === "help") {
      return help() + "\n\nBASE :: " + await baseUrl() + "\nMODEL :: " + (await model() || "(NONE SET)");
    }
    if (verb === "status") {
      try {
        var t0 = Date.now();
        var list = await models();
        return "LOCAL :: SERVER ALIVE (" + (Date.now() - t0) + " MS, " + list.length + " MODELS)"
          + "\nBASE :: " + await baseUrl() + "\nMODEL :: " + (await model() || "(NONE SET - /local model <id>)");
      } catch (e) { return "LOCAL :: SERVER NOT REACHABLE :: " + e.message + "\n" + lanNote(); }
    }
    if (verb === "test") {
      var tm;
      try { tm = await model(); } catch (e) { tm = ""; }
      if (!tm) return "NO MODEL SET - /local models LISTS WHAT THE SERVER HOLDS, /local model <id> SETS ONE, THEN /local test PROVES IT END TO END.";
      try {
        var tr = await chat("Reply with exactly: Test successful", { maxTokens: 10, temperature: 0.1 });
        return "LOCAL :: FULLY FUNCTIONAL\nMODEL :: " + tr.model + "\nREPLY :: " + tr.text;
      } catch (e) { return "LOCAL TEST FAILED :: " + e.message + "\n401 = THE SERVER WANTS ITS KEY (/local key <KEY>). 403 = TRUSTED HOSTS IN THE APP DOES NOT ALLOW THIS PAGE YET. LAN SERVER: LM STUDIO → LOCAL SERVER → ENABLE CORS, THEN RESTART THE SERVER."; }
    }
    if (verb === "models") {
      try {
        var l2 = await models();
        var cur = await model();
        if (!l2.length) return "LOCAL :: SERVER ALIVE, NO MODELS LOADED IN IT.";
        return "LOCAL MODELS (" + l2.length + ") ::\n" + l2.map(function (m) { return (m === cur ? "* " : "  ") + m; }).join("\n");
      } catch (e) { return "MODELS NOT LISTED :: " + e.message; }
    }
    if (verb === "model") {
      if (!parts[1]) return "MODEL :: " + (await model() || "(NONE SET)");
      var s = await lsettings();
      s.model = parts.slice(1).join(" ");
      await lsaveSettings(s);
      return "MODEL :: " + s.model;
    }
    if (verb === "base") {
      if (!parts[1]) return "BASE :: " + await baseUrl();
      var s2 = await lsettings();
      s2.baseUrl = parts[1].replace(/\/+$/, "");
      await lsaveSettings(s2);
      return "BASE :: " + await baseUrl();
    }
    if (verb === "key") {
      var s3 = await lsettings();
      if (!parts[1]) return "KEY :: " + (s3.apiKey ? "(SET - NEVER PRINTED)" : "(NOT SET)");
      s3.apiKey = parts.slice(1).join(" ");
      await lsaveSettings(s3);
      return "KEY :: SET. IT LIVES IN THIS BROWSER ONLY AND IS NEVER PRINTED.";
    }
    if (verb === "chat") {
      var q = String(arg || "").replace(/^\s*chat\s*/i, "").trim();
      if (!q) return "CHAT WHAT? /local chat <text>";
      try {
        var r = await chat(q);
        return "[" + r.model + "]\n" + r.text;
      } catch (e) { return "LOCAL CHAT FAILED :: " + e.message; }
    }
    if (verb === "see") {
      var q = parts.slice(1).join(" ").trim() || "Describe exactly what you see, in detail.";
      var f = await pickMedia();
      if (!f) return "NO FILE PICKED. NOTHING SHOWN.";
      var isVid = /^video\//.test(f.type || "") || /\.(mp4|m4v|mov|webm|ogv|mkv|avi)$/i.test(f.name || "");
      var blobs = [];
      var note = "";
      try {
        if (isVid) {
          if (!SEAM.attach || !SEAM.attach.sampleFrames) return "THE ATTACH MODULE IS OFFLINE (src/js/attach.js) - CLIPS CANNOT BE SAMPLED.";
          var smp = await SEAM.attach.sampleFrames(f, { count: 4 });
          if (!smp.frames.length) return "NO FRAME COULD BE DRAWN FROM THAT CLIP" + (smp.error ? " :: " + smp.error : "") + ".";
          blobs = smp.frames.map(function (fr) { return fr.blob; });
          note = "CLIP AS " + blobs.length + " STILLS";
        } else {
          blobs = [f];
          note = "PICTURE";
        }
        var r = await chat(q, { images: blobs });
        return "[" + r.model + " :: " + note + "]\n" + r.text;
      } catch (e) { return "LOCAL SEE FAILED :: " + e.message; }
    }
    return "UNKNOWN LOCAL VERB :: " + help();
  }
  
return { chat: chat, models: models, model: model, baseUrl: baseUrl, words: words, help: help };
}
var G = groqLane();
var L = localLane();
function help() { return G.help() + "\n\n" + L.help(); }
return { groq: G, local: L, help: help };
}
return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosLanes;
