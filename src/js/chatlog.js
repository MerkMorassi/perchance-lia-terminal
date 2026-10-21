window.chatlog = (function () {
  "use strict";

  /* THE CHATLOG - THE RAW RECORD OF THE CONVERSATION THIS TERMINAL WAS BUILT IN.

     WHY IT EXISTS
     Everything else in this generator is the machine or the record of USING it. The conversation
     that BUILT it - what Patrikios actually asked for, in which words, what was tried first, what
     the numbers were - lives nowhere but in the chat window of the editor, and a chat window is
     the one file that closes. A handoff note is a few kilobytes of someone's memory of it; a
     chronicle entry (src/chronicle/) is the WRITE-UP. This is the transcript itself, kept whole,
     so a later session can go and read what was actually said instead of guessing at it.

     WHERE IT LIVES, AND WHY IT IS NOT IN src/
     src/ IS PUBLIC - it ships with the generator, and every file in it can be read by anyone who
     opens the source. A conversation is not public: it is full of things said between two people,
     and of incidental things like keys, ids and private addresses. So the record lives in kv -
     THIS BROWSER, lia_settings / chatlog_* - and the only things that ship are the READER (this
     file), the recipe for the export (src/chatlog/EXTRACT.md) and the INDEX
     (src/chatlog/manifest.json). Nothing here is put in her prompt, indexed for recall, or shown
     to her: like the RTFM and the chronicle, this is the lane of the MAKING.

     THE TWO HALVES
     1. GETTING IT OUT. No code on this page can read the editor's chat panel - it is a different
        origin, one window up, and the browser refuses the crossing on purpose. So the export is
        an OPS: /chatlog snippet hands over a small script to paste into the editor's console (the
        whole recipe, with the script in a code fence, is src/chatlog/EXTRACT.md). It walks the
        DOM, finds the conversation, and downloads it as lia-chatlog-<date>.txt plus a .json
        sidecar. It sends nothing anywhere.
     2. KEEPING IT. This module: IMPORT (paste it into the panel, or pick the downloaded file),
        and the record is split into chunks in kv and indexed - which chunk holds what, and which
        line of which chunk each turn of the conversation starts on. Then it can be read back:
        show, turns, grep, export. A record of ten megabytes reads back as fifty 200KB reads and
        never has to be re-sent to a model to be remembered.

     HOW IT GROWS, AND WHY THE POLICY IS APPEND
     A conversation only ever gets longer, so the newest export of it contains everything the last
     one did. "Import the newest file" therefore has to mean "keep what is here and take what is
     new", never "throw the record away and write this in its place" - the second is how a record
     gets smaller for no reason, and it is exactly what a first attempt at this did. So an import
     MERGES: it finds where the new file and the record meet (an exact extension of the record, or
     the record's own tail found inside the new file), keeps only what is past the seam, and writes
     the seam into the record so anyone reading it can see where one session's transcript ends and
     the next begins. A file that is already in the record changes NOTHING - unless it carries
     turns (the .json sidecar), in which case only the index is rebuilt and the words are left
     alone. REPLACE is the deliberate opposite, on its own button and its own word, and it is the
     only thing here that ever throws anything away.

     WHAT IT DOES NOT DO
     It never touches the text engine and never speaks for her. It uploads NOTHING: EXPORT hands
     you a file, IMPORT takes one, and there is no network in this file at all except /chatlog
     import <URL>, which you have to type yourself. It deletes nothing without the word yes, and
     it replaces the record only when told to in as many words.

     A COLD COPY. kv is this browser. If this browser's storage is ever cleared, the record goes
     with it - so the shipped index (src/chatlog/manifest.json) also records where a copy was
     hosted, if one ever was, and /chatlog import <URL> puts it back into a fresh browser.
     Hosting one is a deliberate act by the agent, not something this page does by itself. */

  var FOLDER = "lia_settings";
  var META_KEY = "chatlog_meta";
  var CHUNK_KEY = "chatlog_chunk_";
  var MARKS_KEY = "chatlog_marks";
  var POLICY_KEY = "chatlog_policy";       // append (the default) or replace - see wantMode
  var ORIGIN_KEY = "chatlog_origin";       // where this record has been kept - see keeperOf
  var EXTRACT = "src/chatlog/EXTRACT.md";
  var ABOUT = "src/chatlog/README.md";
  var SHIPPED = "src/chatlog/manifest.json";   // the shipped index - the one claim that travels

  var MODE_APPEND = "append";
  var MODE_REPLACE = "replace";

  // Knobs live in src/js/config.js with every other one. Each is read defensively, because a page
  // that loaded this file but not the config still has to work.
  var CHUNK_CHARS = (typeof LIA_CHATLOG_CHUNK === "number" && LIA_CHATLOG_CHUNK >= 20000) ? Math.round(LIA_CHATLOG_CHUNK) : 200000;
  var MARK_MAX = (typeof LIA_CHATLOG_MARKS === "number" && LIA_CHATLOG_MARKS > 0) ? Math.round(LIA_CHATLOG_MARKS) : 4000;
  var GREP_MAX = (typeof LIA_CHATLOG_GREP === "number" && LIA_CHATLOG_GREP > 0) ? Math.round(LIA_CHATLOG_GREP) : 60;
  var SHOW_CHARS = (typeof LIA_CHATLOG_SHOW === "number" && LIA_CHATLOG_SHOW > 400) ? Math.round(LIA_CHATLOG_SHOW) : 8000;
  var KEEP_HISTORY = 40;    // one line per import ever made, so a record that was replaced is visible
  var KEEP_JOINS = 40;      // one line per JOIN ever written into the record (see joinStamp)
  var JOIN_ANCHOR = (typeof LIA_CHATLOG_JOIN === "number" && LIA_CHATLOG_JOIN >= 80) ? Math.round(LIA_CHATLOG_JOIN) : 2000;
                            // how many of the record's last characters are looked for in a new file
  var BRIEF_TURNS = (typeof LIA_CHATLOG_BRIEF_TURNS === "number" && LIA_CHATLOG_BRIEF_TURNS > 0) ? Math.round(LIA_CHATLOG_BRIEF_TURNS) : 6;
                            // how many of the newest turns THE BRIEF prints - see briefText
  var BRIEF_CUT = (typeof LIA_CHATLOG_BRIEF_CUT === "number" && LIA_CHATLOG_BRIEF_CUT > 80) ? Math.round(LIA_CHATLOG_BRIEF_CUT) : 280;
                            // how much of a turn the brief shows (the whole turn is /chatlog turn <N>)

  // WHAT A TURN LOOKS LIKE IN A DUMP. Role lines are rendered as their own line by every chat UI
  // worth the name, so a line that is ONLY a role word (or a role word and a colon) marks a turn,
  // and so does a line that opens with one and a colon. A sentence that merely begins "You should"
  // is not a turn, which is why the rest of the line has to be empty or a colon.
  var SPEAKER = (typeof LIA_CHATLOG_SPEAKER !== "undefined" && LIA_CHATLOG_SPEAKER instanceof RegExp)
    ? LIA_CHATLOG_SPEAKER
    : /^(you|your|me|patrikios|user|human|assistant|agent|ai|lia|barbelo|system|tool|claude|gpt|developer)/i;

  var meta = null;      // the index of the record: { at, chars, bytes, chunks, turns, head, tail, history }
  var marks = [];       // [{ i: chunk, l: line in that chunk, o: character in that chunk, k: speaker }]
  var report = null;    // what reading kv last said
  var busy = false;     // one import at a time - a second one would write over the first's chunks
  var policy = MODE_APPEND;   // what an import does by default: KEEP WHAT IS HERE AND ADD TO IT
  var originClaim = null;     // where this record has been kept (kv: chatlog_origin) - see keeperOf
  var shippedOrigin = false;  // src/chatlog/manifest.json read once; false = not read yet

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function up(v) { return String(v == null ? "" : v).toUpperCase(); }
  function cut(s, n) {
    var t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "\u2026" : t;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function bytes(s) { try { return new Blob([String(s)]).size; } catch (e) { return String(s).length; } }
  function size(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }
  function when(ts) {
    try { if (window.logTime && window.logTime.stamp) return window.logTime.stamp(ts); } catch (e) {}
    return new Date(Number(ts) || Date.now()).toString();
  }
  function day(ts) {
    var d = new Date(Number(ts) || Date.now());
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  }
  function lines(s) { return String(s == null ? "" : s).split("\n"); }
  function firstLine(s) { var l = lines(s); for (var i = 0; i < l.length; i++) if (l[i].trim()) return l[i]; return ""; }
  function lastLine(s) { var l = lines(s); for (var i = l.length - 1; i >= 0; i--) if (l[i].trim()) return l[i]; return ""; }
  function countLines(s) { return String(s == null ? "" : s).split("\n").length; }
  function pad(v, n) { var s = String(v == null ? "" : v); while (s.length < n) s += " "; return s; }
  function rule(ch, n) { return new Array(Math.max(1, n) + 1).join(ch); }

  // THE BAR (src/js/progress.js). An import is the one job in this file with a real count: the record
  // is read back ONE CHUNK AT A TIME (to find the seam it may be nineteen reads) and then written one
  // chunk at a time (nineteen writes of 200,000 characters), and an export is the same nineteen reads
  // again plus a JSON.stringify of the whole thing. So the rail can say exactly where it is, which
  // matters here more than most places: a 3.8 MB conversation on a slow device is seconds of silence.
  // ONE id ("chatlog") for the whole file: a read is followed by a write in the same job, and the
  // second begin() continues the first rather than stacking a second bar.
  function pbar(label, total) {
    try {
      if (window.progress) return window.progress.begin(label, {
        id: "chatlog", total: total,
        detail: "the chatlog - kept on this device, never sent to the text engine",
      });
    } catch (e) {}
    return null;
  }
  function pbarDone() {
    try { if (window.progress) window.progress.finish("chatlog"); } catch (e) {}
  }

  // A fingerprint of the whole record - FNV-1a, 32 bits, in hex. Not cryptography: a way for a
  // later session to tell in one line whether the record on disk is the one it read about.
  function fingerprint(s) {
    var h = 0x811c9dc5, t = String(s == null ? "" : s);
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return ("0000000" + h.toString(16)).slice(-8) + "-" + t.length.toString(16);
  }

  // ---- the turn index --------------------------------------------------------

  function speakerOf(line) {
    var s = String(line == null ? "" : line).replace(/[\u200b\u00a0]/g, " ").trim();
    if (!s || s.length > 90) return "";
    var m = s.match(SPEAKER);
    if (!m) return "";
    var rest = s.slice(m[0].length).replace(/^[\s>*_#`]+/, "").replace(/[\s*_`]+$/, "");
    if (rest === "" || /^[:\u2013\u2014-]/.test(rest)) return m[1].toLowerCase();
    if (rest.length <= 12 && /:$/.test(rest)) return m[1].toLowerCase();   // "You said:" and its like
    return "";
  }

  // A ROLE NAME FROM THE TURN LIST, normalised. The export script guesses from class names and
  // attributes; a sidecar says it plainly. Both land here.
  function normRole(r) {
    var s = String(r == null ? "" : r).trim().toLowerCase().replace(/[^a-z]/g, "");
    if (!s) return "";
    if (/^(user|human|you|me|patrikios|him)$/.test(s)) return "user";
    if (/^(assistant|agent|ai|bot|lia|barbelo|claude|gpt|model)$/.test(s)) return "assistant";
    if (s === "system" || s === "tool" || s === "developer") return s;
    return s.slice(0, 24);
  }

  // WHERE A CHARACTER SITS, AS A LINE OF ITS CHUNK. The turns arrive as character offsets into the
  // whole record, and the index wants a line number within a chunk, so each chunk's line ends are
  // computed once and binary-searched - which matters: a record like this one has twenty thousand
  // turns, and counting newlines per turn would be twenty thousand passes over a 200KB string.
  function nlOffsets(s) {
    var out = [], i = -1;
    while ((i = s.indexOf("\n", i + 1)) !== -1) out.push(i);
    return out;
  }
  function lineAt(nl, off) {
    var lo = 0, hi = nl.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (nl[mid] < off) lo = mid + 1; else hi = mid; }
    return lo;
  }

  // THE INDEX, FROM THE TURNS THEMSELVES (a .json sidecar carries the role of every message, which
  // is the only way to be sure) - and the whole point of the sidecar: a dumped transcript often has
  // no role line to find, so the guess below finds nothing. Both roads end in the same shape.
  function markTurns(text, parts, turns) {
    var cum = [], run = 0, n;
    for (n = 0; n < parts.length; n++) { cum.push(run); run += parts[n].length; }
    var nls = {}, out = [], at = 0;
    for (var i = 0; i < turns.length && out.length < MARK_MAX; i++) {
      var piece = String((turns[i] && turns[i].text) || "");
      if (!piece.trim()) continue;
      var probe = piece.slice(0, 400);                    // prefix-match: edges get trimmed in a dump
      var found = text.indexOf(probe, at);
      if (found === -1) found = text.indexOf(probe);
      if (found === -1) continue;                         // not in the record - skipped, never guessed
      var c = 1;
      for (n = cum.length - 1; n >= 0; n--) if (found >= cum[n]) { c = n + 1; break; }
      var off = found - cum[c - 1];
      if (!nls[c]) nls[c] = nlOffsets(parts[c - 1]);
      out.push({ i: c, l: lineAt(nls[c], off), o: off, k: normRole(turns[i].role) || "?" });
      at = found + 1;
    }
    return out;
  }

  function markUp(parts, turns) {
    var out = [], i, l;
    for (i = 0; i < parts.length && out.length < MARK_MAX; i++) {
      var ls = parts[i].split("\n"), off = 0;
      for (l = 0; l < ls.length; l++) {
        var k = speakerOf(ls[l]);
        if (k) { out.push({ i: i + 1, l: l, o: off, k: k }); if (out.length >= MARK_MAX) break; }
        off += ls[l].length + 1;
      }
    }
    return out;
  }

  // THE SAME RULE AS markUp, BUT AS A TURN LIST. markUp answers "where are the marks"; this answers
  // "what are the turns, as {role, text} pairs", which is what markTurns takes. It exists so that a
  // MIXED index can be built in one pass: the turns a record already had (carried forward when it is
  // appended to) plus the role lines the new part brought, handed to markTurns exactly like a
  // sidecar's messages are, so every turn ends up with the same shape of mark.
  function turnsFromLines(text) {
    var ls = lines(text), off = 0, out = [], k0 = "", at0 = 0;
    for (var i = 0; i < ls.length; i++) {
      if (speakerOf(ls[i])) {
        if (k0) out.push({ role: k0, text: text.slice(at0, off) });
        k0 = speakerOf(ls[i]); at0 = off;
      }
      off += ls[i].length + 1;
    }
    if (k0) out.push({ role: k0, text: text.slice(at0) });
    return out;
  }

  // A .json SIDECAR, RECOGNISED. The export script writes two files: the .txt (the transcript
  // verbatim) and the .json (the same words, plus the role of every message and how the panel was
  // found). Handing the .json to the store used to file the JSON itself as if it were the
  // conversation - because that is what it is, a file full of escaped newlines and no turn marks.
  // So the sidecar is detected here and UNPACKED: its `text` is the record, its `messages` are the
  // turn index. Importing either file works; importing the .json is the richer of the two.
  function sidecar(s) {
    var t = String(s == null ? "" : s).replace(/^\uFEFF/, "").trim();
    if (t.charAt(0) !== "{" || t.length < 400) return null;
    var d;
    try { d = JSON.parse(t); } catch (e) { return null; }
    if (!d || typeof d !== "object") return null;
    var text = (typeof d.text === "string") ? d.text : "";
    if (text.length < 400) return null;
    var turns = [];
    if (Array.isArray(d.messages)) {
      d.messages.forEach(function (m) {
        if (m && typeof m.text === "string" && m.text.trim()) turns.push({ role: m.role, text: m.text });
      });
    }
    return {
      text: text, turns: turns,
      where: String(d.where || ""),
      picked: String((d.picked && d.picked.key) || ""),
      // WHERE THE FILE WAS EXPORTED FROM, when it says (this module's own export stamps the origin
      // into its meta; the console script does not). An import that carried a record over from
      // another origin says so in its read-out instead of leaving it to be discovered later.
      from: String((d.meta && d.meta.origin) || ""),
      // The console script stamps an ISO string; THIS module's own export stamps a number. Both are
      // reported the same way, so a file it wrote and a file the script wrote read alike.
      exportedAt: (typeof d.exportedAt === "number") ? when(d.exportedAt) : String(d.exportedAt || ""),
    };
  }

  function labelNames(mk) {
    var seen = {}, out = [];
    for (var i = 0; i < mk.length; i++) if (!seen[mk[i].k]) { seen[mk[i].k] = 1; out.push(mk[i].k); }
    return out;
  }

  // ---- storage ---------------------------------------------------------------

  async function load() {
    report = { loaded: false, chunks: 0, failed: "" };
    var k = kv();
    meta = null; marks = [];
    if (!k) { report.failed = "no store on this page (kv)"; return report; }
    try {
      var m = await k.get(META_KEY);
      if (m && typeof m === "object" && Number(m.chunks) > 0) meta = m;
      var mk = await k.get(MARKS_KEY);
      if (Array.isArray(mk)) marks = mk.filter(function (x) { return x && x.i; });
      var p = await k.get(POLICY_KEY);
      if (p === MODE_REPLACE || p === MODE_APPEND) policy = p;
      // A RECORD THAT PREDATES THE ORIGIN FIELD IS STAMPED WITH WHERE IT IS KEPT NOW - the field
      // means "where this record lives", so the honest value for one already here is here.
      if (meta && !meta.origin) {
        meta.origin = originNow().origin;
        try { await k.set(META_KEY, meta); } catch (e2) {}
      }
      report.loaded = true;
      report.chunks = meta ? meta.chunks : 0;
    } catch (e) {
      report.failed = String((e && e.message) ? e.message : e);
      console.warn("the chatlog index could not be read", e);
    }
    return report;
  }

  async function ready() { if (!report) await load(); return meta; }

  // SPLIT ON A LINE BOUNDARY WHEN THERE IS ONE NEARBY. Chunks are read back by number, so the only
  // things that matter are that the same text always splits the same way, and that a chunk does not
  // begin in the middle of a word when a line end was a few hundred characters away.
  function split(text, size) {
    var out = [], i = 0, n = text.length;
    while (i < n) {
      var end = Math.min(n, i + size);
      if (end < n) {
        var nl = text.lastIndexOf("\n", end);
        if (nl > i + Math.floor(size * 0.6)) end = nl + 1;
      }
      out.push(text.slice(i, end));
      i = end;
      if (out.length >= 4000) break;     // a runaway never eats the tab
    }
    return out.length ? out : [""];
  }

  async function get(n) {
    var k = kv();
    if (!k) throw new Error("THIS BROWSER HAS NO STORE (kv is not on this page)");
    var t = await k.get(CHUNK_KEY + n);
    if (typeof t !== "string") throw new Error("CHUNK " + n + " IS NOT IN THE STORE");
    return t;
  }

  // A .json THAT IS NOT A SIDECAR, RECOGNISED AS SUCH. It is worth the few lines: the first real
  // sidecar to reach the store got filed as JSON (7 MB of escaped braces where the conversation
  // should have been) because nothing here knew the difference. The words in it were recoverable;
  // the next one might not be. So an unrecognised .json is REFUSED, and the record is left alone.
  function jsonShape(s) {
    var t = String(s == null ? "" : s).replace(/^\uFEFF/, "").trim();
    if (t.charAt(0) !== "{" || t.length < 400) return null;
    try { var d = JSON.parse(t); return (d && typeof d === "object") ? d : null; } catch (e) { return null; }
  }

  // ---- where it lives --------------------------------------------------------

  // kv IS PER-ORIGIN, AND THE ORIGIN IS THE GENERATOR'S ID. Every key of this record (chatlog_*)
  // lives in the storage of the origin this page runs at - https://<generatorPublicId>.perchance.org
  // /<name> - and that origin is the ID, NOT the name. Two consequences, and they are the whole
  // reason this section exists:
  //   * A RENAME is free: it changes the path, not the origin, so the record follows the generator.
  //   * A NEW ID is a different origin with an EMPTY store. A fork, a copy into another generator,
  //     or a second generator opened on this machine comes up with no record in it - and without a
  //     word from the page, a session finds an empty store and does not know why.
  // WHETHER A SAVE MOVES IT WAS CHECKED, NOT ASSUMED (2026-09-26 - see the chronicle entry). This
  // generator ALREADY EXISTS on the server under this ID: the served page for its name already links
  // to this very subdomain, the API already answers with its code, and the server already holds its
  // main.pjs (byte-identical to this tree's copy) and 60 of its 82 src files. The ID is fixed before
  // a page ever loads, so SAVING UPLOADS THE REST OF THE SOURCE TO THE SAME GENERATOR, and the
  // record does not move. Nothing here has to be done before a save.
  // What is still worth guarding is the case that is NOT that one, so two claims are kept and read
  // back: HERE (kv - this origin first held the record at such a time, and still does) and THE
  // SHIPPED INDEX (src/chatlog/manifest.json - the only claim that TRAVELS with the code, and so the
  // only one that can speak up on an origin that has never seen this record; it is fetched lazily,
  // once, and a fetch that fails just means the check is not made).
  function originNow() {
    var o = { origin: "", id: "", name: "" };
    try { o.origin = String(location.origin || ""); } catch (e) {}
    try { o.id = String(window.generatorPublicId || ""); } catch (e) {}
    try { o.name = String(window.generatorName || ""); } catch (e) {}
    return o;
  }
  function hostOf(o) { return String((o && o.origin) || o || "").replace(/^https?:\/\//, "").replace(/\/+$/, ""); }
  // THE SAME PLACE, SAID TWO WAYS. A claim may be written as a whole origin (this module's meta) or
  // as a bare host (the shipped index), so the comparison is made on the bare host, case-blind.
  function sameOrigin(a, b) { return hostOf(a).replace(/^www\./, "").toLowerCase() === hostOf(b).replace(/^www\./, "").toLowerCase(); }

  async function keeperOf() {
    var k = kv(), now = originNow(), t = Date.now();
    if (!k) return { here: now, claim: null, shipped: null, agree: true };
    if (!originClaim) {
      try {
        var c = await k.get(ORIGIN_KEY);
        if (c && typeof c === "object" && c.origin) originClaim = c;
      } catch (e) {}
    }
    if (!originClaim) {
      // FIRST SIGHTING, WRITTEN DOWN. `first` is when this origin first held the record and is never
      // moved afterwards - so the line a later session reads is an age, not a "last loaded".
      originClaim = { origin: now.origin, id: now.id, name: now.name, first: t, seen: t };
    } else {
      originClaim.seen = t;
      originClaim.name = now.name;
    }
    try { await k.set(ORIGIN_KEY, originClaim); } catch (e) {}
    if (shippedOrigin === false) {
      shippedOrigin = null;
      try {
        var res = await fetch(SHIPPED, { cache: "no-store" });
        if (res.ok) {
          var d = JSON.parse(await res.text());
          var r = (d && d.record) || {};
          if (r.origin) shippedOrigin = { origin: String(r.origin), at: String(r.originAt || "") };
        }
      } catch (e) { shippedOrigin = null; }
    }
    return { here: now, claim: originClaim, shipped: shippedOrigin, agree: (!shippedOrigin || !shippedOrigin.origin || sameOrigin(shippedOrigin, now)) };
  }

  // ONE LINE, FOR ANY READER: where the record is kept, and whether the shipped index agrees.
  function keptLine(o) {
    return "KEPT AT     :: " + hostOf(o.here) + "  \u00b7  " + (o.agree
      ? "SAME ORIGIN AS THE SHIPPED INDEX - A SAVE DOES NOT MOVE IT, A RENAME DOES NOT EITHER"
      : "THE SHIPPED INDEX SAYS " + hostOf(o.shipped.origin)) + "  \u00b7  /chatlog origin";
  }

  // THE LOUD VERSION, for a reader that has just been told the two disagree.
  function mismatchBlock(o) {
    return "WHERE THIS RECORD LIVES - AND WHY THE SHIPPED INDEX DISAGREES\n"
      + rule("=", 79) + "\n"
      + "THIS PAGE   :: " + hostOf(o.here) + "\n"
      + "THE INDEX   :: " + hostOf(o.shipped.origin) + (o.shipped.at ? "  (WRITTEN " + when(Date.parse(o.shipped.at) || 0) + ")" : "") + "\n"
      + "kv IS PER-ORIGIN AND THE ORIGIN IS THE GENERATOR'S ID, so a record kept at one of these is\n"
      + "invisible from the other. IF THIS PAGE IS THE ONE THAT IS NEW, THE RECORD IS OVER THERE:\n"
      + "open the terminal at the address above and /chatlog export, then bring the file back here.\n"
      + "IF THIS PAGE IS WHERE THE RECORD IS NOW, the shipped index is simply out of date - it is\n"
      + "/chatlog origin THAT SAYS WHICH, and src/chatlog/manifest.json that is corrected.";
  }

  async function originReport() {
    await ready();
    var o = await keeperOf();
    return { here: o.here, claim: o.claim, shipped: o.shipped, agree: o.agree, born: meta ? String(meta.origin || "") : "" };
  }

  // THE WHOLE STORY, FOR /chatlog origin. The question this answers is asked once by every careful
  // session ("if he saves, do we lose the record?"), so it is answered here in full rather than
  // re-derived from a comment: what the origin is, what moves it, what does not, and what to do if
  // the verdict is ever not SAME.
  async function originText() {
    var o = await originReport();
    var L = [];
    L.push("WHERE THIS RECORD LIVES");
    L.push(rule("=", 79));
    L.push("");
    L.push("THIS PAGE   :: " + hostOf(o.here));
    L.push("GENERATOR   :: " + (o.here.name || "(no name)") + "  \u00b7  ID " + (o.here.id || "(no id)") + (o.here.id ? "  \u00b7  " + o.here.id.slice(0, 8) : ""));
    L.push("THE CLAIM   :: " + (o.claim
      ? "THIS ORIGIN HAS HELD THE RECORD SINCE " + when(o.claim.first) + " (LAST LOADED " + when(o.claim.seen) + ")"
      : "NOT WRITTEN (kv IS NOT ON THIS PAGE, SO NOTHING CAN BE KEPT AT ALL)"));
    L.push("SHIPPED INDEX :: " + (o.shipped
      ? hostOf(o.shipped.origin) + (o.shipped.at ? "  (CORRECTED " + o.shipped.at + ")" : "")
      : "src/chatlog/manifest.json COULD NOT BE READ - THE CHECK WAS NOT MADE"));
    L.push("RECORD      :: " + (meta
      ? meta.chars.toLocaleString() + " CHARACTERS, " + meta.turns + " TURNS, KEPT AT " + (o.born ? hostOf(o.born) : hostOf(o.here))
      : "NOTHING HAS BEEN IMPORTED HERE"));
    L.push("");
    L.push("VERDICT     :: " + (o.agree
      ? "SAME ORIGIN. THE RECORD IS HERE, AND IT SURVIVES A SAVE."
      : "THE TWO DO NOT AGREE - SEE BELOW."));
    L.push("");
    if (!o.agree) { L.push(mismatchBlock({ here: o.here, shipped: o.shipped })); L.push(""); }
    L.push("WHY THE QUESTION IS ASKED AT ALL");
    L.push(rule("-", 79));
    L.push("kv IS PER-ORIGIN. Every key of this record lives in the storage of the origin this page runs");
    L.push("at, and that origin is the GENERATOR'S ID - not its name, and not the editor. So:");
    L.push("");
    L.push("  \u00b7 A SAVE does not move it. This generator already exists on the server under this ID (its");
    L.push("    page is served at that subdomain and the server already holds its source), so saving");
    L.push("    uploads the rest of the tree to the SAME generator. Nothing has to be exported first.");
    L.push("  \u00b7 A RENAME does not move it either: the name is the PATH, the ID is the origin.");
    L.push("  \u00b7 A FORK - or the same code copied into another generator - is a NEW ID, so it is a");
    L.push("    different origin with an EMPTY store. The record does not follow, and this page would");
    L.push("    come up looking as if nothing had ever been imported.");
    L.push("");
    L.push("IF THE VERDICT IS EVER NOT \"SAME\": the record is at the origin named above. Open the");
    L.push("terminal THERE and /chatlog export - both files come down to this machine - and bring them");
    L.push("back here (/chatlog append <URL>, or the CHATLOG panel's file picker). Nothing is lost");
    L.push("while the old browser's storage stands; the file is the copy that travels.");
    L.push("");
    L.push("AND THE ONE HABIT WORTH KEEPING: everything here is in THIS BROWSER. /chatlog export");
    L.push("every so often, and before anything is cleared, is the only insurance there is.");
    return L.join("\n");
  }

  // ---- the policy, and the merge ---------------------------------------------

  // WHAT AN IMPORT DOES. `append` unless he says otherwise (MODE_REPLACE on the REPLACE button, or
  // /chatlog import --replace), and the stored setting is read at load, so the choice survives a
  // reload. An explicit opts.mode always wins over the setting.
  function wantMode(m) {
    var s = String(m == null ? "" : m).trim().toLowerCase();
    if (s === MODE_REPLACE || s === MODE_APPEND) return s;
    return policy;
  }

  async function setPolicy(p) {
    var s = String(p == null ? "" : p).trim().toLowerCase();
    if (s === "add" || s === "keep") s = MODE_APPEND;
    if (s === "over" || s === "overwrite") s = MODE_REPLACE;
    if (s !== MODE_APPEND && s !== MODE_REPLACE) return { ok: false, error: "THE POLICY IS EITHER append OR replace" };
    var k = kv();
    await ready();                 // read the stored policy FIRST, so this cannot be undone by a load
    policy = s;
    if (k) {
      try { await k.set(POLICY_KEY, policy); }
      catch (e) { return { ok: false, error: "THE POLICY COULD NOT BE SAVED :: " + String((e && e.message) || e) }; }
    }
    paintBadge();
    if (isOpen()) renderPanel(policyText());
    return { ok: true, policy: policy };
  }

  // WHERE TWO TRANSCRIPTS MEET. `base` is the record, `add` is what arrived. Returns where the new
  // material begins in `add` (`at`), or `dup: true` when there is nothing new in it. Three ways to
  // meet, in order of how sure they are:
  //   1. the new file starts with the whole record (the ordinary case: the panel grew a little)
  //   2. the record's own last JOIN_ANCHOR characters are somewhere in the new file (the head of the
  //      dump was rebuilt or trimmed, so the exact-extension test cannot see it)
  //   3. neither - then it is a different conversation (or a record that was cut), and the honest
  //      thing is to append all of it after a marked join rather than to guess at a seam.
  function joinOf(base, add) {
    var A = String(base == null ? "" : base), B = String(add == null ? "" : add);
    if (!A.length) return { at: 0, ow: "the record was empty - this is where it starts", first: true };
    if (B.length >= A.length && B.slice(0, A.length) === A) {
      return { at: A.length, ow: "the new file starts with the whole record" };
    }
    var n = Math.min(A.length, JOIN_ANCHOR);
    if (n > 80) {
      var idx = B.indexOf(A.slice(-n));
      if (idx !== -1) return { at: idx + n, ow: "the record's last " + n.toLocaleString() + " characters were found in the new file" };
    }
    var probe = B.slice(0, Math.min(400, B.length));
    if (probe.replace(/\s+/g, "").length > 40 && A.indexOf(probe) !== -1) {
      return { at: -1, dup: true, ow: "the new file is already in the record" };
    }
    return { at: 0, ow: "nothing of the record was found in the new file" };
  }

  // THE SEAM, WRITTEN DOWN. Nothing is ever spliced into this record silently: the join says when,
  // how much, from where, and how the two were matched. It is not a role line, so the turn index
  // ignores it, and a reader (or grep) meets it as what it is - the place where one session's
  // transcript stops and the next begins.
  function joinStamp(n, how, source) {
    return "\n\n=== CHATLOG JOIN \u00b7 " + when(Date.now()) + " \u00b7 +" + Number(n || 0).toLocaleString() + " CHARACTERS"
      + (source ? " \u00b7 FROM " + up(source) : "") + " ===\n"
      + "=== " + up(how) + " ===\n\n";
  }

  function policyText() {
    var withRecord = meta ? ("THE RECORD NOW HOLDS " + meta.chars.toLocaleString() + " CHARACTERS IN " + meta.chunks
      + " CHUNKS, FROM " + (meta.history && meta.history.length ? meta.history.length : 1) + " IMPORT(S), WITH " + (meta.joins ? meta.joins.length : 0) + " JOIN(S).")
      : "THERE IS NO RECORD YET - THE FIRST IMPORT IS THE WHOLE TRANSCRIPT.";
    return "THE IMPORT POLICY IS " + up(policy) + ".\n"
      + rule("=", 79) + "\n"
      + "AN IMPORT " + (policy === MODE_APPEND
        ? "ADDS TO THE RECORD. The seam between what is here and what arrived is found (an exact\n"
          + "extension of the record, or the record's own tail inside the new file), only what is past the\n"
          + "seam is kept, and the join is written into the record so the seam is visible. A file that is\n"
          + "already in the record changes NOTHING - unless it carries turns, in which case only the index\n"
          + "is rebuilt and the words are left exactly as they are."
        : "REPLACES THE RECORD. The words already in it are thrown away (the import they came from is\n"
          + "still listed in the index) and the new file becomes the record. Nothing is merged and no\n"
          + "joins are kept.") + "\n"
      + "\n" + withRecord + "\n"
      + "\nTHE FILE PICKER AND /chatlog import <URL> FOLLOW THE POLICY. The box's own buttons do not: APPEND\n"
      + "THE BOX and REPLACE mean exactly what they say, whatever the policy is.\n"
      + "\nSET IT :: /chatlog policy append   \u00b7   /chatlog policy replace     (kept in this browser)";
  }

  // THE READ-OUT AFTER AN IMPORT, in one place, so a button and a command never word it differently.
  function readout(res) {
    if (!res) return "NOTHING HAPPENED.";
    if (!res.ok) return "THE IMPORT DID NOT GO THROUGH :: " + up(res.error);
    if (res.nothingNew) {
      return "NOTHING WAS ADDED :: " + up(res.reason || "IT IS ALREADY IN THE RECORD")
        + (res.reindexed ? "\nBUT THE FILE CARRIED TURNS, SO THE INDEX WAS REBUILT FROM THEM - THE WORDS WERE NOT TOUCHED." : "")
        + "\n\n" + importReport();
    }
    return importReport();
  }

  function settle(text) { paintBadge(); if (isOpen()) renderPanel(text || importReport()); }

  // THE IMPORT. One entry point for the panel's paste box, for a picked file, for /chatlog import
  // <URL>, and for the agent.
  //
  // THE POLICY IS APPEND, AND IT IS A POLICY FOR A REASON. A conversation only ever grows, so the
  // newest export of it contains everything the last one did - which means "import the newest file"
  // has to mean "keep what is here and take what is new", never "throw the record away and write
  // this in its place". So `put` DOES THE MERGE (see joinOf): only what is past the seam is added,
  // the seam is written into the record, and everything is re-split and re-indexed. A file that is
  // nothing but what is already in the record changes NOTHING - except the index, when it carries
  // turns the record's index does not have (the .json sidecar: the words are the same, and it is
  // its messages list that numbers every turn). opts.mode = "replace" is the deliberate opposite.
  async function put(text, opts) {
    opts = opts || {};
    if (busy) return { ok: false, error: "AN IMPORT IS ALREADY RUNNING" };
    var k = kv();
    if (!k) return { ok: false, error: "THIS BROWSER HAS NO STORE (kv is not on this page)" };
    var s = String(text == null ? "" : text);
    if (s.length < 200) return { ok: false, error: "THAT IS TOO SHORT TO BE A TRANSCRIPT (" + s.length + " CHARACTERS)" };
    busy = true;
    try {
      await ready();
      var old = meta;
      // A .json SIDECAR IS UNPACKED, NOT FILED. Its `text` is the record and its `messages` are the
      // roles; filing the JSON itself would put escaped newlines and no turns in the store.
      var sc = sidecar(s);
      var turns = Array.isArray(opts.turns) ? opts.turns : (sc ? sc.turns : null);
      if (sc) {
        s = sc.text;
        if (!opts.source) opts.source = "the .json sidecar" + (sc.exportedAt ? " of " + sc.exportedAt : "");
        if (!opts.kind) opts.kind = "sidecar";
        if (sc.picked && !opts.note) opts.note = "the panel was found as <" + sc.picked + ">";
      } else if (jsonShape(s)) {
        // NOT a sidecar, and it IS a .json: refuse it rather than file it. See jsonShape above.
        var shape = jsonShape(s);
        return { ok: false, error: (shape.meta && shape.marks)
          ? "THAT IS A CHATLOG INDEX FILE, NOT A TRANSCRIPT :: THE WORDS ARE IN THE .txt THAT WAS EXPORTED BESIDE IT - IMPORT THAT ONE, AND THE .json ONLY IF IT CARRIES TURNS. NOTHING WAS FILED AND THE RECORD IS UNTOUCHED."
          : "THAT .json IS NOT A SIDECAR THIS READER KNOWS :: IT NEEDS THE CONSOLE SCRIPT'S SIDECAR (A `text` FIELD, AND A `messages` LIST FOR THE TURNS) OR THE TRANSCRIPT ITSELF. NOTHING WAS FILED AND THE RECORD IS UNTOUCHED." };
      }
      var mode = wantMode(opts.mode);
      var added = s.length, joinHow = "", carried = 0;
      var joins = (old && Array.isArray(old.joins)) ? old.joins.slice(-(KEEP_JOINS - 1)) : [];
      // THE MERGE. Nothing below this block ever drops a word that is already in kv: an append
      // reduces to "what is past the seam", and only an explicit REPLACE does not go through here.
      if (mode === MODE_APPEND && old) {
        var base = "", lens = [];
        var RB = pbar("READING THE RECORD BACK", old.chunks);   // the seam is found against the whole of it
        try {
          for (var q = 1; q <= old.chunks; q++) { var tq = await get(q); base += tq; lens.push(tq.length); if (RB) RB.set(q); }
        } catch (e) { return { ok: false, error: "THE RECORD COULD NOT BE READ BACK TO APPEND TO IT :: " + String((e && e.message) || e) }; }
        var j = joinOf(base, s);
        var fresh = (j.at < 0 ? "" : s.slice(j.at)).replace(/^\s+/, "");
        if (j.dup || !fresh.replace(/\s+/g, "").length) {
          // THE WORDS ARE ALREADY IN THE RECORD. Importing the same file twice is not an error and
          // must not double the log - but a file that carries TURNS still has something to give,
          // which is exactly the case of the .json sidecar of a transcript already imported.
          return await thinIndex(k, base, turns, j.ow, opts);
        }
        // A TURN INDEX IS NOT THROWN AWAY BY APPENDING TO IT. If the record's index was built from a
        // real turn list (the .json sidecar names every message), the turns it already has are still
        // the turns of the part that is not changing - so they are CARRIED FORWARD, at their own
        // offsets, and the new part's role lines are added after them. Without this, one export
        // imported without its sidecar would collapse a 19,690-turn index back to the handful of
        // role lines a dump happens to contain, and "the log only ever gets better" would be false.
        if (!(turns && turns.length) && old.indexed === "turns" && marks.length) {
          var cumOld = [], r2 = 0;
          for (q = 0; q < lens.length; q++) { cumOld.push(r2); r2 += lens[q]; }
          var carry = [];
          for (q = 0; q < marks.length; q++) {
            var abs = cumOld[Math.min(Math.max(1, Number(marks[q].i) || 1), cumOld.length) - 1] + Math.max(0, Number(marks[q].o) || 0);
            if (abs >= base.length) continue;
            carry.push({ role: marks[q].k, text: base.slice(abs, Math.min(base.length, abs + 400)) });
          }
          if (carry.length) { turns = carry.concat(turnsFromLines(fresh)); carried = carry.length; }
        }
        joinHow = j.ow;
        added = fresh.length;
        if (j.first) s = base.replace(/\s+$/, "") + "\n\n" + fresh;
        else {
          s = base.replace(/\s+$/, "") + joinStamp(added, j.ow, opts.source || "") + fresh;
          joins.push({ at: Date.now(), added: added, source: String(opts.source || ""), how: j.ow });
        }
      } else if (mode === MODE_REPLACE) {
        joins = [];      // a replacement throws the old record away, and its joins describe it
      }
      var parts = split(s, CHUNK_CHARS);
      var WB = pbar("WRITING THE RECORD", parts.length);
      for (var n = 1; n <= parts.length; n++) { await k.set(CHUNK_KEY + n, parts[n - 1]); if (WB) WB.set(n); }
      if (old && old.chunks > parts.length) {
        for (var d = parts.length + 1; d <= old.chunks; d++) { try { await k.delete(CHUNK_KEY + d); } catch (e) {} }
      }
      var indexed = (turns && turns.length) ? "turns" : "lines";
      marks = (turns && turns.length) ? markTurns(s, parts, turns) : markUp(parts);
      if (!marks.length && turns && turns.length) { marks = markUp(parts); indexed = "role lines (the turn list matched nothing)"; }
      if (carried && indexed === "turns") indexed = "turns (the record's own, carried forward, plus the new part's role lines)";
      try { await k.set(MARKS_KEY, marks.slice(0, MARK_MAX)); } catch (e) { console.warn("the turn index was not saved", e); }
      var history = (old && Array.isArray(old.history)) ? old.history.slice(-(KEEP_HISTORY - 1)) : [];
      history.push({
        at: Date.now(), chars: s.length, bytes: bytes(s),
        source: String(opts.source || ""), kind: String(opts.kind || ""),
        fingerprint: fingerprint(s), replaced: (old && mode === MODE_REPLACE) ? old.chars : 0,
        mode: mode, added: added,
      });
      var notes = [];
      if (opts.note) notes.push(String(opts.note));
      // A RECORD THAT ARRIVED FROM ANOTHER ORIGIN SAYS SO, ONCE, HERE. The file carries the origin
      // it was exported from (its meta), and an import is the only moment that fact is visible -
      // after this the record is simply kept here.
      if (sc && sc.from && !sameOrigin(sc.from, originNow())) {
        notes.push("the file was exported from " + hostOf(sc.from) + ", not from here - it is kept HERE now");
      }
      if (mode === MODE_APPEND && old) {
        notes.push("appended (+" + added.toLocaleString() + " characters): " + joinHow);
        if (carried) notes.push("the turn index carries the " + carried.toLocaleString() + " turns the record already had, plus the ones the new part brought");
      } else if (old) notes.push("the record was replaced (the one before it is listed in the imports)");
      meta = {
        v: 1, at: Date.now(), chars: s.length, bytes: bytes(s), chunks: parts.length, lines: countLines(s),
        fingerprint: fingerprint(s), source: String(opts.source || ""), kind: String(opts.kind || ""),
        note: notes.join(" \u00b7 "), turns: marks.length, labels: labelNames(marks), indexed: indexed,
        head: cut(firstLine(s), 160), tail: cut(lastLine(s), 160), history: history,
        mode: mode, added: added, joinHow: joinHow, joins: joins, carried: carried,
        origin: originNow().origin,     // where it is KEPT, stamped every time the words are written
      };
      try { await k.set(META_KEY, meta); } catch (e) { return { ok: false, error: "THE INDEX COULD NOT BE SAVED :: " + String((e && e.message) || e) }; }
      settle();
      return { ok: true, chars: s.length, bytes: meta.bytes, chunks: meta.chunks, turns: meta.turns, mode: mode, added: added };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    } finally { busy = false; pbarDone(); }
  }

  // A FILE THAT IS ALREADY IN THE RECORD. Two things can still be true of it: it carries turns the
  // index does not have (the .json sidecar beside a transcript that was imported on its own), in
  // which case the index is rebuilt from THEM and the words are left exactly as they are; or it is
  // simply the same file again, in which case nothing happens at all and the record is untouched.
  // This is the road his one remaining click takes: the record is already whole, and the sidecar's
  // 19,690 messages are what turn `/chatlog turn <N>` into something you can actually use.
  async function thinIndex(k, base, turns, how, opts) {
    if (!(turns && turns.length)) {
      settle("NOTHING WAS ADDED :: " + up(how) + ".\n\n" + importReport());
      return { ok: true, nothingNew: true, reason: how, chars: meta.chars, bytes: meta.bytes, chunks: meta.chunks, turns: meta.turns };
    }
    var parts = split(base, CHUNK_CHARS);
    pbar("REBUILDING THE TURN INDEX", 0);   // no count to give: one CPU pass over the whole record
    marks = markTurns(base, parts, turns);
    var indexed = "turns";
    if (!marks.length) { marks = markUp(parts); indexed = "role lines (the turn list matched nothing)"; }
    try { await k.set(MARKS_KEY, marks.slice(0, MARK_MAX)); } catch (e) { console.warn("the turn index was not saved", e); }
    meta.turns = marks.length;
    meta.labels = labelNames(marks);
    meta.indexed = indexed;
    meta.mode = MODE_APPEND;
    meta.added = 0;
    meta.note = "the words did not change (" + how + "); the index was rebuilt from " + (indexed === "turns" ? "the file's own turn list" : "the role lines in the text")
      + (opts && opts.source ? " - " + opts.source : "");
    meta.history = (meta.history || []).slice(-(KEEP_HISTORY - 1));
    meta.history.push({
      at: Date.now(), chars: meta.chars, bytes: meta.bytes, source: String((opts && opts.source) || ""),
      kind: "index", fingerprint: meta.fingerprint, replaced: 0, mode: "index", added: 0,
    });
    try { await k.set(META_KEY, meta); } catch (e) { return { ok: false, error: "THE INDEX COULD NOT BE SAVED :: " + String((e && e.message) || e) }; }
    settle("NOTHING WAS ADDED :: " + up(how) + "\nBUT THE FILE CARRIED " + turns.length.toLocaleString()
      + " TURNS, SO THE INDEX WAS REBUILT FROM THEM - THE WORDS WERE NOT TOUCHED.\n\n" + importReport());
    return { ok: true, nothingNew: true, reindexed: true, reason: how, chars: meta.chars, bytes: meta.bytes, chunks: meta.chunks, turns: marks.length };
  }

  // TOPPING UP, BY NAME. APPEND is the policy, so this is shorthand for it - kept as its own name
  // because "append this" is what a caller means, and it has to keep meaning that even if the stored
  // policy is ever flipped to replace.
  async function append(text, opts) {
    var o = opts || {};
    o.mode = MODE_APPEND;
    return await put(text, o);
  }

  async function readAsText(file) {
    if (typeof file.text === "function") return await file.text();
    return await new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result || "")); };
      fr.onerror = function () { rej(new Error("the file could not be read")); };
      fr.readAsText(file);
    });
  }

  async function importFile(file, opts) {
    if (!file) return { ok: false, error: "NO FILE" };
    var text = "";
    try { text = await readAsText(file); }
    catch (e) { return { ok: false, error: "THE FILE COULD NOT BE READ :: " + String((e && e.message) || e) }; }
    var o = opts || {};
    if (!o.source) o.source = file.name || "a file";
    if (!o.kind) o.kind = "file";
    return await put(text, o);
  }

  async function pull(url, opts) {
    var u = String(url == null ? "" : url).trim();
    if (!/^https?:\/\//i.test(u)) return { ok: false, error: "USAGE: /chatlog import <URL> - IT MUST BE A WHOLE ADDRESS" };
    var text = "";
    try {
      var res = await fetch(u, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      text = await res.text();
    } catch (e) {
      return { ok: false, error: "THE ADDRESS COULD NOT BE READ :: " + String((e && e.message) || e) + "\nIF IT IS ON ANOTHER SITE, THIS PAGE IS NOT ALLOWED TO FETCH IT - DOWNLOAD IT AND USE THE CHATLOG PANEL'S FILE PICKER." };
    }
    opts = opts || {};
    opts.source = u; opts.kind = "url";
    return await put(text, opts);
  }

  async function wipe(confirm) {
    if (String(confirm || "").trim().toLowerCase() !== "yes") {
      return { ok: false, error: "THE RECORD IS NOT DELETED WITHOUT THE WORD :: /chatlog wipe yes" };
    }
    var k = kv();
    if (!k) return { ok: false, error: "THIS BROWSER HAS NO STORE (kv is not on this page)" };
    await ready();
    var gone = 0;
    try {
      if (meta) for (var n = 1; n <= meta.chunks; n++) { try { await k.delete(CHUNK_KEY + n); gone++; } catch (e) {} }
      try { await k.delete(MARKS_KEY); } catch (e) {}
      try { await k.delete(META_KEY); } catch (e) {}
    } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
    meta = null; marks = [];
    paintBadge();
    if (isOpen()) renderPanel("THE RECORD IS GONE (" + gone + " CHUNKS). THERE IS NO UNDO, AND THE EXPORTED FILE IN YOUR DOWNLOADS FOLDER IS NOW THE ONLY COPY.");
    return { ok: true, chunks: gone };
  }

  // ---- reading it back -------------------------------------------------------

  async function readAll() {
    if (!meta) return "";
    var out = [];
    var P = pbar("READING THE RECORD", meta.chunks);
    for (var n = 1; n <= meta.chunks; n++) { out.push(await get(n)); if (P) P.set(n); }
    // A read is a whole job of its own (a bare `chatlog.all()` is exactly this and nothing else), so
    // it closes its own claim. The export below re-opens the same id for the CPU half.
    if (P) { try { P.finish(); } catch (e) {} }
    return out.join("");
  }

  async function chunkRow(n) {
    var t = "";
    try { t = await get(n); } catch (e) { return { chunk: n, opens: "(UNREADABLE)", bytes: 0, lines: 0, turns: 0, chars: 0 }; }
    var turns = 0;
    for (var j = 0; j < marks.length; j++) if (marks[j].i === n) turns++;
    return { chunk: n, opens: cut(firstLine(t), 46), bytes: bytes(t), lines: countLines(t), turns: turns, chars: t.length };
  }

  // THE INDEX. Read from the store rather than estimated off the index, so it can never lie about a
  // record that was cut in a way this file no longer cuts (a change to LIA_CHATLOG_CHUNK, say).
  async function listText() {
    await ready();
    var L = [];
    L.push("THE CHATLOG - THE RAW RECORD OF THIS CONVERSATION (" + (meta ? size(meta.bytes) : "EMPTY") + ")");
    L.push(rule("=", 79));
    L.push("");
    if (!meta) {
      L.push("  NOTHING HAS BEEN IMPORTED YET. THE RECORD LIVES IN THIS BROWSER (kv: " + FOLDER + " / " + META_KEY + ").");
      L.push("  NOTHING IS SENT ANYWHERE: YOU HAND IT A TRANSCRIPT, IT KEEPS IT, AND IT READS IT BACK HERE.");
      L.push("  THE IMPORT POLICY IS " + up(policy) + ": AN IMPORT ADDS TO THE RECORD RATHER THAN REPLACING IT.");
      L.push("");
      L.push("  " + keptLine(await keeperOf()));
      L.push("");
      L.push("  GETTING IT OUT OF THE EDITOR :: run /chatlog snippet, paste what it prints into the EDITOR'S");
      L.push("  BROWSER CONSOLE, and the conversation comes back as a downloaded .txt. Then pick it on");
      L.push("  the CHATLOG panel (or paste it into the panel's box). THE WHOLE RECIPE IS " + EXTRACT + ".");
      return L.join("\n");
    }
    L.push("  IMPORTED    :: " + when(meta.at) + (meta.source ? "   FROM " + up(meta.source) : ""));
    L.push("  RECORD      :: " + meta.chars.toLocaleString() + " CHARACTERS  \u00b7  " + size(meta.bytes) + "  \u00b7  " + meta.lines.toLocaleString() + " LINES  \u00b7  " + meta.chunks + " CHUNKS");
    L.push("  TURNS       :: " + meta.turns + " MARKED" + (meta.labels && meta.labels.length ? " (" + meta.labels.map(up).join(", ") + ")" : "") + (meta.indexed ? "  \u00b7  INDEXED FROM " + up(meta.indexed) : ""));
    L.push("  GROWS BY    :: " + up(policy) + (policy === MODE_APPEND
      ? "  \u00b7  AN IMPORT KEEPS WHAT IS HERE AND TAKES WHAT IS NEW; A FILE ALREADY IN THE RECORD CHANGES NOTHING"
      : "  \u00b7  AN IMPORT THROWS THE RECORD AWAY AND WRITES THE NEW FILE IN ITS PLACE (REPLACE)"));
    // WHERE IT IS KEPT IS PART OF WHAT IT IS. One line, always; and when the shipped index disagrees
    // with this page, the whole story - because that is the one reading where the answer matters.
    var ko = await keeperOf();
    L.push("  " + keptLine(ko));
    if (!ko.agree && ko.shipped) { L.push(""); L.push(mismatchBlock(ko)); }
    // A RECORD THAT INDEXED ALMOST NOTHING HAS ONE LIKELY EXPLANATION, and it is worth saying here
    // rather than leaving a later session to conclude the feature is broken: a dump usually has no
    // role line for the heuristic to find, and the fix is the sidecar it was exported with.
    if (meta.turns < meta.lines / 50) {
      L.push("  THIN INDEX  :: THAT IS FEWER THAN ONE TURN PER FIFTY LINES - A PANEL DUMP USUALLY HAS NO");
      L.push("                 ROLE LINE FOR THE HEURISTIC TO FIND. THE RECORD IS WHOLE AND FULLY SEARCHABLE");
      L.push("                 (`/chatlog grep`), AND IMPORTING THE .json SIDECAR BESIDE IT FILLS THE INDEX:");
      L.push("                 ITS `messages` NUMBER EVERY TURN. NOTHING ELSE ABOUT THE RECORD CHANGES.");
      L.push("                 THE POLICY IS " + up(policy) + ", SO THAT IMPORT CANNOT DUPLICATE ANYTHING - A FILE");
      L.push("                 ALREADY IN THE RECORD IS NOT ADDED AGAIN, AND THE INDEX IS ALL THAT IS REBUILT.");
    }
    L.push("  FINGERPRINT :: " + meta.fingerprint);
    L.push("  STARTS      :: " + up(meta.head));
    L.push("  ENDS        :: " + up(meta.tail));
    L.push("");
    L.push("  CHUNK  CHARACTERS          SIZE      LINES   TURNS   OPENS WITH");
    var from = 1;
    for (var n = 1; n <= meta.chunks; n++) {
      var r = await chunkRow(n);
      var to = from + (r.chars || 0) - 1;
      L.push("    " + pad(n, 3) + "  " + pad(from.toLocaleString() + "-" + to.toLocaleString(), 18)
        + "  " + pad(size(r.bytes), 8) + "  " + pad(r.lines, 5) + "  " + pad(r.turns, 5) + "   " + up(r.opens));
      from += (r.chars || 0);
    }
    L.push("");
    L.push("READING IT   :: /chatlog show <CHUNK|first|last> [CHAR|all]  \u00b7  /chatlog turns [N]  \u00b7  /chatlog turn <N>  \u00b7  /chatlog grep <WORDS>");
    L.push("HANDING IT OVER :: /chatlog export (the same .txt and .json the console script makes)");
    L.push("GROWING IT   :: /chatlog append <URL>  \u00b7  /chatlog policy append|replace  \u00b7  APPEND THE BOX on the panel");
    if (meta.history && meta.history.length > 1) {
      L.push("");
      L.push("IMPORTS SO FAR (WHAT EACH ONE DID TO THE RECORD)");
      meta.history.slice(-6).forEach(function (h) {
        var what = (h.mode === "index") ? "THE INDEX ONLY (+0)"
          : (h.mode === MODE_REPLACE ? ("REPLACED " + (h.replaced || 0).toLocaleString() + " CHARS") : ("ADDED +" + (h.added || 0).toLocaleString()));
        L.push("  " + when(h.at) + "   " + (h.chars || 0).toLocaleString() + " CHARS   " + pad(size(h.bytes), 9)
          + "   " + pad(what, 26) + (h.source ? "FROM " + up(h.source) : ""));
      });
    }
    if (meta.joins && meta.joins.length) {
      L.push("");
      L.push("JOINS :: " + meta.joins.length + " SEAM(S) WRITTEN INTO THE RECORD (THE NEWEST " + Math.min(6, meta.joins.length) + " HERE)");
      meta.joins.slice(-6).forEach(function (j) {
        L.push("  " + when(j.at) + "   +" + Number(j.added || 0).toLocaleString() + " CHARS   " + up(j.how || "")
          + (j.source ? "   FROM " + up(j.source) : ""));
      });
    }
    return L.join("\n");
  }

  async function showText(arg) {
    await ready();
    if (!meta) return await listText();
    var a = String(arg == null ? "" : arg).trim();
    var low = a.toLowerCase();
    if (!a) return await listText();
    if (low === "first" || low === "head") return await headTail(true);
    if (low === "last" || low === "tail") return await headTail(false);
    var m = a.match(/^(\d+)(?:\s+(\d+))?(?:\s+(all))?$/);
    if (!m) return "USAGE: /chatlog show <CHUNK>  \u00b7  /chatlog show first|last  \u00b7  /chatlog show <CHUNK> all";
    var n = parseInt(m[1], 10);
    if (n < 1 || n > meta.chunks) return "THERE IS NO CHUNK " + n + " - THE RECORD HAS " + meta.chunks + ".";
    var t = await get(n);
    var off = parseInt(m[2] || "0", 10) || 0;
    var wantAll = !!m[3] || off > 0;
    var body = off > 0 ? t.slice(off) : t;
    if (!wantAll && body.length > SHOW_CHARS) {
      return "CHUNK " + n + " OF " + meta.chunks + " - THE FIRST " + SHOW_CHARS.toLocaleString() + " OF " + t.length.toLocaleString() + " CHARACTERS"
        + "\nMORE :: /chatlog show " + n + " " + SHOW_CHARS + "   \u00b7   THE WHOLE CHUNK :: /chatlog show " + n + " all"
        + "\n" + rule("-", 79) + "\n" + body.slice(0, SHOW_CHARS);
    }
    return "CHUNK " + n + " OF " + meta.chunks + " (" + t.length.toLocaleString() + " CHARACTERS)"
      + "\n" + rule("-", 79) + "\n" + body;
  }

  async function headTail(first) {
    var t = await get(first ? 1 : meta.chunks);
    var body = first ? t.slice(0, SHOW_CHARS) : t.slice(Math.max(0, t.length - SHOW_CHARS));
    return (first ? "THE BEGINNING OF THE RECORD" : "THE END OF THE RECORD") + " (" + when(meta.at) + ")"
      + "\n" + rule("-", 79) + "\n" + body;
  }

  async function turnText(arg) {
    await ready();
    if (!meta) return await listText();
    if (!marks.length) return "THERE IS NO TURN INDEX ON THIS RECORD - THE DUMP DOES NOT MARK ITS SPEAKERS.\nUSE /chatlog grep <WORDS> OR /chatlog show <CHUNK> INSTEAD.";
    var m = String(arg == null ? "" : arg).trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) return "USAGE: /chatlog turn <N>  \u00b7  /chatlog turn <N>-<M>   (SEE /chatlog turns FOR THE NUMBERS)";
    var a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
    if (a < 1 || a > marks.length) return "THERE IS NO TURN " + a + " - THE INDEX HAS " + marks.length + ".";
    b = Math.min(Math.max(b, a), marks.length);
    var out = [];
    for (var n = a - 1; n < b; n++) {
      var mk = marks[n];
      var t = await get(mk.i);
      var next = marks[n + 1];
      var body;
      if (!next) {
        body = t.slice(mk.o);
        // THE LAST TURN RUNS TO THE END OF THE RECORD, WHICH MAY BE SEVERAL CHUNKS AWAY - so the
        // chunks after it are read in too, rather than the turn stopping dead at a chunk edge.
        for (var q = mk.i + 1; q <= meta.chunks; q++) { try { body += await get(q); } catch (e) {} }
      }
      else if (next.i === mk.i) body = t.slice(mk.o, next.o);
      else {
        body = t.slice(mk.o);
        try { body += (await get(next.i)).slice(0, next.o); } catch (e) {}
      }
      out.push("TURN " + (n + 1) + " \u00b7 " + up(mk.k) + " \u00b7 CHUNK " + mk.i + " \u00b7 LINE " + (mk.l + 1) + "\n" + body.replace(/\s+$/, ""));
    }
    var text = out.join("\n\n" + rule("-", 79) + "\n\n");
    return text.length > SHOW_CHARS * 2 ? text.slice(0, SHOW_CHARS * 2) + "\n\n(TRUNCATED - ASK FOR A NARROWER RANGE)" : text;
  }

  async function turnsText(arg) {
    await ready();
    if (!meta) return await listText();
    if (!marks.length) return "THERE IS NO TURN INDEX ON THIS RECORD - THE DUMP DOES NOT MARK ITS SPEAKERS.";
    var want = parseInt(String(arg == null ? "" : arg).trim(), 10);
    var take = (isFinite(want) && want > 0) ? Math.min(want, marks.length) : Math.min(40, marks.length);
    var L = ["THE TURNS OF THE CONVERSATION (" + marks.length + " MARKED - SHOWING " + take + ")", rule("=", 79), ""];
    for (var n = 0; n < take; n++) {
      var mk = marks[n], t = "";
      try { t = await get(mk.i); } catch (e) {}
      L.push("  " + pad(n + 1, 5) + pad(up(mk.k), 12) + " " + up(cut(t.slice(mk.o, mk.o + 90), 70)));
    }
    L.push("");
    L.push("/chatlog turn <N> PRINTS ONE WHOLE TURN   \u00b7   /chatlog turns " + marks.length + " LISTS THEM ALL");
    return L.join("\n");
  }

  async function grepText(pat) {
    await ready();
    if (!meta) return await listText();
    var q = String(pat == null ? "" : pat).trim();
    if (!q) return "USAGE: /chatlog grep <WORDS OR PATTERN> - SEARCHES THE WHOLE RECORD AND SAYS WHICH CHUNK AND LINE EACH HIT IS ON.";
    var re;
    try { re = new RegExp(q, "i"); }
    catch (e) { re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); }
    var found = 0, shown = [];
    for (var n = 1; n <= meta.chunks; n++) {
      var t = "";
      try { t = await get(n); } catch (e) { continue; }
      var ls = t.split("\n");
      for (var i = 0; i < ls.length; i++) {
        if (!re.test(ls[i])) continue;
        found++;
        if (shown.length < GREP_MAX) shown.push("  CHUNK " + n + " \u00b7 LINE " + (i + 1) + "\n    " + up(cut(ls[i], 220)));
      }
    }
    if (!found) return "NOTHING IN THE RECORD MATCHES \"" + up(q) + "\" (" + meta.chars.toLocaleString() + " CHARACTERS SEARCHED).";
    var L = [found + " HIT" + (found === 1 ? "" : "S") + " FOR \"" + up(q) + "\"" + (found > shown.length ? " - SHOWING THE FIRST " + shown.length : ""), rule("=", 79), ""];
    L = L.concat(shown);
    L.push("");
    L.push("READ AROUND ONE :: /chatlog show <CHUNK>   \u00b7   /chatlog turn <N> IF THE DUMP MARKS ITS SPEAKERS");
    return L.join("\n");
  }

  // ---- handing it back out ---------------------------------------------------

  function saveText(name, text, type) {
    var blob = new Blob([String(text)], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  async function exportIt() {
    await ready();
    if (!meta) return { ok: false, error: "THERE IS NOTHING TO EXPORT YET." };
    // THE BAR. readAll (below) opens and closes its own counted claim for the chunk reads; from there
    // on the work has no count to give - the join, messagesFrom, and a JSON.stringify of the whole
    // record into the sidecar are one long CPU step - so the label changes and the bar goes
    // indeterminate until the files are handed over.
    try {
      var text = await readAll();
      pbar("EXPORTING THE RECORD", 0);
      var base = "lia-chatlog-" + day(meta.at);
      var msgs = messagesFrom(text, marks);
      saveText(base + ".txt", text);
      // THE .json IS A SIDECAR, IN THE SAME SHAPE THE CONSOLE SCRIPT WRITES, so that what EXPORT hands
      // out is exactly what IMPORT takes in: its `text` is the record and its `messages` are the turns,
      // which is the pair sidecar() unpacks. Handing it the index alone (meta + marks, no text) would
      // make the richer-looking file the one that cannot be read back - which is the mistake this
      // module already made once with somebody else's sidecar.
      saveText(base + ".json", JSON.stringify({
        format: "chatlog-sidecar", exportedAt: Date.now(), where: location.href,
        text: text, messages: msgs, meta: meta, marks: marks.slice(0, MARK_MAX),
      }, null, 1), "application/json");
      return { ok: true, chars: text.length, bytes: bytes(text), name: base + ".txt", turns: msgs.length };
    } finally { pbarDone(); }
  }

  // THE TURNS, CUT BACK OUT OF THE RECORD - what a sidecar's `messages` list is made of. Each mark
  // runs to the next one, so the pieces tile the record exactly and re-importing this file numbers
  // the turns the same way they were numbered here.
  function messagesFrom(text, mk) {
    var parts = split(text, CHUNK_CHARS), cum = [], run = 0, i;
    for (i = 0; i < parts.length; i++) { cum.push(run); run += parts[i].length; }
    var at = [], out = [];
    for (i = 0; i < mk.length; i++) {
      var c = Math.min(Math.max(1, Number(mk[i].i) || 1), cum.length);
      at.push(cum[c - 1] + Math.max(0, Number(mk[i].o) || 0));
    }
    for (i = 0; i < at.length; i++) {
      var end = (i + 1 < at.length && at[i + 1] > at[i]) ? at[i + 1] : text.length;
      var piece = text.slice(at[i], end).replace(/\s+$/, "");
      if (piece) out.push({ role: String(mk[i].k || ""), text: piece });
    }
    return out;
  }

  // The script that reads the editor's chat panel. It is a FILE, not a string in here, so it can be
  // fixed without touching this module - and printing it FROM the file means the copy this hands you
  // and the copy in src/chatlog/EXTRACT.md can never drift apart.
  async function snippet() {
    try {
      var res = await fetch(EXTRACT, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var raw = await res.text();
      var m = raw.match(/```(?:js|javascript)?\n([\s\S]*?)```/);
      var body = m ? m[1] : raw;
      return "THE EXPORT SCRIPT. IT IS RUN IN THE EDITOR'S OWN PAGE, NOT IN HERE - open the browser's console on\n"
        + "the editor tab (F12, then the console), paste the whole of the box below, and press Enter. It reads the\n"
        + "chat panel, finds the conversation, and downloads lia-chatlog-<date>.txt and a .json beside it. IT\n"
        + "SENDS NOTHING ANYWHERE. Then come back here and pick it with the CHATLOG panel's file picker (or paste it\n"
        + "into the panel's box and press APPEND THE BOX - an import ADDS to the record, so nothing is written twice).\n"
        + "\n" + rule("=", 79) + "\n" + body.replace(/\s+$/, "") + "\n" + rule("=", 79) + "\n"
        + "\nTHE WHOLE RECIPE - including what the script looks at, and what to do if it finds nothing - IS " + EXTRACT + ".";
    } catch (e) {
      return "THE SCRIPT COULD NOT BE READ FROM " + EXTRACT + " :: " + String((e && e.message) || e);
    }
  }

  async function about() {
    try {
      var res = await fetch(ABOUT, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var raw = await res.text();
      var body = (window.rtfm && typeof window.rtfm.markdown === "function") ? window.rtfm.markdown(raw, { skipFirstHeading: true }) : raw;
      return "THE CHATLOG :: " + ABOUT + " - THE RECIPE.\n\n" + body;
    } catch (e) {
      return "THE RECIPE COULD NOT BE READ :: " + String((e && e.message) || e) + "\n\nIT IS " + ABOUT + ".";
    }
  }

  // ---- THE BRIEF -------------------------------------------------------------

  // WHAT A SESSION READS FIRST. The record is millions of characters; a session that reads all of it
  // has spent everything it has on the reading. So there is a fixed-size head instead - what the
  // record is, where it is kept, where it STARTS, where it is NOW (the newest turns), what was MADE
  // of it (the chronicle), and the four ways deeper - and it costs two chunk reads however much the
  // record weighs. Every line is a LABELED FIELD, because this is read by a machine as often as by
  // him: the same labels appear in /chatlog list and in /chatlog origin, so a reader can diff two
  // sessions' briefs and see only what changed.
  //
  // The brief is not a summary. It holds no opinion: the newest turns are quoted, not paraphrased,
  // and nothing is left out because it looked unimportant. A session that reads it knows where to
  // ASK, which is the point - /chatlog turn <N>, /chatlog grep, /chatlog show, /chronicle.
  async function briefText(arg) {
    await ready();
    var here = originNow();
    if (!meta) {
      return "THE BRIEF :: NO RECORD YET\n" + rule("=", 79) + "\n"
        + "THERE IS NOTHING IN THIS BROWSER'S RECORD (kv: " + FOLDER + " / " + META_KEY + ").\n"
        + "\n"
        + "TO PUT THE CONVERSATION IN IT :: /chatlog snippet - paste what it prints into the EDITOR'S\n"
        + "browser console, then bring the downloaded file back here (pick it on the CHATLOG panel, or\n"
        + "/chatlog import <URL>). NOTHING IS UPLOADED BY ANY OF IT, AND NOTHING IS SENT ANYWHERE.\n"
        + "\n"
        + "WHERE IT WOULD LIVE :: " + hostOf(here) + "\n"
        + "  kv IS PER-ORIGIN, so this is the one place a record kept here can be. /chatlog origin SAYS\n"
        + "  WHY THAT MATTERS - IN ONE LINE, IT DOES NOT MOVE WHEN THE GENERATOR IS SAVED.";
    }
    var want = parseInt(String(arg == null ? "" : arg).trim(), 10);
    var take = (isFinite(want) && want > 0) ? Math.min(want, marks.length) : Math.min(BRIEF_TURNS, marks.length);
    var o = await keeperOf();
    var L = [];
    L.push("THE BRIEF :: THE RAW RECORD OF THE CONVERSATION THIS TERMINAL WAS BUILT IN");
    L.push(rule("=", 79));
    L.push("");
    L.push(keptLine(o));
    L.push("RECORD      :: " + meta.chars.toLocaleString() + " CHARACTERS  \u00b7  " + size(meta.bytes) + "  \u00b7  "
      + meta.lines.toLocaleString() + " LINES  \u00b7  " + meta.chunks + " CHUNKS  \u00b7  "
      + ((meta.history && meta.history.length) || 1) + " IMPORT(S)  \u00b7  " + ((meta.joins && meta.joins.length) || 0) + " JOIN(S)");
    L.push("TURNS       :: " + meta.turns + " MARKED" + (meta.labels && meta.labels.length ? " (" + meta.labels.map(up).join(", ") + ")" : "")
      + (meta.indexed ? "  \u00b7  INDEXED FROM " + up(meta.indexed) : ""));
    L.push("FINGERPRINT :: " + meta.fingerprint);
    L.push("GROWS BY    :: " + up(policy) + (policy === MODE_APPEND
      ? "  -  AN IMPORT KEEPS WHAT IS HERE AND TAKES WHAT IS NEW" : "  -  AN IMPORT THROWS THE RECORD AWAY"));
    L.push("LAST IMPORT :: " + when(meta.at) + (meta.source ? "  FROM " + up(meta.source) : ""));
    L.push("ENDS        :: " + up(meta.tail));
    L.push("");
    if (!o.agree && o.shipped) { L.push(mismatchBlock(o)); L.push(""); }
    // A THIN INDEX HAS ONE CAUSE AND ONE FIX, and a brief is exactly where a session would otherwise
    // conclude that the turn feature is broken. See the same note in listText.
    if (meta.turns < meta.lines / 50) {
      L.push("THIN INDEX  :: FEWER THAN ONE TURN PER FIFTY LINES - A PANEL DUMP HAS NO ROLE LINE FOR THE");
      L.push("               HEURISTIC TO FIND. THE WORDS ARE ALL HERE AND FULLY SEARCHABLE (/chatlog grep);");
      L.push("               IMPORTING THE .json BESIDE THE .txt FILLS THE INDEX (ITS `messages` NUMBER EVERY");
      L.push("               TURN) AND CANNOT DUPLICATE ANYTHING - THE POLICY IS " + up(policy) + ".");
      L.push("");
    }
    if (marks.length) {
      L.push("WHERE IT STARTS");
      L.push("  TURN 1  \u00b7  " + up(marks[0].k) + "  \u00b7  CHUNK " + marks[0].i + " \u00b7 LINE " + (marks[0].l + 1));
      L.push("  " + up(await turnSlice(1, BRIEF_CUT)));
      L.push("");
      L.push("WHERE IT IS NOW (THE LAST " + take + " MARKED TURN" + (take === 1 ? "" : "S") + ")");
      for (var n = marks.length - take + 1; n <= marks.length; n++) {
        var mk = marks[n - 1];
        L.push("  TURN " + n + "  \u00b7  " + up(mk.k) + "  \u00b7  CHUNK " + mk.i + " \u00b7 LINE " + (mk.l + 1));
        L.push("  " + up(await turnSlice(n, BRIEF_CUT)));
      }
    } else {
      L.push("WHERE IT STARTS / WHERE IT IS NOW :: THE DUMP MARKS NO SPEAKERS, SO THERE IS NO TURN LIST.");
      L.push("  THE WORDS ARE ALL HERE: /chatlog show <CHUNK>  \u00b7  /chatlog grep <WORDS>.");
    }
    L.push("");
    L.push("WHAT WAS MADE OF IT (THE CHRONICLE - THE WRITE-UPS, NOT THE TRANSCRIPT)");
    var ce = [];
    try {
      if (window.chronicle) ce = (typeof window.chronicle.rows === "function") ? window.chronicle.rows()
        : (typeof window.chronicle.entries === "function" ? window.chronicle.entries() : []);
      // THE CHRONICLE'S OWN LOAD MAY STILL BE IN FLIGHT WHEN A BRIEF IS ASKED FOR. One retry, once,
      // so the part of the brief that says WHAT WAS MADE OF IT is there when a session reads it -
      // and not "not loaded", which would be a fact about the moment rather than about the record.
      if ((!ce || !ce.length) && window.chronicle && typeof window.chronicle.reload === "function") {
        await window.chronicle.reload();
        ce = (typeof window.chronicle.rows === "function") ? window.chronicle.rows()
          : (window.chronicle.entries ? window.chronicle.entries() : []);
      }
    } catch (e) { ce = []; }
    if (ce && ce.length) {
      for (var c = 0; c < Math.min(3, ce.length); c++) {
        var e2 = ce[c];
        L.push("  " + pad(String(e2.date || ""), 12) + up(e2.title || e2.id || ""));
        if (e2.desc) L.push("               " + up(cut(e2.desc, 150)));
      }
      L.push("  /chronicle READS THEM ALL  \u00b7  " + ce.length + " ENTRIES ON FILE");
    } else {
      L.push("  THE CHRONICLE HAS NOT LOADED (src/chronicle/) - /chronicle READS IT.");
    }
    L.push("");
    L.push("DEEPER      :: /chatlog turn <N>  \u00b7  /chatlog turns [N]  \u00b7  /chatlog grep <WORDS>  \u00b7  /chatlog show <CHUNK|first|last>  \u00b7  /chatlog list");
    L.push("              /chatlog origin (WHERE IT LIVES)  \u00b7  /chronicle (WHAT WAS MADE OF IT)  \u00b7  /chatlog export");
    L.push("THE WHOLE RECORD IS " + size(meta.bytes) + ". THIS IS ITS HEAD - ASK FOR THE REST, DO NOT READ IT ALL.");
    return L.join("\n");
  }

  // ONE TURN, CUT TO A GLIMPSE. It reads the chunk the turn starts in, and the next one when the
  // turn is short and runs over an edge - which is all a paragraph needs. The whole of it is
  // /chatlog turn <N>, which is the honest way to read a turn that matters.
  async function turnSlice(n, maxChars) {
    var mk = marks[n - 1];
    if (!mk) return "";
    var t = "";
    try { t = await get(mk.i); } catch (e) { return "(CHUNK " + mk.i + " COULD NOT BE READ)"; }
    var body = t.slice(Math.max(0, Number(mk.o) || 0));
    if (body.length < maxChars && mk.i < meta.chunks) {
      try { body += await get(mk.i + 1); } catch (e) {}
    }
    return cut(body, maxChars);
  }

  // ---- the panel -------------------------------------------------------------

  function statusText() {
    if (!report) return "NOT READ YET";
    if (!meta) return ((report.failed ? ("EMPTY \u00b7 " + up(report.failed)) : "EMPTY") + " \u00b7 POLICY " + up(policy));
    return size(meta.bytes) + " \u00b7 " + meta.chunks + " CHUNKS \u00b7 " + meta.turns + " TURNS \u00b7 POLICY " + up(policy);
  }

  function importReport() {
    if (!meta) return "NOTHING HAS BEEN IMPORTED YET.";
    var how = (meta.mode === MODE_REPLACE) ? "THE RECORD WAS REPLACED"
      : (meta.mode === MODE_APPEND ? "ADDED TO WHAT WAS HERE (+" + Number(meta.added || 0).toLocaleString() + " CHARACTERS)" : "FILED");
    return "IMPORTED :: " + meta.chars.toLocaleString() + " CHARACTERS (" + size(meta.bytes) + ") IN " + meta.chunks
      + " CHUNKS \u00b7 " + meta.turns + " TURNS MARKED \u00b7 " + how + (meta.source ? " \u00b7 FROM " + up(meta.source) : "")
      + "\n" + (meta.labels && meta.labels.length ? "SPEAKERS :: " + meta.labels.map(up).join(", ") + "\n" : "")
      + (meta.joins && meta.joins.length ? "JOINS :: " + meta.joins.length + " (THE SEAMS BETWEEN TRANSCRIPTS ARE WRITTEN INTO THE RECORD)\n" : "")
      + (meta.carried ? "CARRIED :: " + Number(meta.carried).toLocaleString() + " TURNS THE RECORD ALREADY HAD WERE KEPT IN THE INDEX\n" : "")
      + (meta.indexed ? "THE TURN INDEX WAS BUILT FROM " + up(meta.indexed) + "\n" : "")
      + (meta.note ? "NOTE :: " + up(meta.note) + "\n" : "")
      + "STARTS :: " + up(meta.head) + "\nENDS   :: " + up(meta.tail)
      + "\n\nIT IS KEPT IN THIS BROWSER ONLY (kv: " + FOLDER + " - /chatlog origin SAYS WHICH ORIGIN THAT IS AND WHAT\nCOULD MOVE IT). /chatlog brief PRINTS THE HEAD OF IT, /chatlog LISTS THE INDEX, /chatlog turns THE TURNS,\n/chatlog grep <WORDS> SEARCHES IT, /chatlog export HANDS THE WHOLE THING BACK AS A FILE.";
  }

  function out(text) {
    var o = el("clOut");
    if (o) { o.textContent = String(text == null ? "" : text); o.scrollTop = 0; }
  }

  function paintBadge() {
    var b = el("clBtn");
    if (b) b.textContent = meta ? ("CHATLOG \u00b7 " + size(meta.bytes) + " \u25be") : "CHATLOG \u25be";
    var s = el("clState");
    if (s) s.textContent = statusText();
    var p = el("clPolicyBtn");
    if (p) p.textContent = "POLICY \u00b7 " + up(policy);
  }

  function renderPanel(text) {
    var p = el("clPanel");
    if (!p || p.hidden) return;
    paintBadge();
    if (text) out(text);
    else {
      var o = el("clOut");
      if (o && !o.textContent) {
        o.textContent = "READING THE INDEX\u2026";
        listText().then(function (t) { if (o) o.textContent = t; }, function (e) { if (o) o.textContent = "THE INDEX COULD NOT BE READ :: " + up((e && e.message) || e); });
      }
    }
  }

  function isOpen() { var p = el("clPanel"); return !!(p && !p.hidden); }
  function fit() {
    var p = el("clPanel"), deck = el("command-deck");
    if (!p || p.hidden || !deck) return;
    var room = Math.round(deck.getBoundingClientRect().top - 12);
    p.style.maxHeight = Math.max(180, room) + "px";
  }
  function open() {
    var p = el("clPanel");
    if (!p) return;
    try { if (window.shift && window.shift.isOpen && window.shift.isOpen()) window.shift.close(); } catch (e) {}
    try { if (window.tools && window.tools.isOpen && window.tools.isOpen()) window.tools.close(); } catch (e) {}
    try { if (window.instr && window.instr.isOpen && window.instr.isOpen()) window.instr.close(); } catch (e) {}
    try { if (window.keyring && window.keyring.isOpen && window.keyring.isOpen()) window.keyring.close(); } catch (e) {}
    p.hidden = false;
    fit();
    renderPanel();
  }
  function close() { var p = el("clPanel"); if (p) p.hidden = true; }
  function toggle() { if (isOpen()) close(); else open(); }

  function wire() {
    var b = el("clBtn");
    if (b && !b.dataset.clWired) { b.dataset.clWired = "1"; b.addEventListener("click", toggle); }
    var cb = el("clCloseBtn");
    if (cb && !cb.dataset.clWired) { cb.dataset.clWired = "1"; cb.addEventListener("click", close); }
    // THE BRIEF IS THE ONE BUTTON THAT DOES NOT BELONG TO AN OPERATION - it is where to START, so it
    // sits first: the head of the record, the newest turns, what was made of it, and the way deeper.
    var bf = el("clBriefBtn");
    if (bf && !bf.dataset.clWired) {
      bf.dataset.clWired = "1";
      bf.addEventListener("click", async function () { out("READING THE HEAD OF THE RECORD\u2026"); out(await briefText("")); });
    }
    // THE BOX'S OWN BUTTONS DO NOT FOLLOW THE POLICY - THEY SAY WHAT THEY DO. APPEND THE BOX always
    // appends (which is also the policy, so it is the ordinary press), REPLACE always replaces, and
    // the policy itself is the POLICY button, which is what the FILE PICKER and /chatlog import <URL>
    // read. A paste box is where the biggest, hand-carried file lands, so it gets both words out loud.
    var ap = el("clAppendBtn");
    if (ap && !ap.dataset.clWired) {
      ap.dataset.clWired = "1";
      ap.addEventListener("click", async function () {
        var box = el("clPaste");
        var text = box ? String(box.value || "") : "";
        if (!text.trim()) { out("THE PASTE BOX IS EMPTY. PASTE THE CONVERSATION INTO IT FIRST - OR PICK THE DOWNLOADED FILE."); return; }
        out("APPENDING " + text.length.toLocaleString() + " CHARACTERS\u2026");
        var res = await append(text, { kind: "paste", source: "pasted into the panel" });
        if (box && res.ok) box.value = "";
        out(readout(res));
      });
    }
    var rp = el("clReplaceBtn");
    if (rp && !rp.dataset.clWired) {
      rp.dataset.clWired = "1";
      rp.addEventListener("click", async function () {
        var box = el("clPaste");
        var text = box ? String(box.value || "") : "";
        if (!text.trim()) { out("THE PASTE BOX IS EMPTY - THERE IS NOTHING TO REPLACE THE RECORD WITH."); return; }
        out("REPLACING THE RECORD WITH " + text.length.toLocaleString() + " CHARACTERS\u2026");
        var res = await put(text, { kind: "paste", source: "pasted into the panel (replace)", mode: MODE_REPLACE });
        if (box && res.ok) box.value = "";
        out(readout(res));
      });
    }
    var pb = el("clPolicyBtn");
    if (pb && !pb.dataset.clWired) {
      pb.dataset.clWired = "1";
      pb.addEventListener("click", async function () {
        var res = await setPolicy(policy === MODE_APPEND ? MODE_REPLACE : MODE_APPEND);
        out(res.ok ? policyText() : up(res.error));
      });
    }
    var file = el("clFile");
    if (file && !file.dataset.clWired) {
      file.dataset.clWired = "1";
      file.addEventListener("change", async function () {
        var list = file.files ? [].slice.call(file.files) : [];
        if (!list.length) return;
        out("READING " + list.map(function (f) { return up(f.name) + " (" + size(f.size) + ")"; }).join("  +  ") + "\u2026");
        var res = list.length === 1 ? await importFile(list[0], {}) : await importFiles(list, {});
        file.value = "";
        if (!res.ok) { out("THE IMPORT DID NOT GO THROUGH :: " + up(res.error)); return; }
        out(readout(res) + (res.skipped && res.skipped.length
          ? "\n\nNOT FILED (THE RICHEST FILE WON - A SIDECAR WITH THE TURNS IS RICHER THAN A BARE TRANSCRIPT) :: " + res.skipped.map(up).join(", ")
          : ""));
      });
    }
    var exp = el("clExportBtn");
    if (exp && !exp.dataset.clWired) {
      exp.dataset.clWired = "1";
      exp.addEventListener("click", async function () {
        out("BUILDING THE EXPORT\u2026");
        var res = await exportIt();
        out(res.ok
          ? "EXPORTED :: " + up(res.name) + " (" + size(res.bytes) + ") AND A .json SIDECAR BESIDE IT, CARRYING THE TRANSCRIPT AND "
            + (res.turns || 0).toLocaleString() + " TURNS.\nIT WENT TO YOUR DOWNLOADS - NOTHING WAS UPLOADED."
          : up(res.error));
      });
    }
    var lst = el("clListBtn");
    if (lst && !lst.dataset.clWired) { lst.dataset.clWired = "1"; lst.addEventListener("click", async function () { out("READING THE INDEX\u2026"); out(await listText()); }); }
    var trn = el("clTurnsBtn");
    if (trn && !trn.dataset.clWired) { trn.dataset.clWired = "1"; trn.addEventListener("click", async function () { out(await turnsText("")); }); }
    var grp = el("clGrepBtn");
    if (grp && !grp.dataset.clWired) {
      grp.dataset.clWired = "1";
      grp.addEventListener("click", async function () {
        var q = el("clGrepInput");
        out("SEARCHING THE WHOLE RECORD\u2026");
        out(await grepText(q ? q.value : ""));
      });
    }
    var snp = el("clSnipBtn");
    if (snp && !snp.dataset.clWired) { snp.dataset.clWired = "1"; snp.addEventListener("click", async function () { out(await snippet()); }); }
    var wb = el("clWipeBtn");
    if (wb && !wb.dataset.clWired) {
      wb.dataset.clWired = "1";
      wb.addEventListener("click", async function () {
        var w = el("clWipeInput");
        var res = await wipe(w ? w.value : "");
        if (w) w.value = "";
        out(res.ok ? "THE RECORD IS GONE (" + res.chunks + " CHUNKS DELETED). THERE IS NO UNDO." : up(res.error));
      });
    }
    try { window.addEventListener("resize", function () { if (isOpen()) fit(); }); } catch (e) {}
  }

  // ---- the command -----------------------------------------------------------

  async function run(arg) {
    var a = String(arg == null ? "" : arg).trim();
    var low = a.toLowerCase();
    await ready();
    if (!a || /^(index|list|ls|status)$/.test(low)) return { title: "THE CHATLOG", text: await listText() };
    if (/^(about|recipe|help|\?)$/.test(low)) return { title: "THE CHATLOG", text: await about() };
    // WHAT A SESSION READS FIRST - see briefText. `start` and `catchup` are the same word said three
    // ways, because that is how a person says it; a number after it asks for that many turns.
    if (/^(brief|start|startup|catchup|catch-?up)(\s|$)/.test(low)) {
      return { title: "THE BRIEF", text: await briefText(a.replace(/^(brief|start|startup|catchup|catch-?up)\s*/i, "")) };
    }
    if (/^(origin|where)(\s|$)/.test(low)) return { title: "THE CHATLOG - WHERE IT LIVES", text: await originText() };
    if (/^(snippet|script|console|export-script|ops)$/.test(low)) return { title: "THE CHATLOG - THE EXPORT SCRIPT", text: await snippet() };
    if (/^(reload|refresh|reread)$/.test(low)) { await load(); return { title: "THE CHATLOG", text: "RELIT.\n\n" + await listText() }; }
    if (low.indexOf("show") === 0) return { title: "THE CHATLOG", text: await showText(a.replace(/^show\s*/i, "")) };
    if (low.indexOf("turn ") === 0) return { title: "THE CHATLOG", text: await turnText(a.replace(/^turns?\s*/i, "")) };
    if (low === "turns" || low.indexOf("turns ") === 0) return { title: "THE CHATLOG", text: await turnsText(a.replace(/^turns\s*/i, "")) };
    if (low.indexOf("grep") === 0 || low.indexOf("find") === 0 || low.indexOf("search") === 0) {
      return { title: "THE CHATLOG", text: await grepText(a.replace(/^(grep|find|search)\s*/i, "")) };
    }
    if (low === "export" || low === "download") {
      var e = await exportIt();
      return { title: "THE CHATLOG", text: e.ok
        ? "EXPORTED :: " + up(e.name) + " (" + size(e.bytes) + ") AND A .json SIDECAR BESIDE IT, CARRYING THE TRANSCRIPT AND "
          + (e.turns || 0).toLocaleString() + " TURNS.\nIT WENT TO YOUR DOWNLOADS - NOTHING WAS UPLOADED AND NOTHING WAS SENT ANYWHERE."
        : up(e.error) };
    }
    if (low.indexOf("import ") === 0) {
      var iArg = a.replace(/^import\s*/i, "").trim(), iMode = "";
      if (/^--?replace\b/i.test(iArg)) { iMode = MODE_REPLACE; iArg = iArg.replace(/^--?replace\b/i, "").trim(); }
      var r = await pull(iArg, iMode ? { mode: iMode } : {});
      return { title: "THE CHATLOG", text: readout(r) };
    }
    // APPENDING, BY HAND. The policy already appends, so this is for saying it out loud - to a URL, or
    // to whatever is in the panel's box (`/chatlog append` with no argument).
    if (low === "append" || low.indexOf("append ") === 0) {
      var apArg = a.replace(/^append\s*/i, "").trim();
      if (!apArg) {
        var box = el("clPaste"), boxText = box ? String(box.value || "") : "";
        if (!boxText.trim()) return { title: "THE CHATLOG", text: "NOTHING TO APPEND :: PUT THE TRANSCRIPT IN THE PANEL'S BOX FIRST, OR GIVE AN ADDRESS - /chatlog append <URL>.\nAN IMPORT APPENDS BY DEFAULT (" + up(policy) + " POLICY), SO /chatlog import <URL> DOES THE SAME THING." };
        var rB = await append(boxText, { kind: "paste", source: "pasted into the panel" });
        if (box && rB.ok) box.value = "";
        return { title: "THE CHATLOG", text: readout(rB) };
      }
      return { title: "THE CHATLOG", text: readout(await pull(apArg, { kind: "url", source: apArg, mode: MODE_APPEND })) };
    }
    if (low === "policy" || low.indexOf("policy ") === 0) {
      var want = a.replace(/^policy\s*/i, "").trim();
      if (!want) return { title: "THE CHATLOG - THE IMPORT POLICY", text: policyText() };
      var sr = await setPolicy(want);
      return { title: "THE CHATLOG - THE IMPORT POLICY", text: sr.ok ? policyText() : up(sr.error) };
    }
    if (low.indexOf("wipe") === 0) {
      var w = await wipe(a.replace(/^wipe\s*/i, ""));
      return { title: "THE CHATLOG", text: w.ok ? "THE RECORD IS GONE (" + w.chunks + " CHUNKS DELETED). THERE IS NO UNDO." : up(w.error) };
    }
    return { title: "THE CHATLOG", text: "USAGE :: /chatlog \u00b7 /chatlog brief [N] \u00b7 /chatlog origin \u00b7 /chatlog snippet \u00b7 /chatlog show <CHUNK|first|last> [CHAR|all] \u00b7 /chatlog turns [N] \u00b7 /chatlog turn <N> \u00b7 /chatlog grep <WORDS> \u00b7 /chatlog export \u00b7 /chatlog import [--replace] <URL> \u00b7 /chatlog append [URL] \u00b7 /chatlog policy [append|replace] \u00b7 /chatlog wipe yes \u00b7 /chatlog about" };
  }

  function describe() {
    return "THE CHATLOG (kv: " + FOLDER + " / " + META_KEY + ", read by src/js/chatlog.js) :: THE RAW RECORD OF THE CONVERSATION THIS TERMINAL WAS BUILT IN.\n"
      + "\n"
      + "WHY IT EXISTS :: a chat window is the one file that closes. Everything else survives - the code in src/, every\n"
      + "change in TODO.md, her memory in the LOREPACK, the manual in the RTFM, the write-ups in src/chronicle/ - but\n"
      + "the CONVERSATION ITSELF (what he asked for, in which words, what was tried first, what the numbers were) is\n"
      + "gone when the tab is. A handoff note is a few kilobytes of someone's memory of it; this is the transcript.\n"
      + "\n"
      + "WHERE IT LIVES :: kv (THIS BROWSER), not src/. src/ IS PUBLIC - it ships with the generator and anyone who\n"
      + "opens the source can read it - and a conversation is not public. What ships is the READER (src/js/chatlog.js),\n"
      + "the export recipe (src/chatlog/EXTRACT.md) and the INDEX (src/chatlog/manifest.json).\n"
      + "\n"
      + "GETTING IT OUT :: nothing on this page can read the editor's chat panel - it is a different origin, one window\n"
      + "up, and the browser forbids the crossing. So it is an OPS: /chatlog snippet prints a small script to run in the\n"
      + "EDITOR'S console, which reads the panel and downloads the conversation as a .txt (and a .json beside it). It\n"
      + "sends nothing anywhere.\n"
      + "\n"
      + "KEEPING IT :: the CHATLOG panel (the CHATLOG button in the deck) takes a pasted conversation or a picked file,\n"
      + "splits it into chunks in kv, and indexes it - which chunk holds what, and where every turn begins. Then it is\n"
      + "readable without ever being re-sent to a model: /chatlog show <CHUNK>, /chatlog turns, /chatlog turn <N>,\n"
      + "/chatlog grep <WORDS>, /chatlog export.\n"
      + "\n"
      + "HOW IT GROWS :: the policy is " + up(policy) + ", and it is the policy because a conversation only ever gets\n"
      + "longer - the newest export of it contains everything the last one did. So an import MERGES: the seam between\n"
      + "what is here and what arrived is found, only what is past the seam is kept, and the join is written into the\n"
      + "record so the seam is visible to anyone reading it. A file already in the record changes nothing at all -\n"
      + "unless it carries turns, in which case only the index is rebuilt. /chatlog policy replace (and the panel's\n"
      + "REPLACE) is the deliberate opposite, and the only thing here that ever throws anything away.\n"
      + "\n"
      + "WHAT IT IS NOT :: not her memory (nothing here is indexed for recall or handed to her), and not the write-ups -\n"
      + "the chronicle is what a session made of the conversation, and this is the conversation they were made from.\n"
      + "NOTHING HERE EVER REACHES THE TEXT ENGINE: an import costs nothing, a search costs nothing, reading costs\n"
      + "nothing, and no part of it is ever put in her prompt.\n"
      + "\n"
      + "WHERE IT LIVES, EXACTLY :: kv is PER-ORIGIN and the origin is the generator's ID, so a SAVE does not\n"
      + "move the record (this generator already exists on the server under this ID) and a RENAME does not\n"
      + "either - but a FORK is a new ID with an empty store. /chatlog origin says which one this page is,\n"
      + "and what to do if the two ever disagree.\n"
      + "READING IT FIRST :: /chatlog brief [N] is the fixed-size head of the record - where it lives, where\n"
      + "it starts, where it is NOW (the newest turns), and what was made of it - for two chunk reads,\n"
      + "however large the record grows. It is what a session should read before anything else.\n"
      + "\n"
      + "AND IT IS ONLY IN THIS BROWSER :: clear this browser's storage and the record goes with it. That is why EXPORT\n"
      + "exists, and why the shipped index records a cold copy if one was ever hosted. " + statusText();
  }

  (function boot() {
    wire();
    var p = load();
    if (p && p.then) p.then(function () { paintBadge(); }, function () { paintBadge(); });
    else paintBadge();
  })();

  return {
    load: load,
    ready: ready,
    put: put,
    append: append,
    importFile: importFile,
    importFiles: async function (files, opts) {
      var arr = [];
      for (var i = 0; i < (files || []).length; i++) if (files[i]) arr.push(files[i]);
      if (!arr.length) return { ok: false, error: "NO FILE" };
      if (arr.length === 1) return await importFile(arr[0], opts);
      // SEVERAL FILES AT ONCE. Filing them in turn would put the same conversation in twice - the .txt
      // and the .json beside it hold the same words (and the append merge, meeting a file it cannot
      // line up, would mark a join and keep both). So they are read, and the RICHEST one is filed: a
      // sidecar with a turn list wins, and the longest wins otherwise. The others are not filed and
      // nothing is uploaded.
      var texts = [];
      for (i = 0; i < arr.length; i++) {
        var t = "";
        try { t = await readAsText(arr[i]); } catch (e) { t = ""; }
        texts.push({ file: arr[i], text: t, side: sidecar(t) });
      }
      var pick = -1;
      for (i = 0; i < texts.length; i++) if (texts[i].side && texts[i].side.turns.length) { pick = i; break; }
      if (pick === -1) for (i = 0; i < texts.length; i++) if (pick === -1 || texts[i].text.length > texts[pick].text.length) pick = i;
      if (pick === -1) return { ok: false, error: "NOTHING IN THAT SELECTION COULD BE READ" };
      var o = opts || {};
      if (!o.source) o.source = "the richest of " + texts.length + " files (" + (texts[pick].file.name || "a file") + ")";
      if (!o.kind) o.kind = "file";
      var res = await put(texts[pick].text, o);
      if (res && res.ok) { res.picked = texts[pick].file.name || "a file"; res.skipped = texts.filter(function (x, j) { return j !== pick; }).map(function (x) { return x.file.name || "a file"; }); }
      return res;
    },
    pull: pull,
    wipe: wipe,
    get: get,
    all: readAll,
    meta: function () { return meta; },
    marks: function () { return marks.slice(); },
    listText: listText,
    brief: briefText,
    origin: originText,
    showText: showText,
    turnText: turnText,
    turnsText: turnsText,
    grepText: grepText,
    export: exportIt,
    snippet: snippet,
    about: about,
    run: run,
    describe: describe,
    status: statusText,
    policy: function () { return policy; },
    setPolicy: setPolicy,
    policyText: policyText,
    readout: readout,
    count: function () { return meta ? meta.chunks : 0; },
    bytes: function () { return meta ? meta.bytes : 0; },
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    refresh: function () { paintBadge(); if (isOpen()) renderPanel(); },
  };
})();
