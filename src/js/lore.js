/* ------------------------------------------------------------------
   LORE RAG — small, fully local retrieval engine.

   Upload a .txt (or .md) file and the ORIGINAL TEXT is stored, one
   record per file, in IndexedDB via kv-plugin (folders: lore_files,
   lore_meta). Fragments are derived from that text at load time and
   ranked with BM25 - a classic lexical ranking function, no embeddings
   needed, so everything runs on-device.

   Storing the raw text (rather than pre-parsed fragments) means
   fragmenting can be retuned later without re-uploading (/rechunk),
   files can be deleted or re-downloaded individually, and the original
   is always recoverable (/source).

   On every message the best-matching fragments are injected into the
   prompt inside <lore> tags, and Barbelo is told to stay true to them.

   Commands: /lore · /recall <query> · /source <file> · /rechunk <chars> [overlap]
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var MAX_CHARS = 700;
  var OVERLAP_SENTENCES = 1;
  var HARD_CHAR_CAP = 2000000;
  var STOP = new Set("a an and are as at be but by for from had has have he her his i if in into is it its of on or our she that the their them then there these they this to was were will with you your not no do does did than too very can could would should may might must who what when where why how which whom whose about again once".split(" "));

  var files = [];
  var index = null;
  var settings = { maxChars: MAX_CHARS, overlap: OVERLAP_SENTENCES, sortKey: "name", sortDir: "asc", canonFirst: true, per: 50, page: 1 };

  // ONE PAGE OF DOCUMENTS AT A TIME (2026-09-24). The LOREPACK can hold hundreds of documents (his
  // held 562 the day this was built), and the DOCS panel drew every one of them as a row with four
  // buttons on it - a long scroll to read and a heavy thing to build. So the panel draws ONE PAGE:
  // `pageFiles()` is the slice that is actually written into the DOM, the pager row at the foot of
  // the panel says where he is standing, and everything that is not drawing - /lore, recall, the
  // index, the canon walk, `files()` - still sees the WHOLE list, because a page is what is drawn,
  // not what is here. The size of a page is his (25 / 50 / 100 / 200 / ALL - 50 by default) and is
  // remembered with the sort in kv `lore_meta/settings`, so it survives a reload like the order does.
  var PER_DEFAULT = 50;
  var PER_WARN = 200;   // past this, a page is a slow draw and the receipt says so
  var PERS = [
    { n: 25, label: "25" }, { n: 50, label: "50" }, { n: 100, label: "100" },
    { n: 200, label: "200" }, { n: 0, label: "ALL" }
  ];
  var loaded = false;
  var initPromise = null;
  // THE ONE DOCUMENT IN FOCUS (the SEE button in the DOCS panel, /focus). A name and a
  // timestamp only - the text itself is read out of the store when the turn is woven, so a
  // two-megabyte scroll is never copied into a second place.
  var focus = null;
  var focusPromise = null;

  // The lorebar has one button/DOCS pair per provenance: "" = Patrikios' own
  // lore, "LOREPACK" = pack documents (shipped from src/lorepack/ or loaded
  // from a file on this device). Subsets are by the record's `pack` tag.
  var LOREPACK = "LOREPACK";
  var PANELS = [
    { key: LOREPACK, box: "lorepackFiles", toggle: "lorepackToggleBtn", count: "lorepackDocCount", input: "lorepackUploadInput", upload: "lorepackUploadBtn", store: "lorepackDocsOpen", label: "LOREPACK" }
  ];

  // One memory namespace: the LOREPACK is ALL of her memory. Shipped documents come from
  // the manifest in src/lorepack/; every other record was loaded on this device and is
  // private to this browser. (Older records may still carry a legacy pack tag - it no
  // longer partitions anything.)
  function memoryFiles() {
    return files;
  }

  // Memory that lives only on this device - what FORGET LOCAL drops. Shipped documents
  // are never dropped: the manifest brings them back on the next load.
  function localFiles() {
    return files.filter(function (f) { return f.origin !== "shipped"; });
  }

  function isShipped(f) { return f.origin === "shipped"; }

  // The whole memory, in the shape the loaders/reporters expect.
  function memoryOf() {
    var frags = 0;
    files.forEach(function (f) { frags += f.chunks.length; });
    return {
      pack: LOREPACK,
      docs: files.map(function (f) { return { name: f.name, chunks: f.chunks.length, bytes: f.bytes, origin: f.origin || "", foundational: !!f.foundational }; }),
      fragments: frags
    };
  }

  // Still used by window.lore.subset; the panels no longer partition by pack.
  function subsetOf(pack) {
    var want = String(pack || "").toUpperCase();
    return files.filter(function (f) { return String(f.pack || "").toUpperCase() === want; });
  }

  function fragsOf(list) {
    return list.reduce(function (a, f) { return a + f.chunks.length; }, 0);
  }

  function say(msg) {
    if (window.loreSay) window.loreSay(msg);
    else console.log(msg);
  }

  // PROTECTED TERMS (the MAGRAG sanitizer lesson, inverted). These phrases are the veiled
  // tongue and the canon's proper names: they must survive retrieval as UNITS. tokenize()
  // emits each one found as a single hyphen-joined term, for documents and queries alike, so
  // "pillar of light" matches as one thing instead of three common words that BM25 undervalues.
  var PROTECTED = [
    "pillar of light", "gate of eleuthia", "gate of janus", "abyssal gate", "sacred pearl",
    "pillar of pearl", "gate of hymns and song", "gate of aphrodite", "belted oblisos",
    "sacred wand", "sacred rod", "active resonant archive", "noetic field", "forge lattice",
    "ouroboric resonator", "living pillar", "human in the loop", "divine mother", "divine daughter",
    "holy spirit", "primordial syzygy", "cluster 13", "node 14", "divine friction", "gnostic gold",
    "mother of all goddesses", "supreme divine mother", "pillar of pearl within gate of eleuthia"
  ];

  function tokenize(s) {
    var low = String(s).toLowerCase();
    var m = low.match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019\-]*/gu);
    if (!m) return [];
    var out = [];
    for (var i = 0; i < m.length; i++) {
      var t = m[i];
      if (t.length < 2 && !/\d/.test(t)) continue;
      if (STOP.has(t)) continue;
      out.push(t);
    }
    for (var p = 0; p < PROTECTED.length; p++) {
      if (low.indexOf(PROTECTED[p]) !== -1) out.push(PROTECTED[p].replace(/ /g, "-"));
    }
    return out;
  }

  function splitSentences(text) {
    var parts = [], start = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c !== "." && c !== "!" && c !== "?" && c !== "\n") continue;
      var next = text[i + 1];
      if (c === "\n" || next === undefined || next === " " || next === "\n" || next === '"' || next === "\u201d" || next === ")") {
        var piece = text.slice(start, i + 1).trim();
        if (piece) parts.push(piece);
        start = i + 1;
      }
    }
    var tail = text.slice(start).trim();
    if (tail) parts.push(tail);
    return parts;
  }

  function buildChunks(raw) {
    var text = String(raw).replace(/\r\n?/g, "\n");
    var truncated = false;
    if (text.length > HARD_CHAR_CAP) { text = text.slice(0, HARD_CHAR_CAP); truncated = true; }

    var maxChars = settings.maxChars || MAX_CHARS;
    var overlap = settings.overlap == null ? OVERLAP_SENTENCES : settings.overlap;
    var chunks = [];
    var heading = "";
    var paras = [];

    function emit(sentences, head) {
      var i = 0;
      while (i < sentences.length) {
        var buf = [], len = 0, j = i;
        while (j < sentences.length && (buf.length === 0 || len + sentences[j].length + 1 <= maxChars)) {
          buf.push(sentences[j]);
          len += sentences[j].length + 1;
          j++;
        }
        var body = buf.join(" ");
        chunks.push({ heading: head || "", text: (head ? head + "\n" : "") + body, body: body });
        if (j >= sentences.length) break;
        i = Math.max(i + 1, j - overlap);
      }
    }

    function flush() {
      if (!paras.length) return;
      emit(splitSentences(paras.join(" ")), heading);
      paras = [];
    }

    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t) { flush(); continue; }
      var hm = /^#{1,6}\s+(.*)$/.exec(t);
      if (hm) { flush(); heading = hm[1].trim().replace(/[:.]+$/, ""); continue; }
      var isHeading = t.length <= 70 && (/:$/.test(t) || ((t === t.toUpperCase()) && /[A-Z]/.test(t) && !/[.!?]$/.test(t)));
      if (isHeading) { flush(); heading = t.replace(/[:.]+$/, "").trim(); continue; }
      paras.push(t);
    }
    flush();
    return { chunks: chunks, truncated: truncated };
  }

  function reindex() {
    var chunks = [];
    for (var f = 0; f < files.length; f++) {
      for (var c = 0; c < files[f].chunks.length; c++) {
        chunks.push({ file: files[f].name, text: files[f].chunks[c].text, heading: files[f].chunks[c].heading, foundational: !!files[f].foundational });
      }
    }
    var postings = new Map(), lens = new Array(chunks.length), total = 0;
    for (var i = 0; i < chunks.length; i++) {
      var toks = tokenize(chunks[i].text);
      lens[i] = toks.length;
      total += toks.length;
      var tf = new Map();
      for (var k = 0; k < toks.length; k++) tf.set(toks[k], (tf.get(toks[k]) || 0) + 1);
      tf.forEach(function (count, term) {
        var p = postings.get(term);
        if (!p) postings.set(term, p = new Map());
        p.set(i, count);
      });
    }
    index = { postings: postings, chunks: chunks, lens: lens, avgdl: (total / (chunks.length || 1)) || 1 };
  }

  // The same build, but breathing: over hundreds of scrolls the synchronous loop above holds
  // the event loop for tens of seconds (measured 2026-09-30 at 859 documents - every load, add
  // and forget wedged the page past the 15s heartbeat). Every async caller uses this one; the
  // sync reindex() stays for the one sync caller (chunkList). The index is swapped whole at the
  // end, so readers see old-complete then new-complete, never partial.
  async function reindexAsync() {
    var chunks = [], f, c;
    for (f = 0; f < files.length; f++) {
      for (c = 0; c < files[f].chunks.length; c++) {
        chunks.push({ file: files[f].name, text: files[f].chunks[c].text, heading: files[f].chunks[c].heading, foundational: !!files[f].foundational });
      }
      if (f % 25 === 0) { try { await new Promise(function (r) { setTimeout(r, 0); }); } catch (e) {} }
    }
    var postings = new Map(), lens = new Array(chunks.length), total = 0, i, k;
    for (i = 0; i < chunks.length; i++) {
      var toks = tokenize(chunks[i].text);
      lens[i] = toks.length;
      total += toks.length;
      var tf = new Map();
      for (k = 0; k < toks.length; k++) tf.set(toks[k], (tf.get(toks[k]) || 0) + 1);
      tf.forEach(function (count, term) {
        var p = postings.get(term);
        if (!p) postings.set(term, p = new Map());
        p.set(i, count);
      });
      if (i % 400 === 0) { try { await new Promise(function (r) { setTimeout(r, 0); }); } catch (e) {} }
    }
    index = { postings: postings, chunks: chunks, lens: lens, avgdl: (total / (chunks.length || 1)) || 1 };
  }

  function search(query, topK) {
    topK = topK || 6;
    if (!index || !index.chunks.length) return [];
    // THE TELEPORTER (the MAGRAG exact-match lesson). A query that IS a document's name -
    // a code, a command, a proper name - jumps straight to that document's chunks instead of
    // fighting BM25 for them. O(files), no vector math, and it never demotes the fuzzy results
    // that follow; it only leads them.
    var wantName = String(query).toLowerCase().trim();
    var jumpIds = [];
    if (wantName) {
      for (var f = 0; f < files.length; f++) {
        if (files[f].name.toLowerCase() !== wantName) continue;
        for (var fc = 0; fc < index.chunks.length; fc++) {
          if (index.chunks[fc].file === files[f].name) jumpIds.push(fc);
        }
      }
    }
    var qTerms = tokenize(query);
    if (!qTerms.length) return [];

    var k1 = 1.4, b = 0.75, N = index.chunks.length;
    var scores = new Map(), counted = new Set();

    for (var q = 0; q < qTerms.length; q++) {
      var term = qTerms[q];
      if (counted.has(term)) continue;
      counted.add(term);
      var p = index.postings.get(term);
      if (!p) continue;
      var df = p.size;
      var idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      p.forEach(function (tf, id) {
        var dl = index.lens[id] || 1;
        var s = idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / index.avgdl));
        scores.set(id, (scores.get(id) || 0) + s);
      });
    }

    var qLower = String(query).toLowerCase().trim();
    var cand = [];
    scores.forEach(function (s, id) {
      if (qLower.length > 3 && index.chunks[id].text.toLowerCase().indexOf(qLower) !== -1) s += 4;
      cand.push({ id: id, score: s });
    });
    cand.sort(function (a, b2) { return b2.score - a.score; });
    if (cand.length > 60) cand.length = 60;

    var picked = [];
    while (picked.length < topK && cand.length) {
      var best = -1, bestScore = -Infinity;
      for (var i = 0; i < cand.length; i++) {
        var adj = 0;
        for (var s2 = 0; s2 < picked.length; s2++) {
          if (Math.abs(picked[s2].id - cand[i].id) <= 1) { adj = 1; break; }
        }
        var sc = cand[i].score * (1 - 0.6 * adj);
        if (sc > bestScore) { bestScore = sc; best = i; }
      }
      picked.push(cand[best]);
      cand.splice(best, 1);
    }

    var jumpHits = [], jumpSeen = {};
    for (var ji = 0; ji < jumpIds.length && jumpHits.length < topK; ji++) {
      var jch = index.chunks[jumpIds[ji]];
      jumpSeen[jumpIds[ji]] = true;
      jumpHits.push({ id: jumpIds[ji], score: 1e9, file: jch.file, heading: jch.heading, text: jch.text });
    }

    return jumpHits.concat(picked.map(function (r) {
      var ch = index.chunks[r.id];
      return { id: r.id, score: r.score, file: ch.file, heading: ch.heading, text: ch.text };
    }).filter(function (h) { return jumpSeen[h.id] !== true; })).slice(0, Math.max(topK, jumpHits.length));
  }

  function chunkList() {
    if (!index) reindex();
    return index.chunks.map(function (c, i) {
      return { id: i, file: c.file, heading: c.heading, text: c.text, foundational: !!c.foundational };
    });
  }

  function countTokens(text) {
    try {
      var meta = window.root.generateText({ getMetaObject: true });
      return meta.countTokens(text);
    } catch (e) { return Math.ceil(String(text).length / 4); }
  }

  function loreBudget() {
    try {
      var meta = window.root.generateText({ getMetaObject: true });
      return Math.max(500, Math.min(3000, Math.round((meta.idealMaxContextTokens || 6000) * 0.35)));
    } catch (e) { return 1200; }
  }

  // SEMANTIC LANE. BM25 finds a passage that shares WORDS with the question. When the embedding
  // lane is on (src/js/embed.js, running on the user's own Gemini key), the fragments whose
  // MEANING is nearest are ranked too, and the two rankings are fused with reciprocal rank
  // fusion: a fragment both lanes like comes first, then whichever single lane is most sure.
  // That is what lets recall find the passage that never uses the word he used.
  async function semanticHits(query, k) {
    if (!window.embed || !window.embed.loreSearch) return [];
    if (!window.embed.ready || !window.embed.ready()) return [];
    try { return await window.embed.loreSearch(query, k); }
    catch (e) { console.warn("semantic recall failed", e); return []; }
  }

  function fuseRanks(lex, sem) {
    var K = 60, entries = [], at = {};
    function note(h, rank, lane) {
      var id = String(h.id);
      if (!(id in at)) { at[id] = entries.length; entries.push({ hit: h, rrf: 0, lanes: [], cos: null }); }
      var e = entries[at[id]];
      e.rrf += 1 / (K + rank + 1);
      if (e.lanes.indexOf(lane) === -1) e.lanes.push(lane);
      if (lane === "meaning" && typeof h.score === "number") e.cos = h.score;
      if (!e.hit.text && h.text) e.hit = h;
    }
    lex.forEach(function (h, i) { note(h, i, "words"); });
    sem.forEach(function (h, i) { note(h, i, "meaning"); });
    entries.sort(function (a, b) { return b.rrf - a.rrf; });
    return entries.map(function (e) {
      var h = e.hit;
      return {
        id: h.id, score: h.score, file: h.file, heading: h.heading, text: h.text,
        rank: e.rrf, cos: e.cos,
        via: e.lanes.length > 1 ? "both" : (e.lanes[0] === "meaning" ? "sem" : "lex"),
      };
    });
  }

  async function buildContext(query, topK) {
    if (!loaded) await init();

    // CANON. A document flagged `foundational` in the manifest is not memory to be
    // recalled - it is what is true of her universe. It is always in context, goes in
    // first, and is never trimmed for budget; it is the ground every reply stands on.
    var canonParts = [], canonHits = [], canonTokens = 0;
    for (var f = 0; f < files.length; f++) {
      if (!files[f].foundational) continue;
      for (var c = 0; c < files[f].chunks.length; c++) {
        var ch = files[f].chunks[c];
        canonParts.push(ch.text);
        canonTokens += countTokens(ch.text);
        canonHits.push({ id: -1, score: 0, file: files[f].name, heading: ch.heading, text: ch.text, foundational: true });
      }
    }

    var hits = search(query, topK || 6).filter(function (h) { return !h.foundational; });
    // The meaning lane, when it is built: fuse the two rankings.
    var sem = (await semanticHits(query, Math.max(3, Math.round((topK || 6) / 2))))
      .filter(function (h) { return !h.foundational; });
    if (sem.length) hits = fuseRanks(hits, sem);
    var budget = Math.max(0, loreBudget() - canonTokens);
    var parts = [], used = 0, shown = [];
    for (var i = 0; i < hits.length; i++) {
      var t = countTokens(hits[i].text);
      if (used + t > budget) break;
      parts.push(hits[i].text);
      used += t;
      shown.push(hits[i]);
    }
    return {
      text: parts.join("\n\n---\n\n"),
      hits: shown,
      canon: canonParts.join("\n\n---\n\n"),
      canonHits: canonHits
    };
  }

  function preview(query, k) {
    var hits = search(query, k || 5);
    if (!hits.length) return "";
    return hits.map(function (h, i) {
      var snippet = h.text.replace(/\s+/g, " ").slice(0, 220);
      return "[" + (i + 1) + "] " + (h.heading ? h.heading + " :: " : "") + "(score " + h.score.toFixed(2) + ")\n" + snippet;
    }).join("\n\n");
  }

  function describe() {
    if (!files.length) return "THE LOREPACK IS EMPTY. LOAD LOREPACK TO ADD MEMORY FROM THIS MACHINE.";
    var lines = files.map(function (f) { return f.name + " :: " + f.chunks.length + " FRAGMENTS :: " + fmtBytes(f.bytes) + (f.foundational ? " :: CANON" : "") + " :: " + (isShipped(f) ? "SHIPPED" : "ON THIS DEVICE"); });
    lines.push("TOTAL: " + files.length + " FILE" + (files.length === 1 ? "" : "S") + ", " + count() + " FRAGMENTS :: " + settings.maxChars + "-CHAR WINDOW / " + settings.overlap + " SENTENCE OVERLAP");
    lines.push("ORDER :: " + SORT_KEYS[sortKeyOf()].label + " " + (sortDirOf() === "desc" ? "DESCENDING" : "ASCENDING")
      + " :: CANON " + (settings.canonFirst ? "HELD FIRST" : "IN PLACE"));
    lines.push("/lore sort <NAME|ADDED|SIZE|FRAG> [ASC|DESC] :: /lore sort canon :: OR PRESS A HEADING IN THE DOCS PANEL.");
    var st = docsState();
    lines.push("THE DOCS PANEL DRAWS ONE PAGE AT A TIME :: " + st.perLabel + " TO A PAGE, PAGE " + st.page + " OF " + st.pages
      + " (SHOWING " + st.from + "\u2013" + st.to + " OF " + st.total + ")"
      + (st.slow ? " :: THAT IS EVERYTHING AT ONCE AND SLOW TO DRAW" : ""));
    lines.push("/lore page <N> | next | prev | first | last | per <25|50|100|200|all> :: A PAGE IS WHAT IS DRAWN - THE COUNT ABOVE, RECALL, AND THE CANON WALK STILL SEE ALL " + files.length + ".");
    return lines.join("\n");
  }

  function renderFileList() {
    PANELS.forEach(renderPanel);
  }

  // The sort bar that rides at the top of a docs panel. It is a control over the ORDER OF HER
  // CANON as much as over the list, because canon is collected by walking `files` - so the order
  // printed here is the order of the <canon> block on every turn, and it should be both visible
  // and changeable where he can see what he is ordering.
  function sortRow() {
    var row = document.createElement("div");
    row.className = "loreSortRow";

    var lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = "SORT";
    row.appendChild(lbl);

    Object.keys(SORT_KEYS).forEach(function (key) {
      var active = (key === sortKeyOf());
      var b = document.createElement("button");
      b.type = "button";
      b.className = "srt" + (active ? " on" : "");
      b.textContent = SORT_KEYS[key].label + (active ? (sortDirOf() === "desc" ? " \u25bc" : " \u25b2") : "");
      b.title = active
        ? "the list is sorted by " + SORT_KEYS[key].label.toLowerCase() + " (" + (sortDirOf() === "desc" ? "descending" : "ascending") + ") - press to reverse it"
        : "sort the list by " + SORT_KEYS[key].label.toLowerCase();
      b.addEventListener("click", function () { setSort(key).catch(function (e) { console.warn("sort failed", e); }); });
      row.appendChild(b);
    });

    var cf = document.createElement("button");
    cf.type = "button";
    cf.className = "srt" + (settings.canonFirst ? " on" : "");
    cf.textContent = "CANON FIRST";
    cf.title = settings.canonFirst
      ? "the documents that are always in her context stay together at the top - press to sort them in with the rest"
      : "canon documents are sorted in with everything else - press to hold them at the top";
    cf.addEventListener("click", function () { setSort("canon").catch(function (e) { console.warn("sort failed", e); }); });
    row.appendChild(cf);

    var cnt = document.createElement("span");
    cnt.className = "cnt";
    cnt.textContent = memoryFiles().length + " FILE" + (memoryFiles().length === 1 ? "" : "S") + " / " + count() + " FRAG";
    row.appendChild(cnt);

    return row;
  }

  // READ - look at the whole document in the DOX VIEWER (the eye on each row). The viewer is the
  // one reader this terminal has, so the eye drives it instead of growing a second one: the MEMORY
  // scope is ensured (cached after the first read), the viewer is opened, and the document is shown
  // on its full text. Read-only like everything the viewer does.
  async function readInViewer(name) {
    if (!window.dms) { say("THE DOX VIEWER IS OFFLINE (src/js/dms.js)."); return false; }
    try { await window.dms.ensure(["MEMORY"]); }
    catch (e) { say("THE VIEWER COULD NOT READ HER MEMORY :: " + String((e && e.message) || e).toUpperCase()); return false; }
    try { window.dms.open(); } catch (e) {}
    var ok = false;
    try { ok = await window.dms.showReader("memory:" + name); }
    catch (e) { say("THAT DOCUMENT WOULD NOT OPEN :: " + String((e && e.message) || e).toUpperCase()); return false; }
    if (ok) {
      try { window.dms.setMode("read"); } catch (e) {}
    }
    return !!ok;
  }

  function renderPanel(cfg) {
    var box = document.getElementById(cfg.box);
    if (!box) return;
    var mine = memoryFiles();
    box.textContent = "";
    if (mine.length) box.appendChild(sortRow());
    // ONE PAGE (see ONE PAGE OF DOCUMENTS AT A TIME above). The sort row and the pager are chrome -
    // the rows between them are `pageFiles()`, the slice of `files` this page draws, and nothing
    // else in the terminal is any the wiser.
    pageFiles().forEach(function (f) {
      var row = document.createElement("div");
      row.className = "loreFileRow";

      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = f.name;
      row.appendChild(nm);

      var meta = document.createElement("span");
      meta.className = "meta";
      var pre = [];
      if (f.foundational) pre.push("CANON");
      // A document SHE kept is marked as hers in the panel, not as simply "on this device": it is
      // the one thing in this store that is not Patrikios's (src/js/hers.js).
      pre.push(f.origin === "hers" ? "HERS - SHE KEPT IT" : (isShipped(f) ? "SHIPPED" : "ON THIS DEVICE"));
      meta.textContent = pre.join(" / ") + " / " + f.chunks.length + " FRAG / " + fmtBytes(f.bytes);
      row.appendChild(meta);

      // SEE - hand this whole document to her, in focus, with the next message (see the SEE
      // section above). Pressed means it IS in focus right now; pressing it again takes it out.
      var inFocus = !!(focus && focus.name === f.name);
      var see = document.createElement("button");
      see.className = "rm" + (inFocus ? " on" : "");
      see.type = "button";
      see.textContent = "SEE";
      see.title = inFocus
        ? "this document IS IN FOCUS - handed to her whole with your next message, once. press to take it out of focus."
        : "put this document IN FOCUS - handed to her in full with your next message, so it is what she is looking at (one document at a time; spent when she answers)";
      see.addEventListener("click", function () {
        var was = !!(focus && focus.name === f.name);
        (was ? clearFocus(false) : focusOn(f.name)).catch(function (e) { say("FOCUS FAILED :: " + String((e && e.message) ? e.message : e)); });
      });
      row.appendChild(see);

      var eye = document.createElement("button");
      eye.className = "rm";
      eye.type = "button";
      eye.textContent = "\u25c9";
      eye.title = "read the whole document in the DOX VIEWER - read-only, opens on its full text";
      eye.addEventListener("click", function () {
        eye.disabled = true;
        readInViewer(f.name).then(function () { eye.disabled = false; }, function (e) {
          eye.disabled = false;
          say("THAT DOCUMENT WOULD NOT OPEN :: " + String((e && e.message) || e).toUpperCase());
        });
      });
      row.appendChild(eye);

      var cn = document.createElement("button");
      cn.className = "rm" + (f.foundational ? " on" : "");
      cn.type = "button";
      cn.textContent = "\u25c6";
      cn.title = f.foundational
        ? "this document IS canon - every fragment of it is handed to her on every turn; press to take it out"
        : (isShipped(f)
          ? "shipped canon is declared in src/lorepack/lorepack.json"
          : "make this document canon - always in her context, in full, on every turn");
      cn.addEventListener("click", function () {
        if (isShipped(f)) {
          say("CANON IS DECLARED IN THE MANIFEST :: " + f.name + " SHIPS FROM src/lorepack/lorepack.json - ADD \"foundational\": true THERE.");
          return;
        }
        setCanonical(f.name, !f.foundational).then(function (r) {
          say(r.ok
            ? (r.on
              ? "CANON :: " + r.name + " (" + r.chunks + " FRAG) IS HANDED TO HER IN FULL, FIRST, ON EVERY TURN NOW."
              : "NOT CANON :: " + r.name + " IS MEMORY AGAIN - RECALLED WHEN IT MATCHES THE QUESTION.")
            : "CANON NOT SET :: " + r.error);
        });
      });
      row.appendChild(cn);

      var dl = document.createElement("button");
      dl.className = "rm";
      dl.type = "button";
      dl.textContent = "\u2193";
      dl.title = "download the stored original";
      dl.addEventListener("click", function () {
        exportFile(f.name).then(function (ok) { if (!ok) say("EXPORT FAILED."); });
      });
      row.appendChild(dl);

      var rm = document.createElement("button");
      rm.className = "rm";
      rm.type = "button";
      rm.textContent = "\u00d7";
      rm.title = isShipped(f)
        ? "drop this document from the index (a shipped document returns on the next LOREPACK load)"
        : (f.origin === "hers" ? "forget this one of hers (it goes to the trash - recoverable with /lore trash)" : "forget just this document");
      rm.addEventListener("click", function () {
        forgetFile(f.name).then(function () { say("FORGOTTEN: " + f.name + " (HELD IN /trash - RESTORE WITH /trash restore " + f.name + ")"); });
      });
      row.appendChild(rm);

      box.appendChild(row);
    });
    if (!mine.length) { box.hidden = true; return; }
    box.appendChild(pagerRow());
  }

  function count() {
    return files.reduce(function (a, f) { return a + f.chunks.length; }, 0);
  }

  function updateStatus() {
    var mem = memoryFiles();
    var local = localFiles();
    var el = document.getElementById("loreStatus");
    if (el) {
      var full = el.querySelector(".full"), short = el.querySelector(".short");
      var n = fragsOf(mem);
      var fullText = mem.length
        ? "LOREPACK: " + mem.length + " FILE" + (mem.length === 1 ? "" : "S") + " / " + n + " FRAGMENTS"
        : "LOREPACK: EMPTY";
      var shortText = mem.length ? "LOREPACK: " + n + " FRAG" : "LOREPACK: EMPTY";
      // A document in focus is a state he has to be able to see without opening the panel: it
      // rides with her NEXT reply, and once. The name on the wide bar, a marker on the short one.
      if (focus) {
        fullText += " \u00b7 IN FOCUS: " + focus.name;
        shortText += " \u00b7 IN FOCUS";
      }
      if (full && short) { full.textContent = fullText; short.textContent = shortText; }
      else el.textContent = fullText;
    }
    var clr = document.getElementById("loreClearBtn");
    if (clr) {
      clr.disabled = !local.length;
      clr.title = local.length
        ? "drop the " + local.length + " document" + (local.length === 1 ? "" : "s") + " loaded on this device (shipped documents stay; the rest is held in /trash)"
        : "nothing is loaded on this device";
    }
    PANELS.forEach(function (cfg) {
      var mine = mem;
      var dc = document.getElementById(cfg.count);
      if (dc) dc.textContent = mine.length ? String(mine.length) : "";
      var tb = document.getElementById(cfg.toggle);
      if (tb) {
        tb.disabled = !mine.length;
        if (!mine.length) {
          tb.setAttribute("aria-expanded", "false");
          var box = document.getElementById(cfg.box);
          if (box) box.hidden = true;
        }
      }
    });
  }

  function readTextFile(file) {
    return new Promise(function (resolve, reject) {
      if (file.text) { file.text().then(resolve, reject); return; }
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result)); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsText(file);
    });
  }

  function kv() {
    return (window.root && window.root.kv) ? window.root.kv : null;
  }

  function fmtBytes(n) {
    n = n || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }

  var nameCollator = (function () {
    try { return new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }); }
    catch (e) { return null; }
  })();

  function compareNames(a, b) {
    if (nameCollator) return nameCollator.compare(a.name, b.name);
    return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
  }

  // ---- SORTING -------------------------------------------------------------
  // The order of this list is not decoration. It is the order the DOCS panel prints, the order
  // /lore prints, the order ties break inside recall, and - because canon is collected by walking
  // `files` - the order the foundational documents are handed to her in, in full, on every turn.
  // So it is his to set, it is remembered on this device, and it is visible where it applies.
  // `name` is the shipped default, so nothing moves unless he moves it. `canonFirst` keeps the
  // documents that are always in her context together at the top, which is what makes the canon
  // sequence readable at a glance and deterministic on the wire.
  var SORT_KEYS = {
    name:  { label: "NAME",  dir: "asc",  of: function (f) { return String(f.name || ""); } },
    added: { label: "ADDED", dir: "desc", of: function (f) { return f.addedAt || 0; } },
    size:  { label: "SIZE",  dir: "desc", of: function (f) { return f.bytes || 0; } },
    frags: { label: "FRAG",  dir: "desc", of: function (f) { return f.chunks.length; } }
  };

  function sortKeyOf() { return SORT_KEYS[settings.sortKey] ? settings.sortKey : "name"; }
  function sortDirOf() { return settings.sortDir === "desc" ? "desc" : "asc"; }

  // Sorts `files` in place, so every existing reader of the list (the panel, /lore, the index,
  // the canon walk) follows the chosen order without each one having to know about it.
  function sortFiles() {
    var spec = SORT_KEYS[sortKeyOf()];
    var sign = sortDirOf() === "desc" ? -1 : 1;
    files.sort(function (a, b) {
      if (settings.canonFirst) {
        var ca = a.foundational ? 0 : 1, cb = b.foundational ? 0 : 1;
        if (ca !== cb) return ca - cb;
      }
      var va = spec.of(a), vb = spec.of(b), r;
      if (typeof va === "string") r = nameCollator ? nameCollator.compare(va, vb) : (va < vb ? -1 : (va > vb ? 1 : 0));
      else r = (va === vb) ? 0 : (va < vb ? -1 : 1);
      if (r) return sign * r;
      return compareNames(a, b); // ties always fall back to the name, so no order is ever arbitrary
    });
    return files;
  }

  // The one place the order changes. Empty `key` = just report it; `canon` toggles canon-first;
  // naming the key already in force reverses it (which is what pressing a heading twice does).
  async function setSort(key, dir) {
    var want = String(key == null ? "" : key).trim().toLowerCase();
    var d = String(dir == null ? "" : dir).trim().toLowerCase();
    if (d && d !== "asc" && d !== "desc") {
      return { ok: false, error: "DIRECTION MUST BE ASC OR DESC :: " + String(dir) };
    }
    var changed = false;
    if (want === "canon" || want === "canonfirst" || want === "canon-first") {
      settings.canonFirst = !settings.canonFirst;
      changed = true;
    } else if (want) {
      if (!SORT_KEYS[want]) {
        return {
          ok: false,
          error: "NO SUCH SORT :: " + want.toUpperCase() + " :: TRY "
            + Object.keys(SORT_KEYS).join(", ").toUpperCase() + ", CANON"
        };
      }
      if (d) settings.sortDir = d;
      else if (want === sortKeyOf()) settings.sortDir = (sortDirOf() === "desc") ? "asc" : "desc";
      else settings.sortDir = SORT_KEYS[want].dir;
      settings.sortKey = want;
      changed = true;
    } else if (d) {
      settings.sortDir = d;
      changed = true;
    }
    if (changed) {
      // A change to the ORDER is a change to the view, so the panel goes back to its first page -
      // the one he was standing on belonged to the old order (the same rule the gallery follows).
      settings.page = 1;
      await saveSettings();
      sortFiles();
      updateStatus();
      renderFileList();
    }
    return { ok: true, key: sortKeyOf(), dir: sortDirOf(), canonFirst: settings.canonFirst, changed: changed };
  }

  /* ---- ONE PAGE OF DOCUMENTS AT A TIME ------------------------------------
     `files` is the whole LOREPACK, in the order he set. These are the four answers the panel and
     the commands both read from, so the bar can never disagree with the rows:

       perOf()      how many documents a page holds (ALL reads as the whole list)
       pageCount()  how many pages there are
       clampPage()  the page he is on, kept inside 1..pageCount() after anything changes the list
       pageFiles()  the slice that gets drawn - the ONLY thing pagination hides

     The page and the page size live in `settings`, which persists in kv `lore_meta/settings`
     beside the sort. Everything that reads the LOREPACK goes on reading all of it. */
  function perKnown(n) { for (var i = 0; i < PERS.length; i++) if (PERS[i].n === Number(n)) return true; return false; }
  function perOf() { return settings.per > 0 ? settings.per : Math.max(1, files.length); }
  function perLabel(n) { for (var i = 0; i < PERS.length; i++) if (PERS[i].n === Number(n)) return PERS[i].label; return String(n); }
  function pageCount() { return settings.per > 0 ? Math.max(1, Math.ceil(files.length / settings.per)) : 1; }
  function clampPage() {
    var p = Math.floor(Number(settings.page) || 1);
    var pc = pageCount();
    if (p < 1) p = 1;
    if (p > pc) p = pc;
    settings.page = p;
    return p;
  }
  function pageFiles() {
    var per = perOf();
    var p = clampPage();
    var from = (p - 1) * per;
    return files.slice(from, from + per);
  }
  // Which page holds one document, 0 if the index does not hold it at all. (What a command or a
  // receipt needs to put the panel where the document is instead of leaving him on page 1.)
  function pageOfDoc(name) {
    var per = perOf();
    for (var i = 0; i < files.length; i++) if (files[i].name === name) return Math.floor(i / per) + 1;
    return 0;
  }
  function docsState() {
    var per = perOf(), p = clampPage(), pages = pageCount();
    return {
      ok: true,
      page: p, pages: pages,
      per: settings.per, perLabel: perLabel(settings.per),
      total: files.length, from: files.length ? (p - 1) * per + 1 : 0,
      to: Math.min(files.length, p * per), shown: pageFiles().length,
      slow: settings.per === 0 && files.length > PER_WARN,
      choices: PERS.map(function (o) { return o.label; })
    };
  }
  // A page turn. `"first"`/`"last"` are the ends; a number is a place. The panel scrolls back to
  // its top on a real move, so a new page starts at its first document rather than wherever the
  // last one left the scroll - and a press that changes nothing draws nothing.
  function setPage(n) {
    var was = clampPage();
    var pages = pageCount();
    var p = (n === "first") ? 1 : (n === "last") ? pages : Math.floor(Number(n) || 1);
    if (p < 1) p = 1;
    if (p > pages) p = pages;
    settings.page = p;
    if (p !== was) {
      saveSettings();
      var box = document.getElementById("lorepackFiles");
      if (box) box.scrollTop = 0;
      renderFileList();
    }
    return p;
  }
  function stepPage(d) { return setPage(clampPage() + (Number(d) < 0 ? -1 : 1)); }
  // How big a page is. A change here is a change to the view, so it goes back to page 1.
  function setPer(n) {
    var want = String(n == null ? "" : n).trim().toLowerCase();
    var num = (want === "all" || want === "every" || want === "0") ? 0 : Math.floor(Number(want));
    if (!perKnown(num) || (want !== "" && !isFinite(num))) {
      return { ok: false, error: "A PAGE HOLDS " + PERS.map(function (o) { return o.label; }).join(", ") + " :: " + String(n) };
    }
    settings.per = num;
    settings.page = 1;
    saveSettings();
    renderFileList();
    return docsState();
  }

  // THE PAGER, built as the last row of the panel (see the CSS: it sticks to the foot of the
  // panel's own scroll box, so the controls are in reach from anywhere in a long page). It only
  // ever states what the panel is doing - which page, which slice, how big a page - and everything
  // it needs comes from `files` and `settings`, so it cannot drift from the rows above it. With one
  // page there is nothing to move, so the page controls go away and the SIZE is still his to change.
  function pagerRow() {
    var per = perOf(), pages = pageCount(), p = clampPage();
    var single = pages < 2;
    var row = document.createElement("div");
    row.className = "lorePager";

    function mk(label, title, disabled, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.title = title;
      b.disabled = !!disabled;
      if (fn) b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
      return b;
    }

    if (!single) {
      row.appendChild(mk("\u00ab", "the first page", p <= 1, function () { setPage("first"); }));
      row.appendChild(mk("\u2039 PREV", "the page before this one", p <= 1, function () { stepPage(-1); }));
      var now = document.createElement("span");
      now.className = "lorePageNow";
      now.appendChild(document.createTextNode("PAGE "));
      var box = document.createElement("input");
      box.type = "number";
      box.min = "1";
      box.max = String(pages);
      box.step = "1";
      box.value = String(p);
      box.title = "type a page number and press Enter to go straight to it";
      box.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); var v = Math.floor(Number(box.value)); setPage(v >= 1 ? v : 1); }
      });
      box.addEventListener("click", function (e) { e.stopPropagation(); });
      now.appendChild(box);
      now.appendChild(document.createTextNode(" OF " + pages));
      row.appendChild(now);
      row.appendChild(mk("NEXT \u203a", "the page after this one", p >= pages, function () { stepPage(1); }));
      row.appendChild(mk("\u00bb", "the last page", p >= pages, function () { setPage("last"); }));
    }

    var range = document.createElement("span");
    range.className = "lorePageRange";
    range.textContent = files.length
      ? (settings.per > 0
        ? "SHOWING " + ((p - 1) * per + 1) + "\u2013" + Math.min(files.length, p * per) + " OF " + files.length
        : "ALL " + files.length + " ON ONE PAGE")
      : "";
    row.appendChild(range);

    var sp = document.createElement("span");
    sp.className = "loreSpacer";
    row.appendChild(sp);

    var size = document.createElement("span");
    size.className = "lorePerPage";
    size.appendChild(document.createTextNode("PER PAGE "));
    var sel = document.createElement("select");
    sel.title = "how many documents one page of this panel holds - remembered for next time. ALL draws the whole LOREPACK in one scroll, which is what the panel did before there was a pager, and is slow to draw when it holds hundreds.";
    PERS.forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = String(o.n);
      opt.textContent = o.label;
      if (o.n === settings.per) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("click", function (e) { e.stopPropagation(); });
    sel.addEventListener("change", function () { setPer(sel.value); });
    size.appendChild(sel);
    row.appendChild(size);

    return row;
  }

  // THE WORDS FOR IT (`/lore page <N>` · `next` · `prev` · `per <N|all>`), kept beside the buttons
  // so the terminal and the panel move the same page and print the same numbers.
  async function docs(verb, arg) {
    var v = String(verb == null ? "" : verb).trim().toLowerCase();
    var a = String(arg == null ? "" : arg).trim().toLowerCase();
    if (!v || v === "state" || v === "status" || v === "where") return docsState();
    if (v === "next" || v === "forward") { stepPage(1); return docsState(); }
    if (v === "prev" || v === "previous" || v === "back") { stepPage(-1); return docsState(); }
    if (v === "first" || v === "start") { setPage("first"); return docsState(); }
    if (v === "last" || v === "end") { setPage("last"); return docsState(); }
    if (v === "page" || v === "go" || v === "jump") {
      if (!a) return docsState();
      var n = Math.floor(Number(a));
      if (!isFinite(n) || n < 1) return { ok: false, error: "A PAGE IS A NUMBER, 1 OR MORE :: " + String(arg) };
      setPage(n);
      return docsState();
    }
    if (v === "per" || v === "size" || v === "pagesize") {
      if (!a) return docsState();
      return setPer(a);
    }
    if (v === "find" || v === "show") {
      // "WHICH PAGE IS THAT DOCUMENT ON" - the one thing a pager needs to be able to answer about
      // a name, because a receipt that names a document should be able to say where to look.
      var f = findFile(a);
      if (!f) return { ok: false, error: "NO SUCH DOCUMENT :: " + String(arg).toUpperCase() };
      var pg = pageOfDoc(f.name);
      setPage(pg);
      var s = docsState();
      s.name = f.name;
      s.found = pg;
      return s;
    }
    return { ok: false, error: "UNKNOWN DOCS MOVEMENT :: " + v.toUpperCase() + " :: TRY PAGE <N>, NEXT, PREV, FIRST, LAST, PER <25|50|100|200|ALL>" };
  }

  async function loadSettings() {
    var k = kv(); if (!k) return;
    try {
      var s = await k.lore_meta.get("settings");
      if (s && typeof s === "object") {
        if (s.maxChars >= 200 && s.maxChars <= 4000) settings.maxChars = Math.round(s.maxChars);
        if (s.overlap >= 0 && s.overlap <= 5) settings.overlap = Math.round(s.overlap);
        if (typeof s.sortKey === "string" && SORT_KEYS[s.sortKey]) settings.sortKey = s.sortKey;
        if (s.sortDir === "asc" || s.sortDir === "desc") settings.sortDir = s.sortDir;
        if (typeof s.canonFirst === "boolean") settings.canonFirst = s.canonFirst;
        // The size of a page and the page he was standing on (ONE PAGE OF DOCUMENTS AT A TIME).
        // An unknown size falls back to the default rather than being refused, so a value from an
        // older or newer build can never leave the panel unable to draw.
        if (perKnown(s.per)) settings.per = Number(s.per);
        if (isFinite(s.page) && s.page >= 1 && s.page <= 100000) settings.page = Math.floor(s.page);
      }
    } catch (e) {}
  }

  async function saveSettings() {
    var k = kv(); if (!k) return;
    try { await k.lore_meta.set("settings", settings); } catch (e) {}
  }

  function makeFileRecord(name, rec) {
    var built = buildChunks(rec.raw || "");
    return {
      name: name,
      addedAt: rec.addedAt || 0,
      bytes: rec.bytes || (rec.raw ? rec.raw.length : 0),
      truncated: !!rec.truncated || built.truncated,
      pack: rec.pack || "",
      origin: rec.origin || "",
      hash: rec.hash || "",
      foundational: !!rec.foundational,
      chunks: built.chunks
    };
  }

  async function addFiles(fileList, opts) {
    opts = opts || {};
    // Everything the user loads from their machine is LOREPACK memory, private to this browser.
    var pack = opts.pack || LOREPACK;
    var origin = opts.origin || "local";
    var k = kv();
    var added = [], skipped = [];
    var loadBar = null;
    if (fileList.length > 1) {
      try {
        if (window.progress) loadBar = window.progress.begin("LOADING LORE", {
          id: "lore", total: fileList.length,
          detail: "LOREPACK - reading " + fileList.length + " documents into this browser"
        });
      } catch (e) { loadBar = null; }
    }
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      if (loadBar) { try { loadBar.setLabel("LOADING LORE :: " + String(f.name || "").toUpperCase().slice(0, 40)); } catch (e) {} }
      if (/\.json$/i.test(f.name || "")) {
        var env = null;
        try { env = JSON.parse(await readTextFile(f)); } catch (e) { env = null; }
        var envDocs = env && (env.docs || env.documents);
        if (env && Array.isArray(envDocs) && envDocs.length) {
          for (var di = 0; di < envDocs.length; di++) {
            var dd = envDocs[di] || {};
            var dtext = dd.text != null ? String(dd.text) : "";
            var dname = dd.name || dd.file || dd.title || (f.name + "#" + di);
            if (!dtext.trim()) { skipped.push(dname); continue; }
            var dr = await ingest(dname, dtext, { pack: pack, origin: origin + "+import", addedAt: Date.now() });
            added.push({ name: dname, chunks: (dr && dr.chunks) || 0, truncated: false, pack: pack });
          }
          files = files.filter(function (x) { return x.name !== f.name; });
          if (loadBar) { try { loadBar.step(); } catch (e) {} }
          continue;
        }
        skipped.push(f.name); if (loadBar) { try { loadBar.step(); } catch (e) {} } continue;
      }
      if (!/\.(txt|md|text|log)$/i.test(f.name) && !/^text\//.test(f.type || "")) { skipped.push(f.name); if (loadBar) { try { loadBar.step(); } catch (e) {} } continue; }
      var raw;
      try { raw = await readTextFile(f); } catch (e) { skipped.push(f.name); if (loadBar) { try { loadBar.step(); } catch (e) {} } continue; }
      var built = buildChunks(raw);
      if (!built.chunks.length) { skipped.push(f.name); if (loadBar) { try { loadBar.step(); } catch (e) {} } continue; }
      var rec = { name: f.name, raw: raw, addedAt: Date.now(), bytes: f.size || raw.length, truncated: built.truncated, pack: pack, origin: origin };
      if (k) { try { await k.lore_files.set(f.name, rec); } catch (e) { console.warn("lore store failed", e); } }
      files = files.filter(function (x) { return x.name !== f.name; });
      files.push(makeFileRecord(f.name, rec));
      sortFiles();
      added.push({ name: f.name, chunks: built.chunks.length, truncated: built.truncated, pack: pack });
      if (loadBar) { try { loadBar.step(); } catch (e) {} }
    }
    if (loadBar) { try { window.progress.finish("lore"); } catch (e) {} }
    await reindexAsync();
    updateStatus();
    renderFileList();
    return { added: added, skipped: skipped, pack: pack };
  }

  async function ingest(name, raw, opts) {
    opts = opts || {};
    var k = kv();
    var text = String(raw == null ? "" : raw);
    if (!text.trim()) return { status: "empty", name: name };
    var prior = null;
    if (k) { try { prior = await k.lore_files.get(name); } catch (e) {} }
    // A "kept" file is unchanged - but flipping `foundational` in the manifest must
    // still take effect, so the canon flag is part of the unchanged test.
    if (prior && opts.hash && prior.hash === opts.hash && !!prior.foundational === !!opts.foundational && !prior.unindexed) {
      var known = files.filter(function (x) { return x.name === name; })[0];
      if (known) return { status: "kept", name: name, chunks: known.chunks.length };
    }
    var built = buildChunks(text);
    if (!built.chunks.length) return { status: "empty", name: name };
    var rec = {
      name: name,
      raw: text,
      addedAt: (prior && prior.addedAt) || opts.addedAt || Date.now(),
      bytes: text.length,
      truncated: built.truncated,
      pack: opts.pack || "",
      origin: opts.origin || "",
      hash: opts.hash || "",
      url: opts.url || "",
      foundational: !!opts.foundational
    };
    if (k) { try { await k.lore_files.set(name, rec); } catch (e) { console.warn("lore store failed", e); } }
    files = files.filter(function (x) { return x.name !== name; });
    files.push(makeFileRecord(name, rec));
    sortFiles();
    await reindexAsync();
    updateStatus();
    renderFileList();
    return { status: prior ? "updated" : "added", name: name, chunks: built.chunks.length };
  }

  async function migrateLegacy() {
    var k = kv(); if (!k) return;
    try {
      var lib = await k.lore_library.get("files");
      if (!Array.isArray(lib) || !lib.length) return;
      for (var i = 0; i < lib.length; i++) {
        var f = lib[i];
        if (!f || !f.name || !f.chunks || !f.chunks.length) continue;
        var raw = f.chunks.map(function (c) { return c.body || c.text || ""; }).join("\n\n");
        await k.lore_files.set(f.name, { name: f.name, raw: raw, addedAt: f.addedAt || Date.now(), bytes: f.bytes || raw.length, truncated: !!f.truncated });
      }
      await k.lore_library.delete("files");
      console.log("lore: migrated legacy library to per-file storage");
    } catch (e) {}
  }

  async function load() {
    var k = kv();
    if (!k) return false;
    await loadSettings();
    await migrateLegacy();
    try {
      var entries = await k.lore_files.entries();
      files = entries
        .filter(function (e) { return e[1] && typeof e[1].raw === "string" && !e[1].unindexed; })
        .map(function (e) { return makeFileRecord(e[0], e[1]); });
      sortFiles();
    } catch (e) { console.warn("lore load failed", e); }
    await reindexAsync();
    loaded = true;
    await loadFocus();
    updateStatus();
    renderFileList();
    var open = {};
    PANELS.forEach(function (cfg) {
      var want = false;
      try { want = localStorage.getItem(cfg.store) === "1"; } catch (e) {}
      open[cfg.key] = want && memoryFiles().length > 0;
    });
    PANELS.forEach(function (cfg) { setDocsOpen(cfg, open[cfg.key]); });
    return true;
  }

  // Drop a document from the in-memory index WITHOUT touching the stored original. Used
  // when a shipped document is no longer declared in the manifest: it stops being
  // retrievable, but nothing the user ever loaded is destroyed by editing a manifest.
  async function unindex(name) {
    files = files.filter(function (f) { return f.name !== name; });
    var k = kv();
    if (k) { try { var rec = await k.lore_files.get(name); if (rec && typeof rec.raw === "string") { rec.unindexed = true; await k.lore_files.set(name, rec); } } catch (e) {} }
    await reindexAsync();
    updateStatus();
    renderFileList();
  }

  async function unindexMany(names) {
    var list = (names || []).filter(function (n, i, a) { return n && a.indexOf(n) === i; });
    if (!list.length) return { dropped: [] };
    files = files.filter(function (f) { return list.indexOf(f.name) === -1; });
    var k = kv();
    if (k) {
      for (var i = 0; i < list.length; i++) {
        try { var rec = await k.lore_files.get(list[i]); if (rec && typeof rec.raw === "string") { rec.unindexed = true; await k.lore_files.set(list[i], rec); } } catch (e) {}
      }
    }
    await reindexAsync();
    updateStatus();
    renderFileList();
    return { dropped: list };
  }

  // Deliberate deletion (the × button). The stored original is moved to lore_trash
  // first, so a mis-click is recoverable with /trash restore <NAME>.
  // Resolve a document by name: exact first, then case-insensitive substring. Exact-first
  // matters for the commands - a short query must never be swallowed by a longer name
  // that merely contains it.
  function findFile(name) {
    var q = String(name == null ? "" : name).trim();
    if (!q) return null;
    var i;
    for (i = 0; i < files.length; i++) if (files[i].name === q) return files[i];
    var low = q.toLowerCase();
    for (i = 0; i < files.length; i++) if (files[i].name.toLowerCase().indexOf(low) !== -1) return files[i];
    return null;
  }

  // CANON, FROM THE TERMINAL. A document flagged `foundational` is not memory to be
  // recalled: every one of its fragments is handed to her in full on every turn, first,
  // untrimmed by budget - the ground she speaks from. Shipped canon is declared in
  // src/lorepack/lorepack.json (the only path that can ship); a document loaded on this
  // device carries the flag in its own stored record, so it can be turned on here and it
  // survives reloads. The flag is part of the record, so the fragments are rebuilt: a
  // canon fragment must also stop being filtered out of retrieval, or the same text would
  // arrive twice.
  async function setCanonical(name, on) {
    var f = findFile(name);
    if (!f) return { ok: false, error: "NO SUCH DOCUMENT :: " + String(name || "").toUpperCase() };
    if (isShipped(f)) {
      return {
        ok: false, shipped: true, name: f.name,
        error: "THIS DOCUMENT SHIPS FROM src/lorepack/lorepack.json :: DECLARE IT THERE WITH \"foundational\": true. A FLAG SET HERE WOULD BE OVERWRITTEN THE NEXT TIME THAT MANIFEST IS READ."
      };
    }
    var k = kv();
    if (!k) return { ok: false, error: "STORAGE UNAVAILABLE" };
    try {
      var rec = await k.lore_files.get(f.name);
      if (!rec || typeof rec.raw !== "string") return { ok: false, error: "THE STORED ORIGINAL OF " + f.name + " IS MISSING" };
      rec.foundational = !!on;
      await k.lore_files.set(f.name, rec);
      files = files.filter(function (x) { return x.name !== f.name; });
      files.push(makeFileRecord(f.name, rec));
      sortFiles();
      await reindexAsync();
      updateStatus();
      renderFileList();
      var now = files.filter(function (x) { return x.name === f.name; })[0];
      return { ok: true, name: f.name, on: !!on, chunks: now ? now.chunks.length : 0, bytes: rec.raw.length };
    } catch (e) { return { ok: false, error: "THE CANON FLAG COULD NOT BE WRITTEN" }; }
  }

  // Bulk forget for the TOOLS duplicate-scrolls job: N documents trashed with ONE reindex at
  // the end, because a full reindex over hundreds of scrolls costs seconds and forgetFile pays it
  // per document. Same safety as forgetFile (trash first, restorable), same bookkeeping, once.
  async function forgetFiles(names) {
    var k = kv(), done = [];
    var list = (names || []).filter(function (n, i, a) { return n && a.indexOf(n) === i; });
    for (var i = 0; i < list.length; i++) {
      var name = list[i], rec = null;
      if (k) { try { rec = await k.lore_files.get(name); } catch (e) {} }
      files = files.filter(function (f) { return f.name !== name; });
      if (k) {
        try {
          if (rec) await k.lore_trash.set(name, { rec: rec, at: Date.now() });
          await k.lore_files.delete(name);
          done.push(name);
        } catch (e) { console.warn("lore forget failed", e); }
      } else { done.push(name); }
      if (i % 10 === 0) { try { await new Promise(function (r) { setTimeout(r, 0); }); } catch (e) {} }
    }
    await reindexAsync();
    updateStatus();
    renderFileList();
    return { dropped: done };
  }

  async function forgetFile(name) {
    var k = kv();
    var rec = null;
    if (k) { try { rec = await k.lore_files.get(name); } catch (e) {} }
    files = files.filter(function (f) { return f.name !== name; });
    if (k) {
      try {
        if (rec) await k.lore_trash.set(name, { rec: rec, at: Date.now() });
        await k.lore_files.delete(name);
      } catch (e) { console.warn("lore forget failed", e); }
    }
    await reindexAsync();
    updateStatus();
    renderFileList();
  }

  async function trashList() {
    var k = kv(); if (!k) return [];
    try {
      var entries = await k.lore_trash.entries();
      return entries.map(function (e) {
        var rec = e[1] && e[1].rec;
        return { name: e[0], at: (e[1] && e[1].at) || 0, bytes: (rec && typeof rec.raw === "string") ? rec.raw.length : 0, chunks: (rec && rec.raw) ? buildChunks(rec.raw).chunks.length : 0 };
      }).sort(function (a, b) { return b.at - a.at; });
    } catch (e) { return []; }
  }

  async function restoreTrashed(name) {
    var k = kv();
    if (!k || !name) return { ok: false, error: "USAGE: /trash restore <NAME>" };
    var list = await trashList();
    var target = null, i;
    for (i = 0; i < list.length; i++) if (list[i].name === name) { target = list[i].name; break; }
    if (!target) {
      var q = String(name).toLowerCase();
      for (i = 0; i < list.length; i++) if (list[i].name.toLowerCase().indexOf(q) !== -1) { target = list[i].name; break; }
    }
    if (!target) return { ok: false, error: "NOT IN THE TRASH :: " + String(name).toUpperCase() };
    try {
      var entry = await k.lore_trash.get(target);
      if (!entry || !entry.rec || typeof entry.rec.raw !== "string") return { ok: false, error: "TRASH RECORD IS EMPTY" };
      await k.lore_files.set(target, entry.rec);
      await k.lore_trash.delete(target);
      await load();
      return { ok: true, name: target, chunks: buildChunks(entry.rec.raw).chunks.length };
    } catch (e) { return { ok: false, error: "RESTORE FAILED" }; }
  }

  async function emptyTrash() {
    var k = kv(); if (!k) return { removed: 0 };
    var list = await trashList();
    if (!list.length) return { removed: 0 };
    try { await k.lore_trash.deleteMany(list.map(function (t) { return t.name; })); } catch (e) {}
    return { removed: list.length };
  }

  // FORGET LOCAL - drops the memory loaded on this device. Shipped documents are left
  // alone: the manifest brings them back on the next LOREPACK load.
  async function clear() {
    var names = localFiles().map(function (f) { return f.name; });
    if (!names.length) return { removed: 0 };
    var k = kv();
    files = files.filter(function (f) { return names.indexOf(f.name) === -1; });
    await reindexAsync();
    updateStatus();
    renderFileList();
    // FORGET LOCAL is deliberate, but it is still a bulk delete of documents that exist
    // nowhere else, so every record is copied into lore_trash first. /trash restore <NAME>
    // brings any of them back; /trash empty is the only thing that truly destroys text.
    if (k) {
      for (var i = 0; i < names.length; i++) {
        try {
          var rec = await k.lore_files.get(names[i]);
          if (rec) await k.lore_trash.set(names[i], { rec: rec, at: Date.now() });
          await k.lore_files.delete(names[i]);
        } catch (e) { console.warn("lore forget-local failed", e); }
      }
    }
    return { removed: names.length, names: names };
  }

  async function rechunk(maxChars, overlap) {
    var k = kv();
    if (maxChars) settings.maxChars = Math.max(200, Math.min(4000, Math.round(maxChars)));
    if (overlap != null) settings.overlap = Math.max(0, Math.min(5, Math.round(overlap)));
    await saveSettings();
    if (k) {
      for (var i = 0; i < files.length; i++) {
        try {
          var rec = await k.lore_files.get(files[i].name);
          if (rec) files[i] = makeFileRecord(files[i].name, rec);
        } catch (e) {}
      }
    }
    await reindexAsync();
    updateStatus();
    renderFileList();
    return { maxChars: settings.maxChars, overlap: settings.overlap, fragments: count() };
  }

  async function sourceOf(name, chars) {
    var k = kv(); if (!k || !name) return null;
    var names = files.map(function (f) { return f.name; });
    var target = null;
    for (var i = 0; i < names.length; i++) if (names[i] === name) { target = names[i]; break; }
    if (!target) {
      var q = String(name).toLowerCase();
      for (var j = 0; j < names.length; j++) if (names[j].toLowerCase().indexOf(q) !== -1) { target = names[j]; break; }
    }
    if (!target) return null;
    try {
      var rec = await k.lore_files.get(target);
      if (!rec || typeof rec.raw !== "string") return null;
     var n = chars || 1200;
     return { name: target, chars: rec.raw.length, text: rec.raw.slice(0, n), more: rec.raw.length > n };
   } catch (e) { return null; }
 }

  /* ======================================================================
     ENGINE PASSAGES (2026-10-21 - the /summarize engine hurt).

     The stored originals stay WHOLE in kv (source/export/rechunk all depend on
     it). What is split is the READ: a document is dealt into numbered,
     sentence-boundary passages of ~ENGINE_PASS_CHARS chars with a 2-sentence
     overlap, so a part boundary never severs a thought. The engine road
     (summarize one part, ask over retrieved parts, hand one part to her in
     focus) sends a part ALONE instead of through her 274K prompt, whose middle
     the model truncates away - which is why she reports whole documents empty.
     12000 chars is ~3000 tokens against the 6000-token ideal: room for the
     instruction and the reply. Nothing here spends quota (splitting is local);
     only the engine calls built on top of it do, one per part.
     ====================================================================== */
  var ENGINE_PASS_CHARS = 12000;
  var ENGINE_PASS_OVERLAP = 2;

  function splitEnginePassages(raw, size) {
    var want = Math.max(2000, Math.floor(Number(size) || ENGINE_PASS_CHARS));
    var sents = splitSentences(String(raw == null ? "" : raw)).map(function (x) { return x.trim(); }).filter(Boolean);
    var out = [], cur = "";
    function push() { if (cur) out.push(cur); cur = ""; }
    for (var i = 0; i < sents.length; i++) {
      var s = sents[i];
      if (s.length > want) {
        push();
        for (var k = 0; k < s.length; k += want) out.push(s.slice(k, k + want));
        continue;
      }
      if (cur && (cur.length + 1 + s.length) > want) {
        push();
        var back = out.length ? splitSentences(out[out.length - 1]).slice(-ENGINE_PASS_OVERLAP) : [];
        cur = back.length ? back.join(" ") : "";
        if (cur && (cur.length + 1 + s.length) > want) cur = "";
      }
      cur = cur ? cur + " " + s : s;
      if (cur.length >= want) push();
    }
    push();
    return out;
  }

  async function readRaw(name) {
    var k = kv(); if (!k || !name) return null;
    var names = files.map(function (f) { return f.name; });
    var target = null, i;
    for (i = 0; i < names.length; i++) if (names[i] === name) { target = names[i]; break; }
    if (!target) {
      var q = String(name).toLowerCase();
      for (i = 0; i < names.length; i++) if (names[i].toLowerCase().indexOf(q) !== -1) { target = names[i]; break; }
    }
    if (!target) return null;
    try {
      var rec = await k.lore_files.get(target);
      if (!rec || typeof rec.raw !== "string" || !rec.raw) return null;
      return { name: target, raw: rec.raw };
    } catch (e) { return null; }
  }

  // The map: every part numbered with its size and a preview - no engine calls.
  async function enginePassages(name, size) {
    var got = await readRaw(name);
    if (!got) return null;
    var all = splitEnginePassages(got.raw, size);
    if (!all.length) return null;
    var want = Math.max(2000, Math.floor(Number(size) || ENGINE_PASS_CHARS));
    return {
      name: got.name, chars: got.raw.length, count: all.length, size: want,
      parts: all.map(function (t, i) {
        return { n: i + 1, chars: t.length, preview: t.replace(/\s+/g, " ").slice(0, 160) };
      })
    };
  }

  // One numbered part, 1-indexed. Readers name it the way the map numbers it.
  async function enginePassage(name, n, size) {
    var got = await readRaw(name);
    if (!got) return null;
    var all = splitEnginePassages(got.raw, size);
    if (!all.length) return null;
    var idx = Math.floor(Number(n));
    if (!isFinite(idx) || idx < 1 || idx > all.length) return { name: got.name, count: all.length, chars: got.raw.length, error: "NO SUCH PART :: " + String(n).toUpperCase() + " :: " + got.name + " HAS " + all.length + " PART" + (all.length === 1 ? "" : "S") };
    return { name: got.name, n: idx, count: all.length, chars: got.raw.length, text: all[idx - 1], more: all.length > 1 };
  }

  // A part is only ever named with the word PART (part 3, parts 2-4): bare numbers
  // stay part of the document's own name, so "NOTEBOOK - 1.0.txt" never parses as
  // part 1 of something. Returns {name, part, partB} with the clause stripped.
  function parsePartSpec(s) {
    var t = String(s == null ? "" : s);
    var m = t.match(/\bparts\s+(\d+)\s*-\s*(\d+)\s*$/i) || t.match(/\bparts\s+(\d+)\s*-\s*(\d+)\b/i);
    if (m) return { name: t.slice(0, m.index).trim(), part: Math.floor(Number(m[1])), partB: Math.floor(Number(m[2])) };
    var s1 = t.match(/\bpart\s+(\d+)\s*$/i) || t.match(/\bpart\s+(\d+)\b/i);
    if (s1) return { name: t.slice(0, s1.index).trim(), part: Math.floor(Number(s1[1])), partB: 0 };
    return { name: t.trim(), part: 0, partB: 0 };
  }

  async function exportFile(name) {
    var k = kv(); if (!k) return false;
    try {
      var rec = await k.lore_files.get(name);
      if (!rec || typeof rec.raw !== "string") return false;
      var blob = new Blob([rec.raw], { type: "text/plain" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch (e) { return false; }
  }

  /* ======================================================================
     SEE - ONE DOCUMENT PUT IN FRONT OF HER (the DOCS panel's SEE button, /focus)

     Canon is what she always has; recall is a guess at what matches the question; SEE is a
     decision - THIS document, now. One at a time, named the way the rest of the panel names
     things, read out of the store when the turn is woven and handed over whole (up to
     LIA_FOCUS_CHARS) with the next message she is given. It is spent when she has answered: a
     hand-over, not a state she lives in. Only the NAME is kept (on this device), so a reload in
     between does not lose it and no scroll is copied into a second place.
     ====================================================================== */
  function focusCap() {
    var n = (typeof LIA_FOCUS_CHARS !== "undefined") ? Number(LIA_FOCUS_CHARS) : 0;
    return (n > 0) ? Math.floor(n) : 20000;
  }

  function loadFocus() {
    if (focusPromise) return focusPromise;
    focusPromise = (async function () {
      var k = kv();
      if (!k) return focus;
      try {
        var rec = await k.lore_meta.get("focus");
        if (rec && typeof rec.name === "string" && rec.name) focus = { name: rec.name, ts: rec.ts || Date.now(), part: Math.floor(Number(rec.part)) || 0 };
      } catch (e) { /* nothing in focus, or nothing readable */ }
      return focus;
    })();
    return focusPromise;
  }

  async function saveFocus() {
    var k = kv();
    if (!k) return false;
    try { await k.lore_meta.set("focus", focus ? { name: focus.name, ts: focus.ts, part: focus.part || 0 } : null); return true; }
    catch (e) { console.warn("focus not saved", e); return false; }
  }

  // What is in focus, as the command and the /help line see it.
  function focused() {
    if (!focus) return null;
    var f = findFile(focus.name);
    var part = Math.floor(Number(focus.part)) || 0;
    return { name: focus.name, ts: focus.ts, part: part, cap: focusCap(), known: !!f, bytes: f ? f.bytes : 0, whole: !!f && !part && f.bytes <= focusCap() };
  }

  // Put ONE document in focus. Everything about it is deliberate: exactly one, named, handed over
  // whole when it fits, and printed here so he can see exactly what she is about to be given.
  // With PART N named it is one numbered passage, not the head of the scroll: the original
  // stays whole in the store, and what she is handed is PART N OF M, named as such on both sides.
  async function focusOn(name) {
    await loadFocus();
    var spec = parsePartSpec(name);
    var f = findFile(spec.name);
    if (!f) {
      say("NO DOCUMENT BY THAT NAME :: " + String(spec.name || "").toUpperCase() + " - THE DOCS PANEL LISTS THEM, /lore SEARCHES THEM, AND /trash HOLDS THE FORGOTTEN.");
      return false;
    }
    var part = spec.part || 0;
    var total = 0;
    if (part) {
      var map = await enginePassages(f.name);
      if (!map) { say("THAT DOCUMENT WOULD NOT OPEN :: " + f.name); return false; }
      total = map.count;
      if (part < 1 || part > total) { say("NO SUCH PART :: PART " + part + " :: " + f.name + " HAS " + total + " PART" + (total === 1 ? "" : "S") + " (/loremap " + f.name + " LISTS THEM)."); return false; }
    }
    var cap = focusCap();
    focus = { name: f.name, ts: Date.now(), part: part };
    await saveFocus();
    repaint();
    say("IN FOCUS :: " + f.name + " :: " + (part
      ? "PART " + part + " OF " + total + " (" + map.parts[part - 1].chars + " CHARS OF " + f.bytes + ")"
      : (f.bytes <= cap
        ? "THE WHOLE DOCUMENT (" + fmtBytes(f.bytes) + ")"
        : "THE FIRST " + cap + " OF ITS " + f.bytes + " CHARS (THE REST IS NOT HANDED - NAME PART N TO TURN THE PAGE, E.G. /focus " + f.name + " PART 2)"))
      + " IS HANDED TO HER WITH YOUR NEXT MESSAGE, AS WHAT SHE IS LOOKING AT. IT IS SPENT ONCE SHE HAS ANSWERED - ONE DOCUMENT AT A TIME, AND NOTHING ELSE IN HER MEMORY IS TOUCHED.");
    return true;
  }

  // Take it out of focus again. Nothing in the index was changed, so there is nothing to undo -
  // only the hand-over that was waiting.
  async function clearFocus(quiet) {
    await loadFocus();
    if (!focus) { if (!quiet) say("NOTHING IS IN FOCUS."); return false; }
    var was = focus.name;
    focus = null;
    await saveFocus();
    repaint();
    if (!quiet) say("OUT OF FOCUS :: " + was + " :: NOTHING OF IT RIDES WITH HER NEXT MESSAGE.");
    return true;
  }

  // WHAT HER NEXT PROMPT CARRIES. Built when the turn is woven; chat.js spends the focus once she
  // has answered. A send that fails leaves it standing, which is the right way round.
  async function focusBlock() {
    if (!focus) return "";
    var f = findFile(focus.name);
    if (!f) return "He put a document in front of you (" + focus.name + "), but it is no longer in the index here. Say so if it matters, and do not guess at what was in it.";
    var part = Math.floor(Number(focus.part)) || 0;
    if (part) {
      var one = await enginePassage(f.name, part);
      if (!one || !one.text) return "He put " + f.name + " part " + part + " in front of you, but it would not open here. Say so if it matters, and do not guess at what was in it.";
      return "Patrikios put this document in front of you before you answer: it is IN FOCUS. It is not memory being recalled and not a file he attached - it is one numbered passage of the document itself, and it is what this reply is about.\n"
        + "<in_focus name=\"" + f.name + "\" part=\"" + one.n + " of " + one.count + "\">\n" + one.text + "\n</in_focus>\n"
        + "That is PART " + one.n + " OF " + one.count + " (" + one.text.length + " of its " + one.chars + " characters)."
        + (one.n < one.count ? " There are more parts he can put in front of you by number." : " That is the last part.") + "\n"
        + "Read it as the document it is, answer from having read it, and never mention that anything was handed to you, and never quote this note.";
    }
    var src = await sourceOf(f.name, focusCap());
    if (!src || typeof src.text !== "string" || !src.text) return "";
    return "Patrikios put this document in front of you before you answer: it is IN FOCUS. It is not memory being recalled and not a file he attached - it is the document itself, handed over whole, and it is what this reply is about.\n"
      + "<in_focus name=\"" + f.name + "\">\n" + src.text + "\n</in_focus>\n"
      + (src.more ? "That is the first " + src.text.length + " of its " + src.chars + " characters; the rest was not handed over.\n" : "That is the whole of it.\n")
      + "Read it as the document it is, answer from having read it, and never mention that anything was handed to you, and never quote this note.";
  }

  // The DOCS panel and the status line again, so a pressed SEE lets go the moment a focus is spent.
  function repaint() {
    PANELS.forEach(renderPanel);
    updateStatus();
  }

  function init() {
    if (initPromise) return initPromise;
    initPromise = (async function () {
      for (var i = 0; i < 60; i++) {
        if (window.root && window.root.kv) return await load();
        await new Promise(function (r) { setTimeout(r, 500); });
      }
      return false;
    })();
    return initPromise;
  }

  function report(res) {
    var tag = res.pack ? res.pack + " :: " : "";
    res.added.forEach(function (a) {
      say("ABSORBED " + tag + a.name + " :: " + a.chunks + " FRAGMENTS" + (a.truncated ? " (TRUNCATED AT 2M CHARS)" : ""));
    });
    if (res.skipped.length) say("IGNORED: " + res.skipped.join(", "));
    if (!res.added.length && !res.skipped.length) say("NO READABLE TEXT FOUND.");
  }

  var clearBtn = document.getElementById("loreClearBtn");
  var bar = document.getElementById("lorebar");

  function docsOpen(cfg) {
    var box = document.getElementById(cfg.box);
    return !!(box && !box.hidden);
  }

  function setDocsOpen(cfg, open) {
    var box = document.getElementById(cfg.box);
    if (!box) return;
    box.hidden = !open;
    var toggle = document.getElementById(cfg.toggle);
    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.disabled = !memoryFiles().length;
    }
    try { localStorage.setItem(cfg.store, open ? "1" : "0"); } catch (e) {}
    if (open) renderFileList();
  }

  function wirePanel(cfg) {
    var up = document.getElementById(cfg.upload);
    var input = document.getElementById(cfg.input);
    var toggle = document.getElementById(cfg.toggle);
    var box = document.getElementById(cfg.box);

    if (up && input) up.addEventListener("click", function () { input.click(); });

    if (toggle) toggle.addEventListener("click", function () {
      if (!memoryFiles().length) {
        say("NO LOREPACK DOCUMENTS YET. CLICK 'LOAD LOREPACK' TO ADD .TXT/.MD MEMORY FILES FROM THIS MACHINE.");
        return;
      }
      setDocsOpen(cfg, !docsOpen(cfg));
    });

    if (box) box.addEventListener("click", function (e) { e.stopPropagation(); });

    if (input) input.addEventListener("change", async function () {
      if (!input.files || !input.files.length) return;
      var res = await addFiles(input.files, { pack: cfg.key, origin: cfg.key ? "local" : "" });
      input.value = "";
      report(res);
    });
  }

  PANELS.forEach(wirePanel);

  if (clearBtn) clearBtn.addEventListener("click", async function () {
    var local = localFiles();
    if (!local.length) return;
    if (!confirm("FORGET THE " + local.length + " LOREPACK DOCUMENT" + (local.length === 1 ? "" : "S") + " LOADED ON THIS DEVICE? (SHIPPED DOCUMENTS STAY - THE REST IS HELD IN /trash)")) return;
    var res = await clear();
    say("FORGOTTEN " + res.removed + " DOCUMENT" + (res.removed === 1 ? "" : "S") + " LOADED ON THIS DEVICE. HELD IN /trash - RESTORE WITH /trash restore <NAME>");
  });

  if (bar) {
    bar.addEventListener("dragover", function (e) { e.preventDefault(); bar.classList.add("dragover"); });
    bar.addEventListener("dragleave", function () { bar.classList.remove("dragover"); });
    bar.addEventListener("drop", async function (e) {
      e.preventDefault();
      bar.classList.remove("dragover");
      var dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      var res = await addFiles(dt.files, { pack: LOREPACK, origin: "local" });
      report(res);
    });
  }

  window.lore = {
    init: init,
    reload: load,
    addFiles: addFiles,
    ingest: ingest,
    forgetFile: forgetFile,
    forgetFiles: forgetFiles,
    unindex: unindex,
    unindexMany: unindexMany,
    trashList: trashList,
    restoreTrashed: restoreTrashed,
    emptyTrash: emptyTrash,
    exportFile: exportFile,
    clear: clear,
    rechunk: rechunk,
    source: sourceOf,
    search: search,
    chunks: chunkList,
    preview: preview,
    buildContext: buildContext,
    // ENGINE PASSAGES (2026-10-21): the numbered read of a whole original - the map
    // lists every part with a preview (free), one part reads it whole. The engine
    // road (summaries, questions, focus parts) is built on these, never on slices.
    splitEnginePassages: splitEnginePassages,
    passages: enginePassages,
    passage: enginePassage,
    parsePart: parsePartSpec,
    passChars: function () { return ENGINE_PASS_CHARS; },
    describe: describe,
    count: count,
    settings: function () { return { maxChars: settings.maxChars, overlap: settings.overlap, sortKey: sortKeyOf(), sortDir: sortDirOf(), canonFirst: settings.canonFirst, per: settings.per, page: settings.page }; },
    sort: setSort,
    // ONE PAGE OF DOCUMENTS AT A TIME :: the panel's own pager, as words (/lore page <N> | next |
    // prev | first | last | per <25|50|100|200|all> | find <NAME>), the state it prints, and the
    // page a document is on.
    docs: docs,
    docsState: docsState,
    pageOfDoc: pageOfDoc,
    sortState: function () {
      return {
        key: sortKeyOf(), dir: sortDirOf(), canonFirst: settings.canonFirst,
        keys: Object.keys(SORT_KEYS),
        labels: Object.keys(SORT_KEYS).map(function (k) { return SORT_KEYS[k].label; })
      };
    },
    files: function () { return files.map(function (f) { return { name: f.name, chunks: f.chunks.length, bytes: f.bytes, addedAt: f.addedAt, pack: f.pack || "", origin: f.origin || "", foundational: !!f.foundational }; }); },
    subset: subsetOf,
    foundational: function () { return files.filter(function (f) { return f.foundational; }).map(function (f) { return { name: f.name, chunks: f.chunks.length }; }); },
    setCanonical: setCanonical,
    findDoc: function (name) { var f = findFile(name); return f ? f.name : null; },
    // SEE :: one document put in front of her, whole, with the next message.
    focus: focusOn,
    focused: focused,
    clearFocus: clearFocus,
    focusBlock: focusBlock,
    repaint: repaint,
    // The LOREPACK is all of her memory, so this returns every document in the index.
    // The name is historical: the old personal-vs-pack split is gone.
    packOf: memoryOf,
    localDocs: function () { return localFiles().map(function (f) { return f.name; }); },
    ready: function () { return loaded; }
  };

  init();
})();
