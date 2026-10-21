/* -----------------------------------------------------------------------------
   CHATLOG -> LOREPACK.

   WHAT THIS IS. The bridge between the two halves of keeping a conversation: the CHATLOG (the raw
   record, chunked in kv - see CHATLOG.FORMAT.v2.md) and a LOREPACK (memory that can be retrieved).
   One export in, two files out:

     1. <agent>-chatlog-<stamp>.md    a DOCUMENT for a document LOREPACK (BM25): a front block and
                                      then ONE SECTION PER TURN, each headed with its number and its
                                      speaker. Section-per-turn is the whole point: a 3 MB chat then
                                      retrieves as turns, and every turn keeps the speaker the raw
                                      .txt loses.
     2. <agent>-turns.jsonl           STAGING RECORDS for a MYTHOS pack: one object per turn, in the
                                      pack's own field names (v/type/id/a/h/t/ts/src/d), with
                                      `vec: null`.

   WHY `vec` IS NULL AND WHY IT IS NOT A BUG. A vector is an embedding, and an embedding is the
   FACTORY's step - it owns the model, the dimension and the mark. A converter that invented vectors
   would be putting meaningless geometry into somebody's memory. So the staging record declares
   everything the factory cannot derive (who it belongs to, who spoke, in what order, from where)
   and leaves the one thing it must compute to it.

   WHY THE ID IS DETERMINISTIC (`<agent>:<stamp>:t<seq>`). So ingesting the same export twice is a
   no-op rather than a second copy of the same memory. If the factory insists on its own uuid, it
   should keep this id in `d.stagingId` so a re-ingest can still be recognised.

   WHY IT REFUSES A .json IT DOES NOT KNOW. Same rule as the module: the first foreign .json to reach
   that store was filed as a transcript (megabytes of escaped braces where the conversation should
   have been). A file that is not a sidecar and does not look like a transcript is refused BY NAME,
   and nothing is written.

   IT NEVER TOUCHES THE NETWORK, AND IT WRITES NOTHING BY ITSELF. build() is pure: text in, strings
   out. download() (browser only) is a separate, deliberate second call.

   Runs in a generator's console, the editor's console, or Node (module.exports is set when there is
   a `module`). No dependencies, no build step.
------------------------------------------------------------------------------ */

