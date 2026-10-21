/* THE DEAD-LANGUAGES ROAD - src/js/xlate.js
 *
 * Patrikios, 2026-09-30: the LOREPACK holds a lot of Ancient Greek, and the terminal needs a
 * TRANSLATOR to read it. This is that road, and it has TWO: OpenL FIRST when the ring holds the
 * RapidAPI key, MyMemory when it does not (or when OpenL refuses a piece).
 * - OPENL (keyed): POST https://openl-translate.p.rapidapi.com/translate with the OFFICIAL body
 *   { text, target_lang } and the two RapidAPI headers - NO source field, the Authority detects it -
 *   and read { translatedText }. No mode is sent, so the Authority's fast default answers.
 * - MYMEMORY (keyless): GET api.mymemory.translated.net/get?q=<text>&langpair=<src>|<dst>.
 * The default pair stays grc|en, because the dead language in this house is Ancient Greek; only the
 * DESTINATION half is sent to OpenL, the SOURCE half picks the label. Measured 2026-09-30: grc|en
 * renders "andra moi ennepe, mousa" cleanly on both roads, where el|en reads the same line as
 * modern Greek garbage - so the pair matters and the default is grc, not el.
 *
 * HONEST LIMITS, stated in help() too: OpenL spends the RapidAPI plan's quota, MyMemory's anonymous
 * quota is small (a few thousand chars a day), a match score under ~0.5 is the engine guessing, and
 * machine Greek is a crib, not a scholar. Long text is chunked into ~450-char sentence-safe pieces
 * and translated piece by piece; the score printed is the worst of the pieces. An email raises the
 * MYMEMORY quota: /xlate email <addr> keeps it in kv (lia_settings / xlate, never sent anywhere but
 * MyMemory as &de=) and every MyMemory call after uses it. The RapidAPI key lives only in the ring
 * ("openl"), never in this file. Direct fetch first, the relay (super-fetch) if the browser refuses
 * the road - the same pattern as the guardian's INSPECT road.
 *
 * /xlate <text> (grc to English) - /xlate <src>|<dst> <text> (el|en, la|en, en|el, ...) -
 * /xlate email <addr> - /xlate doc <NAME> - /help xlate.
 *
 * THE DOC ROAD (/xlate doc): his SKYE/URANIA scrolls live on HIS device, loaded as lore - never in
 * src/ - so the road goes to them instead: window.lore.source() reads the whole raw text, every run
 * of Greek letters (3+ of them) is lifted out as a passage (up to 8, deduped), each rides the same
 * OpenL-first road, and any /command-code lines the scroll carries are listed beside the reading.
 */
