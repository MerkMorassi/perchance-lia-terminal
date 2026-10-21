/* ------------------------------------------------------------------
   MYTHOS LOREPACK READER — READ-ONLY.

   Imports a pre-built MYTHOS lorem pack (.jsonl / .jsonl.gz) into this
   browser and reads it back: O(1) sigil teleport (NumMarkX), the s/r/o
   triplet graph, and a lexical scan over the chunk text. Nothing here
   MINTS a pack - no chunking, no embeddings, no graph building. The
   write side lives in the MYTHOS LOREPACK FACTORY:
     https://github.com/MerkMorassi/MYTHOS-LOREPACK-FACTORY-MVP
   Format + integrity rules vendored from that repo's monolithic build
   (monolithic/js/lorepack.js: SimpleDB, parseRecord, integrity gate).
   Wire format, one JSON object per line:
     { v:2, type:"vector", id, a:AGENT, h:handle, t:text, vec:[...],
       m:numMarkId, d:{ locus, embeddingModel, embeddingDimension, ... },
       src?:provenance, ts?:epochMs }
     { type:"edge", id, aid:AGENT, src:<vectorId>, s, r, o, timestamp }
   `src`/`ts` on a vector are optional carry-through fields: the factory's TS
   core stamps them, its monolithic build does not, so a pack may be either
   shape. Audited against the factory's `main` @ e6a9c9e (2026-09-18): the
   monolithic producer is byte-identical across the last three commits, and
   the only later changes there were UI/model-management, so packs stay
   compatible.

   Commands: /pack · /pack import · /pack split · /pack search <q> · /pack graph <term>
             /pack index <AGENT> · /pack export <AGENT> ·
             /pack drop <PACK> yes · /pack dropfile ·
             /pack forget <AGENT> yes · /pack nuke yes
             /agents · /agents <ID|NAME|PORT>  (the canonical agent manifest)

   The roster also has a WIRE FORM: rosterPayload() emits THE ALIA ROSTER LOG v1 -
   the same sixteen, one JSON object per line, canonical key order, with the
   manifest's provenance on every line. "bridge" mode emits the six-field transit
   envelope from the standing order. See the function.

   Rows carry the pack they came from (`pack` / `packedAt`, stamped at import),
   so a pack can be taken back out as a pack - by name (`dropPack`) or by
   handing the file back (`dropPackFile`, which scans it for the ids it
   declares). Either way an exact id set is removed, the ledger is recomputed
   from the store, and the locus is refolded or un-indexed to match.

   The loci are named by the factory's canonical roster (its src/agents.ts),
   vendored here as src/mythos/agents.json: 16 agents, order 0-15, each with a
   port, a role, a lore policy and the system_instruction the factory stamps it
   with. The manifest is NAMING ONLY - nothing here validates a pack against it
   and reading it writes nothing. A held locus that is not on the roster is
   reported as such, and the roster's own agents are listed whether or not a
   pack for them has ever arrived here.

   Integrity gate: one pack carries ONE embedding space, and every edge's
   `src` must resolve to a vector id carried by that same pack. A pack that
   fails is rejected whole - nothing is left written.
   The LOCUS of each record comes from the record itself (`a` / `aid`), so no
   agent is chosen at import time and a mixed pack fans out to several loci.
   (The FACTORY UI is the opposite: the agent selected in its picker is
   stamped onto every record and the file's own agent fields are ignored there
   - choose the right one in the factory, or the pack lands under a wrong name.)
   Streams without materialising the store: imports, counts and lexical scans
   walk IndexedDB cursors, so reading a very large pack does not need a
   same-size JS array.
   `trace(query)` is the read-only probe behind the terminal's SEARCH LOG -
   it runs search() plus a per-word edge probe and returns counts, not prose.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var DB_NAME = "lia_mythos";
  var DB_VERSION = 1;
  var VS = "vectors";
  var ES = "edges";
  var PS = "packs";
  var FLUSH_EVERY = 500;
  var SCAN_CAP = 40000;
  var INDEX_DOC_CHARS = 1400000;
  var INDEX_DOC_MAX = 12;
  var ROSTER_PATH = "src/mythos/agents.json";

  var db = null;
  var opening = null;
  var roster = null;        // the canonical agent manifest, read once
  var rosterLoading = null;

  function idb() {
    if (db) return Promise.resolve(db);
    if (opening) return opening;
    if (!window.indexedDB) return Promise.reject(new Error("IndexedDB unavailable in this browser."));
    opening = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains(VS)) {
          var v = d.createObjectStore(VS, { keyPath: "id" });
          v.createIndex("agentId", "agentId", { unique: false });
          v.createIndex("numMarkId", "numMarkId", { unique: false });
          v.createIndex("markKey", "markKey", { unique: false });
        }
        if (!d.objectStoreNames.contains(ES)) {
          var e = d.createObjectStore(ES, { keyPath: "id" });
          e.createIndex("agentId", "agentId", { unique: false });
          e.createIndex("sourceId", "sourceId", { unique: false });
        }
        if (!d.objectStoreNames.contains(PS)) d.createObjectStore(PS, { keyPath: "id" });
      };
      req.onsuccess = function () { db = req.result; resolve(db); };
      req.onerror = function () { reject(req.error || new Error("Could not open the reader store.")); };
    });
    return opening;
  }

  function tx(store, mode) {
    return db.transaction(store, mode).objectStore(store);
  }

  function putMany(store, rows) {
    if (!rows.length) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var t = db.transaction(store, "readwrite");
      var s = t.objectStore(store);
      for (var i = 0; i < rows.length; i++) s.put(rows[i]);
      t.oncomplete = function () { resolve(); };
      t.onerror = function () { reject(t.error || new Error("write failed")); };
      t.onabort = function () { reject(t.error || new Error("write aborted")); };
    });
  }

  function putBoth(vRows, eRows) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction([VS, ES], "readwrite");
      var vs = t.objectStore(VS);
      var es = t.objectStore(ES);
      for (var i = 0; i < vRows.length; i++) vs.put(vRows[i]);
      for (var j = 0; j < eRows.length; j++) es.put(eRows[j]);
      t.oncomplete = function () { resolve(); };
      t.onerror = function () { reject(t.error || new Error("write failed")); };
      t.onabort = function () { reject(t.error || new Error("write aborted")); };
    });
  }

  function deleteKeys(store, keys) {
    if (!keys.length) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var t = db.transaction(store, "readwrite");
      var s = t.objectStore(store);
      for (var i = 0; i < keys.length; i++) s.delete(keys[i]);
      t.oncomplete = function () { resolve(); };
      t.onerror = function () { reject(t.error || new Error("delete failed")); };
      t.onabort = function () { reject(t.error || new Error("delete aborted")); };
    });
  }

  function byIndex(store, index, value) {
    return new Promise(function (resolve, reject) {
      var out = [];
      var req = tx(store, "readonly").index(index).openCursor(IDBKeyRange.only(value));
      req.onsuccess = function () {
        var c = req.result;
        if (!c) { resolve(out); return; }
        out.push(c.value);
        c.continue();
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function everyRow(store) {
    return new Promise(function (resolve, reject) {
      var req = tx(store, "readonly").getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  // Cursor walk - the memory-safe way to count or scan a large store. The
  // callback sees one value at a time and returns false to stop early; the
  // promise resolves with the number of values visited.
  function walkCursor(req, cb) {
    return new Promise(function (resolve, reject) {
      var n = 0;
      req.onsuccess = function () {
        var c = req.result;
        if (!c) { resolve(n); return; }
        n++;
        if (cb) {
          var cont = true;
          try { cont = cb(c.value) !== false; } catch (e) { reject(e); return; }
          if (!cont) { resolve(n); return; }
        }
        c.continue();
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function walk(store, cb) {
    return walkCursor(tx(store, "readonly").openCursor(), cb);
  }

  function walkIndex(store, index, value, cb) {
    return walkCursor(tx(store, "readonly").index(index).openCursor(IDBKeyRange.only(value)), cb);
  }

  function allKeys(store) {
    return new Promise(function (resolve, reject) {
      var req = tx(store, "readonly").getAllKeys();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function normAgent(id) { return String(id || "").trim().toUpperCase(); }

  function isValidVector(v) {
    if (!Array.isArray(v) || !v.length) return false;
    for (var i = 0; i < v.length; i++) {
      var n = v[i];
      if (typeof n !== "number" || !isFinite(n)) return false;
    }
    return true;
  }

  // The pack's own sigil key (its `m` field), and the NumMarkX ASCII key.
  function genSigil(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
  }

  function markKeyOf(text) {
    var clean = String(text || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    if (!clean || clean.length > 100) return "";
    var out = "";
    for (var i = 0; i < clean.length; i++) out += String(clean.charCodeAt(i)).padStart(3, "0");
    return out;
  }

  // Same FNV-1a as packs.js, so a re-fold of identical text is a cheap no-op.
  function fnv(text) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16) + ":" + text.length;
  }

  function tokenize(s) {
    var m = String(s).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019\-]*/gu);
    return m ? m.filter(function (t) { return t.length > 1 || /\d/.test(t); }) : [];
  }

  function streamOf(file) {
    if (file.stream) return file.stream();
    return new Response(file).body;
  }

  function looksLikeText(bytes) {
    var text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch (e) { text = new TextDecoder("utf-8").decode(bytes); }
    var trimmed = text.replace(/^\uFEFF/, "").trimStart();
    if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") return true;
    if (!text.length) return true;
    var printable = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.codePointAt(i);
      if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127 && c !== 0xfffd)) printable++;
    }
    return printable / text.length >= 0.95;
  }

  // Content first, name second. A pack named .gz whose bytes are not actually
  // gzip (plain JSONL, or zlib / raw deflate) must not die on DecompressionStream's
  // "incorrect header check" - the factory's importer trusts the extension and does.
  // The rule set is the factory's own sniffing rule set (37766b5, "advanced lorepack
  // decompression"), so a pack and a reader agree on every shape the factory can write:
  // gzip (1f 8b), zlib (78 xx with a valid check), anything that is not text at all
  // (raw deflate), and plain text. The name is only a fallback for a head we cannot
  // read, because a name is a claim and the bytes are the fact.
  async function detectCompression(file) {
    try {
      var head = new Uint8Array(await file.slice(0, 128).arrayBuffer());
      if (head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b) return "gzip";
      if (head.length >= 2 && head[0] === 0x78 && ((head[0] << 8) | head[1]) % 31 === 0) return "deflate";
      if (!looksLikeText(head)) return "deflate-raw";
      return null;
    } catch (e) {
      return /\.gz$/i.test(file.name || "") ? "gzip" : null;
    }
  }

  // One line -> { vector } or { edge }. Throws with a real line number.
  function parseRecord(record, lineNumber) {
    if (!record || typeof record !== "object") throw new Error("Line " + lineNumber + ": record is not an object.");

    if (record.type === "edge") {
      if (!record.id || !record.src || !record.aid ||
        typeof record.s !== "string" || typeof record.r !== "string" || typeof record.o !== "string" ||
        !record.s.trim() || !record.r.trim() || !record.o.trim()) {
        throw new Error("Line " + lineNumber + ": invalid edge record.");
      }
      return {
        edge: {
          id: String(record.id),
          type: "edge",
          agentId: normAgent(record.aid),
          sourceId: String(record.src),
          s: record.s.trim(),
          r: record.r.trim(),
          o: record.o.trim(),
          timestamp: record.timestamp || new Date().toISOString(),
          model: record.model || ""
        }
      };
    }

    var node;
    if (record.v === 2) {
      node = {
        id: record.id || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)),
        agentId: normAgent(record.a),
        agentHandle: record.h || "",
        text: record.t,
        vector: record.vec,
        numMarkId: record.m || "",
        metadata: record.d || {},
        source: record.src || "",
        timestamp: typeof record.ts === "number" ? record.ts : undefined
      };
    } else {
      node = {
        id: record.id || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)),
        agentId: normAgent(record.agentId || record.a),
        agentHandle: record.agentHandle || record.h || "",
        text: record.text,
        vector: record.vector || record.vec,
        numMarkId: record.numMarkId || record.m || "",
        metadata: record.metadata || record.d || {},
        source: record.source || "",
        timestamp: record.timestamp
      };
    }

    if (!node.agentId) throw new Error("Line " + lineNumber + ": vector agent id missing.");
    if (typeof node.text !== "string" || !node.text.trim()) throw new Error("Line " + lineNumber + ": vector text invalid.");
    if (!isValidVector(node.vector)) throw new Error("Line " + lineNumber + ": vector is missing, empty, non-numeric, or malformed.");

    var metadata = (node.metadata && typeof node.metadata === "object") ? Object.assign({}, node.metadata) : {};
    var dimension = metadata.embeddingDimension;
    if (dimension !== undefined && Number(dimension) !== node.vector.length) throw new Error("Line " + lineNumber + ": embedding dimension metadata mismatch.");
    node.metadata = metadata;
    return { vector: node };
  }

  async function importFile(file, onProgress) {
    if (!file) throw new Error("No file given.");
    await idb();
    var name = String(file.name || "lorepack.jsonl");
    var compression = await detectCompression(file);
    var gz = !!compression;
    var stream = streamOf(file);
    if (compression) {
      if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unzip .gz - send the plain .jsonl instead.");
      stream = stream.pipeThrough(new DecompressionStream(compression));
    }
    var reader = stream.pipeThrough(new TextDecoderStream()).getReader();

    var buffer = "";
    var linesRead = 0;
    var recordsRead = 0;
    var bad = [];
    var ids = new Set();
    var edgeIds = new Set();
    var dims = new Set();
    var models = new Set();
    var dimLines = {};
    var modelLines = {};
    var agents = new Set();
    var edgeSources = [];
    var vBatch = [];
    var eBatch = [];
    var writtenVectors = 0;
    var writtenEdges = 0;
    var vectorIdsWritten = [];
    var edgeIdsWritten = [];
    // Provenance: every row remembers which pack brought it in, so a pack can
    // later be taken back out as a pack (see dropPack / dropPackFile below).
    var importedAt = Date.now();
    // Snapshot the store BEFORE the first byte is written, so a rollback only
    // ever removes rows this import created: re-imports stay idempotent and a
    // rejected pack can never take pre-existing data down with it.
    var preexisting = {
      v: new Set(await allKeys(VS).catch(function () { return []; })),
      e: new Set(await allKeys(ES).catch(function () { return []; }))
    };

    async function rollback() {
      await deleteKeys(VS, vectorIdsWritten.filter(function (id) { return !preexisting.v.has(id); })).catch(function () {});
      await deleteKeys(ES, edgeIdsWritten.filter(function (id) { return !preexisting.e.has(id); })).catch(function () {});
    }

    async function flush() {
      if (!vBatch.length && !eBatch.length) return;
      await putBoth(vBatch, eBatch);
      writtenVectors += vBatch.length;
      writtenEdges += eBatch.length;
      vBatch = [];
      eBatch = [];
      if (onProgress) onProgress({ lines: linesRead, vectors: writtenVectors, edges: writtenEdges });
      if (writtenVectors && writtenVectors % 5000 === 0) print("SYSTEM", "READING " + name + " :: " + writtenVectors + " FRAGMENTS SO FAR...");
    }

    function consume(line, lineNumber) {
      var trimmed = line.trim();
      if (!trimmed) return false;
      var entry;
      try {
        entry = JSON.parse(trimmed);
      } catch (e) {
        throw new Error("Line " + lineNumber + ": not valid JSON.");
      }
      var parsed = parseRecord(entry, lineNumber);

      if (parsed.edge) {
        var eg = parsed.edge;
        if (edgeIds.has(eg.id)) throw new Error('Line ' + lineNumber + ': duplicate edge id "' + eg.id + '".');
        edgeIds.add(eg.id);
        edgeSources.push({ id: eg.id, sourceId: eg.sourceId });
        eg.pack = name;
        eg.packedAt = importedAt;
        eBatch.push(eg);
        edgeIdsWritten.push(eg.id);
        return true;
      }

      var node = parsed.vector;
      if (ids.has(node.id)) throw new Error('Line ' + lineNumber + ': duplicate vector id "' + node.id + '".');
      ids.add(node.id);
      var dim = node.vector.length;
      if (!dimLines[dim]) dimLines[dim] = { line: lineNumber, id: node.id, agentId: node.agentId };
      dims.add(dim);
      if (dims.size > 1) {
        throw new Error("Line " + lineNumber + ": vectors mix embedding dimensions - one pack, one space ("
          + Object.keys(dimLines).map(function (d) {
            return d + "-D first on line " + dimLines[d].line + " (" + dimLines[d].agentId + " / " + dimLines[d].id + ")";
          }).join(", ") + "). Hand the file to /pack split first - it comes back as one importable pack per space.");
      }
      var mdl = node.metadata && node.metadata.embeddingModel;
      if (mdl) {
        if (!modelLines[mdl]) modelLines[mdl] = { line: lineNumber, id: node.id };
        models.add(mdl);
        if (models.size > 1) {
          throw new Error("Line " + lineNumber + ": vectors mix embedding models - one pack, one space ("
            + Object.keys(modelLines).map(function (m) { return m + " first on line " + modelLines[m].line; }).join(", ")
            + "). Hand the file to /pack split first - it comes back as one importable pack per space.");
        }
      }
      node.markKey = markKeyOf(node.text);
      if (!node.markKey) delete node.markKey;
      agents.add(node.agentId);
      node.pack = name;
      node.packedAt = importedAt;
      vBatch.push(node);
      vectorIdsWritten.push(node.id);
      return true;
    }

    try {
      while (true) {
        var step = await reader.read();
        if (step.done) break;
        buffer += step.value;
        var parts = buffer.split(/\r?\n/);
        buffer = parts.pop() || "";
        for (var i = 0; i < parts.length; i++) {
          linesRead++;
          if (consume(parts[i], linesRead)) recordsRead++;
          if (vBatch.length + eBatch.length >= FLUSH_EVERY) await flush();
        }
      }
      if (buffer.trim()) {
        linesRead++;
        if (consume(buffer, linesRead)) recordsRead++;
      }
      await flush();
    } catch (err) {
      bad.push(err && err.message ? err.message : String(err));
    }

    if (bad.length) {
      // All or nothing: nothing from a rejected file stays in the store.
      await rollback();
      throw new Error(bad[0] + (bad.length > 1 ? " (+" + (bad.length - 1) + " more)" : ""));
    }
    if (!recordsRead) throw new Error("No records found. Nothing was imported.");

    var missing = edgeSources.filter(function (e) { return !ids.has(e.sourceId); });
    if (missing.length) {
      await rollback();
      throw new Error("Import rejected: " + missing.length + " edge(s) point at a vector that is not in this pack (e.g. " + missing[0].id + " -> " + missing[0].sourceId + ").");
    }

    var stamp = Date.now();
    var rows = [];
    agents.forEach(function (aid) {
      rows.push({
        id: name + "::" + aid,
        name: name,
        agentId: aid,
        bytes: file.size || 0,
        gz: gz,
        importedAt: stamp,
        vectors: 0,
        edges: 0,
        docNames: []
      });
    });
    var counts = {};
    var agentSet = {};
    rows.forEach(function (r) { agentSet[r.agentId] = true; });
    await walk(VS, function (r) { if (agentSet[r.agentId]) counts[r.agentId] = (counts[r.agentId] || 0) + 1; });
    var priorPacks = {};
    await everyRow(PS).then(function (all) {
      all.forEach(function (p) { if (p.id === p.name + "::" + p.agentId) priorPacks[p.id] = p; });
    });
    rows.forEach(function (r) {
      r.vectors = counts[r.agentId] || 0;
      r.edges = 0;
      var prior = priorPacks[r.id];
      if (prior && prior.docNames) r.docNames = prior.docNames;
    });
    await walk(ES, function (e) {
      rows.forEach(function (r) { if (r.agentId === e.agentId) r.edges++; });
    });
    await putMany(PS, rows);

    return {
      name: name,
      gz: gz,
      lines: linesRead,
      vectors: writtenVectors,
      edges: writtenEdges,
      agents: Array.from(agents).sort(),
      models: Array.from(models),
      dims: Array.from(dims)
    };
  }

  async function agents() {
    await idb();
    var out = {};
    function slot(aid) {
      out[aid] = out[aid] || { agentId: aid, vectors: 0, edges: 0, packs: [] };
      return out[aid];
    }
    await walk(VS, function (r) { slot(r.agentId).vectors++; });
    await walk(ES, function (e) { slot(e.agentId).edges++; });
    await walk(PS, function (p) {
      slot(p.agentId).packs.push({ name: p.name, at: p.importedAt, bytes: p.bytes, gz: p.gz, docNames: p.docNames || [] });
    });
    return Object.keys(out).sort().map(function (k) { return out[k]; });
  }

  // ---- the canonical agent manifest ---------------------------------------
  // Who each locus IS. Entries 0-14 are vendored verbatim from the factory's
  // src/agents.ts, so a pack's `a` / `aid` field resolves to a name, a role and a
  // lore policy rather than a bare string. Order 15 is a local rewrite: upstream
  // stamps it NULL, here it is OPERATOR, the resident AI of this STAGE (the file's
  // own `local` field records that). This is a naming authority only: the reader
  // never checks a pack against it and never writes from it.
  function loadRoster() {
    if (roster) return Promise.resolve(roster);
    if (rosterLoading) return rosterLoading;
    rosterLoading = (async function () {
      var out = { agents: [], byId: {}, source: "", local: "", failed: "" };
      try {
        var res = await fetch(ROSTER_PATH, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var man = await res.json();
        if (man && man.source) out.source = String(man.source);
        if (man && man.local) out.local = String(man.local);
        var raw = (man && man.agents) || [];
        for (var i = 0; i < raw.length; i++) {
          var a = raw[i] || {};
          if (!a.id) continue;
          var rec = {
            order: (typeof a.order === "number") ? a.order : i,
            name: String(a.name || a.id), id: String(a.id),
            handle: String(a.handle || a.name || a.id),
            port: (typeof a.port === "number") ? a.port : 0,
            role: String(a.role || ""), revision: String(a.revision || ""),
            tone: String((a.meta && a.meta.tone) || ""),
            constraints: ((a.meta && a.meta.constraints) || []).map(String),
            description: String((a.meta && a.meta.description) || ""),
            read: ((a.lore_policy && a.lore_policy.read) || []).map(String),
            write: ((a.lore_policy && a.lore_policy.write) || []).map(String),
            instruction: String(a.system_instruction || "")
          };
          out.agents.push(rec);
          out.byId[rec.id.toUpperCase()] = rec;
        }
        out.agents.sort(function (x, y) { return x.order - y.order; });
      } catch (e) {
        out.failed = (e && e.message) ? e.message : String(e);
        console.warn("agent manifest unavailable :: " + out.failed);
      }
      roster = out;
      return roster;
    })();
    return rosterLoading;
  }

  // Same lookups the factory's getCanonicalAgentById accepts, plus a port:
  // id, handle, name, `agent-<x>`, or 4000-4015. Case-insensitive.
  function canonicalAgent(q) {
    if (!roster) return null;
    var clean = String(q == null ? "" : q).trim();
    if (!clean) return null;
    var port = Number(clean);
    if (isFinite(port) && port > 0) {
      for (var p = 0; p < roster.agents.length; p++) if (roster.agents[p].port === port) return roster.agents[p];
      // A PORT is 4000-4015; the ORDER is 0-15. A bare integer that is not a port
      // is read as the ORDER - the canonical index, and the first thing anyone
      // types (/agents 13). Until this, an order answered NO SUCH CANONICAL AGENT
      // while every line of the roster printed that same number in front of the name.
      if (port >= 0 && port <= roster.agents.length - 1) {
        for (var k = 0; k < roster.agents.length; k++) if (roster.agents[k].order === port) return roster.agents[k];
      }
    }
    var lower = clean.toLowerCase();
    var stripped = lower.replace(/^agent-/, "");
    var cands = [lower, stripped, "agent-" + stripped];
    for (var i = 0; i < roster.agents.length; i++) {
      var a = roster.agents[i];
      if (cands.indexOf(a.id.toLowerCase()) !== -1
        || cands.indexOf(a.handle.toLowerCase()) !== -1
        || cands.indexOf(a.name.toLowerCase()) !== -1) return a;
    }
    return null;
  }

  function policyText(v) {
    return (v && v.length ? v.join(" / ") : "none").toUpperCase();
  }

  // The whole roster, each agent annotated with whether a pack for it is in this
  // browser - and the reverse: loci held here that the roster does not name.
  async function rosterText() {
    var r = await loadRoster();
    if (!r.agents.length) {
      return "AGENT MANIFEST UNAVAILABLE :: " + (r.failed || "EMPTY") + "\n"
        + "IT SHIPS IN " + ROSTER_PATH + " (VENDORED FROM THE FACTORY'S src/agents.ts :: " + r.source + ").";
    }
    var held = await agents();
    var byAgent = {};
    held.forEach(function (g) { byAgent[String(g.agentId).toUpperCase()] = g; });
    var lines = ["MYTHOS AGENT MANIFEST :: " + r.agents.length + " CANONICAL AGENTS, ORDER "
      + r.agents[0].order + "-" + r.agents[r.agents.length - 1].order];
    r.agents.forEach(function (a) {
      var g = byAgent[a.id.toUpperCase()];
      lines.push("  " + a.order + " " + a.id + " :: " + a.role
        + (g ? " :: HELD HERE " + g.vectors + " FRAG / " + g.edges + " EDGE" : ""));
    });
    var known = {};
    r.agents.forEach(function (a) { known[a.id.toUpperCase()] = 1; });
    var strangers = held.filter(function (g) { return !known[String(g.agentId).toUpperCase()]; });
    if (strangers.length) {
      lines.push("LOCI HELD HERE THAT THE MANIFEST DOES NOT NAME :: "
        + strangers.map(function (g) { return g.agentId + " (" + g.vectors + " FRAG / " + g.edges + " EDGE)"; }).join(", "));
    }
    lines.push("SOURCE :: " + (r.source || ROSTER_PATH));
    if (r.local) lines.push("ORDER 15 IS A LOCAL REWRITE :: UPSTREAM STAMPS IT NULL; ON THIS STAGE IT IS THE OPERATOR. SEE \"local\" IN " + ROSTER_PATH + ".");
    lines.push("/agents <ID|NAME|ORDER|PORT> FOR ONE AGENT IN FULL. NAMING MANIFEST ONLY - IT VALIDATES NOTHING AND WRITES NOTHING.");
    lines.push("THE SAME " + r.agents.length + " AS A PAYLOAD :: mythos.rosterPayload() - THE ALIA ROSTER LOG (ONE JSON OBJECT PER LINE, ORDER " + r.agents[0].order + "-" + r.agents[r.agents.length - 1].order + "); PASS \"bridge\" FOR THE SIX-FIELD TRANSIT ENVELOPE.");
    return lines.join("\n");
  }

  async function rosterAgent(q) {
    var r = await loadRoster();
    if (!r.agents.length) return "AGENT MANIFEST UNAVAILABLE :: " + (r.failed || "EMPTY");
    var a = canonicalAgent(q);
    if (!a) {
      var miss = String(q == null ? "" : q).trim().toLowerCase();
      return "NO SUCH CANONICAL AGENT :: " + miss.toUpperCase()
        + (miss === "null" ? "\nUPSTREAM'S ORDER 15 IS NULL :: A RESERVED PORT THAT LEAVES NO RECORD. ON THIS STAGE ORDER 15 IS THE OPERATOR :: /agents 4015." : "")
        + "\n/agents LISTS THE " + r.agents.length + " AGENTS IN " + ROSTER_PATH + ".";
    }
    var held = await agents();
    var g = null;
    for (var i = 0; i < held.length; i++) {
      if (String(held[i].agentId).toUpperCase() === a.id.toUpperCase()) g = held[i];
    }
    var lines = [
      "AGENT " + a.order + " OF " + (r.agents.length - 1) + " :: " + a.id + " :: " + a.name,
      "  ROLE      " + a.role,
      "  HANDLE    " + a.handle + " :: PORT " + a.port + " :: REVISION " + (a.revision || "-"),
      "  TONE      " + (a.tone || "-"),
      "  LORE      READ " + policyText(a.read) + " :: WRITE " + policyText(a.write)
    ];
    if (a.constraints.length) lines.push("  BOUND     " + a.constraints.join(" / "));
    if (a.description) lines.push("  ABOUT     " + a.description);
    lines.push("  STAMPED   \"" + a.instruction + "\"");
    lines.push(g
      ? "  HELD HERE :: " + g.vectors + " FRAG / " + g.edges + " EDGE"
        + (g.packs.length ? " :: " + g.packs.map(function (p) { return p.name + (p.gz ? " [GZ]" : ""); }).join(", ") : "")
        + (g.packs.some(function (p) { return (p.docNames || []).length; }) ? " :: IN HER RETRIEVAL INDEX" : "")
      : "  HELD HERE :: NOTHING. NO PACK FOR THIS LOCUS HAS ARRIVED IN THIS BROWSER.");
    return lines.join("\n");
  }

  // ---- THE ROSTER LOG (ALIA ROSTER LOG v1) -------------------------------
  // THE WAY AN ALIA IS LOGGED, and the only shape this terminal ever emits for
  // transit. One JSON object per line, LF, canonical key order, no pretty
  // printing - so a log can be `tail`ed, `grep`ed and concatenated, and a diff
  // of two logs is a diff of two LISTS rather than of two formatted files.
  //
  //   mode "full"   THE REGISTER - fourteen keys, in this order:
  //                 order, name, id, handle, port, role, revision, tone,
  //                 constraints[], description, read[], write[], instruction,
  //                 source
  //   mode "bridge" THE TRANSIT ENVELOPE of Order v1.0 section 17 - six keys:
  //                 schema, id, handle, order, role, source
  //
  // TWO THINGS ARE DELIBERATE. (1) `source` rides on every line, in both
  // modes: a line lifted out of the file still says where the naming came
  // from, so a payload that reaches another room cannot be mistaken for that
  // room's own authority. (2) The bridge envelope carries NO
  // `system_instruction` - a stamp is the receiving locus's own business, and
  // a payload that ships everyone's stamps is a payload nobody trusts. The
  // register keeps it; the envelope does not.
  //
  // Read-only, like every other export here: this READS the manifest and
  // writes nothing anywhere (see the header - the reader names, the factory
  // mints).
  function rosterLines(mode) {
    if (!roster) return [];
    var bridge = (mode === "bridge" || mode === "transit");
    var src = roster.source || ROSTER_PATH;
    return roster.agents.map(function (a) {
      if (bridge) {
        return {
          schema: "alia-roster/1", id: a.id, handle: a.handle,
          order: a.order, role: a.role, source: src
        };
      }
      return {
        order: a.order, name: a.name, id: a.id, handle: a.handle, port: a.port,
        role: a.role, revision: a.revision, tone: a.tone,
        constraints: a.constraints.slice(), description: a.description,
        read: a.read.slice(), write: a.write.slice(),
        instruction: a.instruction, source: src
      };
    });
  }

  function rosterPayload(mode) {
    if (!roster) return "";
    return rosterLines(mode).map(function (r) { return JSON.stringify(r); }).join("\n") + "\n";
  }

  // Sigil-prefix teleport: idb range over the pack's own `m` (sigil) field.
  function bySigilPrefix(store, sig, cap) {
    return new Promise(function (resolve, reject) {
      var out = [];
      var hi = sig + String.fromCharCode(0xffff);
      var req = tx(store, "readonly").index("numMarkId").openCursor(IDBKeyRange.bound(sig, hi));
      req.onsuccess = function () {
        var c = req.result;
        if (!c || out.length >= (cap || 20)) { resolve(out); return; }
        out.push(c.value);
        c.continue();
      };
      req.onerror = function () { reject(req.error); };
    });
  }
  async function vectorsOf(agentId) {
    await idb();
    return byIndex(VS, "agentId", normAgent(agentId));
  }

  async function edgesOf(agentId) {
    await idb();
    return byIndex(ES, "agentId", normAgent(agentId));
  }

  async function teleport(text, agentId) {
    await idb();
    var key = markKeyOf(text);
    var sig = genSigil(text);
    var found = [];
    var seen = new Set();
    function take(list) {
      list.forEach(function (r) {
        if (seen.has(r.id)) return;
        if (agentId && r.agentId !== normAgent(agentId)) return;
        seen.add(r.id);
        found.push(r);
      });
    }
    if (key) take(await byIndex(VS, "markKey", key));
    if (!found.length && sig) {
      take(await byIndex(VS, "numMarkId", sig));
    }
    // Sigil prefix: the pack's own `m` field is genSigil(text), so a range
    // scan teleports to every chunk whose text begins with the query.
    if (!found.length && sig.length >= 6) {
      take(await bySigilPrefix(VS, sig, 8).catch(function () { return []; }));
    }
    return found;
  }

  async function graphHits(term, agentId, limit) {
    var q = String(term || "").trim().toLowerCase();
    if (!q) return [];
    var pool = agentId ? await edgesOf(agentId) : await everyRow(ES);
    var out = [];
    for (var i = 0; i < pool.length && out.length < (limit || 12); i++) {
      var e = pool[i];
      if (e.s.toLowerCase().indexOf(q) === -1 && e.r.toLowerCase().indexOf(q) === -1 && e.o.toLowerCase().indexOf(q) === -1) continue;
      out.push(e);
    }
    return out;
  }

  function scoreText(text, terms, q) {
    var low = String(text || "").toLowerCase();
    var s = 0;
    for (var t = 0; t < terms.length; t++) {
      var at = low.indexOf(terms[t]);
      if (at === -1) continue;
      s += 1 + (at === 0 ? 0.5 : 0);
    }
    if (q.length > 3 && low.indexOf(q) !== -1) s += 4;
    return s;
  }

  function byScore(a, b) { return b.score - a.score; }

  // Lexical scan over the chunk text, scored inline, so only the running top
  // few rows are ever held. SCAN_CAP still bounds the walk.
  async function lexicalScan(query, agentId, limit) {
    await idb();
    var terms = tokenize(query);
    var q = String(query).toLowerCase().trim();
    var k = limit || 6;
    var top = [];
    var scanned = 0;
    function consider(r) {
      scanned++;
      var s = scoreText(r.text, terms, q);
      if (s > 0) {
        top.push({ row: r, score: s });
        if (top.length > 64) { top.sort(byScore); top = top.slice(0, k); }
      }
      return scanned < SCAN_CAP;
    }
    if (agentId) await walkIndex(VS, "agentId", normAgent(agentId), consider);
    else await walk(VS, consider);
    top.sort(byScore);
    return { hits: top.slice(0, k), scanned: scanned };
  }

  async function search(query, opts) {
    opts = opts || {};
    await idb();
    var q = String(query || "").trim();
    var out = { query: q, agent: opts.agent ? normAgent(opts.agent) : "", exact: [], graph: [], lexical: [], scanned: 0 };
    if (!q) return out;

    out.exact = await teleport(q, opts.agent);
    out.graph = await graphHits(q, opts.agent, 10);
    var lex = await lexicalScan(q, opts.agent, opts.limit || 6);
    out.scanned = lex.scanned;
    out.lexical = lex.hits;
    return out;
  }

  // One turn's pack-side trace, for the terminal's SEARCH LOG. Structured, not
  // formatted - the chat layer prints it beside the archive retrieval it actually
  // fed her. The sigil probe is the exact/prefix teleport; GRAPH probes the pack's
  // edges with each distinctive word of the query (a whole sentence never matches
  // an edge's s/r/o, so per-word is the honest reading); the lexical scan is the
  // same inline-scored walk `/pack search` uses.
  var STOPWORDS = { that: 1, this: 1, with: 1, what: 1, your: 1, have: 1, from: 1, they: 1, will: 1, would: 1, there: 1, their: 1, about: 1, which: 1, when: 1, then: 1, them: 1, these: 1, those: 1, into: 1, just: 1, like: 1, some: 1, more: 1, most: 1, been: 1, were: 1, does: 1, dont: 1, here: 1, know: 1, tell: 1, make: 1, well: 1, than: 1, also: 1, only: 1, over: 1, very: 1, much: 1, many: 1, could: 1, should: 1, being: 1 };

  async function trace(query, opts) {
    opts = opts || {};
    var t0 = performance.now();
    var q = String(query || "");
    var res = await search(q, { limit: opts.limit || 4 });
    var loci = await agents();
    var sig = genSigil(q);
    var mode = "";
    if (res.exact.length) mode = (sig && res.exact.some(function (r) { return (r.numMarkId || "") === sig; })) ? "EXACT" : "PREFIX";
    var terms = tokenize(q).filter(function (t) { return t.length >= 4 && !STOPWORDS[t]; }).slice(0, 8);
    var seen = {};
    var nodes = [];
    for (var i = 0; i < terms.length; i++) {
      var gh = await graphHits(terms[i], "", 6);
      for (var j = 0; j < gh.length; j++) {
        if (seen[gh[j].id]) continue;
        seen[gh[j].id] = 1;
        nodes.push({ term: terms[i], s: gh[j].s, r: gh[j].r, o: gh[j].o, agentId: gh[j].agentId });
      }
    }
    return {
      query: q,
      ms: Math.round((performance.now() - t0) * 10) / 10,
      loci: loci.map(function (g) { return { agentId: g.agentId, vectors: g.vectors, edges: g.edges }; }),
      fragments: loci.reduce(function (n, g) { return n + g.vectors; }, 0),
      edges: loci.reduce(function (n, g) { return n + g.edges; }, 0),
      sigilMode: mode,
      sigil: res.exact.slice(0, 3).map(function (r) { return { agentId: r.agentId, text: r.text }; }),
      graphN: nodes.length,
      graph: nodes.slice(0, 4),
      lexicalN: res.lexical.length,
      lexicalTop: res.lexical[0] ? res.lexical[0].score : 0,
      scanned: res.scanned,
      terms: terms
    };
  }

  async function indexAgent(agentId, opts) {
    opts = opts || {};
    if (!window.lore) throw new Error("The LORE index is offline.");
    var aid = normAgent(agentId);
    var rows = await vectorsOf(aid);
    if (!rows.length) throw new Error("Nothing loaded for " + (aid || "(no agent)") + ".");
    var chunks = rows.map(function (r) { return String(r.text || "").trim(); }).filter(Boolean);
    var docs = [];
    var buf = "";
    for (var i = 0; i < chunks.length; i++) {
      if (buf && buf.length + chunks[i].length + 2 > INDEX_DOC_CHARS) { docs.push(buf); buf = ""; }
      buf += (buf ? "\n\n" : "") + chunks[i];
      if (buf.length >= INDEX_DOC_CHARS) { docs.push(buf); buf = ""; }
    }
    if (buf) docs.push(buf);
    var dropped = 0;
    if (docs.length > INDEX_DOC_MAX) { dropped = docs.length - INDEX_DOC_MAX; docs = docs.slice(0, INDEX_DOC_MAX); }

    var names = [];
    var added = 0, kept = 0, updated = 0;
    for (var d = 0; d < docs.length; d++) {
      var nm = "MYTHOS." + aid + ".LOREPACK" + (docs.length > 1 ? "." + (d + 1) : "");
      var res = await window.lore.ingest(nm, docs[d], { pack: "LOREPACK", origin: "pack:" + aid, hash: fnv(docs[d]) });
      names.push(nm);
      if (res && res.status === "kept") kept++;
      else if (res && res.status === "updated") updated++;
      else added++;
    }

    var packRows = (await everyRow(PS)).filter(function (p) { return p.agentId === aid; });
    var previous = [];
    packRows.forEach(function (p) {
      (p.docNames || []).forEach(function (n) { if (previous.indexOf(n) === -1) previous.push(n); });
    });
    // A refold can yield fewer documents than the last one - a pack was dropped,
    // or the fragments came back shorter. Whatever is no longer there has to
    // leave the index too, or her recall keeps quoting text the store no longer
    // holds.
    var stale = previous.filter(function (n) { return names.indexOf(n) === -1; });
    for (var s = 0; s < stale.length; s++) {
      try { if (window.lore.unindex) await window.lore.unindex(stale[s]); else await window.lore.forgetFile(stale[s]); } catch (e) {}
    }
    if (packRows.length) {
      packRows.forEach(function (p) { p.docNames = names; });
      await putMany(PS, packRows);
    }
    return { agent: aid, fragments: rows.length, docs: docs.length, added: added, updated: updated, kept: kept, dropped: dropped, stale: stale, names: names };
  }

  async function exportAgent(agentId) {
    await idb();
    var aid = normAgent(agentId);
    if (!aid) throw new Error("Name an agent: /pack export <AGENT>.");
    var rows = await vectorsOf(aid);
    if (!rows.length) throw new Error("Nothing loaded for " + aid + ".");
    var edges = await edgesOf(aid);
    var ids = new Set(rows.map(function (r) { return r.id; }));
    var orphans = edges.filter(function (e) { return !ids.has(e.sourceId); });
    if (orphans.length) throw new Error("Refusing to export: " + orphans.length + " edge(s) reference missing vectors.");

    var encoder = new TextEncoder();
    var stream = new ReadableStream({
      start: function (controller) {
        try {
          for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var vec = {
              v: 2, type: "vector", id: r.id, a: r.agentId, h: r.agentHandle || "", t: r.text, vec: r.vector, m: r.numMarkId || "", d: r.metadata || {}
            };
            if (r.source) vec.src = r.source;
            if (typeof r.timestamp === "number") vec.ts = r.timestamp;
            controller.enqueue(encoder.encode(JSON.stringify(vec) + "\n"));
          }
          for (var j = 0; j < edges.length; j++) {
            var e = edges[j];
            var edg = {
              v: 2, type: "edge", id: e.id, aid: e.agentId, src: e.sourceId, s: e.s, r: e.r, o: e.o, timestamp: e.timestamp
            };
            if (e.model) edg.model = e.model;
            controller.enqueue(encoder.encode(JSON.stringify(edg) + "\n"));
          }
          controller.close();
        } catch (err) { controller.error(err); }
      }
    });
    var useGz = typeof CompressionStream !== "undefined";
    var finalStream = useGz ? stream.pipeThrough(new CompressionStream("gzip")) : stream;
    var blob = await new Response(finalStream).blob();
    var stamp = new Date().toISOString().slice(0, 10);
    return { blob: blob, name: "MYTHOS.LORE." + aid + ".LOREPACK." + stamp + ".jsonl" + (useGz ? ".gz" : ""), vectors: rows.length, edges: edges.length };
  }

  // ---- the factory's gate, mirrored --------------------------------------
  // A pack that fails here is refused WHOLE by the LOREPACK FACTORY: its importer
  // collects every record, then aborts the entire import if a single one is bad
  // ("Import integrity failure: N record(s) rejected"). This reader is deliberately
  // more tolerant than that - it takes what it can read - which is exactly why a pack
  // can live here and still be turned away there. So before a pack is sent outward,
  // it goes through the same gate the factory will run on it. The rules are taken
  // from that repo's own importer (`monolithic/js/lorepack.js` and
  // `src/lorepack-factory.ts`) and audited against main @ 462ff87.
  var FACTORY_MODEL = "gemini-embedding-2";

  function factoryGate(rows, edges) {
    var errors = [];
    var ids = new Set();
    var edgeIds = new Set();
    var dims = new Set();
    var models = new Set();
    var noId = 0;

    rows.forEach(function (r, i) {
      var where = "FRAGMENT " + (i + 1) + (r.text ? " (" + String(r.text).replace(/\s+/g, " ").slice(0, 28) + ")" : "");
      if (!r.id || typeof r.id !== "string") {
        noId++;
        if (errors.length < 20) errors.push(where + " :: NO id FIELD. THE FACTORY KEYS EVERY FRAGMENT BY ID AND EVERY EDGE NAMES ONE - A FRAGMENT WITHOUT AN ID MAKES THE WHOLE PACK UNREADABLE THERE.");
      } else if (ids.has(r.id)) {
        if (errors.length < 20) errors.push(where + " :: DUPLICATE FRAGMENT ID " + r.id);
      } else {
        ids.add(r.id);
      }
      if (typeof r.text !== "string" || !r.text.trim()) {
        if (errors.length < 20) errors.push(where + " :: TEXT MISSING OR EMPTY");
      }
      if (!isValidVector(r.vector)) {
        if (errors.length < 20) errors.push(where + " :: VECTOR MISSING, EMPTY OR NOT ALL NUMBERS");
      } else {
        dims.add(r.vector.length);
      }
      var md = (r.metadata && typeof r.metadata === "object") ? r.metadata : {};
      if (md.embeddingModel) {
        models.add(md.embeddingModel);
        if (md.embeddingModel !== FACTORY_MODEL) {
          if (errors.length < 20) errors.push(where + ' :: STAMPED "' + md.embeddingModel + '" - THE FACTORY ACCEPTS ONLY "' + FACTORY_MODEL + '"');
        }
      }
      if (md.embeddingDimension !== undefined && Array.isArray(r.vector) && Number(md.embeddingDimension) !== r.vector.length) {
        if (errors.length < 20) errors.push(where + " :: DIMENSION METADATA SAYS " + md.embeddingDimension + ", THE VECTOR IS " + r.vector.length);
      }
    });

    edges.forEach(function (e, i) {
      var where = "EDGE " + (i + 1);
      if (!e.id || !e.sourceId || !e.agentId || typeof e.s !== "string" || typeof e.r !== "string" || typeof e.o !== "string" ||
        !e.s.trim() || !e.r.trim() || !e.o.trim()) {
        if (errors.length < 20) errors.push(where + " :: MALFORMED - id, src, aid, s, r AND o ARE ALL REQUIRED AND NON-EMPTY");
      }
      if (edgeIds.has(e.id)) {
        if (errors.length < 20) errors.push(where + " :: DUPLICATE EDGE ID " + e.id);
      } else {
        edgeIds.add(e.id);
      }
      if (!ids.has(e.sourceId)) {
        if (errors.length < 20) errors.push(where + " :: NAMES FRAGMENT " + String(e.sourceId).slice(0, 8) + "... WHICH IS NOT IN THIS PACK. THIS IS THE USUAL KILLER - A FRAGMENT THAT LOST ITS id, SO THE EDGES THAT NAME IT POINT AT NOTHING.");
      }
    });

    if (dims.size > 1) errors.push("THE PACK MIXES EMBEDDING DIMENSIONS (" + Array.from(dims).join(", ") + ") - ONE PACK, ONE SPACE.");
    if (models.size > 1) errors.push("THE PACK MIXES EMBEDDING MODELS (" + Array.from(models).join(", ") + ") - ONE PACK, ONE SPACE.");

    return {
      ok: !errors.length,
      errors: errors,
      vectors: rows.length,
      edges: edges.length,
      dims: Array.from(dims),
      models: Array.from(models),
      missingIds: noId
    };
  }

  async function factoryCheck(agentId) {
    var aid = normAgent(agentId);
    if (!aid) throw new Error("Name an agent: /pack check <AGENT>.");
    var rows = await vectorsOf(aid);
    if (!rows.length) throw new Error("Nothing loaded for " + aid + ".");
    var edges = await edgesOf(aid);
    var g = factoryGate(rows, edges);
    g.agent = aid;
    var idSet = new Set(rows.map(function (r) { return r.id; }));
    g.orphans = edges.filter(function (e) { return !idSet.has(e.sourceId); }).length;
    return g;
  }

  // The half of the trip no gate on this side can see: the factory's CURRENT
  // importer (`src/lorepack-factory.ts`) first reads what that agent already holds
  // in ITS vault and takes the first record as the baseline, then refuses every
  // incoming record that disagrees with it:
  //     detectedDimension = existing[0].vector.length
  //     detectedModel     = existing[0].metadata?.embeddingModel || null
  // So a pack that is perfectly formed is still turned away - with an error that
  // blames the pack - if that agent's factory vault already holds records from an
  // older ingest made with a different model or dimension. Measured, not guessed.
  var VAULT_NOTE = "THE FACTORY'S MAIN IMPORTER CHECKS THIS PACK AGAINST WHAT THAT AGENT ALREADY HOLDS IN ITS VAULT, NOT JUST ITSELF: IT TAKES THE FIRST RECORD IT FINDS FOR THE AGENT AS THE BASELINE (MODEL AND DIMENSION) AND REFUSES THE WHOLE PACK IF ANYTHING DISAGREES - AND THE ERROR NAMES THE PACK, NOT THE OLD RECORD. IF THIS PACK LOOKS CLEAN HERE AND STILL WON'T GO IN: IMPORT UNDER A FRESH AGENT, EMPTY THAT AGENT IN THE FACTORY FIRST, OR USE THE FACTORY'S MONOLITHIC VIEW (WHICH ONLY CHECKS THE FILE ITSELF).";

  async function reportCheck(agentId) {
    if (!agentId || /^all$/i.test(agentId)) {
      var list = await agents();
      if (!list.length) return "NO PACKS IMPORTED INTO THIS BROWSER.";
      var lines = [];
      for (var i = 0; i < list.length; i++) {
        var g = await factoryCheck(list[i].agentId);
        lines.push((g.ok ? "PASS " : "FAIL ") + g.agent + " :: " + g.vectors + " FRAG / " + g.edges + " EDGE"
          + (g.dims.length ? " :: " + g.dims.join("/") + "-D" : "")
          + (g.models.length ? " :: " + g.models.join("/") : "")
          + (g.ok ? "" : " :: " + g.errors.length + " PROBLEM" + (g.errors.length === 1 ? "" : "S")));
      }
      return "FACTORY PRE-FLIGHT :: " + list.length + " LOCUS\n" + lines.join("\n")
        + "\n/pack check <AGENT> FOR THE DETAIL.\n" + VAULT_NOTE;
    }
    var g = await factoryCheck(agentId);
    var head = "FACTORY PRE-FLIGHT :: " + g.agent + " :: " + g.vectors + " FRAGMENT" + (g.vectors === 1 ? "" : "S") + " / " + g.edges + " EDGE"
      + "\nSHAPE :: " + (g.dims.length ? g.dims.join("/") + "-D" : "NO VECTOR DIMENSION") + " :: " + (g.models.length ? g.models.join(", ") : "NO EMBEDDING MODEL STAMPED");
    if (g.ok) {
      return head + "\nGATE PASSED :: THE FACTORY'S OWN RULES ACCEPT THIS PACK AS IT STANDS"
        + (g.models.indexOf(FACTORY_MODEL) === -1 ? " - NOTE THAT NOTHING HERE IS STAMPED " + FACTORY_MODEL + ", WHICH IS FINE: THE FACTORY DEFAULTS AN UNSTAMPED VECTOR TO IT." : ".")
        + "\n/pack export " + g.agent + " TO ROUND-TRIP IT OUT.\n" + VAULT_NOTE;
    }
    var seen = {};
    var shown = g.errors.filter(function (t) { if (t === null) return false; if (seen[t]) return false; seen[t] = 1; return true; }).slice(0, 12);
    return head + "\nGATE FAILED :: THE FACTORY WOULD REFUSE THE WHOLE PACK (" + g.errors.length + " PROBLEM" + (g.errors.length === 1 ? "" : "S") + "), NOT JUST THESE LINES:"
      + "\n" + shown.join("\n")
      + (g.errors.length > shown.length ? "\n... AND " + (g.errors.length - shown.length) + " MORE" : "")
      + "\nA PACK IS ALL-OR-NOTHING THERE: ONE BAD LINE REJECTS EVERY LINE. NOTHING HERE IS DAMAGED - THIS IS A READING, NOT A WRITE.";
  }

  async function forgetAgent(agentId) {
    await idb();
    var aid = normAgent(agentId);
    if (!aid) throw new Error("Name an agent: /pack forget <AGENT> yes.");
    var vKeys = (await vectorsOf(aid)).map(function (r) { return r.id; });
    var eKeys = (await edgesOf(aid)).map(function (r) { return r.id; });
    var packRows = (await everyRow(PS)).filter(function (p) { return p.agentId === aid; });
    var docNames = [];
    packRows.forEach(function (p) { (p.docNames || []).forEach(function (n) { if (docNames.indexOf(n) === -1) docNames.push(n); }); });
    await deleteKeys(VS, vKeys);
    await deleteKeys(ES, eKeys);
    await deleteKeys(PS, packRows.map(function (p) { return p.id; }));
    var unindexed = 0;
    if (window.lore) {
      for (var i = 0; i < docNames.length; i++) {
        try { await window.lore.forgetFile(docNames[i]); unindexed++; } catch (e) {}
      }
    }
    return { agent: aid, vectors: vKeys.length, edges: eKeys.length, unindexed: unindexed, docNames: docNames };
  }

  // ---- taking a pack back out -------------------------------------------
  // A pack is the unit that arrives, so it is the unit that should be able to
  // leave: an updated BARBELO pack must be able to supersede the one already in
  // the store without dragging her older fragments along with it. There are two
  // ways in, because there are two kinds of knowledge:
  //   * by name - every row carries the pack it came from (`pack` / `packedAt`,
  //     stamped at import), so the store can answer for itself;
  //   * by file - a pack file declares every id it contains, which is the only
  //     attribution available for rows imported before stamping existed.
  // Both remove an exact id set, then settle the two things that outlive a row:
  // the pack ledger and the LORE documents folded from those fragments. Neither
  // can reach another pack's rows for the same locus.
  var pendingDrop = false;
  var pendingSplit = false;

  // Read a pack without writing anything: which ids does it declare? Same
  // sniffing and same parser as the importer, so what it reports is exactly what
  // an import would have written.
  async function scanFile(file, onProgress) {
    if (!file) throw new Error("No file given.");
    var compression = await detectCompression(file);
    var stream = streamOf(file);
    if (compression) {
      if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unzip .gz - send the plain .jsonl instead.");
      stream = stream.pipeThrough(new DecompressionStream(compression));
    }
    var reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    var buffer = "";
    var linesRead = 0;
    var recordsRead = 0;
    var vectorIds = [];
    var edgeIds = [];
    var agents = {};
    var dims = {};

    function consume(line, lineNumber) {
      var trimmed = line.trim();
      if (!trimmed) return false;
      var entry;
      try { entry = JSON.parse(trimmed); } catch (e) { throw new Error("Line " + lineNumber + ": not valid JSON."); }
      var parsed = parseRecord(entry, lineNumber);
      if (parsed.edge) {
        edgeIds.push(parsed.edge.id);
        agents[parsed.edge.agentId] = true;
        return true;
      }
      var node = parsed.vector;
      vectorIds.push(node.id);
      agents[node.agentId] = true;
      dims[node.vector.length] = true;
      return true;
    }

    var bad = null;
    try {
      while (true) {
        var step = await reader.read();
        if (step.done) break;
        buffer += step.value;
        var parts = buffer.split(/\r?\n/);
        buffer = parts.pop() || "";
        for (var i = 0; i < parts.length; i++) {
          linesRead++;
          if (consume(parts[i], linesRead)) recordsRead++;
        }
        if (onProgress && !(linesRead % 4000)) onProgress({ lines: linesRead, vectors: vectorIds.length, edges: edgeIds.length });
      }
      if (buffer.trim()) {
        linesRead++;
        if (consume(buffer, linesRead)) recordsRead++;
      }
    } catch (err) {
      bad = err && err.message ? err.message : String(err);
    }
    if (bad) throw new Error(bad);
    if (!recordsRead) throw new Error("No records found in " + (file.name || "that file") + ".");
    return {
      name: String(file.name || "lorepack.jsonl"),
      lines: linesRead,
      records: recordsRead,
      vectorIds: vectorIds,
      edgeIds: edgeIds,
      agents: Object.keys(agents).sort(),
      dims: Object.keys(dims).map(Number)
    };
  }

  // Split a pack file by embedding space WITHOUT importing it: one download
  // per (dimension, model) group, lines byte-identical to the file, edges
  // travelling with the vectors they name. The importer's whole-or-nothing
  // rule is honoured - a line that is not a valid record, or a duplicate id,
  // refuses the split, and nothing downloads. Edges whose source vector is in
  // no group could never have imported anyway (the importer rejects orphan
  // edges), so they are left out and named, not silently duplicated.
  async function splitFile(file, onProgress) {
    if (!file) throw new Error("No file given.");
    var compression = await detectCompression(file);
    var stream = streamOf(file);
    if (compression) {
      if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unzip .gz - send the plain .jsonl instead.");
      stream = stream.pipeThrough(new DecompressionStream(compression));
    }
    var reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    var buffer = "";
    var linesRead = 0;
    var groups = {};
    var order = [];
    var edges = [];
    var edgeSeen = {};
    var agents = {};

    function consume(line, lineNumber) {
      var trimmed = line.trim();
      if (!trimmed) return false;
      var entry;
      try { entry = JSON.parse(trimmed); } catch (e) { throw new Error("Line " + lineNumber + ": not valid JSON."); }
      var parsed = parseRecord(entry, lineNumber);
      if (parsed.edge) {
        if (edgeSeen[parsed.edge.id]) throw new Error("Line " + lineNumber + ": duplicate edge id \"" + parsed.edge.id + "\".");
        edgeSeen[parsed.edge.id] = true;
        edges.push({ line: trimmed, id: parsed.edge.id, sourceId: parsed.edge.sourceId });
        agents[parsed.edge.agentId] = true;
        return true;
      }
      var node = parsed.vector;
      var mdl = (node.metadata && node.metadata.embeddingModel) || "";
      var key = node.vector.length + "|" + mdl;
      var g = groups[key];
      if (!g) {
        g = groups[key] = { dim: node.vector.length, model: mdl, lines: [], vectors: 0, ids: {}, agents: {} };
        order.push(key);
      }
      if (g.ids[node.id]) throw new Error("Line " + lineNumber + ": duplicate vector id \"" + node.id + "\".");
      g.ids[node.id] = true;
      g.lines.push(trimmed);
      g.vectors++;
      g.agents[node.agentId] = true;
      agents[node.agentId] = true;
      return true;
    }

    var bad = null;
    try {
      while (true) {
        var step = await reader.read();
        if (step.done) break;
        buffer += step.value;
        var parts = buffer.split(/\r?\n/);
        buffer = parts.pop() || "";
        for (var i = 0; i < parts.length; i++) {
          linesRead++;
          consume(parts[i], linesRead);
        }
        if (onProgress && !(linesRead % 4000)) onProgress({ lines: linesRead, groups: order.length });
      }
      if (buffer.trim()) {
        linesRead++;
        consume(buffer, linesRead);
      }
    } catch (err) {
      bad = err && err.message ? err.message : String(err);
    }
    try { reader.cancel(); } catch (e) {}
    if (bad) throw new Error(bad);
    if (!order.length) throw new Error("No vector records found in " + (file.name || "that file") + " - nothing to split by.");

    var dropped = [];
    edges.forEach(function (e) {
      for (var i = 0; i < order.length; i++) {
        if (groups[order[i]].ids[e.sourceId]) {
          groups[order[i]].lines.push(e.line);
          return;
        }
      }
      dropped.push(e);
    });

    var out = order.map(function (key) {
      var g = groups[key];
      var edgeCount = 0;
      return {
        dim: g.dim,
        model: g.model,
        vectors: g.vectors,
        edges: g.lines.length - g.vectors,
        agents: Object.keys(g.agents).sort(),
        lines: g.lines
      };
    });
    return {
      name: String(file.name || "lorepack.jsonl"),
      lines: linesRead,
      groups: out,
      droppedEdges: dropped.slice(0, 10).map(function (e) { return e.id + " -> " + e.sourceId; }),
      droppedCount: dropped.length,
      agents: Object.keys(agents).sort()
    };
  }

  // Hand the file picker to a split instead of an import: the file that was
  // rejected for mixing embedding spaces is handed straight back, and comes
  // out as one importable pack per space.
  function pickSplit() {
    var input = document.getElementById("mythosInput");
    if (!input) throw new Error("No file picker on this page.");
    pendingSplit = true;
    input.click();
    return true;
  }

  // Delete an exact id set. Ids that are not held are simply not there to
  // remove - this is a subtraction, not a check.
  async function removeRows(vIds, eIds) {
    await idb();
    var vSet = {}, eSet = {};
    (vIds || []).forEach(function (id) { vSet[id] = true; });
    (eIds || []).forEach(function (id) { eSet[id] = true; });
    var hitV = [], hitE = [], loci = {};
    await walk(VS, function (r) {
      if (vSet[r.id]) { hitV.push(r.id); loci[r.agentId] = true; }
    });
    await walk(ES, function (r) {
      if (eSet[r.id]) { hitE.push(r.id); loci[r.agentId] = true; }
    });
    await deleteKeys(VS, hitV);
    await deleteKeys(ES, hitE);
    return { vectors: hitV.length, edges: hitE.length, loci: Object.keys(loci).sort() };
  }

  // What would a name-based drop take? Rows stamped with that pack, the ledger
  // lines that describe it, and a note about rows of the same locus that predate
  // stamping and therefore cannot be attributed to any pack.
  async function packRowsOf(packName, agentId) {
    await idb();
    var want = String(packName || "").trim();
    var aid = agentId ? normAgent(agentId) : "";
    var vIds = [], eIds = [], loci = {}, unstamped = {};
    await walk(VS, function (r) {
      if (aid && r.agentId !== aid) return;
      if (r.pack === want) { vIds.push(r.id); loci[r.agentId] = true; }
      else if (!r.pack) { var k = r.agentId || "(none)"; unstamped[k] = (unstamped[k] || 0) + 1; }
    });
    await walk(ES, function (r) {
      if (aid && r.agentId !== aid) return;
      if (r.pack === want) { eIds.push(r.id); loci[r.agentId] = true; }
      else if (!r.pack) { var k2 = r.agentId || "(none)"; unstamped[k2] = (unstamped[k2] || 0) + 1; }
    });
    var ledger = (await everyRow(PS)).filter(function (p) {
      return p.name === want && (!aid || p.agentId === aid);
    });
    return {
      name: want,
      vectors: vIds,
      edges: eIds,
      loci: Object.keys(loci).sort(),
      ledger: ledger,
      unstamped: Object.keys(unstamped).sort().map(function (k) { return { agentId: k, rows: unstamped[k] }; })
    };
  }

  // The ledger is an index, not the truth: after a removal its counts are
  // recomputed from the store, and a pack whose rows are all gone loses its line.
  async function syncLedger(agentIds, droppedPacks) {
    await idb();
    var rows = await everyRow(PS);
    var dropped = {};
    (droppedPacks || []).forEach(function (n) { dropped[n] = true; });
    var gone = [], keep = [], loci = {};
    rows.forEach(function (p) {
      if (dropped[p.name]) { gone.push(p.id); return; }
      keep.push(p);
    });
    (agentIds || []).forEach(function (a) { if (a) loci[a] = true; });
    keep.forEach(function (p) { loci[p.agentId] = true; });
    var vc = {}, ec = {};
    await walk(VS, function (r) { if (loci[r.agentId]) vc[r.agentId] = (vc[r.agentId] || 0) + 1; });
    await walk(ES, function (e) { if (loci[e.agentId]) ec[e.agentId] = (ec[e.agentId] || 0) + 1; });
    keep.forEach(function (p) {
      p.vectors = vc[p.agentId] || 0;
      p.edges = ec[p.agentId] || 0;
    });
    await deleteKeys(PS, gone);
    await putMany(PS, keep);
    return { droppedPacks: gone.length };
  }

  async function orphanCount() {
    var held = {};
    await walk(VS, function (r) { held[r.id] = true; });
    var n = 0;
    await walk(ES, function (e) { if (!held[e.sourceId]) n++; });
    return n;
  }

  // Settle a locus after its rows have changed: if fragments remain, refold the
  // LORE documents from what is left; if nothing remains, take those documents
  // out of the index.
  async function settleLocus(agentId) {
    var aid = normAgent(agentId);
    var vectors = await vectorsOf(aid);
    var edges = await edgesOf(aid);
    var out = { agent: aid, vectors: vectors.length, edges: edges.length, indexed: null, forgotten: [] };
    if (!window.lore) return out;
    if (vectors.length) {
      out.indexed = await indexAgent(aid);
      return out;
    }
    var names = [];
    if (window.lore.packOf) {
      try {
        var lp = window.lore.packOf("LOREPACK") || { docs: [] };
        (lp.docs || []).forEach(function (d) {
          var mine = (d.origin === "pack:" + aid) || String(d.name || "").indexOf("MYTHOS." + aid + ".LOREPACK") === 0;
          if (mine && names.indexOf(d.name) === -1) names.push(d.name);
        });
      } catch (e) {}
    }
    for (var i = 0; i < names.length; i++) {
      try {
        if (window.lore.unindex) await window.lore.unindex(names[i]);
        else await window.lore.forgetFile(names[i]);
        out.forgotten.push(names[i]);
      } catch (e2) {}
    }
    return out;
  }

  // Drop the pack with this name, across every locus that holds a stamped row of
  // it (or one locus, if named).
  async function dropPack(packName, agentId) {
    var info = await packRowsOf(packName, agentId);
    if (!info.vectors.length && !info.edges.length) {
      throw new Error("No fragment in this browser is stamped with the pack \"" + info.name + "\""
        + (agentId ? " for " + normAgent(agentId) : "") + "."
        + " Rows imported before provenance stamping belong to no pack as far as the store knows:"
        + " use /pack forget <AGENT> yes for those, or hand me the pack file itself (/pack dropfile).");
    }
    var r = await removeRows(info.vectors, info.edges);
    r.name = info.name;
    r.synced = await syncLedger(r.loci, [info.name]);
    r.settled = [];
    for (var i = 0; i < r.loci.length; i++) r.settled.push(await settleLocus(r.loci[i]));
    r.orphans = await orphanCount();
    r.declared = null;
    return r;
  }

  // Drop exactly what this file brought in. Works for any pack, stamped or not,
  // because the ids come from the pack itself.
  async function dropPackFile(file) {
    var scan = await scanFile(file);
    var r = await removeRows(scan.vectorIds, scan.edgeIds);
    var loci = {};
    (scan.agents || []).forEach(function (a) { loci[a] = true; });
    (r.loci || []).forEach(function (a) { loci[a] = true; });
    r.loci = Object.keys(loci).sort();
    r.name = scan.name;
    r.declared = { vectors: scan.vectorIds.length, edges: scan.edgeIds.length };
    r.synced = await syncLedger(r.loci, [scan.name]);
    r.settled = [];
    for (var i = 0; i < r.loci.length; i++) r.settled.push(await settleLocus(r.loci[i]));
    r.orphans = await orphanCount();
    return r;
  }

  function dropReportText(r) {
    var lines = ["PACK DROPPED :: " + r.name + " :: " + r.vectors + " FRAG / " + r.edges + " EDGE REMOVED FROM THIS BROWSER"];
    if (r.declared) {
      lines.push("THE FILE DECLARES " + r.declared.vectors + " FRAG / " + r.declared.edges + " EDGE :: "
        + ((r.declared.vectors === r.vectors && r.declared.edges === r.edges)
          ? "EACH ROW IT BROUGHT IN WAS HERE, AND NONE OF THEM ARE NOW"
          : "ONLY THE ROWS ACTUALLY HELD HERE WERE REMOVED"));
    }
    (r.settled || []).forEach(function (s) {
      lines.push(s.agent + " :: " + s.vectors + " FRAG / " + s.edges + " EDGE LEFT"
        + (s.indexed ? " :: REFOLDED INTO " + s.indexed.docs + " DOC" + (s.indexed.docs === 1 ? "" : "S")
          + " (" + s.indexed.updated + " UPDATED, " + s.indexed.added + " ADDED"
          + (s.indexed.stale && s.indexed.stale.length ? ", " + s.indexed.stale.length + " STALE TAKEN OUT" : "") + ")" : "")
        + (s.forgotten && s.forgotten.length ? " :: " + s.forgotten.length + " INDEXED DOC" + (s.forgotten.length === 1 ? "" : "S") + " TAKEN OUT (" + s.forgotten.join(", ") + ")" : ""));
    });
    if (r.orphans) lines.push("WARNING :: " + r.orphans + " EDGE(S) NOW NAME A FRAGMENT THAT IS NO LONGER HERE - THE FACTORY WOULD REFUSE THAT PACK, SO /pack check BEFORE EXPORTING.");
    lines.push("NOTHING WAS DESTROYED ON DISK - THE PACK FILE YOU HOLD IS STILL THE PACK.");
    return lines.join("\n");
  }

  async function reportDrop(packName, agentId, confirmed) {
    if (!packName) return "USAGE: /pack drop <PACK NAME> yes";
    var info = await packRowsOf(packName, agentId);
    if (!info.vectors.length && !info.edges.length) {
      return "NO STAMPED ROWS FOR PACK \"" + info.name + "\"" + (agentId ? " IN " + normAgent(agentId) : "") + "."
        + "\nTHE LEDGER (/pack) LISTS EVERY PACK THIS BROWSER HOLDS. A ROW IMPORTED BEFORE PROVENANCE STAMPING CARRIES NO PACK NAME, SO A NAME-BASED DROP CANNOT SEE IT - AND A NAME THAT IS NOT THERE TAKES NOTHING OUT."
        + (info.unstamped.length
          ? "\nROWS WITH NO PACK AT ALL :: " + info.unstamped.map(function (u) { return u.agentId + " " + u.rows; }).join(", ")
            + "\nTHOSE GO WITH /pack forget <AGENT> yes (THEN RE-IMPORT WHAT YOU WANT BACK), OR /pack dropfile - HAND BACK THE PACK FILE ITSELF."
          : "");
    }
    if (!confirmed) {
      return "ABOUT TO DROP A PACK :: " + info.name + "\n"
        + info.vectors.length + " FRAGMENT" + (info.vectors.length === 1 ? "" : "S") + " + " + info.edges.length + " EDGE" + (info.edges.length === 1 ? "" : "S")
        + " FROM " + info.loci.join(", ") + "\n"
        + (info.ledger.length ? "LEDGER :: " + info.ledger.map(function (p) { return p.agentId + " :: " + fmtSize(p.bytes) + (p.gz ? " GZIP" : "") + " :: " + p.name; }).join("\n") + "\n" : "")
        + (info.unstamped.length ? "LEFT ALONE :: " + info.unstamped.map(function (u) { return u.agentId + " " + u.rows + " UNSTAMPED ROW(S)"; }).join(", ") + "\n" : "")
        + "ANY OTHER PACK OF THAT LOCUS IS UNTOUCHED, AND THE FILE ON YOUR MACHINE IS UNTOUCHED.\n"
        + "TYPE /pack drop " + info.name + " yes TO CONFIRM.";
    }
    return dropReportText(await dropPack(info.name, agentId));
  }

  // Hand the file picker to a drop instead of an import: the same file that was
  // imported can be handed straight back to take it out again.
  function pickDrop() {
    var input = document.getElementById("mythosInput");
    if (!input) throw new Error("No file picker on this page.");
    pendingDrop = true;
    input.click();
    return true;
  }

  async function nuke() {
    await idb();
    var vKeys = await allKeys(VS);
    var eKeys = await allKeys(ES);
    var ps = await everyRow(PS);
    var docNames = [];
    ps.forEach(function (p) { (p.docNames || []).forEach(function (n) { if (docNames.indexOf(n) === -1) docNames.push(n); }); });
    await deleteKeys(VS, vKeys);
    await deleteKeys(ES, eKeys);
    await deleteKeys(PS, ps.map(function (p) { return p.id; }));
    var unindexed = 0;
    if (window.lore) {
      for (var i = 0; i < docNames.length; i++) {
        try { await window.lore.forgetFile(docNames[i]); unindexed++; } catch (e2) {}
      }
    }
    return { vectors: vKeys.length, edges: eKeys.length, unindexed: unindexed, docNames: docNames };
  }

  async function stats() {
    await idb();
    var dims = {};
    var models = {};
    var vectors = 0;
    await walk(VS, function (r) {
      vectors++;
      var d = r.vector ? r.vector.length : 0;
      dims[d] = (dims[d] || 0) + 1;
      var m = (r.metadata && r.metadata.embeddingModel) || "(unstamped)";
      models[m] = (models[m] || 0) + 1;
    });
    var edges = await walk(ES);
    return { vectors: vectors, edges: edges, dims: dims, models: models };
  }

  async function describe() {
    var a = await agents();
    var st = await stats();
    if (!st.vectors && !st.edges) {
      return "MYTHOS LOREPACK READER :: EMPTY. NOTHING IMPORTED INTO THIS BROWSER YET.\n"
        + "IMPORT A PRE-BUILT PACK WITH /pack import, OR DRAG A .jsonl.gz ONTO THE TERMINAL.\n"
        + "READ-ONLY: THIS TERMINAL RECEIVES PACKS, IT DOES NOT MINT THEM.\n"
        + "THE AGENTS THEMSELVES ARE IN THE CANONICAL MANIFEST :: /agents.";
    }
    var r = await loadRoster();
    var lines = ["MYTHOS LOREPACK READER :: " + a.length + " LOCUS / " + st.vectors + " FRAGMENT" + (st.vectors === 1 ? "" : "S") + " / " + st.edges + " EDGE" + (st.edges === 1 ? "" : "S")];
    a.forEach(function (g) {
      var packs = g.packs.length ? " :: " + g.packs.map(function (p) { return p.name + (p.gz ? " [GZ]" : ""); }).join(", ") : "";
      var indexed = g.packs.some(function (p) { return (p.docNames || []).length; }) ? " :: IN HER RETRIEVAL INDEX" : "";
      var can = r.byId[String(g.agentId).toUpperCase()];
      var named = can
        ? (String(can.name).toUpperCase() === String(g.agentId).toUpperCase() ? " :: CANONICAL AGENT " + can.order : " :: " + String(can.name).toUpperCase())
        : " :: NOT IN THE CANONICAL MANIFEST";
      lines.push("  " + g.agentId + named + " :: " + g.vectors + " FRAG / " + g.edges + " EDGE" + packs + indexed);
    });
    var dimTxt = Object.keys(st.dims).map(function (k) { return k + "-D (" + st.dims[k] + ")"; }).join(", ");
    lines.push("SPACE :: " + (dimTxt || "-") + " :: " + (Object.keys(st.models).join(", ") || "(unstamped)"));
    lines.push("/pack search <Q> · /pack graph <TERM> · /pack index <AGENT> (FOLD INTO HER RETRIEVAL) · /pack export <AGENT> · /pack drop <PACK> yes · /pack forget <AGENT> yes · /agents THE CANONICAL ROSTER");
    return lines.join("\n");
  }

  function clip(text, n) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n - 1) + "\u2026" : t;
  }

  async function reportList() {
    var g = await agents();
    if (!g.length) return "NO PACKS IMPORTED INTO THIS BROWSER. /pack import, OR DRAG A .jsonl.gz ONTO THE TERMINAL.";
    var lines = ["MYTHOS LOCI :: " + g.length];
    g.forEach(function (x) {
      lines.push("  " + x.agentId + " :: " + x.vectors + " FRAG / " + x.edges + " EDGE");
      x.packs.forEach(function (p) {
        lines.push("    " + p.name + (p.gz ? " [GZIP]" : "")
          + " :: " + fmtSize(p.bytes)
          + " :: IMPORTED " + new Date(p.at).toISOString().slice(0, 10)
          + ((p.docNames || []).length ? " :: IN HER INDEX (" + (p.docNames || []).length + " DOC)" : ""));
      });
    });
    return lines.join("\n");
  }

  async function reportSearch(query, agentId) {
    if (!query) return "USAGE: /pack search <QUERY>";
    var res = await search(query, { agent: agentId || "", limit: 6 });
    var lines = [];
    if (res.exact.length) {
      var key = genSigil(query);
      var full = res.exact.filter(function (r) { return (r.numMarkId || "") === key; });
      lines.push(full.length
        ? "TELEPORT :: EXACT SIGIL HIT (" + full.length + ")"
        : "TELEPORT :: SIGIL PREFIX HIT (" + res.exact.length + " FRAGMENT" + (res.exact.length === 1 ? "" : "S") + " UNDER THAT KEY)");
      res.exact.slice(0, 3).forEach(function (r) {
        lines.push("  " + r.agentId + (r.agentHandle ? " / " + r.agentHandle : "") + " :: " + clip(r.text, 240));
      });
    }
    if (res.graph.length) {
      lines.push("GRAPH :: " + res.graph.length + " EDGE" + (res.graph.length === 1 ? "" : "S") + " TOUCH IT");
      res.graph.slice(0, 8).forEach(function (e) { lines.push("  " + e.s + " --" + e.r + "--> " + e.o); });
    }
    if (res.lexical.length) {
      lines.push("LEXICAL :: " + res.lexical.length + " OF " + res.scanned + " FRAGMENT" + (res.scanned === 1 ? "" : "S") + " SCANNED");
      res.lexical.forEach(function (h) { lines.push("  [" + h.score.toFixed(1) + "] " + h.row.agentId + " :: " + clip(h.row.text, 240)); });
    }
    if (!lines.length) return "NOTHING MATCHED IN THE IMPORTED PACKS.";
    lines.push("SCOPE :: " + (agentId ? normAgent(agentId) : "ALL IMPORTED LOCI"));
    return lines.join("\n");
  }

  async function reportGraph(term, agentId) {
    if (!term) return "USAGE: /pack graph <TERM>";
    var hits = await graphHits(term, agentId || "", 24);
    if (!hits.length) return "NO EDGE IN THE IMPORTED PACKS TOUCHES \"" + term + "\".";
    return "GRAPH :: " + hits.length + " EDGE" + (hits.length === 1 ? "" : "S") + " TOUCHING \"" + term + "\"\n"
      + hits.map(function (e) { return "  " + e.s + " --" + e.r + "--> " + e.o + "  (" + e.agentId + ")"; }).join("\n");
  }

  async function reportIndex(agentId) {
    if (!agentId) return "USAGE: /pack index <AGENT>";
    var r = await indexAgent(agentId);
    return "FOLDED INTO HER RETRIEVAL :: " + r.agent + "\n"
      + r.docs + " DOCUMENT" + (r.docs === 1 ? "" : "S") + " (" + r.added + " ADDED, " + r.updated + " REFOLDED, " + r.kept + " UNCHANGED) FROM " + r.fragments + " FRAGMENT" + (r.fragments === 1 ? "" : "S")
      + (r.dropped ? " :: " + r.dropped + " BEYOND THE INDEX LIMIT WERE LEFT OUT" : "") + "\n"
      + r.names.join(", ") + "\n"
      + "/recall <Q> READS IT NOW, /lore LISTS IT, FORGET LOCAL DROPS IT (RECOVERABLE WITH /trash restore).";
  }

  async function reportExport(agentId) {
    if (!agentId) return "USAGE: /pack export <AGENT>";
    var out = await exportAgent(agentId);
    var url = URL.createObjectURL(out.blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = out.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
    return "ROUND-TRIP COPY :: " + out.name + " (" + fmtSize(out.blob.size) + ") :: " + out.vectors + " FRAG + " + out.edges + " EDGE RE-SERIALISED FROM THIS BROWSER.\n"
      + "A BACKUP / INTEGRITY CHECK, NOT A RE-MINT :: NOTHING WAS EMBEDDED OR RE-GRAPHED HERE.";
  }

  async function reportSplit(file) {
    if (!file) return "NO FILE GIVEN.";
    var rep = await splitFile(file);
    if (rep.groups.length < 2) {
      var g0 = rep.groups[0];
      return "NO SPLIT NEEDED :: " + rep.name + " IS ALREADY ONE SPACE :: "
        + g0.dim + "-D" + (g0.model ? " :: " + g0.model : " (unstamped)")
        + " :: " + g0.vectors + " FRAGMENT" + (g0.vectors === 1 ? "" : "S") + " + " + g0.edges + " EDGE" + (g0.edges === 1 ? "" : "S") + "\n"
        + "NOTHING DOWNLOADED - /pack import TAKES IT AS IT IS.";
    }
    var base = rep.name.replace(/\.(jsonl\.gz|jsonl|gz)$/i, "") || "lorepack";
    var names = [];
    for (var i = 0; i < rep.groups.length; i++) {
      var g = rep.groups[i];
      var safeModel = g.model ? "." + String(g.model).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : "";
      var fname = base + "." + g.dim + "D" + safeModel + ".jsonl";
      var blob = new Blob([g.lines.join("\n") + "\n"], { type: "application/jsonl" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      names.push(fname + " :: " + g.vectors + " FRAG + " + g.edges + " EDGE" + (g.edges === 1 ? "" : "S"));
      await new Promise(function (r) { setTimeout(r, 600); });
      URL.revokeObjectURL(url);
      a.remove();
    }
    return "PACK SPLIT :: " + rep.name + " (" + rep.lines + " LINES) -> " + rep.groups.length + " SPACES\n"
      + names.map(function (n) { return "  " + n; }).join("\n") + "\n"
      + "LINES ARE BYTE-IDENTICAL - NOTHING RE-EMBEDDED, NOTHING RE-GRAPHED.\n"
      + (rep.droppedCount
        ? "LEFT OUT :: " + rep.droppedCount + " EDGE(S) POINT AT A VECTOR IN NO GROUP (e.g. " + rep.droppedEdges[0] + ") - THEY COULD NEVER HAVE IMPORTED.\n"
        : "")
      + "IF THE BROWSER HELD BACK A DOWNLOAD, ALLOW MULTIPLE DOWNLOADS AND RUN /pack split AGAIN.\n"
      + "/pack import EACH FILE IN TURN - ONE PACK, ONE SPACE.";
  }

  async function reportForget(agentId, confirmed) {
    var aid = normAgent(agentId);
    if (!aid) return "USAGE: /pack forget <AGENT> yes";
    if (!confirmed) {
      var g = (await agents()).filter(function (x) { return x.agentId === aid; })[0];
      if (!g) return "NO LOCUS " + aid + " IS IN THIS BROWSER.";
      return "ABOUT TO DROP " + aid + " FROM THIS BROWSER :: " + g.vectors + " FRAG / " + g.edges + " EDGE.\n"
        + "THE PACK FILE ON YOUR MACHINE IS UNTOUCHED - RE-IMPORT UNDOES THIS.\n"
        + "TYPE /pack forget " + aid + " yes TO CONFIRM.";
    }
    var r = await forgetAgent(aid);
    return "DROPPED " + r.agent + " :: " + r.vectors + " FRAG / " + r.edges + " EDGE REMOVED FROM THIS BROWSER"
      + (r.unindexed ? " :: " + r.unindexed + " INDEXED DOC" + (r.unindexed === 1 ? "" : "S") + " MOVED TO /trash" : "")
      + "\nNOTHING WAS DESTROYED ON DISK.";
  }

  async function reportNuke(confirmed) {
    var st = await stats();
    if (!st.vectors && !st.edges) return "THE MYTHOS READER IS ALREADY EMPTY.";
    if (!confirmed) {
      return "ABOUT TO EMPTY THE MYTHOS READER :: " + st.vectors + " FRAG / " + st.edges + " EDGE FROM ALL LOCI.\n"
        + "YOUR PACK FILES ARE UNTOUCHED - RE-IMPORT UNDOES THIS.\n"
        + "TYPE /pack nuke yes TO CONFIRM.";
    }
    var r = await nuke();
    return "MYTHOS READER EMPTIED :: " + r.vectors + " FRAG / " + r.edges + " EDGE REMOVED"
      + (r.unindexed ? " :: " + r.unindexed + " INDEXED DOC" + (r.unindexed === 1 ? "" : "S") + " MOVED TO /trash" : "")
      + "\nNOTHING WAS DESTROYED ON DISK.";
  }

  async function reportImport(file) {
    if (!file) return "NO FILE GIVEN.";
    var rep = await importFile(file);
    return "PACK READ :: " + rep.name + (rep.gz ? " [GZIP]" : "") + "\n"
      + rep.vectors + " FRAGMENT" + (rep.vectors === 1 ? "" : "S") + " + " + rep.edges + " EDGE" + (rep.edges === 1 ? "" : "S")
      + " :: LOCUS " + (rep.agents.join(", ") || "(none)") + " :: " + rep.lines + " LINE" + (rep.lines === 1 ? "" : "S") + " READ\n"
      + "SPACE :: " + ((rep.dims || []).join(",") || "-") + "-D :: " + ((rep.models || []).join(", ") || "(unstamped)") + " :: READ ONLY, NEVER MEASURED AGAINST\n"
      + "/pack TO INSPECT, /pack search <Q> TO TEST HER RECALL, /pack index " + (rep.agents[0] || "<AGENT>") + " TO FOLD IT INTO HER RETRIEVAL.";
  }

  function wire() {
    var btn = document.getElementById("mythosImportBtn");
    var input = document.getElementById("mythosInput");
    if (btn && input) {
      btn.addEventListener("click", function () { input.click(); });
      input.addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!f) return;
        if (pendingDrop) {
          pendingDrop = false;
          window.mythos.dropPackFile(f).then(function (r) { print("SYSTEM", dropReportText(r)); }).catch(failDrop);
          return;
        }
        if (pendingSplit) {
          pendingSplit = false;
          window.mythos.reportSplit(f).then(function (t) { print("SYSTEM", t); }).catch(failSplit);
          return;
        }
        window.mythos.reportImport(f).then(function (t) { print("SYSTEM", t); }).catch(fail);
      });
    }
  }

  function fail(err) {
    print("SYSTEM", "PACK REJECTED :: " + ((err && err.message) ? err.message : err) + "\nNOTHING WAS WRITTEN. A PACK EITHER ARRIVES WHOLE OR NOT AT ALL.");
  }

  function failDrop(err) {
    print("SYSTEM", "DROP FAILED :: " + ((err && err.message) ? err.message : err) + "\nNOTHING WAS REMOVED.");
  }

  function failSplit(err) {
    print("SYSTEM", "SPLIT FAILED :: " + ((err && err.message) ? err.message : err) + "\nNOTHING WAS WRITTEN AND NOTHING DOWNLOADED.");
  }

  window.mythos = {
    ready: idb,
    importFile: importFile,
    reportImport: reportImport,
    describe: describe,
    reportList: reportList,
    reportSearch: reportSearch,
    reportGraph: reportGraph,
    reportIndex: reportIndex,
    reportExport: reportExport,
    reportCheck: reportCheck,
    factoryCheck: factoryCheck,
    reportForget: reportForget,
    reportNuke: reportNuke,
    agents: agents,
    canonical: loadRoster,
    canonicalAgent: canonicalAgent,
    rosterText: rosterText,
    rosterAgent: rosterAgent,
    rosterLines: rosterLines,
    rosterPayload: rosterPayload,
    stats: stats,
    search: search,
    trace: trace,
    teleport: teleport,
    graph: graphHits,
    // THE WHOLE GRAPH, rows and all. `graphHits` answers "what edges touch this term" and every other
    // door here is a search; the DOX VIEWER's GRAPH page is the one reader that wants the graph AS a
    // graph (its node names, its relations, its shape), so it gets the store itself. Read-only, like
    // every other export: the factory that MINTS a graph is not this module (see the header).
    // `idb()` first, exactly as edgesOf and vectorsOf do - everyRow() is the low-level walk and it
    // assumes the database is open, so calling it straight from outside finds `db` null.
    allEdges: function () { return idb().then(function () { return everyRow(ES); }); },
    allVectors: function () { return idb().then(function () { return everyRow(VS); }); },
    indexAgent: indexAgent,
    exportAgent: exportAgent,
    forgetAgent: forgetAgent,
    dropPack: dropPack,
    dropPackFile: dropPackFile,
    reportDrop: reportDrop,
    pickDrop: pickDrop,
    pickSplit: pickSplit,
    splitFile: splitFile,
    reportSplit: reportSplit,
    scanFile: scanFile,
    packRows: packRowsOf,
    nuke: nuke,
    vectorsOf: vectorsOf,
    edgesOf: edgesOf,
    sigil: genSigil,
    markKey: markKeyOf,
    fail: fail
  };

  wire();
})();
