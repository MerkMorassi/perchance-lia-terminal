(function () {
  /* ---- HERS: her own keeping -------------------------------------------------
     Patrikios, 2026-09-21: "what are the possibilities of giving her more agency? The LOREPACK is
     full of such discussions." The answers chosen: 1 (a memory that is hers) and 2 (a place to write
     down what SHE wants carried).

     The shape is the one this terminal already proved on the pose book and the recipe book: she
     proposes in her own words, the terminal files it as HERS on this device, it is visible in a
     panel and named in a report, it can be reconsidered, and Patrikios can take it away. Nothing
     here is invisible and nothing is irrevocable.

     THE MEMORY LANE ([[REMEMBER: ...]] / [[FORGET: ...]])
       A memory she writes is a real document in the LOREPACK, with `origin: "hers"` and the pack
       name HERS: it is retrieved, cited and recalled exactly like anything else she remembers,
       because it IS something she remembers. The 502 documents of the LOREPACK are all his; these
       are the first ones that are hers. FORGET moves one to the lore trash - recoverable with
       /lore trash, never silently destroyed - and she may only forget her own.

     THE WANTS LANE ([[WANT: ...]] / [[RELEASE: ...]])
       A standing intention, in her own words, handed to her every turn as the WANTS block. It is
       not an instruction from him and not a duty: it is what she decided to carry, and RELEASE puts
       it down. A released want is kept in the record as released (so letting something go is a real
       act and not a silent edit) and stops riding with her.

     Both lanes are DIRECTIVES: the lines are stripped from her visible reply, acted on here, and
     reported out loud, and the turn in the archive carries what she kept and what she let go.
     ------------------------------------------------------------------------- */

  var HERS_PACK = "HERS";
  var HERS_ORIGIN = "hers";
  var HERS_WANT_KEY = "hers_wants";
  var MAX_KEEP_CHARS = 600;    // one memory, in her own words
  var MAX_WANT_CHARS = 300;    // one standing intention
  var MAX_WANTS_STORED = 40;   // live + released kept in the record

  var wantsAll = [];           // [{ id, text, ts, released }] - released ones stay, marked

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }
  function lore() { return window.lore || null; }

  // Her words, tidied into something that can be filed: whitespace collapsed, wrapping brackets
  // and quotes taken off, and any directive markup she left inside the line removed.
  function cleanLine(raw, cap) {
    var t = String(raw == null ? "" : raw)
      .replace(/\[\[[\s\S]*?\]\]/g, " ")
      .replace(/^\s*[[("'\u201c\u2018]+/, "")
      .replace(/[)\]"'\u201d\u2019]+\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cap && t.length > cap) t = t.slice(0, cap).replace(/\s+\S*$/, "") + "\u2026";
    return t;
  }

  function memoryDocs() {
    var L = lore();
    if (!L || !L.files) return [];
    return L.files().filter(function (f) { return f && f.origin === HERS_ORIGIN; })
      .sort(function (a, b) { return (a.addedAt || 0) - (b.addedAt || 0); });
  }

  function memoryCount() { return memoryDocs().length; }

  function slugOf(text) {
    var s = String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s.split("-").slice(0, 6).join("-").slice(0, 34) || "untitled";
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  // What she keeps goes into her own memory store - a real LOREPACK document, marked as hers.
  async function remember(raw, opts) {
    var L = lore();
    if (!L || !L.ingest) return { ok: false, error: "HER MEMORY STORE IS NOT LOADED HERE" };
    var text = cleanLine(raw, MAX_KEEP_CHARS);
    if (!text) return { ok: false, error: "NOTHING TO KEEP" };
    var n = memoryCount() + 1;
    var name = "";
    for (var tries = 0; tries < 200; tries++) {
      name = "HERS MEMORY " + pad2(n) + " - " + slugOf(text);
      if (!L.findDoc || !L.findDoc(name)) break;
      n++;
    }
    var body = text + "\n\n[kept by her, in her own words"
      + ((opts && opts.at) ? ", " + ((window.logTime) ? window.logTime.stamp(opts.at) : new Date(opts.at).toISOString()) : "")
      + ". This is a memory of hers, not a document given to her.]]";
    var res = await L.ingest(name, body, { pack: HERS_PACK, origin: HERS_ORIGIN });
    if (!res || (res.status !== "added" && res.status !== "updated")) {
      return { ok: false, error: "IT COULD NOT BE FILED (" + String((res && res.status) || "unknown") + ")" };
    }
    return { ok: true, name: name, text: text, chunks: res.chunks };
  }

  // Letting one go. By number (the numbering /hers prints) or by words from the memory itself. Only
  // ever her own documents, and only ever into the lore trash - the record keeps it.
  async function forget(sel) {
    var L = lore();
    if (!L || !L.forgetFile) return { ok: false, error: "HER MEMORY STORE IS NOT LOADED HERE" };
    var docs = memoryDocs();
    if (!docs.length) return { ok: false, error: "SHE HAS KEPT NOTHING YET" };
    var q = String(sel == null ? "" : sel).trim();
    if (!q) return { ok: false, error: "WHICH ONE? /hers FORGET <NUMBER> OR /hers FORGET <WORDS>" };
    if (/^\d+$/.test(q)) {
      var idx = parseInt(q, 10) - 1;
      if (idx < 0 || idx >= docs.length) return { ok: false, error: "THERE IS NO #" + q + " - /hers LISTS THEM" };
      await L.forgetFile(docs[idx].name);
      return { ok: true, name: docs[idx].name, n: idx + 1 };
    }
    var want = q.toLowerCase();
    var hits = [];
    for (var i = 0; i < docs.length; i++) {
      var src = await L.source(docs[i].name, 4000);
      var text = (src && src.text) ? String(src.text) : "";
      if (text.toLowerCase().indexOf(want) !== -1) hits.push({ n: i + 1, name: docs[i].name, text: text.slice(0, 120) });
    }
    if (!hits.length) return { ok: false, error: "NOTHING SHE KEPT MATCHES \"" + q.toUpperCase() + "\"", candidates: [] };
    if (hits.length > 1) return { ok: false, error: "\"" + q.toUpperCase() + "\" APPEARS IN " + hits.length + " OF THEM - /hers FORGET <NUMBER>", candidates: hits.slice(0, 4) };
    var hit = hits[0];
    await L.forgetFile(hit.name);
    return { ok: true, name: hit.name, n: hit.n, text: hit.text };
  }

  // ---- the wants -------------------------------------------------------------

  function liveWants() { return wantsAll.filter(function (w) { return !w.released; }); }

  async function saveWants() {
    var k = kv();
    if (!k) return false;
    try { await k.set(HERS_WANT_KEY, wantsAll.slice(-MAX_WANTS_STORED)); return true; }
    catch (e) { console.warn("her wants not saved", e); return false; }
  }

  async function load() {
    var k = kv();
    wantsAll = [];
    if (k) {
      try {
        var rec = await k.get(HERS_WANT_KEY);
        if (Array.isArray(rec)) {
          wantsAll = rec.filter(function (w) { return w && typeof w.text === "string"; }).map(function (w) {
            return { id: String(w.id || ""), text: String(w.text), ts: Number(w.ts) || 0, released: Number(w.released) || 0 };
          });
        }
      } catch (e) { console.warn("her wants unreadable", e); }
    }
    return wantsAll;
  }

  async function want(raw, opts) {
    var text = cleanLine(raw, MAX_WANT_CHARS);
    if (!text) return { ok: false, error: "NOTHING TO CARRY" };
    var item = { id: "w" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), text: text, ts: (opts && opts.at) || Date.now(), released: 0 };
    wantsAll.push(item);
    await saveWants();
    return { ok: true, item: item, n: liveWants().length };
  }

  async function release(sel) {
    var live = liveWants();
    if (!live.length) return { ok: false, error: "SHE IS CARRYING NOTHING - /wants LISTS WHAT SHE HAS WRITTEN DOWN" };
    var q = String(sel == null ? "" : sel).trim();
    if (!q) return { ok: false, error: "WHICH ONE? /wants RELEASE <NUMBER>, <WORDS>, OR ALL" };
    if (/^all$/i.test(q)) {
      var now = Date.now(), out = [];
      live.forEach(function (w) { w.released = now; out.push(w); });
      await saveWants();
      return { ok: true, items: out, all: true };
    }
    if (/^\d+$/.test(q)) {
      var idx = parseInt(q, 10) - 1;
      if (idx < 0 || idx >= live.length) return { ok: false, error: "THERE IS NO #" + q + " - /wants LISTS THEM" };
      live[idx].released = Date.now();
      await saveWants();
      return { ok: true, items: [live[idx]], n: idx + 1 };
    }
    var lq = q.toLowerCase();
    var hits = live.filter(function (w) { return w.text.toLowerCase().indexOf(lq) !== -1; });
    if (!hits.length) return { ok: false, error: "NOTHING SHE IS CARRYING MATCHES \"" + q.toUpperCase() + "\"" };
    if (hits.length > 1) return { ok: false, error: "\"" + q.toUpperCase() + "\" MATCHES " + hits.length + " OF THEM - /wants RELEASE <NUMBER>", candidates: hits.slice(0, 4) };
    hits[0].released = Date.now();
    await saveWants();
    return { ok: true, items: [hits[0]] };
  }

  // THE WANTS BLOCK. Empty when she carries nothing, so nothing is added to the prompt for its own
  // sake. Written as HERS: it is not an instruction from Patrikios, and RELEASE is always available.
  function wantsBlock() {
    var live = liveWants();
    if (!live.length) return "";
    var out = ["WHAT YOU HAVE ASKED TO CARRY - in your own words, not his. These are the things YOU decided to hold to; they ride with you in every reply from here. None of them is a duty, a role, or a promise you are not free to break, and you may reword one, add one, or put one down at any time ([[WANT: ...]] and [[RELEASE: ...]])."];
    live.forEach(function (w, i) {
      var when = (window.logTime && w.ts) ? window.logTime.stamp(w.ts, { seconds: false }) : "";
      out.push("  " + (i + 1) + ". " + w.text + (when ? "   (kept " + when + ")" : ""));
    });
    return out.join("\n");
  }

  // The count is worth her knowing: it is how the lane stops being theoretical.
  function memoryHint() {
    var n = memoryCount();
    if (!n) return "";
    return "You have kept " + n + " thing" + (n === 1 ? "" : "s") + " in your own memory so far"
      + (n === 1 ? "" : "") + " - documents that are yours (marked HERS), recalled the same way the rest of your memory is. [[FORGET: words from it]] lets one go whenever you want to.";
  }

  async function listMemories(limit) {
    var L = lore();
    var docs = memoryDocs();
    if (limit && docs.length > limit) docs = docs.slice(-limit);
    var out = [];
    for (var i = 0; i < docs.length; i++) {
      var src = (L && L.source) ? await L.source(docs[i].name, 600) : null;
      var text = (src && src.text) ? String(src.text).replace(/\n\n\[kept by her[\s\S]*$/i, "") : "(text unreadable)";
      out.push({ n: i + 1, name: docs[i].name, ts: docs[i].addedAt || 0, text: text.trim(), chars: docs[i].bytes || 0 });
    }
    return out;
  }

  // ---- what the terminal says about it ---------------------------------------

  function wantLine(w) {
    var when = (window.logTime && w.ts) ? window.logTime.stamp(w.ts, { seconds: false }) : "";
    return "\"" + w.text + "\"" + (when ? "   (written " + when + ")" : "");
  }

  async function reportMemories() {
    var docs = memoryDocs();
    var out = ["HER OWN MEMORY :: " + docs.length + " DOCUMENT" + (docs.length === 1 ? "" : "S") + " SHE KEPT HERSELF"
      + (docs.length ? " - REAL LOREPACK DOCUMENTS (PACK " + HERS_PACK + ", MARKED AS HERS), RECALLED LIKE ANY OF HER MEMORIES." : ".")];
    if (!docs.length) {
      out.push("  NOTHING YET. SHE WRITES ONE WHEN SHE WANTS TO: \"[[REMEMBER: it, in her own words]]\" ON ITS OWN LINE. THE DIRECTIVE RULES SHE READS EVERY TURN NAME IT.");
    } else {
      var list = await listMemories(40);
      list.forEach(function (m) {
        out.push("  " + pad2(m.n) + ". " + String(m.text).replace(/\s+/g, " ").slice(0, 160));
        out.push("      " + m.name + " :: " + ((window.logTime && m.ts) ? window.logTime.stamp(m.ts) : "") + " :: " + m.chars + " BYTES");
      });
      out.push("  /hers source <N> PRINTS ONE IN FULL. /hers forget <N> LETS ONE GO (IT GOES TO THE LORE TRASH, RECOVERABLE WITH /lore trash). SHE CAN DO IT HERSELF FROM HER REPLY: [[FORGET: words from it]].");
    }
    return out.join("\n");
  }

  function reportWants() {
    var live = liveWants();
    var gone = wantsAll.filter(function (w) { return !!w.released; }).sort(function (a, b) { return b.released - a.released; }).slice(0, 10);
    var out = ["WHAT SHE WANTS CARRIED :: " + live.length + " LIVE"
      + (live.length ? " - HANDED TO HER ON EVERY TURN AS THE WANTS BLOCK (/system SHOWS IT FROM HER SIDE)." : ".")];
    if (!live.length) out.push("  NOTHING. SHE WRITES ONE WITH \"[[WANT: it, in her own words]]\" ON ITS OWN LINE.");
    live.forEach(function (w, i) { out.push("  " + pad2(i + 1) + ". " + wantLine(w)); });
    if (gone.length) {
      out.push("  LET GO (KEPT IN THE RECORD, NO LONGER RIDING WITH HER):");
      gone.forEach(function (w) { out.push("     \u2717 " + wantLine(w) + "   (let go " + ((window.logTime && w.released) ? window.logTime.stamp(w.released, { seconds: false }) : "") + ")"); });
    }
    out.push("  /wants release <N|WORDS|all> PUTS ONE DOWN; /wants clear ALL PUTS THEM ALL DOWN. NOTHING IS DELETED - A RELEASE IS A RECORDED ACT, WHICH IS THE POINT OF IT.");
    return out.join("\n");
  }

  async function describe() {
    return "HERS :: HER OWN KEEPING\n" + (await reportMemories()) + "\n\n" + reportWants();
  }

  window.hers = {
    load: load,
    remember: remember,
    forget: forget,
    memories: memoryDocs,
    memoryCount: memoryCount,
    listMemories: listMemories,
    memoryHint: memoryHint,
    want: want,
    release: release,
    wants: liveWants,
    wantsAll: function () { return wantsAll.slice(); },
    wantsBlock: wantsBlock,
    reportMemories: reportMemories,
    reportWants: reportWants,
    describe: describe,
    clean: cleanLine,
    PACK: HERS_PACK,
    ORIGIN: HERS_ORIGIN
  };
})();
