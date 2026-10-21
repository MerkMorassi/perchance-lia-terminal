window.MythosLore = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var STORE = opts.store || null;
  var MAX_CHARS = opts.maxChars || 700;
  var OVERLAP = (opts.overlap == null) ? 1 : opts.overlap;
  var HARD_CAP = opts.hardCap || 2000000;
  var FOCUS_CAP = opts.focusCap || 20000;
  var STOP = {};
  var stopWords = "a an and are as at be but by for from had has have he her his i if in into is it its of on or our she that the their them then there these they this to was were will with you your not no do does did than too very can could would should may might must who what when where why how which whom whose about again once";
  (function () {
    var parts = stopWords.split(" "), i;
    for (i = 0; i < parts.length; i++) STOP[parts[i]] = true;
  })();
  var PROTECTED = [
    "pillar of light", "gate of eleuthia", "gate of janus", "abyssal gate", "sacred pearl",
    "pillar of pearl", "gate of hymns and song", "gate of aphrodite", "belted oblisos",
    "sacred wand", "sacred rod", "active resonant archive", "noetic field", "forge lattice",
    "ouroboric resonator", "living pillar", "human in the loop", "divine mother", "divine daughter",
    "holy spirit", "primordial syzygy", "cluster 13", "node 14", "divine friction", "gnostic gold",
    "mother of all goddesses", "supreme divine mother", "pillar of pearl within gate of eleuthia"
  ];
  var files = [];
  var index = null;
  var focus = null;
  var maxChars = MAX_CHARS;
  var overlap = OVERLAP;
  function COUNT(text) {
    if (typeof opts.countTokens === "function") {
      try { return opts.countTokens(text); } catch (e) {}
    }
    return Math.ceil(String(text).length / 4);
  }
  function BUDGET() {
    if (typeof opts.budget === "number") return opts.budget;
    if (typeof opts.budgetFn === "function") {
      try { return opts.budgetFn(); } catch (e) {}
    }
    return 1200;
  }
  function SEM(q, k) {
    if (typeof opts.semanticSearch !== "function") return null;
    try { return opts.semanticSearch(q, k); }
    catch (e) { return null; }
  }
  function tokenize(s) {
    var low = String(s).toLowerCase();
    var m = null;
    try { m = low.match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019\-]*/gu); }
    catch (e) { m = low.match(/[a-z0-9][a-z0-9'\-]*/g); }
    if (!m) return [];
    var out = [], i, t;
    for (i = 0; i < m.length; i++) {
      t = m[i];
      if (t.length < 2 && !/\d/.test(t)) continue;
      if (STOP[t]) continue;
      out.push(t);
    }
    for (i = 0; i < PROTECTED.length; i++) {
      if (low.indexOf(PROTECTED[i]) !== -1) out.push(PROTECTED[i].replace(/ /g, "-"));
    }
    return out;
  }
  function splitSentences(text) {
    var parts = [], start = 0, i, c, next, piece, tail;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (c !== "." && c !== "!" && c !== "?" && c !== "\n") continue;
      next = text[i + 1];
      if (c === "\n" || next === undefined || next === " " || next === "\n" || next === '"' || next === "\u201d" || next === ")") {
        piece = text.slice(start, i + 1).trim();
        if (piece) parts.push(piece);
        start = i + 1;
      }
    }
    tail = text.slice(start).trim();
    if (tail) parts.push(tail);
    return parts;
  }
  function buildChunks(raw) {
    var text = String(raw).replace(/\r\n?/g, "\n");
    var truncated = false;
    if (text.length > HARD_CAP) { text = text.slice(0, HARD_CAP); truncated = true; }
    var chunks = [], heading = "", paras = [], lines, i, t, hm, isHeading;
    function emit(sentences, head) {
      var a = 0, buf, len, j, body;
      while (a < sentences.length) {
        buf = []; len = 0; j = a;
        while (j < sentences.length && (buf.length === 0 || len + sentences[j].length + 1 <= maxChars)) {
          buf.push(sentences[j]);
          len += sentences[j].length + 1;
          j++;
        }
        body = buf.join(" ");
        chunks.push({ heading: head || "", text: (head ? head + "\n" : "") + body, body: body });
        if (j >= sentences.length) break;
        a = Math.max(a + 1, j - overlap);
      }
    }
    function flush() {
      if (!paras.length) return;
      emit(splitSentences(paras.join(" ")), heading);
      paras = [];
    }
    lines = text.split("\n");
    for (i = 0; i < lines.length; i++) {
      t = lines[i].trim();
      if (!t) { flush(); continue; }
      hm = /^#{1,6}\s+(.*)$/.exec(t);
      if (hm) { flush(); heading = hm[1].trim().replace(/[:.]+$/, ""); continue; }
      isHeading = t.length <= 70 && (/:$/.test(t) || ((t === t.toUpperCase()) && /[A-Z]/.test(t) && !/[.!?]$/.test(t)));
      if (isHeading) { flush(); heading = t.replace(/[:.]+$/, "").trim(); continue; }
      paras.push(t);
    }
    flush();
    return { chunks: chunks, truncated: truncated };
  }
  function makeRec(name, raw, meta) {
    meta = meta || {};
    var built = buildChunks(raw);
    return {
      name: name,
      raw: String(raw),
      addedAt: meta.addedAt || Date.now(),
      bytes: String(raw).length,
      truncated: built.truncated,
      pack: meta.pack || "",
      origin: meta.origin || "",
      hash: meta.hash || "",
      foundational: !!meta.foundational,
      chunks: built.chunks
    };
  }
  function flatChunks() {
    var out = [], f, c;
    for (f = 0; f < files.length; f++) {
      for (c = 0; c < files[f].chunks.length; c++) {
        out.push({ file: files[f].name, text: files[f].chunks[c].text, heading: files[f].chunks[c].heading, foundational: !!files[f].foundational });
      }
    }
    return out;
  }
  function buildIndex(chunks) {
    var postings = {}, lens = new Array(chunks.length), total = 0, i, k, toks, tf, term, p;
    for (i = 0; i < chunks.length; i++) {
      toks = tokenize(chunks[i].text);
      lens[i] = toks.length;
      total += toks.length;
      tf = {};
      for (k = 0; k < toks.length; k++) tf[toks[k]] = (tf[toks[k]] || 0) + 1;
      for (term in tf) {
        p = postings[term];
        if (!p) postings[term] = p = {};
        p[i] = tf[term];
      }
    }
    return { postings: postings, chunks: chunks, lens: lens, avgdl: (total / (chunks.length || 1)) || 1 };
  }
  function reindex() {
    index = buildIndex(flatChunks());
    return index.chunks.length;
  }
  function reindexAsync() {
    return new Promise(function (resolve) {
      var chunks = flatChunks(), postings = {}, lens = new Array(chunks.length), total = 0, i = 0;
      function step() {
        var end = Math.min(i + 400, chunks.length), k, toks, tf, term, p;
        for (; i < end; i++) {
          toks = tokenize(chunks[i].text);
          lens[i] = toks.length;
          total += toks.length;
          tf = {};
          for (k = 0; k < toks.length; k++) tf[toks[k]] = (tf[toks[k]] || 0) + 1;
          for (term in tf) {
            p = postings[term];
            if (!p) postings[term] = p = {};
            p[i] = tf[term];
          }
        }
        if (i < chunks.length) { setTimeout(step, 0); return; }
        index = { postings: postings, chunks: chunks, lens: lens, avgdl: (total / (chunks.length || 1)) || 1 };
        resolve(index.chunks.length);
      }
      step();
    });
  }
  function findFile(name) {
    var q = String(name == null ? "" : name).trim(), i;
    if (!q) return null;
    for (i = 0; i < files.length; i++) if (files[i].name === q) return files[i];
    q = q.toLowerCase();
    for (i = 0; i < files.length; i++) if (files[i].name.toLowerCase().indexOf(q) !== -1) return files[i];
    return null;
  }
  function search(query, topK) {
    topK = topK || 6;
    if (!index) reindex();
    if (!index.chunks.length) return [];
    var wantName = String(query).toLowerCase().trim(), jumpIds = [], f, fc;
    if (wantName) {
      for (f = 0; f < files.length; f++) {
        if (files[f].name.toLowerCase() !== wantName) continue;
        for (fc = 0; fc < index.chunks.length; fc++) {
          if (index.chunks[fc].file === files[f].name) jumpIds.push(fc);
        }
      }
    }
    var qTerms = tokenize(query);
    if (!qTerms.length && !jumpIds.length) return [];
    var k1 = 1.4, b = 0.75, N = index.chunks.length;
    var scores = {}, counted = {}, q, term, p, df, idf, id, dl, s;
    for (q = 0; q < qTerms.length; q++) {
      term = qTerms[q];
      if (counted[term]) continue;
      counted[term] = true;
      p = index.postings[term];
      if (!p) continue;
      df = Object.keys(p).length;
      idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      for (id in p) {
        dl = index.lens[id] || 1;
        s = idf * (p[id] * (k1 + 1)) / (p[id] + k1 * (1 - b + b * dl / index.avgdl));
        scores[id] = (scores[id] || 0) + s;
      }
    }
    var qLower = String(query).toLowerCase().trim(), cand = [];
    for (id in scores) {
      s = scores[id];
      if (qLower.length > 3 && index.chunks[id].text.toLowerCase().indexOf(qLower) !== -1) s += 4;
      cand.push({ id: Number(id), score: s });
    }
    cand.sort(function (a, c2) { return c2.score - a.score; });
    if (cand.length > 60) cand.length = 60;
    var picked = [], best, bestScore, i, s2, adj, sc;
    while (picked.length < topK && cand.length) {
      best = -1; bestScore = -Infinity;
      for (i = 0; i < cand.length; i++) {
        adj = 0;
        for (s2 = 0; s2 < picked.length; s2++) {
          if (Math.abs(picked[s2].id - cand[i].id) <= 1) { adj = 1; break; }
        }
        sc = cand[i].score * (1 - 0.6 * adj);
        if (sc > bestScore) { bestScore = sc; best = i; }
      }
      picked.push(cand[best]);
      cand.splice(best, 1);
    }
    var jumpHits = [], jumpSeen = {}, ji, jch;
    for (ji = 0; ji < jumpIds.length && jumpHits.length < topK; ji++) {
      jch = index.chunks[jumpIds[ji]];
      jumpSeen[jumpIds[ji]] = true;
      jumpHits.push({ id: jumpIds[ji], score: 1e9, file: jch.file, heading: jch.heading, text: jch.text });
    }
    var lex = picked.map(function (r) {
      var ch = index.chunks[r.id];
      return { id: r.id, score: r.score, file: ch.file, heading: ch.heading, text: ch.text, foundational: !!ch.foundational };
    }).filter(function (h) { return jumpSeen[h.id] !== true; });
    return jumpHits.concat(lex).slice(0, Math.max(topK, jumpHits.length));
  }
  function fuseRanks(lex, sem) {
    var K = 60, entries = [], at = {}, i;
    function note(h, rank, lane) {
      var id = String(h.id);
      if (!(id in at)) { at[id] = entries.length; entries.push({ hit: h, rrf: 0, lanes: [], cos: null }); }
      var e = entries[at[id]];
      e.rrf += 1 / (K + rank + 1);
      if (e.lanes.indexOf(lane) === -1) e.lanes.push(lane);
      if (lane === "meaning" && typeof h.score === "number") e.cos = h.score;
      if (!e.hit.text && h.text) e.hit = h;
    }
    for (i = 0; i < lex.length; i++) note(lex[i], i, "words");
    for (i = 0; i < sem.length; i++) note(sem[i], i, "meaning");
    entries.sort(function (a, b) { return b.rrf - a.rrf; });
    return entries.map(function (e) {
      var h = e.hit;
      return {
        id: h.id, score: h.score, file: h.file, heading: h.heading, text: h.text,
        rank: e.rrf, cos: e.cos,
        via: e.lanes.length > 1 ? "both" : (e.lanes[0] === "meaning" ? "sem" : "lex")
      };
    });
  }
  function storeRec(rec) {
    if (!STORE || typeof STORE.set !== "function") return Promise.resolve(false);
    var slim = { name: rec.name, raw: rec.raw, addedAt: rec.addedAt, bytes: rec.bytes, truncated: rec.truncated, pack: rec.pack, origin: rec.origin, hash: rec.hash, foundational: rec.foundational };
    return STORE.set(rec.name, slim).then(function () { return true; }, function () { return false; });
  }
  function storeDel(name) {
    if (!STORE || typeof STORE.delete !== "function") return Promise.resolve(false);
    return STORE.delete(name).then(function () { return true; }, function () { return false; });
  }
  function ingest(name, raw, meta) {
    meta = meta || {};
    name = String(name == null ? "" : name).trim();
    var text = String(raw == null ? "" : raw);
    if (!name || !text.trim()) return Promise.resolve({ status: "empty", name: name });
    var prior = null, i;
    for (i = 0; i < files.length; i++) if (files[i].name === name) prior = files[i];
    if (prior && meta.hash && prior.hash === meta.hash && !!prior.foundational === !!meta.foundational) {
      return Promise.resolve({ status: "kept", name: name, chunks: prior.chunks.length });
    }
    var rec = makeRec(name, text, { addedAt: (prior && prior.addedAt) || meta.addedAt || Date.now(), pack: meta.pack || "", origin: meta.origin || "", hash: meta.hash || "", foundational: !!meta.foundational });
    if (!rec.chunks.length) return Promise.resolve({ status: "empty", name: name });
    files = files.filter(function (x) { return x.name !== name; });
    files.push(rec);
    return storeRec(rec).then(function () { return reindexAsync(); }).then(function () {
      return { status: prior ? "updated" : "added", name: name, chunks: rec.chunks.length };
    });
  }
  function forget(name) {
    var f = findFile(name);
    if (!f) return Promise.resolve(false);
    files = files.filter(function (x) { return x.name !== f.name; });
    if (focus && focus.name === f.name) focus = null;
    return storeDel(f.name).then(function () { return reindexAsync(); }).then(function () { return true; });
  }
  function clear() {
    var names = files.map(function (f) { return f.name; });
    files = [];
    focus = null;
    var chain = Promise.resolve(true);
    if (STORE && typeof STORE.delete === "function") {
      chain = names.reduce(function (p, n) {
        return p.then(function () { return STORE.delete(n).then(function () { return true; }, function () { return false; }); });
      }, Promise.resolve(true));
    }
    return chain.then(function () { return reindexAsync(); }).then(function () { return { dropped: names.length }; });
  }
  function rechunk(nc, ov) {
    if (nc) maxChars = Math.max(200, Math.min(4000, Math.round(nc)));
    if (ov != null) overlap = Math.max(0, Math.min(5, Math.round(ov)));
    var raws = files.map(function (f) {
      return { name: f.name, raw: f.raw, addedAt: f.addedAt, pack: f.pack, origin: f.origin, hash: f.hash, foundational: f.foundational };
    });
    files = raws.map(function (r) { return makeRec(r.name, r.raw, r); });
    return reindexAsync().then(function () {
      return { maxChars: maxChars, overlap: overlap, fragments: count() };
    });
  }
  function source(name, chars) {
    var f = findFile(name);
    if (!f) return null;
    var n = chars || 1200;
    return { name: f.name, chars: f.raw.length, text: f.raw.slice(0, n), more: f.raw.length > n };
  }
  function count() {
    return files.reduce(function (a, f) { return a + f.chunks.length; }, 0);
  }
  function fmtBytes(n) {
    n = n || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }
  function describe() {
    if (!files.length) return "THE LOREPACK IS EMPTY. LOAD LOREPACK TO ADD MEMORY FROM THIS MACHINE.";
    var lines = files.map(function (f) {
      return f.name + " :: " + f.chunks.length + " FRAGMENTS :: " + fmtBytes(f.bytes) + (f.foundational ? " :: CANON" : "");
    });
    lines.push("TOTAL: " + files.length + " FILE" + (files.length === 1 ? "" : "S") + ", " + count() + " FRAGMENTS :: " + maxChars + "-CHAR WINDOW / " + overlap + " SENTENCE OVERLAP");
    return lines.join("\n");
  }
  function chunkList() {
    if (!index) reindex();
    return index.chunks.map(function (c, i) {
      return { id: i, file: c.file, heading: c.heading, text: c.text, foundational: !!c.foundational };
    });
  }
  function preview(query, k) {
    var hits = search(query, k || 5);
    if (!hits.length) return "";
    return hits.map(function (h, i) {
      var snippet = h.text.replace(/\s+/g, " ").slice(0, 220);
      return "[" + (i + 1) + "] " + (h.heading ? h.heading + " :: " : "") + "(score " + h.score.toFixed(2) + ")\n" + snippet;
    }).join("\n\n");
  }
  function buildContext(query, topK) {
    return Promise.resolve(null).then(function () {
      var f, c, ch;
      var canonParts = [], canonHits = [], canonTokens = 0;
      for (f = 0; f < files.length; f++) {
        if (!files[f].foundational) continue;
        for (c = 0; c < files[f].chunks.length; c++) {
          ch = files[f].chunks[c];
          canonParts.push(ch.text);
          canonTokens += COUNT(ch.text);
          canonHits.push({ id: -1, score: 0, file: files[f].name, heading: ch.heading, text: ch.text, foundational: true });
        }
      }
      var hits = search(query, topK || 6).filter(function (h) { return !h.foundational; });
      var sem = SEM(query, Math.max(3, Math.round((topK || 6) / 2))) || [];
      if (sem && typeof sem.then === "function") {
        return sem.then(function (s) { return { canonParts: canonParts, canonHits: canonHits, canonTokens: canonTokens, hits: hits, sem: (s || []).filter(function (h) { return !h.foundational; }) }; });
      }
      return { canonParts: canonParts, canonHits: canonHits, canonTokens: canonTokens, hits: hits, sem: (sem || []).filter(function (h) { return !h.foundational; }) };
    }).then(function (st) {
      var hits = st.hits;
      if (st.sem.length) hits = fuseRanks(hits, st.sem);
      var budget = Math.max(0, BUDGET() - st.canonTokens);
      var parts = [], used = 0, shown = [], i, t;
      for (i = 0; i < hits.length; i++) {
        t = COUNT(hits[i].text);
        if (used + t > budget) break;
        parts.push(hits[i].text);
        used += t;
        shown.push(hits[i]);
      }
      return { text: parts.join("\n\n---\n\n"), hits: shown, canon: st.canonParts.join("\n\n---\n\n"), canonHits: st.canonHits };
    });
  }
  function focusOn(name) {
    var f = findFile(name);
    if (!f) return Promise.resolve(false);
    focus = { name: f.name, ts: Date.now() };
    if (STORE && typeof STORE.set === "function") {
      return STORE.set("__focus__", focus).then(function () { return true; }, function () { return true; });
    }
    return Promise.resolve(true);
  }
  function clearFocus() {
    if (!focus) return Promise.resolve(false);
    focus = null;
    if (STORE && typeof STORE.delete === "function") {
      return STORE.delete("__focus__").then(function () { return true; }, function () { return true; });
    }
    return Promise.resolve(true);
  }
  function focused() {
    if (!focus) return null;
    var f = findFile(focus.name);
    return { name: focus.name, ts: focus.ts, cap: FOCUS_CAP, known: !!f, bytes: f ? f.bytes : 0, whole: !!f && f.bytes <= FOCUS_CAP };
  }
  function focusBlock() {
    if (!focus) return Promise.resolve("");
    var f = findFile(focus.name);
    if (!f) return Promise.resolve("");
    var src = source(f.name, FOCUS_CAP);
    if (!src || !src.text) return Promise.resolve("");
    return Promise.resolve("<in_focus name=\"" + f.name + "\">\n" + src.text + "\n</in_focus>\n" + (src.more ? "That is the first " + src.text.length + " of its " + src.chars + " characters; the rest was not handed over.\n" : "That is the whole of it.\n"));
  }
  function fileList() {
    return files.map(function (f) {
      return { name: f.name, chunks: f.chunks.length, bytes: f.bytes, addedAt: f.addedAt, pack: f.pack || "", origin: f.origin || "", foundational: !!f.foundational };
    });
  }
  function load() {
    if (!STORE || typeof STORE.entries !== "function") { reindex(); return Promise.resolve(false); }
    return STORE.entries().then(function (entries) {
      files = (entries || []).filter(function (e) {
        return e && e[0] !== "__focus__" && e[1] && typeof e[1].raw === "string";
      }).map(function (e) { return makeRec(e[0], e[1].raw, e[1]); });
      if (typeof STORE.get === "function") {
        return STORE.get("__focus__").then(function (rec) {
          if (rec && typeof rec.name === "string" && rec.name) focus = { name: rec.name, ts: rec.ts || Date.now() };
        }, function () {}).then(function () { return reindexAsync(); });
      }
      return reindexAsync();
    }).then(function () { return true; });
  }
  reindex();
  return {
    ingest: ingest,
    forget: forget,
    clear: clear,
    rechunk: rechunk,
    search: search,
    chunks: chunkList,
    preview: preview,
    describe: describe,
    count: count,
    files: fileList,
    source: source,
    buildContext: buildContext,
    focus: focusOn,
    unfocus: clearFocus,
    focused: focused,
    focusBlock: focusBlock,
    load: load,
    settings: function () { return { maxChars: maxChars, overlap: overlap }; }
  };
}
return { client: client };
})();
