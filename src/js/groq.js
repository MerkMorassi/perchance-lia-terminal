(function () {
  "use strict";
  var FOLDER = "lia_settings";
  var SLOT = "groq";
  var API = "https://api.groq.com/openai/v1";
  var DEFAULT_MODEL = "llama-3.3-70b-versatile";
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function mem() {
    try { return JSON.parse(localStorage.getItem("lia_groq") || "{}"); }
    catch (e) { return {}; }
  }
  async function settings() {
    var k = kv();
    if (k) { try { var s = await k.get(SLOT); if (s && typeof s === "object") return s; } catch (e) {} }
    return mem();
  }
  async function saveSettings(s) {
    var k = kv();
    if (k) { try { await k.set(SLOT, s); } catch (e) {} }
    try { localStorage.setItem("lia_groq", JSON.stringify(s)); } catch (e) {}
  }
  async function model() {
    var s = await settings();
    return s.model || DEFAULT_MODEL;
  }
  function needKey() {
    if (!window.keyring) throw new Error("THE KEYRING IS OFFLINE (src/js/keys.js).");
  }
  async function chat(text, opts) {
    needKey();
    opts = opts || {};
    var m = opts.model || await model();
    var res = await window.keyring.request("groq", API + "/chat/completions", {
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
    var res = await window.keyring.request("groq", API + "/models", { method: "GET" });
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
    if (!window.keyring) return "THE KEYRING IS OFFLINE (src/js/keys.js).";
    var parts = String(arg || "").trim().split(/\s+/).filter(Boolean);
    var verb = (parts[0] || "").toLowerCase();
    if (!verb || verb === "help") {
      var sm = await model();
      return help() + "\n\nMODEL IN FORCE :: " + sm;
    }
    if (verb === "status") {
      var probe = await window.keyring.test("groq");
      return "GROQ :: " + (probe.ok ? "KEY ALIVE (" + probe.status + ", " + probe.ms + " MS, " + probe.mode + ")" : "KEY NOT PROVEN :: " + (probe.error || probe.snippet || "UNKNOWN"))
        + "\nMODEL IN FORCE :: " + await model();
    }
    if (verb === "test") {
      var t = await window.keyring.test("groq");
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
      var s = await settings();
      s.model = parts.slice(1).join(" ");
      await saveSettings(s);
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
  window.groq = { chat: chat, models: models, model: model, words: words, help: help };
})();
