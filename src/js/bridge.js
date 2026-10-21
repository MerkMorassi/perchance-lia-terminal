(function () {
  "use strict";
  var FOLDER = "lia_settings";
  var SLOT = "bridge";
  var DEFAULT_BASE = "http://127.0.0.1:8098";
  var DEFAULT_AGENT = "LIA";
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function mem() {
    try { return JSON.parse(localStorage.getItem("lia_bridge") || "{}"); }
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
    try { localStorage.setItem("lia_bridge", JSON.stringify(s)); } catch (e) {}
  }
  async function baseUrl() {
    var s = await settings();
    return String(s.baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
  }
  async function agent() {
    var s = await settings();
    return String(s.agent || DEFAULT_AGENT).trim() || DEFAULT_AGENT;
  }
  function stampOf(e) { return Number((e && (e.st || e.ts)) || 0) || 0; }
  function keyOf(e) { return String(e.ts) + "|" + String(e.st || ""); }
  async function transport(url, init) {
    try {
      return await fetch(url, init);
    } catch (e) {
      var sf = window.root && window.root.superFetch;
      if (!sf) throw e;
      return await sf(url, init);
    }
  }
  async function call(path, opts) {
    opts = opts || {};
    var base = await baseUrl();
    var s = await settings();
    var headers = { "Content-Type": "application/json" };
    if (s.apiKey) headers.Authorization = "Bearer " + s.apiKey;
    var res = await transport(base + path, {
      method: opts.method || "GET",
      headers: headers,
      body: (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    });
    var text = await res.text();
    if (!res.ok) {
      if (res.status === 401) throw new Error("THE STORE ASKED FOR ITS KEY (/bridge key <KEY>) - START IT WITHOUT MYTHOS_BRIDGE_KEY FOR OPEN LAN USE.");
      throw new Error("THE STORE REFUSED (" + res.status + ") :: " + text.slice(0, 200));
    }
    try { return JSON.parse(text); }
    catch (e) { throw new Error("THE STORE ANSWERED NON-JSON."); }
  }
  function archive() { return (window.root && window.root.kv && window.root.kv.sacred_archive) || null; }
  async function localLogs() {
    var a = archive();
    if (!a) return null;
    try { return (await a.get("master_log")) || []; }
    catch (e) { return null; }
  }
  function lanNote() {
    return "HTTPS-PAGE LIMIT :: THIS PAGE IS SERVED OVER HTTPS, AND A BROWSER REFUSES PLAIN-HTTP LAN CALLS (MIXED CONTENT + PRIVATE-NETWORK RULES) - SO AN HTTP-ONLY SERVER ON YOUR LAN IS UNREACHABLE FROM HERE NO MATTER WHAT. THE BRIDGE WORKS THE MOMENT THE ENDPOINT IS HTTPS-REACHABLE (A TUNNEL, TAILSCALE SERVE) OR FROM A LOCALLY-SERVED COPY OF THIS TERMINAL. SAME LIMIT AS THE /local LANE.";
  }
  function help() {
    return "BRIDGE (src/js/bridge.js + src/server/mythos-chatlog-server.mjs - chatlogs out of this browser onto his own Mythos server, one JSONL file per agent, append-only both ways).\n"
      + "  SERVER :: node src/server/mythos-chatlog-server.mjs [port] (default 8098, zero dependencies) - MYTHOS_BRIDGE_KEY=<secret> LOCKS IT, /bridge key <secret> MATCHES IT.\n"
      + "  /bridge status :: STORE ANSWERS? TURNS HERE? TURNS THERE?\n"
      + "  /bridge push :: SEND EVERY TURN THE STORE IS MISSING (THE STORE DEDUPES, SO PUSHING TWICE CHANGES NOTHING)\n"
      + "  /bridge pull :: TAKE EVERY TURN THIS BROWSER IS MISSING (MERGE ONLY ADDS BY STAMP, NOTHING IS OVERWRITTEN)\n"
      + "  /bridge base [url] :: POINT AT THE STORE (BARE PRINTS THE SET ONE, DEFAULT " + DEFAULT_BASE + ")\n"
      + "  /bridge key [k] :: THE STORE'S KEY, IF IT ASKS ONE (BARE SAYS SET OR NOT SET - THE KEY ITSELF IS NEVER PRINTED)\n"
      + "  /bridge agent [id] :: WHOSE FILE THE TURNS GO TO (DEFAULT LIA - ONE FILE PER AGENT, LIKE COMMPACK)\n"
      + lanNote();
  }
  async function status() {
    var logs = await localLogs();
    if (!logs) return "BRIDGE :: THE ARCHIVE COULD NOT BE READ ON THIS DEVICE.";
    var ag = await agent();
    try {
      var info = await call("/chatlog/count?agent=" + encodeURIComponent(ag));
      return "BRIDGE :: STORE ALIVE\nBASE :: " + await baseUrl() + "\nAGENT :: " + ag
        + "\nHERE :: " + logs.length + " TURNS\nTHERE :: " + info.total + " TURNS";
    } catch (e) { return "BRIDGE :: STORE NOT REACHABLE :: " + e.message + "\n" + lanNote(); }
  }
  async function push() {
    var logs = await localLogs();
    if (!logs) return "BRIDGE :: THE ARCHIVE COULD NOT BE READ ON THIS DEVICE.";
    var ag = await agent();
    var info;
    try { info = await call("/chatlog/count?agent=" + encodeURIComponent(ag)); }
    catch (e) { return "BRIDGE PUSH FAILED :: " + e.message + "\n" + lanNote(); }
    var fresh = logs.filter(function (e) { return e && e.ts && stampOf(e) > (info.newest || 0); });
    if (!fresh.length) return "BRIDGE PUSH :: NOTHING NEW - THE STORE ALREADY HOLDS ALL " + logs.length + " TURNS HERE (THERE: " + info.total + ").";
    var res;
    try { res = await call("/chatlog/append", { method: "POST", body: { agent: ag, turns: fresh } }); }
    catch (e) { return "BRIDGE PUSH FAILED :: " + e.message; }
    return "BRIDGE PUSH :: SENT " + fresh.length + ", STORE KEPT " + res.added + " (THERE: " + res.total + " TURNS). PUSHING TWICE CHANGES NOTHING - THE STORE DEDUPES BY STAMP.";
  }
  async function pull() {
    var logs = await localLogs();
    if (!logs) return "BRIDGE :: THE ARCHIVE COULD NOT BE READ ON THIS DEVICE.";
    var ag = await agent();
    var newest = 0;
    logs.forEach(function (e) { var s = stampOf(e); if (s > newest) newest = s; });
    var res;
    try { res = await call("/chatlog/since?agent=" + encodeURIComponent(ag) + "&ts=" + newest); }
    catch (e) { return "BRIDGE PULL FAILED :: " + e.message + "\n" + lanNote(); }
    var got = (res.turns || []).filter(function (e) { return e && e.ts; });
    if (!got.length) return "BRIDGE PULL :: NOTHING NEW - THIS BROWSER HOLDS ALL " + res.total + " TURNS THERE (HERE: " + logs.length + ").";
    var keys = {};
    logs.forEach(function (e) { keys[keyOf(e)] = 1; });
    var merged = logs.slice();
    var added = 0;
    got.forEach(function (e) { if (!keys[keyOf(e)]) { keys[keyOf(e)] = 1; merged.push(e); added++; } });
    merged.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    merged = merged.slice(-1000);
    var a = archive();
    try { await a.set("master_log", merged); }
    catch (e) { return "BRIDGE PULL :: TOOK " + added + " BUT COULD NOT WRITE THEM HERE :: " + e.message; }
    return "BRIDGE PULL :: TOOK " + added + " NEW TURNS IN (HERE: " + merged.length + "). THE MERGE ONLY ADDS BY STAMP - NOTHING HERE WAS OVERWRITTEN.";
  }
  async function words(arg) {
    var parts = String(arg || "").trim().split(/\s+/).filter(Boolean);
    var verb = (parts[0] || "").toLowerCase();
    if (!verb || verb === "help") {
      return help() + "\n\nBASE :: " + await baseUrl() + "\nAGENT :: " + await agent();
    }
    if (verb === "status") return status();
    if (verb === "push") return push();
    if (verb === "pull") return pull();
    if (verb === "base") {
      if (!parts[1]) return "BASE :: " + await baseUrl();
      var s = await settings();
      s.baseUrl = parts.slice(1).join(" ").replace(/\/+$/, "");
      await saveSettings(s);
      return "BASE :: " + await baseUrl();
    }
    if (verb === "key") {
      var s3 = await settings();
      if (!parts[1]) return "KEY :: " + (s3.apiKey ? "(SET - NEVER PRINTED)" : "(NOT SET)");
      s3.apiKey = parts.slice(1).join(" ");
      await saveSettings(s3);
      return "KEY :: SET. IT LIVES IN THIS BROWSER ONLY AND IS NEVER PRINTED.";
    }
    if (verb === "agent") {
      if (!parts[1]) return "AGENT :: " + await agent();
      var id = String(parts[1]).trim();
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return "AGENT :: BAD ID (LETTERS, NUMBERS, _ AND -, MAX 40).";
      var s4 = await settings();
      s4.agent = id;
      await saveSettings(s4);
      return "AGENT :: " + id;
    }
    return "BRIDGE :: NO SUCH VERB (" + verb + "). /bridge status | push | pull | base | key | agent.";
  }
  window.mythosBridge = { words: words, help: help, status: status, push: push, pull: pull };
})();