(function () {
  "use strict";

  // ---- the knobs the owner sets -------------------------------------------------
  var DEFAULTS = {
    agent: "LIA",          // WHOSE memory this is. UPPERCASE - it is the pack's join key.
    handle: "Lia",         // how she is addressed in the record. Capitalized.
    human: "Patrikios",    // the human's handle in this lane.
    includeHuman: true,    // true: the human's turns go into the PACK too (recommended - an answer with
                           // nothing above it is not a memory of an exchange). The .md always carries
                           // both sides: a transcript with one side missing is not a transcript.
    kind: "chat"           // what to call this document, in its own front block.
  };

  // The module's own role-word rule, so a bare .txt is read exactly as the module would read it.
  var SPEAKER = /^(you|your|me|patrikios|user|human|assistant|agent|ai|lia|barbelo|system|tool|claude|gpt|developer)/i;

  function normRole(r) {
    var s = String(r == null ? "" : r).trim().toLowerCase().replace(/[^a-z]/g, "");
    if (!s) return "";
    if (/^(user|human|you|me|patrikios|him)$/.test(s)) return "user";
    if (/^(assistant|agent|ai|bot|lia|barbelo|claude|gpt|model)$/.test(s)) return "assistant";
    if (s === "system" || s === "tool" || s === "developer") return s;
    return s.slice(0, 24);
  }

  // A LINE THAT IS ONLY A ROLE WORD. Mirrors speakerOf() in the module: the line must be short, must
  // open with a role word, and must be nothing after it but a colon or a dash - so "You should have
  // seen it." is not a turn.
  function labelOf(line) {
    var s = String(line == null ? "" : line).replace(/[\u200b\u00a0]/g, " ").trim();
    if (!s || s.length > 90) return "";
    var m = s.match(SPEAKER);
    if (!m) return "";
    var rest = s.slice(m[0].length).replace(/^[\s>*_#`]+/, "").replace(/[\s*_`]+$/, "");
    if (rest === "" || /^[:\u2013\u2014-]/.test(rest)) return normRole(m[1]);
    if (rest.length <= 12 && /:$/.test(rest)) return normRole(m[1]);
    return "";
  }

  // THE LABEL IS THE PANEL'S, NOT THE TURN'S. A message read off the page (or a mark taken from a role
  // line) usually begins with the word "You"/"Assistant" on its own line. It is not part of what was
  // said, and it is already in the record's `role`, so it is cut here - once, and only when the first
  // line really is nothing but that label.
  function stripLeadLabel(text, role) {
    var t = String(text == null ? "" : text).replace(/\r\n?/g, "\n").replace(/^\s+/, "").replace(/\s+$/, "");
    var nl = t.indexOf("\n");
    var first = nl === -1 ? t : t.slice(0, nl);
    var k = labelOf(first);
    if (k && (!role || k === role)) return t.slice(nl + 1).replace(/^\s+/, "");
    return t;
  }

  function slug(s) { return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent"; }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stampOf(d) {
    var dt = (d instanceof Date && !isNaN(d)) ? d : new Date();
    return dt.getFullYear() + pad(dt.getMonth() + 1) + pad(dt.getDate()) + "-" + pad(dt.getHours()) + pad(dt.getMinutes());
  }
  function whenOf(v) {
    if (typeof v === "number" && isFinite(v)) return new Date(v);
    if (typeof v === "string" && v) { var d = new Date(v); if (!isNaN(d)) return d; }
    return null;
  }
  function num(n) { return Number(n || 0).toLocaleString ? Number(n || 0).toLocaleString() : String(n); }

  // ---- the two shapes of sidecar, and a bare .txt ---------------------------------

  // Returns { messages, text, where, exportedAt, origin, format } or null. Both writers' files are
  // accepted, which is the module's own rule (see sidecar() in chatlog.js).
  function readSidecar(raw) {
    var t = String(raw == null ? "" : raw).replace(/^\uFEFF/, "").trim();
    if (t.charAt(0) !== "{") return null;
    var d;
    try { d = JSON.parse(t); } catch (e) { return null; }
    if (!d || typeof d !== "object") return null;
    var text = (typeof d.text === "string") ? d.text : "";
    var msgs = Array.isArray(d.messages) ? d.messages.filter(function (m) { return m && typeof m.text === "string" && m.text.replace(/\s+/g, ""); }) : [];
    if (text.replace(/\s+/g, "").length < 200 && !msgs.length) return null;
    var origin = String((d.meta && d.meta.origin) || d.where || "");
    return {
      messages: msgs.map(function (m) { return { role: normRole(m.role), text: String(m.text) }; }),
      text: text, where: String(d.where || ""), origin: origin,
      exportedAt: whenOf(d.exportedAt), format: String(d.format || "")
    };
  }

  // The .txt road: no roles, so the turn list is the role lines the text happens to carry. Same rule
  // as the module's fallback, and the same honesty about it - a dump usually has none, and then the
  // whole file is one turn.
  function turnsFromText(text) {
    var ls = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
    var off = 0, out = [], k = "", at = 0;
    for (var i = 0; i < ls.length; i++) {
      var s = labelOf(ls[i]);
      if (s) {
        if (k) out.push({ role: k, text: text.slice(at, off) });
        k = s; at = off;
      }
      off += ls[i].length + 1;
    }
    if (k) out.push({ role: k, text: text.slice(at) });
    return out.filter(function (t) { return t.text.replace(/\s+/g, ""); });
  }

  // ---- the two files --------------------------------------------------------------

  function heading(turn, i, opts) {
    var who = turn.role === "user" ? opts.human : (turn.role === "assistant" ? opts.handle : (turn.role ? turn.role.charAt(0).toUpperCase() + turn.role.slice(1) : "?"));
    return "## T" + (i + 1) + " \u00b7 " + who;
  }

  function build(input, opts) {
    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var k2 in (opts || {})) o[k2] = opts[k2];
    o.agent = String(o.agent || "LIA").toUpperCase();
    o.handle = String(o.handle || o.agent);

    var raw = (input && typeof input === "object" && typeof input.text === "string") ? input.text : input;
    raw = String(raw == null ? "" : raw);
    // A .json IS REFUSED BY NAME BEFORE THE LENGTH GATE, because "too short" is the wrong sentence for
    // a file somebody picked by mistake: the reader has to know WHY, not just that it did not work.
    var isJson = raw.replace(/^\uFEFF/, "").trim().charAt(0) === "{";
    var side = readSidecar(raw);
    if (side === null && isJson) {
      return { ok: false, error: "THAT .json IS NOT A SIDECAR THIS CONVERTER KNOWS :: IT NEEDS A `text` FIELD (ANY LENGTH) OR A `messages` LIST. " +
        "THE CONSOLE SCRIPT'S SIDECAR AND THE CHATLOG PANEL'S OWN EXPORT BOTH QUALIFY. NOTHING WAS WRITTEN." };
    }
    // The module's own gate, on the raw string (chatlog.js `put`): under 200 CHARACTERS is a paste
    // accident, not a transcript.
    if (raw.length < 200) return { ok: false, error: "THAT IS TOO SHORT TO BE A TRANSCRIPT (" + raw.length + " CHARACTERS)." };
    var text = side ? (side.text || side.messages.map(function (m) { return m.text; }).join("\n\n")) : raw;
    var turns = (side && side.messages.length) ? side.messages : turnsFromText(text);
    if (!turns.length) return { ok: false, error: "NO TURNS COULD BE FOUND IN THAT TEXT AND IT IS NOT A SIDECAR. NOTHING WAS WRITTEN." };

    var stamp = stampOf(side && side.exportedAt ? side.exportedAt : new Date());
    var origin = (side && (side.origin || side.where)) || "";
    var idBase = slug(o.agent) + ":" + stamp;
    var clean = turns.map(function (t, i) {
      var role = t.role || "";
      return { seq: i + 1, role: role, speaker: role === "user" ? o.human : (role === "assistant" ? o.handle : (role || "?")), text: stripLeadLabel(t.text, role) };
    }).filter(function (t) { return t.text.replace(/\s+/g, ""); });

    var md = [];
    md.push("# " + o.agent + " \u2014 CHATLOG " + stamp);
    md.push("");
    md.push("- kind: " + o.kind);
    md.push("- agent: " + o.agent + " (handle " + o.handle + ")");
    md.push("- exported: " + (side && side.exportedAt ? side.exportedAt.toISOString() : "(unknown)"));
    md.push("- origin: " + (origin || "(unknown)"));
    md.push("- turns: " + clean.length + " (" + clean.filter(function (t) { return t.role === "user"; }).length + " human / " +
      clean.filter(function (t) { return t.role === "assistant"; }).length + " " + o.handle + ")");
    md.push("- characters: " + num(text.length));
    md.push("- shape: chatlog v2 (chunked kv record; format in CHATLOG.FORMAT.v2.md)");
    md.push("- note: one section per turn, so a turn can be retrieved on its own; the words are unedited.");
    md.push("");
    md.push("---");
    md.push("");
    clean.forEach(function (t, i) {
      md.push(heading(t, i, o));
      md.push("");
      md.push(t.text);
      md.push("");
    });

    var jsonl = [];
    var skipped = 0;
    clean.forEach(function (t) {
      if (!o.includeHuman && t.role === "user") { skipped++; return; }
      var rec = {
        v: 2, type: "turn",
        id: idBase + ":t" + t.seq,
        a: o.agent, h: t.speaker, t: t.text,
        role: t.role, seq: t.seq, ts: null,
        src: "chatlog :: " + (origin || "(unknown origin)") + " :: " + stamp + " :: t" + t.seq,
        d: { origin: origin, exportedAt: (side && side.exportedAt ? side.exportedAt.toISOString() : null), role: t.role, seq: t.seq, chatlog: "v2", stagingId: idBase + ":t" + t.seq },
        vec: null     // THE FACTORY'S. See the header. Do not fill this in here.
      };
      jsonl.push(JSON.stringify(rec));
    });

    var name = slug(o.agent) + "-chatlog-" + stamp;
    var report = [
      "READ      :: " + (side ? "a sidecar" + (side.format ? " (" + side.format + ")" : "") : "a bare transcript") +
        (origin ? " from " + origin : ""),
      "TURNS     :: " + clean.length + " (" + clean.filter(function (t) { return t.role === "user"; }).length + " human, " +
        clean.filter(function (t) { return t.role === "assistant"; }).length + " " + o.handle + ", " +
        clean.filter(function (t) { return t.role !== "user" && t.role !== "assistant"; }).length + " other)",
      "RECORDS   :: " + jsonl.length + (skipped ? " (" + skipped + " human turn(s) left out: includeHuman = false)" : ""),
      "MD        :: " + name + ".md  (\u2248" + Math.round(md.join("\n").length / 1024) + " KB - a document for a document LOREPACK)",
      "JSONL     :: " + name + ".jsonl  (\u2248" + Math.round(jsonl.join("\n").length / 1024) + " KB - staging records; `vec` is the factory's)",
      "NOT DONE  :: embedding, chunking, edges, and the pack itself. Those are the factory's four steps, not this file's.",
      "WROTE     :: nothing. build() returns strings; download() is the only thing that saves a file."
    ].join("\n");

    return { ok: true, name: name, md: md.join("\n") + "\n", jsonl: jsonl.join("\n") + "\n", report: report, turns: clean.length, records: jsonl.length, agent: o.agent, stamp: stamp };
  }

  // ---- handing it back out (browser only) -----------------------------------------
  function saveText(name, text, type) {
    var blob = new Blob([String(text)], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function download(res) {
    if (!res || !res.ok) return false;
    saveText(res.name + ".md", res.md, "text/markdown;charset=utf-8");
    saveText(res.name + ".jsonl", res.jsonl, "application/json");
    return true;
  }
  // A file picker's File -> build(), for a page that would rather not make the user paste 3 MB.
  function file(f, opts) {
    return new Promise(function (resolve) {
      var r = new FileReader();
      r.onload = function () { resolve(build(String(r.result), opts)); };
      r.onerror = function () { resolve({ ok: false, error: "THAT FILE COULD NOT BE READ." }); };
      r.readAsText(f);
    });
  }

  var api = { build: build, download: download, file: file, readSidecar: readSidecar, turnsFromText: turnsFromText, stripLeadLabel: stripLeadLabel, normRole: normRole, DEFAULTS: DEFAULTS };
  if (typeof window !== "undefined") window.chatlogToLorepack = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