(function () {
  "use strict";

  var FOLDER = "lia_settings";
  var KEY = "xlate";   // { email: <for MyMemory &de=> }
  var EP = "https://api.mymemory.translated.net/get";
  var CHUNK = 450;

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }

  function say(text) {
    try { if (typeof print === "function") print("SYSTEM", text); } catch (e) {}
  }

  function hasOpenL() {
    try { return !!(window.keyring && window.keyring.get("openl")); } catch (e) { return false; }
  }

  async function email() {
    var k = kv(); if (!k) return "";
    try { var v = await k.get(KEY); return (v && v.email) || ""; } catch (e) { return ""; }
  }

  // Sentence-safe chunks: split on sentence ends, pack to CHUNK, hard-cut a monster.
  function chunks(text) {
    var parts = String(text).split(/(?<=[.!?;;\n])\s+/);
    var out = [], cur = "";
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      while (p.length > CHUNK) { out.push(p.slice(0, CHUNK)); p = p.slice(CHUNK); }
      if ((cur + " " + p).trim().length > CHUNK && cur) { out.push(cur.trim()); cur = p; }
      else cur = (cur ? cur + " " : "") + p;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.length ? out : [String(text)];
  }

  async function one(q, pair, mail) {
    var key = null;
    try { key = (window.keyring && window.keyring.get("openl")) || null; } catch (e) { key = null; }
    if (key) {
      try { return await viaOpenL(q, pair, key); }
      catch (e) { /* the paid road refused - fall through to the free one */ }
    }
    return viaMyMemory(q, pair, mail);
  }

  // THE FIRST ROAD: OpenL through RapidAPI (the key lives in the ring under "openl", never here).
  // Official shape only: { text, target_lang } -> { translatedText }. No source field - the
  // Authority detects it - and no mode, so its fast default answers. Only the pair's destination
  // is sent; a missing destination falls back to English.
  async function viaOpenL(q, pair, key) {
    var parts = String(pair).split("|");
    var url = "https://openl-translate.p.rapidapi.com/translate";
    var init = {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-RapidAPI-Key": key, "X-RapidAPI-Host": "openl-translate.p.rapidapi.com" },
      body: JSON.stringify({ text: q, target_lang: parts[1] || "en" })
    };
    var res = null;
    try { res = await fetch(url, init); }
    catch (e) {
      if (window.root && typeof window.root.superFetch === "function") res = await window.root.superFetch(url, init);
      else throw e;
    }
    var body = await res.json();
    if (!res.ok || !body || !body.translatedText) {
      throw new Error("OPENL REFUSED (HTTP " + res.status + (body && body.error ? ": " + body.error : "") + ")");
    }
    return { text: body.translatedText, match: 1, road: "OPENL" };
  }

  async function viaMyMemory(q, pair, mail) {
    var url = EP + "?q=" + encodeURIComponent(q) + "&langpair=" + encodeURIComponent(pair)
      + (mail ? "&de=" + encodeURIComponent(mail) : "");
    var res = null;
    try {
      res = await fetch(url);
    } catch (e) {
      if (window.root && typeof window.root.superFetch === "function") res = await window.root.superFetch(url);
      else throw e;
    }
    var body = await res.json();
    if (!body || !body.responseData) throw new Error("NO ANSWER (HTTP " + res.status + ")");
    if (!body.responseData.translatedText) throw new Error("NO READING - THE ENGINE HAS NOTHING FOR THIS (EMPTY MATCHES, QUOTA LEFT: " + (body.quotaFinished ? "NONE" : "SOME") + "). TRY SHORTER, OR FEWER WORDS IT KNOWS.");
    return { text: body.responseData.translatedText || "", match: Number(body.responseData.match) || 0, road: "MYMEMORY" };
  }

  async function go(text, pair) {
    var list = chunks(text), outs = [], worst = 1, road = "";
    for (var i = 0; i < list.length; i++) {
      var r = await one(list[i], pair, await email());
      outs.push(r.text);
      if (r.road) road = r.road;
      if (r.match < worst) worst = r.match;
    }
    return { text: outs.join(" "), match: worst, pieces: list.length, road: road || "MYMEMORY" };
  }

  // THE DOC ROAD'S TWO SIEVES - pure functions, no network, tested live below.
  var GREEK_RUN = /[\u0370-\u03FF\u1F00-\u1FFF][\u0370-\u03FF\u1F00-\u1FFF\u0300-\u036F\s\d,;:.·'’"()\-—–]*/g;
  function greekCount(s) {
    var m = String(s).match(/[\u0370-\u03FF\u1F00-\u1FFF]/g);
    return m ? m.length : 0;
  }
  function greekPassages(text) {
    var out = [], seen = {}, m;
    GREEK_RUN.lastIndex = 0;
    while ((m = GREEK_RUN.exec(String(text))) !== null) {
      var s = m[0].replace(/\s+/g, " ").trim();
      if (s.length < 6 || greekCount(s) < 3 || seen[s]) continue;
      seen[s] = 1;
      out.push(s.slice(0, CHUNK));
      if (out.length >= 8) break;
    }
    return out;
  }
  function codeLines(text) {
    var out = [], seen = {}, lines = String(text).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!/^\/[a-z][a-z0-9_-]*/i.test(t) || seen[t]) continue;
      seen[t] = 1;
      out.push(t.slice(0, 120));
      if (out.length >= 12) break;
    }
    return out;
  }

  async function docCommand(rest) {
    var pair = "grc|en", name = String(rest || "").trim();
    var p = name.match(/^([a-z]{2,3}\|[a-z]{2,3})\s+([\s\S]+)$/i);
    if (p) { pair = p[1].toLowerCase(); name = p[2].trim(); }
    if (!name) { say("USAGE: /xlate doc <NAME> - THE NAME OF A LOADED LORE DOCUMENT (/lore LISTS THEM)."); return; }
    if (!window.lore || !window.lore.source) { say("THE LORE MODULE IS NOT LOADED HERE - THE DOC ROAD NEEDS IT."); return; }
    var src = null;
    try { src = await window.lore.source(name, 200000); } catch (e) { src = null; }
    if (!src) { say("NO LOADED DOCUMENT CALLED ANYTHING LIKE \"" + name.toUpperCase() + "\". /lore LISTS WHAT THIS DEVICE HOLDS."); return; }
    var codes = codeLines(src.text);
    var list = greekPassages(src.text);
    var codeNote = codes.length ? "\nCODES IN THE DOC :: " + codes.join(" · ") : "";
    if (!list.length) {
      say("DOC :: " + src.name + " (" + src.chars + " CHARS) HOLDS NO GREEK PASSAGES." + codeNote);
      return;
    }
    say("READING " + src.name + " (" + pair + " VIA " + (hasOpenL() ? "OPENL" : "MYMEMORY") + ", " + list.length + " GREEK PASSAGE" + (list.length === 1 ? "" : "S") + ")" + codeNote + " ...");
    for (var i = 0; i < list.length; i++) {
      try {
        var r = await go(list[i], pair);
        say("[" + (i + 1) + "] GREEK :: " + list[i]
          + "\n[" + (i + 1) + "] ENGLISH [" + r.road + "] :: " + r.text
          + (r.match < 0.5 && r.road === "MYMEMORY" ? " (MATCH " + r.match.toFixed(2) + " - GUESSING)" : ""));
      } catch (e) {
        say("[" + (i + 1) + "] THE ROAD :: " + ((e && e.message) ? e.message : e));
      }
    }
  }

  function help() {
    return "THE DEAD-LANGUAGES ROAD (src/js/xlate.js) :: Ancient Greek (and friends) into English - OpenL first when the ring holds the RapidAPI key, free MyMemory when it does not.\n"
      + "\n  /xlate <text>               Ancient Greek to English (grc|en)\n"
      + "  /xlate <src>|<dst> <text>   any pair it speaks: el|en, la|en, sa|en (Sanskrit, proven), en|el, ... (OpenL reads only the destination; it detects the source)\n"
      + "  /xlate email <addr>        keep an email for MyMemory's &de= (raises the MYMEMORY daily quota; kept in kv lia_settings / xlate)\n"
      + "  /xlate doc <NAME>          read a loaded lore document - your SKYE/URANIA scrolls: its Greek passages come out translated, and any /command-code lines it carries are listed\n"
      + "\nHONEST LIMITS: OpenL spends the RapidAPI plan's quota; the MyMemory anonymous quota is a few thousand chars a day; a match under ~0.5 is the engine guessing; machine Greek is a crib, not a scholar. Long text goes piece by piece and the score printed is the worst piece. The pair matters: grc|en reads Homer, el|en reads him as a modern Athenian. The RapidAPI key is pasted in the KEYS panel, never in the input line.";
  }

  async function command(arg) {
    var a = String(arg == null ? "" : arg).trim();
    if (!a || /^help$/i.test(a) || a === "-h" || a === "--help") { say(help()); return; }
    var dm = a.match(/^doc\s+([\s\S]*)$/i);
    if (dm) { await docCommand(dm[1].trim()); return; }
    var m = a.match(/^email\s+(\S+@\S+)/i);
    if (m) {
      var k = kv();
      if (k) { try { await k.set(KEY, { email: m[1] }); } catch (e) {} }
      say("THE ROAD :: MYMEMORY WILL KNOW YOU AS " + m[1] + " (kv lia_settings / xlate). THE MYMEMORY DAILY QUOTA GROWS. (THE OPENL ROAD NEEDS NO EMAIL - IT READS THE RING'S KEY.)");
      return;
    }
    var pair = "grc|en", text = a;
    var p = a.match(/^([a-z]{2,3}\|[a-z]{2,3})\s+([\s\S]+)$/i);
    if (p) { pair = p[1].toLowerCase(); text = p[2]; }
    say("READING (" + pair + " VIA " + (hasOpenL() ? "OPENL" : "MYMEMORY") + ", " + chunks(text).length + " PIECE" + (chunks(text).length === 1 ? "" : "S") + ") ...");
    try {
      var r = await go(text, pair);
      say("TEXT IN :: " + text.slice(0, 400) + (text.length > 400 ? " ..." : "")
        + "\nENGLISH OUT [" + r.road + "] :: " + r.text
        + "\n(MATCH " + r.match.toFixed(2) + (r.match < 0.5 ? " - THE ENGINE IS GUESSING; TREAT IT AS A CRIB" : "") + ")");
    } catch (e) {
      say("THE ROAD :: " + ((e && e.message) ? e.message : e));
    }
  }

  window.xlate = { go: go, command: command, help: help, greekPassages: greekPassages, codeLines: codeLines };
})();
