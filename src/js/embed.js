/* ------------------------------------------------------------------
   EMBEDDINGS - the LOREPACK read by MEANING.

   The word lane (lore.js, BM25) finds a passage that shares WORDS with
   the question. This is the other lane: the one that finds the passage
   that means the same thing in different words, and that can hold a
   PICTURE beside a sentence in the same space.

   It runs on the Google (Gemini) key held in the keyring, because the
   gemini-embedding models are multi-modal: text, an image, audio, even
   a video go into ONE request, and one vector comes back for the whole
   of it. That is the point - a frame and the words she found for it
   become one point in the same space, which is what makes the graph
   underneath the LOREPACK wider than keywords.

   Two lanes are built here and named in the store:

     lore   every fragment of the LOREPACK. Merged into recall as a
            second ranking (lore.js does the merge; this module only
            answers "which fragments mean this?").
     media  every picture and clip in the vault, embedded WITH its
            prompt and with her own reading of it, so a picture can be
            found by what is in it.

   Nothing is sent anywhere except the text (or the picture) being
   embedded, and the vectors never leave this device: they live in this
   browser's IndexedDB, in the same kv-plugin store as everything else.
   A vector is only comparable with vectors of the SAME model and the
   same dimension, so both are stamped on every record and the store is
   emptied if the model changes.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var VEC_FOLDER = "embed_vectors";
  var META_FOLDER = "embed_meta";
  var PROVIDER = "google";
  var API = "https://generativelanguage.googleapis.com/v1beta";
  var META_KEY = "space";

  // What the key can reach, best first. `-2` is the multi-modal line; the `-001` models are
  // text-only but take images through `embedContent` on the newer revisions, and the oldest
  // names are only here so an old key still gets a working lane.
  var PREFERRED = [
    "gemini-embedding-2",
    "gemini-embedding-2-preview",
    "gemini-embedding-001",
    "gemini-embedding-exp-03-07",
    "text-embedding-004",
    "text-embedding-005",
    "embedding-001",
  ];

  var meta = { model: "", dim: 0, counts: {}, indexedAt: 0, multimodal: false };
  var cache = {};        // "ns:id" -> record
  var loaded = false;
  var loading = null;
  var pickPromise = null;

  function kv() {
    return (window.root && window.root.kv) || null;
  }
  function vecStore() { var k = kv(); return k ? k[VEC_FOLDER] : null; }
  function metaStore() { var k = kv(); return k ? k[META_FOLDER] : null; }
  function keyring() { return window.keyring || null; }

  function hasKey() {
    var kr = keyring();
    try { return !!(kr && kr.has && kr.has(PROVIDER)); } catch (e) { return false; }
  }

  function say(msg) { if (typeof print === "function") print("SYSTEM", msg); }
  function quiet(msg) { if (typeof backstage === "function") backstage(msg); else if (typeof print === "function") print("SYSTEM", msg); }

  /* ---- the space: which model, how many dimensions -------------------------- */

  async function call(path, body) {
    var kr = keyring();
    if (!kr || !kr.request) throw new Error("THE KEYRING IS OFFLINE.");
    var res = await kr.request(PROVIDER, API + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    var text = "";
    try { text = await res.text(); } catch (e) { text = ""; }
    var data = null;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    if (!res.ok) {
      var why = (data && data.error && data.error.message) ? data.error.message : (text || ("HTTP " + res.status));
      throw new Error(String(why).replace(/\s+/g, " ").slice(0, 200));
    }
    return data || {};
  }

  // Which embedding model this key can actually reach. The list is asked once and kept, so the
  // choice is a fact about the key rather than a guess in the source.
  async function pick(force) {
    if (!force && meta.model) return meta.model;
    var want = (typeof LIA_EMBED_MODEL === "string" && LIA_EMBED_MODEL) ? LIA_EMBED_MODEL.replace(/^models\//, "") : "";
    if (want) { meta.model = want; meta.multimodal = /embedding-2/.test(want); await saveMeta(); return want; }
    if (pickPromise && !force) return pickPromise;
    pickPromise = (async function () {
      var data = await call("/models", null);
      var list = (data && data.models) || [];
      var names = list.filter(function (m) {
        var methods = m.supportedGenerationMethods || [];
        return methods.indexOf("embedContent") !== -1 || methods.indexOf("embedText") !== -1;
      }).map(function (m) { return String(m.name || "").replace(/^models\//, ""); });
      var chosen = "";
      for (var i = 0; i < PREFERRED.length && !chosen; i++) {
        for (var j = 0; j < names.length; j++) {
          if (names[j] === PREFERRED[i]) { chosen = names[j]; break; }
        }
      }
      if (!chosen) {
        for (var k = 0; k < names.length && !chosen; k++) if (/embed/i.test(names[k])) chosen = names[k];
      }
      if (!chosen) throw new Error("THIS KEY CANNOT REACH AN EMBEDDING MODEL (THE MODELS LIST CAME BACK WITHOUT ONE).");
      meta.model = chosen;
      meta.multimodal = /embedding-2/.test(chosen);
      await saveMeta();
      return chosen;
    })().catch(function (e) { pickPromise = null; throw e; });
    return pickPromise;
  }

  function dim() {
    var d = Number(typeof LIA_EMBED_DIM === "number" ? LIA_EMBED_DIM : 3072);
    if (!isFinite(d) || d < 64) d = 3072;
    return Math.round(d);
  }

  /* ---- the calls: text, and anything else -------------------------------- */

  function configFor(taskType, extra) {
    var cfg = { taskType: taskType || "RETRIEVAL_DOCUMENT", outputDimensionality: dim() };
    if (extra) Object.keys(extra).forEach(function (k) { cfg[k] = extra[k]; });
    return cfg;
  }

  function modelPath() { return "/models/" + meta.model; }

  // One request; `parts` is anything the model accepts - { text }, { inlineData: {...} }.
  async function embedParts(parts, taskType, extra) {
    await pick();
    try {
      return await embedPartsOnce(parts, taskType, extra);
    } catch (e) {
      // A model that was chosen before (or named in config.js) may not be one THIS key can reach,
      // or may have been retired. Forget it, ask the key what it has, and try exactly once more.
      var msg = String((e && e.message) || "");
      if (meta.model && /not found|does not exist|not supported|unsupported|permission|404|invalid model/i.test(msg)) {
        console.warn("embedding model " + meta.model + " was refused - re-picking", msg);
        meta.model = ""; meta.multimodal = false;
        await saveMeta();
        await pick(true);
        return await embedPartsOnce(parts, taskType, extra);
      }
      throw e;
    }
  }

  async function embedPartsOnce(parts, taskType, extra) {
    var body = {
      model: "models/" + meta.model,
      content: { parts: parts },
      embedContentConfig: configFor(taskType, extra),
    };
    var out;
    try {
      out = await call(modelPath() + ":embedContent", body);
    } catch (e) {
      // An older revision of the API does not know embedContentConfig (or the dimension): say
      // it the plain way rather than failing the whole lane.
      if (/unknown|invalid|unsupported|not supported|field/i.test(String(e.message || ""))) {
        var plain = { model: "models/" + meta.model, content: { parts: parts } };
        var t = taskType;
        if (t && /^[A-Z_]+$/.test(t)) plain.taskType = t;
        out = await call(modelPath() + ":embedContent", plain);
      } else throw e;
    }
    var vals = (out && out.embedding && out.embedding.values) || (out && out.embeddings && out.embeddings[0] && out.embeddings[0].values);
    if (!vals || !vals.length) throw new Error("THE SERVICE RETURNED NO VECTOR.");
    return vectorOf(vals);
  }
  async function embedText(text, taskType) {
    return await embedParts([{ text: String(text == null ? "" : text) }], taskType || "RETRIEVAL_DOCUMENT");
  }

  // Several texts in one request. Falls back to one-at-a-time if the batch endpoint is not
  // available to this key, so indexing always finishes.
  async function embedTexts(texts, taskType) {
    if (!texts.length) return [];
    await pick();
    var body = {
      requests: texts.map(function (t) {
        return {
          model: "models/" + meta.model,
          content: { parts: [{ text: String(t == null ? "" : t) }] },
          embedContentConfig: configFor(taskType || "RETRIEVAL_DOCUMENT"),
        };
      }),
    };
    try {
      var out = await call(modelPath() + ":batchEmbedContents", body);
      var list = (out && out.embeddings) || [];
      if (list.length === texts.length) return list.map(function (e) { return vectorOf(e.values || []); });
    } catch (e) {
      // The fallback exists for a key that cannot reach the BATCH endpoint (an older revision of
      // the API answers with a 404 or "unsupported"). It is NOT for a key that is being REFUSED:
      // a spent quota or a rejected key fails identically for every text, so trying them one at a
      // time is a minute of silence that ends in the same error. Those go up to the caller.
      var why = String((e && e.message) || "");
      if (/quota|rate ?limit|too many requests|429|401|403|permission|api key|exceeded/i.test(why)) throw e;
      console.warn("batch embed failed - falling back to one at a time", e);
    }
    var one = [];
    for (var i = 0; i < texts.length; i++) one.push(await embedText(texts[i], taskType));
    return one;
  }

  function blobB64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var s = String(fr.result || "");
        var comma = s.indexOf(",");
        resolve(comma === -1 ? "" : s.slice(comma + 1));
      };
      fr.onerror = function () { reject(fr.error || new Error("unreadable file")); };
      fr.readAsDataURL(blob);
    });
  }

  function partForBlob(blob, mime) {
    return blobB64(blob).then(function (b64) {
      return { inlineData: { mimeType: mime || blob.type || "application/octet-stream", data: b64 } };
    });
  }

  // One vector for several sources at once - words AND a picture, say. That single call is the
  // whole reason this lane exists: the model puts them in the same place.
  async function embedMixed(parts, taskType) {
    var built = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p) continue;
      if (p.text != null) built.push({ text: String(p.text) });
      else if (p.blob) built.push(await partForBlob(p.blob, p.mime));
    }
    if (!built.length) throw new Error("NOTHING TO EMBED.");
    var extra = {};
    for (var j = 0; j < parts.length; j++) {
      if (parts[j] && parts[j].kind === "video") extra.audioTrackExtraction = true;
      if (parts[j] && parts[j].kind === "document") extra.documentOcr = true;
    }
    if (meta.multimodal === false) { extra = {}; }
    return await embedParts(built, taskType || "RETRIEVAL_DOCUMENT", Object.keys(extra).length ? extra : null);
  }

  function vectorOf(values) {
    var v = values instanceof Float32Array ? values : Float32Array.from(values);
    return v;
  }

  /* ---- the store ---------------------------------------------------------- */

  function keyOf(ns, id) { return ns + ":" + id; }

  async function load() {
    if (!loading) loading = (async function () {
      var ms = metaStore(), vs = vecStore();
      try { var m = ms ? await ms.get(META_KEY) : null; if (m && typeof m === "object") meta = Object.assign(meta, m); } catch (e) {}
      cache = {};
      if (vs) {
        try {
          var entries = await vs.entries();
          for (var i = 0; i < entries.length; i++) {
            var rec = entries[i][1];
            if (rec && rec.ns != null && rec.id != null && rec.vec) cache[keyOf(rec.ns, rec.id)] = rec;
          }
        } catch (e) { console.warn("embedding store read failed", e); }
      }
      // A vector from another model (or another size) cannot be compared with a new one.
      if (meta.model) pruneForeign();
      loaded = true;
      recount();
    })().catch(function (e) { loading = null; throw e; });
    return loading;
  }

  function recount() {
    var counts = {};
    Object.keys(cache).forEach(function (k) {
      var ns = cache[k].ns;
      counts[ns] = (counts[ns] || 0) + 1;
    });
    meta.counts = counts;
  }

  function pruneForeign() {
    Object.keys(cache).forEach(function (k) {
      var r = cache[k];
      if (r.model !== meta.model || (r.dim && meta.dim && r.dim !== meta.dim)) delete cache[k];
    });
  }

  async function saveMeta() {
    var ms = metaStore();
    if (!ms) return;
    try { await ms.set(META_KEY, { model: meta.model, dim: meta.dim, multimodal: meta.multimodal, counts: meta.counts, indexedAt: meta.indexedAt }); } catch (e) {}
  }

  async function put(ns, id, vec, extra) {
    var rec = {
      ns: ns, id: String(id), vec: vec, dim: vec.length,
      model: meta.model, ts: Date.now(),
    };
    if (extra) Object.keys(extra).forEach(function (k) { rec[k] = extra[k]; });
    cache[keyOf(ns, id)] = rec;
    if (!meta.dim) meta.dim = vec.length;
    recount();
    var vs = vecStore();
    if (vs) { try { await vs.set(keyOf(ns, id), rec); } catch (e) { console.warn("embedding store write failed", e); } }
    return rec;
  }

  async function putMany(ns, rows) {
    // rows: [{ id, vec, text, meta }]
    if (!rows.length) return 0;
    if (!meta.dim && rows[0].vec) meta.dim = rows[0].vec.length;
    var payload = rows.map(function (r) {
      return { ns: ns, id: String(r.id), vec: r.vec, dim: r.vec.length, model: meta.model, text: r.text || "", meta: r.meta || null, ts: Date.now() };
    });
    for (var i = 0; i < payload.length; i++) cache[keyOf(ns, payload[i].id)] = payload[i];
    recount();
    var vs = vecStore();
    if (vs) {
      try { await vs.setMany(payload.map(function (r) { return [keyOf(ns, r.id), r]; })); } catch (e) {
        console.warn("bulk embedding write failed - writing one at a time", e);
        for (var j = 0; j < payload.length; j++) { try { await vs.set(keyOf(ns, payload[j].id), payload[j]); } catch (e2) {} }
      }
    }
    await saveMeta();
    return rows.length;
  }

  // Empty one lane (or the whole store). Only the vectors are removed - nothing else in the
  // vault, the archive, or her memory is touched, and they can be built again at any time.
  async function clear(ns) {
    await load();
    var keys = Object.keys(cache).filter(function (k) { return !ns || cache[k].ns === ns; });
    if (!keys.length) return 0;
    var vs = vecStore();
    if (vs) {
      try {
        if (vs.deleteMany) await vs.deleteMany(keys);
        else for (var i = 0; i < keys.length; i++) await vs.delete(keys[i]);
      } catch (e) { console.warn("embedding clear failed", e); }
    }
    keys.forEach(function (k) { delete cache[k]; });
    recount();
    await saveMeta();
    return keys.length;
  }

  function cosine(a, b) {
    if (!a || !b || a.length !== b.length) return -1;
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (!na || !nb) return -1;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  function searchVec(ns, vec, k, minSim) {
    var out = [];
    Object.keys(cache).forEach(function (key) {
      var r = cache[key];
      if (r.ns !== ns || !r.vec || r.vec.length !== vec.length) return;
      if (r.model && meta.model && r.model !== meta.model) return;
      var s = cosine(vec, r.vec);
      if (s < minSim) return;
      out.push({ id: r.id, score: s, text: r.text || "", meta: r.meta || null, ts: r.ts });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, k);
  }

  /* ---- the lanes ---------------------------------------------------------- */

  function loreChunks() {
    if (!window.lore) return [];
    if (typeof window.lore.chunks === "function") return window.lore.chunks();
    return [];
  }

  function loreById() {
    var map = {};
    loreChunks().forEach(function (c) { map[String(c.id)] = c; });
    return map;
  }

  function sigOf(text) {
    var h = 2166136261;
    var s = String(text || "");
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return String(h) + ":" + s.length;
  }

  // Index the LOREPACK. Fragments already embedded (same text, same model) are skipped, so a
  // second run after adding one document only pays for the new one. When the corpus is larger
  // than LIA_EMBED_MAX, the sample is SPREAD across all of it (every k-th fragment) rather than
  // taken from the front - a capped run still covers every document, thinly.
  async function indexLore(opts) {
    opts = opts || {};
    await load();
    await pick();
    var all = loreChunks();
    var cap = Number(typeof LIA_EMBED_MAX === "number" ? LIA_EMBED_MAX : 6000);
    if (!isFinite(cap) || cap < 1) cap = 6000;
    var sampled = false, stride = 1;
    if (all.length > cap) { stride = Math.ceil(all.length / cap); sampled = true; }
    var chunks = sampled ? all.filter(function (c, i) { return i % stride === 0; }) : all;
    var todo = [];
    chunks.forEach(function (c) {
      var key = keyOf("lore", c.id);
      var have = cache[key];
      if (have && have.model === meta.model && have.sig === sigOf(c.text)) return;
      todo.push(c);
    });
    if (!todo.length) return { total: chunks.length, corpus: all.length, done: 0, skipped: chunks.length, sampled: sampled, stride: stride };
    var batch = Math.max(1, Math.round(Number(LIA_EMBED_BATCH) || 48));
    var done = 0;
    for (var i = 0; i < todo.length; i += batch) {
      var slice = todo.slice(i, i + batch);
      quiet("EMBEDDING LOREPACK :: " + (i + slice.length) + " / " + todo.length + " ...");
      var vecs = await embedTexts(slice.map(function (c) { return c.text; }), "RETRIEVAL_DOCUMENT");
      var rows = [];
      for (var j = 0; j < slice.length; j++) {
        if (!vecs[j]) continue;
        rows.push({ id: slice[j].id, vec: vecs[j], text: "", meta: { file: slice[j].file, heading: slice[j].heading || "", sig: sigOf(slice[j].text) } });
      }
      await putMany("lore", rows);
      done += rows.length;
    }
    meta.indexedAt = Date.now();
    await saveMeta();
    return { total: chunks.length, corpus: all.length, done: done, skipped: chunks.length - todo.length, sampled: sampled, stride: stride };
  }

  /* ---- A GENERIC LANE (any corpus, the same machinery) -------------------- *

     The LOREPACK and the vault each grew their own loader before there was a second thing to
     index. The DOX VIEWER (src/js/dms.js) needed the same two calls over the whole shipped
     source and the manual, so they were generalised rather than copied: `indexNs` takes
     [{ id, text, meta }] and puts vectors under a namespace, `searchNs` asks that namespace a
     question. Everything else - the model, the dimension, the store, the batching, the
     skip-what-is-already-here cache, the cosine - is the code that was already doing it.

     A CHUNK'S TEXT IS NOT STORED WITH ITS VECTOR (the same reason the LOREPACK's is not): the
     caller already holds its corpus in memory and maps an id back to it, so a second copy of
     every document is never written to the browser.
     ------------------------------------------------------------------------ */
  async function indexNs(ns, items, opts) {
    opts = opts || {};
    await load();
    var list = (items || []).filter(function (it) { return it && it.text && it.id != null; });
    if (!list.length) return { ns: ns, total: 0, done: 0, skipped: 0, failed: 0 };
    if (!meta.model) {
      try { await pick(); }
      catch (e) { return { ns: ns, total: list.length, done: 0, skipped: 0, failed: 0, error: String((e && e.message) ? e.message : e) }; }
    }
    // WHAT IS ALREADY HERE IS NOT EMBEDDED AGAIN: same id, same model, same text (the signature
    // covers the last of those), and the call is not spent. This is what makes a second run after
    // adding one document cost one document.
    var todo = [];
    list.forEach(function (it) {
      var have = cache[keyOf(ns, String(it.id))];
      if (have && have.model === meta.model && have.sig === sigOf(it.text)) return;
      todo.push(it);
    });
    if (!todo.length) return { ns: ns, total: list.length, done: 0, skipped: list.length, failed: 0 };
    var batch = Math.max(1, Math.round(Number(opts.batch) || Number(LIA_EMBED_BATCH) || 48));
    var done = 0, failed = 0, lastError = "";
    for (var i = 0; i < todo.length; i += batch) {
      var slice = todo.slice(i, i + batch);
      if (opts.onStep) { try { opts.onStep(Math.min(todo.length, i + slice.length), todo.length); } catch (e) {} }
      quiet("EMBEDDING " + String(ns).toUpperCase() + " :: " + Math.min(todo.length, i + slice.length) + " / " + todo.length + " ...");
      var vecs;
      try { vecs = await embedTexts(slice.map(function (it) { return it.text; }), "RETRIEVAL_DOCUMENT"); }
      catch (e) {
        failed += slice.length; lastError = String((e && e.message) ? e.message : e);
        // A REFUSAL IS NOT A LOST BATCH. Quota, rate limit and auth failures are about the KEY,
        // not about this slice of text, so every remaining batch would fail the same way - and
        // grinding through a hundred of them turns a clear "the quota is spent" into a minute of
        // silence and then the same answer. Stop here and say so.
        if (/quota|rate ?limit|too many requests|429|401|403|permission|api key|exceeded/i.test(lastError)) break;
        continue;
      }
      var rows = [];
      for (var j = 0; j < slice.length; j++) {
        if (!vecs[j]) continue;
        var meta2 = {};
        var m = slice[j].meta || {};
        Object.keys(m).forEach(function (k) { meta2[k] = m[k]; });
        meta2.sig = sigOf(slice[j].text);
        rows.push({ id: String(slice[j].id), vec: vecs[j], text: "", meta: meta2 });
      }
      await putMany(ns, rows);
      done += rows.length;
    }
    meta.indexedAt = Date.now();
    await saveMeta();
    return { ns: ns, total: list.length, done: done, skipped: list.length - todo.length, failed: failed, error: lastError };
  }

  // What a namespace MEANS this question. `minSim` defaults to the same floor the LOREPACK lane
  // uses, because a floor is about the model's cosines rather than about the corpus.
  async function searchNs(ns, query, k, minSim) {
    await load();
    if (!meta.model || !count(ns)) return [];
    var vec = await embedText(query, "RETRIEVAL_QUERY");
    var min = (typeof minSim === "number") ? minSim : (Number(LIA_EMBED_MIN) || 0);
    return searchVec(ns, vec, Math.max(1, k || 8), min);
  }

  // The semantic lane's answer: which fragments MEAN this question.
  async function loreSearch(query, k, minSim) {
    await load();
    if (!meta.model || !count("lore")) return [];
    var vec = await embedText(query, "RETRIEVAL_QUERY");
    var min = (typeof minSim === "number") ? minSim : (Number(LIA_EMBED_MIN) || 0);
    var hits = searchVec("lore", vec, Math.max(1, k || 6), min);
    var byId = loreById();
    return hits.map(function (h) {
      var c = byId[h.id] || {};
      return {
        id: c.id != null ? c.id : Number(h.id), score: h.score, file: c.file || (h.meta && h.meta.file) || "",
        heading: c.heading || (h.meta && h.meta.heading) || "", text: c.text || "", via: "sem",
      };
    }).filter(function (h) { return !!h.text; });
  }

  function count(ns) { return (meta.counts && meta.counts[ns]) || 0; }

  // Index the vault: every picture (and clip) with the words that belong to it - the prompt it
  // was made from, or the name it arrived as, plus her own reading of it if she has given one.
  // One vector for the whole of that, picture included.
  var CLIP_EMBED_MAX = 14 * 1024 * 1024;   // a video has to go inline in the request; big ones do not
  // A SOUND MASTER can be up to CLIP_MAX_BYTES (64 MiB) in the vault, and the embedding request is
  // inline-only with a MEASURED ceiling of 50 MiB for the whole payload - which base64 inflates by a
  // third, so a 29 MB wav (38.8 MiB encoded) goes through and a 56 MB one comes back "Request payload
  // size exceeds the limit". Over this, the record is still indexed, by her words for it and its name
  // instead of by its samples: a piece she has heard stays findable by what she heard in it.
  var MEDIA_EMBED_MAX = 34 * 1024 * 1024;

  async function indexMedia(opts) {
    opts = opts || {};
    await load();
    await pick();
    await window.media.ensure();
    var ids = window.media.list().filter(function (id) { return !(opts.ids) || opts.ids.indexOf(id) !== -1; });
    var todo = [], skippedBig = 0;
    ids.forEach(function (id) {
      var rec = window.media.get(id);
      if (!rec || !rec.blob) return;
      if (/^video\//.test(rec.mime || "") && (rec.bytes || 0) > CLIP_EMBED_MAX) { skippedBig++; return; }
      var sig = sigOf((rec.prompt || "") + "|" + (rec.name || "") + "|" + (rec.sight || "") + "|" + ((rec.heard && rec.heard.text) || "") + "|" + (rec.bytes || 0));
      var have = cache[keyOf("media", id)];
      if (have && have.model === meta.model && have.sig === sig) return;
      todo.push({ id: id, rec: rec, words: mediaWords(rec), sig: sig });
    });
    if (!todo.length) return { total: ids.length, done: 0, skipped: ids.length, tooBig: skippedBig };
    var done = 0, failed = 0, wordsOnly = 0, lastError = "";
    for (var i = 0; i < todo.length; i++) {
      var t = todo[i];
      var tooBigForSound = (t.rec.bytes || 0) > MEDIA_EMBED_MAX;
      quiet("EMBEDDING VAULT :: " + (i + 1) + " / " + todo.length + " :: " + (t.rec.name || t.rec.prompt || t.id)
        + (tooBigForSound ? " :: TOO BIG TO SEND, SO HER WORDS FOR IT GO IN ALONE" : ""));
      try {
        var kind = /^video\//.test(t.rec.mime || "") ? "video" : null;
        var parts = [{ text: t.words.text || t.rec.name || "image" }];
        if (!tooBigForSound) parts.push({ blob: t.rec.blob, mime: t.rec.mime, kind: kind });
        var vec = await embedMixed(parts, "RETRIEVAL_DOCUMENT");
        await put("media", t.id, vec, { sig: t.sig, name: t.rec.name || "", prompt: t.rec.prompt || "", kind: t.rec.kind || "", mime: t.rec.mime || "" });
        if (tooBigForSound) wordsOnly++;
        done++;
      } catch (e) {
        failed++;
        lastError = String((e && e.message) ? e.message : e);
      }
    }
    await saveMeta();
    return { total: ids.length, done: done, skipped: ids.length - todo.length, failed: failed, tooBig: skippedBig, wordsOnly: wordsOnly, error: lastError };
  }

  function mediaWords(rec) {
    var bits = [];
    if (rec.prompt) bits.push("made from the prompt: " + rec.prompt);
    if (rec.name) bits.push("file: " + rec.name);
    if (rec.kind === "attach") bits.push("(a picture Patrikios attached)");
    if (rec.kind === "video") bits.push("(a video clip)");
    if (rec.note) bits.push(rec.note);
    if (rec.sight) bits.push("what it shows: " + rec.sight);
    if (/^audio\//.test(String(rec.mime || ""))) bits.push("(a recording)");
    if (rec.heard && rec.heard.text) bits.push("what she heard in it: " + rec.heard.text);
    return { text: bits.join(". ") };
  }

  // Which pictures in the vault are LIKE this question - by what is in them, not by their names.
  async function findMedia(query, k) {
    await load();
    if (!meta.model || !count("media")) return [];
    var vec = await embedText(query, "RETRIEVAL_QUERY");
    var min = Number(LIA_EMBED_MIN) || 0;
    return searchVec("media", vec, Math.max(1, k || 6), Math.max(0, min - 0.06)).map(function (h) {
      var rec = window.media ? window.media.get(h.id) : null;
      return {
        id: h.id, score: h.score, name: (rec && rec.name) || (h.meta && h.meta.name) || h.id,
        prompt: (rec && rec.prompt) || (h.meta && h.meta.prompt) || "", kind: (rec && rec.kind) || "",
        mime: (rec && rec.mime) || "",
      };
    });
  }

  async function init() {
    try { await load(); } catch (e) { console.warn("embedding lane init failed", e); }
    return { model: meta.model, dim: meta.dim, counts: meta.counts };
  }

  function statusText() {
    if (!hasKey()) {
      return "EMBEDDING LANE :: NO GOOGLE (GEMINI) KEY IS HELD. THE KEYS PANEL TAKES ONE (IT STARTS AIza). "
        + "WITHOUT IT, RECALL IS WORD-ONLY (BM25) AND THE VAULT HAS NO MEANING INDEX - EVERYTHING ELSE WORKS AS BEFORE.";
    }
    var counts = meta.counts || {};
    var lines = ["EMBEDDING LANE :: " + (meta.model ? meta.model.toUpperCase() : "MODEL NOT CHOSEN YET - /embed MODEL PICKS ONE")
      + (meta.dim ? " :: " + meta.dim + "-DIMENSIONAL" : "")
      + (meta.multimodal ? " :: MULTI-MODAL" : "")];
    var lore = window.lore ? window.lore.chunks().length : 0;
    var capN = (typeof LIA_EMBED_MAX === "number") ? LIA_EMBED_MAX : 6000;
    lines.push("  LOREPACK   :: " + (counts.lore || 0) + " / " + lore + " FRAGMENTS EMBEDDED"
      + (lore > capN ? "  (LIA_EMBED_MAX IS " + capN + " - A FULL RUN SAMPLES EVERY DOCUMENT RATHER THAN THE FIRST " + capN + ")" : ""));
    var vault = window.media ? window.media.list().length : 0;
    lines.push("  VAULT      :: " + (counts.media || 0) + " / " + vault + " PICTURES AND CLIPS EMBEDDED");
    lines.push("  THE LOREPACK IS ALSO READ BY WORDS (BM25); THE TWO RANKINGS ARE MERGED, SO RECALL FINDS A PASSAGE "
      + "THAT SHARES NO WORDS WITH THE QUESTION AS WELL AS ONE THAT DOES.");
    // Any other namespace (the DOX VIEWER's corpus is `docs`) - reported rather than hidden, so a
    // lane that was built is visible in the one place that says what the embedding store holds.
    Object.keys(counts).forEach(function (ns) {
      if (ns === "lore" || ns === "media") return;
      var held = 0;
      try { held = ns === "docs" && window.dms && window.dms.chunks ? window.dms.chunks().length : 0; } catch (e) { held = 0; }
      lines.push("  " + String(ns).toUpperCase().padEnd(11, " ") + ":: " + counts[ns] + " VECTORS"
        + (held ? " / " + held + " DOC FRAGMENTS" : ""));
    });
    if (!counts.lore) lines.push("  /embed now    index the LOREPACK (this spends key calls and takes a while)");
    else if ((counts.lore || 0) < lore) lines.push("  /embed now    " + (lore - counts.lore) + " FRAGMENT(S) ARE NOT EMBEDDED YET");
    if (!counts.media) lines.push("  /embed media  embed every picture and clip in the vault, with her reading of it");
    else if ((counts.media || 0) < vault) lines.push("  /embed media  " + (vault - counts.media) + " PICTURE(S) ARE NOT EMBEDDED YET");
    lines.push("  /embed find <WORDS>   ask the meaning lane directly :: /embed clear [lore|media]   empty it");
    return lines.join("\n");
  }

  function summary() {
    if (!hasKey()) return "EMBEDDING LANE :: OFF (NO GOOGLE KEY)";
    var c = meta.counts || {};
    return "EMBEDDING LANE :: " + (meta.model ? meta.model.toUpperCase() : "NO MODEL YET")
      + (meta.dim ? " " + meta.dim + "D" : "")
      + " :: " + (c.lore || 0) + " LORE / " + (c.media || 0) + " VAULT VECTORS";
  }

  window.embed = {
    init: init,
    ready: function () { return !!meta.model && hasKey(); },
    available: hasKey,
    model: function () { return meta.model; },
    dim: function () { return meta.dim; },
    pick: pick,
    embedText: embedText,
    embedTexts: embedTexts,
    embedMixed: embedMixed,
    embedBlob: function (blob, mime, taskType) { return embedMixed([{ blob: blob, mime: mime }], taskType); },
    count: count,
    meta: function () { return { model: meta.model, dim: meta.dim, counts: meta.counts, multimodal: !!meta.multimodal, indexedAt: meta.indexedAt }; },
    indexLore: indexLore,
    indexMedia: indexMedia,
    loreSearch: loreSearch,
    findMedia: findMedia,
    search: searchVec,
    // A generic lane over any corpus (the DOX VIEWER, src/js/dms.js): put [{ id, text, meta }]
    // under a namespace, then ask that namespace a question. Same model, same store, same cache.
    indexNs: indexNs,
    searchNs: searchNs,
    clear: clear,
    statusText: statusText,
    summary: summary,
  };
})();
