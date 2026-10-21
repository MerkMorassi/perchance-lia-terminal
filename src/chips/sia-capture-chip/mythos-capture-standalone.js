window.MythosCapture = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var HOST = (typeof window !== "undefined") ? window : {};
var STORE = opts.store || null;
var LOGSTORE = opts.logStore || null;
function GEN() {
  if (typeof opts.generateText === "function") return opts.generateText;
  if (HOST.root && HOST.root.generateText) return HOST.root.generateText;
  return null;
}
function PROG() {
  if (opts.progress) return opts.progress;
  if (HOST.progress) return HOST.progress;
  return null;
}
function WRAPOK() { if (typeof opts.wrap === "function") return true; try { return !!(HOST.docstd && HOST.docstd.wrap); } catch (e) { return false; } }
function WRAP() { if (typeof opts.wrap === "function") return opts.wrap; return HOST.docstd.wrap; }
function ING() {
  if (typeof opts.ingest === "function") return opts.ingest;
  if (HOST.lore && HOST.lore.ingest) return HOST.lore.ingest;
  return null;
}
function kv() {
  if (LOGSTORE) return { sacred_archive: LOGSTORE };
  try { return (HOST.root && HOST.root.kv) || null; }
  catch (e) { return null; }
}
function settings() {
  if (STORE) return STORE;
  try { return (HOST.root && HOST.root.kv && HOST.root.kv.lia_settings) || null; }
  catch (e) { return null; }
}
function stamp(ts) {
  if (typeof opts.stamp === "function") { try { return opts.stamp(ts); } catch (e) {} }
  try {
    if (HOST.logTime && HOST.logTime.stamp) return HOST.logTime.stamp(ts);
  } catch (e) {}
  try { return new Date(ts).toISOString().slice(0, 16).replace("T", " "); }
  catch (e2) { return String(ts); }
}
var STATE_KEY = "capture_state";
  var drafting = false;
  var live = false;

  (function () {
    setTimeout(async function () {
      try {
        for (var i = 0; i < 60; i++) {
          if (HOST.root && HOST.root.kv) break;
          await new Promise(function (r) { setTimeout(r, 500); });
        }
        var s = settings();
        if (!s) return;
        var st = await s.get(STATE_KEY);
        live = !!(st && st.active);
      } catch (e) {}
    }, 0);
  })();

  async function state() {
    var s = settings();
    if (!s) return null;
    try { return (await s.get(STATE_KEY)) || null; }
    catch (e) { return null; }
  }

  async function save(st) {
    var s = settings();
    if (!s) return false;
    try { await s.set(STATE_KEY, st); return true; }
    catch (e) { return false; }
  }

  function dayOf(ts) {
    try { return new Date(ts).toISOString().slice(0, 10); }
    catch (e) { return "UNDATED"; }
  }

  function cleanTopic(t) {
    t = String(t == null ? "" : t).trim().replace(/\s+/g, " ");
    if (!t) t = "UNTITLED SESSION";
    return t.slice(0, 80).toUpperCase();
  }

  function fileNameOf(day, topic) {
    var safe = String(topic).replace(/[^A-Z0-9 \-_.]/gi, "").trim().replace(/\s+/g, " ").slice(0, 60) || "UNTITLED SESSION";
    return "CAPTURE " + day + " " + safe + ".md";
  }

  async function start(topic) {
    var st = (await state()) || {};
    if (st.active) return { ok: false, error: "CAPTURE MODE IS ALREADY ACTIVE :: STARTED " + stamp(st.startedAt) + " :: " + (st.topic || "UNTITLED SESSION") + " :: /capturemode stop ENDS IT." };
    st = { active: true, startedAt: Date.now(), fromTs: Date.now(), topic: cleanTopic(topic), draft: null };
    await save(st);
    live = true;
    return { ok: true, topic: st.topic, at: st.startedAt };
  }

  function block() {
    if (!live) return "";
    return "CAPTURE MODE IS ON: this session is being captured for the archive, so speak as one who is being transcribed - structured thoughts, one point at a time, plain words. Nothing about this changes what you may say.";
  }

  function isActive(st) { return !!(st && st.active); }

  async function turns() {
    var k = kv();
    if (!k) return null;
    var st = await state();
    if (!st) return [];
    var logs = [];
    try { logs = (await k.sacred_archive.get("master_log")) || []; } catch (e) { return null; }
    var from = st.fromTs || 0;
    return logs.filter(function (e) {
      if (!e || e.silent || e.kind === "create") return false;
      if ((e.ts || 0) < from && (e.st || 0) < from) return false;
      var h = String(e.h == null ? "" : e.h).trim();
      if (h.charAt(0) === "/") return false;
      var s = String(e.s == null ? "" : e.s).trim();
      return !!(h || s);
    });
  }

  function participantsOf(list) {
    var seen = {}, out = ["PATRIKIOS (HITL)"];
    (list || []).forEach(function (e) {
      var r = String((e && e.role) || "").trim().toUpperCase();
      if (r && r !== "HITL" && !seen[r]) { seen[r] = 1; out.push(r); }
    });
    return out.join(" + ");
  }

  function rawText(list) {
    return (list || []).map(function (e, i) {
      var h = String(e.h == null ? "" : e.h).trim();
      var s = String(e.s == null ? "" : e.s).trim();
      var L = ["TURN " + (i + 1) + " :: " + stamp(e.ts || e.st)];
      if (h) L.push("HITL: " + h);
      else L.push("HITL: [nothing - she spoke first]");
      if (s) L.push("ALIA" + (e.role ? " (" + String(e.role).toUpperCase() + ")" : "") + ": " + s);
      return L.join("\n");
    }).join("\n\n");
  }

  function formatInstruction(topic, who, raw) {
    var rules = [
      "You are formatting a captured session transcript into the house record: a structured, scannable document for the archive, for training, and for content creation.",
      "Follow the format EXACTLY:",
      "Open with a header of three lines: 'Session Date: <the date>', 'Participants: <the names>', 'Main Topic: <the topic>'.",
      "Then one section per major point discussed. Each section opens with a SUBHEADER - a question or a bold statement naming the point.",
      "Under each subheader, BULLETED LISTS of the key points, actions and insights - one bullet per item, short lines. Mark decisions as 'DECISION:' and follow-ups as 'ACTION:'.",
      "Keep the speakers' own words where they matter and compress the rest. Invent nothing that is not in the transcript below.",
      "Output ONLY the formatted document, in the terminal's plain uppercase voice."
    ];
    return rules.join("\n")
      + "\n\nMAIN TOPIC :: " + topic + "\nPARTICIPANTS :: " + who
      + "\n<transcript>\n" + raw + "\n</transcript>\n"
      + "\nTASK: Format the transcript above into the house record. Output ONLY the document.";
  }

  async function stop() {
    var st = await state();
    if (!isActive(st)) return { ok: false, error: "CAPTURE MODE IS NOT ACTIVE - /capturemode <TOPIC> STARTS IT." };
    var list = await turns();
    if (list == null) return { ok: false, error: "CAPTURE MODE :: THE ARCHIVE COULD NOT BE READ." };
    st.active = false;
    live = false;
    st.endedAt = Date.now();
    st.turnCount = list.length;
    st.turns = rawText(list);
    st.who = participantsOf(list);
    st.day = dayOf(st.startedAt);
    if (!list.length) {
      st.draft = null;
      await save(st);
      return { ok: true, empty: true, topic: st.topic };
    }
    if (!GEN()) {
      await save(st);
      return { ok: false, error: "CAPTURE MODE :: THE SESSION ENDED (" + list.length + " TURNS) BUT THE TEXT ENGINE IS NOT AVAILABLE, SO NO FORMATTED DRAFT COULD BE MADE. THE RAW TURNS ARE HELD - /capturemode status PRINTS THEM." };
    }
    if (drafting) return { ok: false, error: "CAPTURE MODE :: A DRAFT IS ALREADY BEING FORMATTED." };
    drafting = true;
    var B = null;
    try {
      if (PROG()) B = PROG().begin("FORMATTING CAPTURE", { id: "capture", detail: "the capture - " + list.length + " turns into the house record" });
    } catch (e) {}
    var text = "";
    try {
      var ans = await GEN()({ temperature: 0.3, instruction: formatInstruction(st.topic, st.who, st.turns) });
      text = String(ans == null ? "" : ans).trim();
    } catch (e) {
      drafting = false;
      try { if (PROG()) PROG().fail("capture", "THE ENGINE DID NOT ANSWER"); } catch (e2) {}
      await save(st);
      return { ok: false, error: "CAPTURE MODE :: THE SESSION ENDED (" + list.length + " TURNS) BUT THE DRAFT COULD NOT BE FORMATTED :: " + String((e && e.message) || e).toUpperCase() + " :: THE RAW TURNS ARE HELD." };
    }
    drafting = false;
    try { if (PROG()) PROG().finish("capture"); } catch (e) {}
    st.draft = text || null;
    await save(st);
    return { ok: true, topic: st.topic, turns: list.length, draft: st.draft, file: fileNameOf(st.day, st.topic) };
  }

  async function keep() {
    var st = await state();
    if (!st || !st.draft) return { ok: false, error: "CAPTURE MODE :: NO FORMATTED DRAFT IS WAITING - /capturemode stop ENDS A SESSION AND MAKES ONE." };
    if (!ING()) return { ok: false, error: "CAPTURE MODE :: THE LORE IS OFFLINE - NOTHING WAS FILED." };
    var name = fileNameOf(st.day || dayOf(Date.now()), st.topic || "UNTITLED SESSION");
    var filed = st.draft;
    try {
      if (WRAPOK()) {
        filed = WRAP()({ title: "CAPTURE: " + (st.topic || "UNTITLED SESSION") + " (" + (st.day || "") + ")", body: st.draft, changes: "Session captured " + (st.day || "") + " (" + (st.turnCount || "?") + " turns), formatted and reviewed." });
      }
    } catch (e) {}
    var res = null;
    try { res = await ING()(name, filed, { pack: "LOREPACK", origin: "local" }); }
    catch (e) { return { ok: false, error: "CAPTURE MODE :: THE DRAFT COULD NOT BE FILED." }; }
    st.draft = null;
    await save(st);
    return { ok: true, name: name, status: (res && res.status) || "filed" };
  }

  async function drop() {
    var st = await state();
    if (!st || (!st.draft && !st.turns)) return { ok: false, error: "CAPTURE MODE :: NOTHING IS WAITING." };
    st.draft = null;
    st.turns = null;
    await save(st);
    return { ok: true, text: "CAPTURE MODE :: THE WAITING DRAFT IS DROPPED - THE TURNS THEMSELVES STAY IN THE ARCHIVE." };
  }

  function download(name, text) {
    if (typeof opts.download === "function") {
      try { return !!opts.download(name, String(text)); } catch (e) { return false; }
    }
    if (typeof document === "undefined") return false;
    try {
      var blob = new Blob([String(text)], { type: "text/markdown" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch (e) { return false; }
  }

  async function status() {
    var st = await state();
    var L = ["CAPTURE MODE :: " + (isActive(st) ? "ACTIVE" : "OFF")];
    if (isActive(st)) {
      var list = await turns();
      L.push("  SINCE   " + stamp(st.startedAt) + " :: " + (st.topic || "UNTITLED SESSION"));
      L.push("  TURNS   " + (list == null ? "?" : list.length) + " CAPTURED SO FAR (/capturemode stop ENDS IT AND FORMATS THE DRAFT)");
      L.push("  SHE IS TOLD IT IS ON - STRUCTURED DISCOURSE, MINDFUL OF TRANSCRIPTION.");
    } else if (st && st.draft) {
      L.push("  A FORMATTED DRAFT IS WAITING (" + (st.turnCount || "?") + " TURNS :: " + (st.topic || "UNTITLED SESSION") + ")");
      L.push("  /capturemode keep FILES IT IN THE LOREPACK :: /capturemode export DOWNLOADS IT :: /capturemode drop LETS IT GO.");
    } else if (st && st.turns) {
      L.push("  THE LAST SESSION (" + (st.turnCount || "?") + " TURNS) ENDED WITHOUT A FORMATTED DRAFT - ITS RAW TURNS ARE BELOW.");
      L.push(st.turns);
    } else {
      L.push("  /capturemode <TOPIC> STARTS A CAPTURED SESSION.");
    }
    return L.join("\n");
  }

  function help() {
    return [
      "CAPTURE MODE :: EVERY SESSION A STRUCTURED, ACTIONABLE TRANSCRIPT",
      "",
      "  /capturemode <TOPIC>   START CAPTURING - SHE IS TOLD IT IS ON, THE TURNS ARE MARKED",
      "  /capturemode stop      END IT - THE TURNS ARE FORMATTED (HEADER, SUBHEADERS, BULLETS) FOR REVIEW",
      "  /capturemode keep      FILE THE REVIEWED DRAFT IN THE LOREPACK (SEARCHABLE, RECALLED LIKE MEMORY)",
      "  /capturemode export    DOWNLOAD THE DRAFT AS A DOCUMENT FOR ALL PARTIES",
      "  /capturemode drop      LET THE WAITING DRAFT GO (THE TURNS STAY IN THE ARCHIVE)",
      "  /capturemode status    WHAT IS ACTIVE, WHAT IS WAITING",
      "",
      "  COMMAND LINES ARE NEVER CAPTURED, AND NOTHING IS FILED UNTIL THE DRAFT IS REVIEWED AND KEPT."
    ].join("\n");
  }

  
async function exportFile() {
  var st = await state();
  if (!st || !st.draft) return { ok: false, error: "CAPTURE MODE :: NO FORMATTED DRAFT IS WAITING." };
  var name = fileNameOf(st.day || dayOf(Date.now()), st.topic || "UNTITLED SESSION");
  var out2 = st.draft;
  try {
    if (WRAPOK()) {
      out2 = WRAP()({ title: "CAPTURE: " + (st.topic || "UNTITLED SESSION") + " (" + (st.day || "") + ")", body: st.draft, changes: "Session captured " + (st.day || "") + " (" + (st.turnCount || "?") + " turns), formatted and reviewed." });
    }
  } catch (e) {}
  if (!download(name, out2)) return { ok: false, error: "CAPTURE MODE :: THE DOWNLOAD COULD NOT BE STARTED." };
  return { ok: true, name: name };
}
async function isActiveNow() { return isActive(await state()); }
return {
    start: start, stop: stop, keep: keep, drop: drop, exportFile: exportFile,
    turns: turns, status: status, help: help, block: block,
    isActive: isActiveNow, busy: function () { return drafting; }
  };
}
return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosCapture;
