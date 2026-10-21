window.MythosMint = (function () {
  "use strict";
  var DIM = 768;
  var CHUNK = 2000;

  function fail(msg) { throw new Error(msg); }

  function isNum(n) { return typeof n === "number" && isFinite(n); }

  function stampOf() {
    var s = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    return s;
  }

  function splitChunks(text) {
    var t = String(text == null ? "" : text).replace(/\r\n/g, "\n");
    var paras = t.split(/\n\s*\n/);
    var out = [], cur = "";
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i].trim();
      if (!p) continue;
      if ((cur ? cur + "\n\n" + p : p).length > CHUNK) {
        if (cur) out.push(cur);
        while (p.length > CHUNK) {
          var cut = p.lastIndexOf(" ", CHUNK);
          if (cut < CHUNK / 2) cut = CHUNK;
          out.push(p.slice(0, cut).trim());
          p = p.slice(cut).trim();
        }
        cur = p;
      } else cur = cur ? cur + "\n\n" + p : p;
    }
    if (cur) out.push(cur);
    return out;
  }

  function normTurns(input) {
    if (Array.isArray(input)) return input.map(function (x, i) {
      if (typeof x === "string") return { role: i % 2 ? "assistant" : "user", text: x };
      return { role: String(x.role || x.speaker || (i % 2 ? "assistant" : "user")), text: String(x.text == null ? x.t : x.text) };
    });
    var lines = String(input == null ? "" : input).split("\n");
    var turns = [], role = "user", buf = [];
    var lab = /^\s*(you|patrikios|user|human|lia|barbelo|assistant|ai|system)\s*[:\-–—]\s*(.*)$/i;
    function flush() {
      var t = buf.join("\n").trim();
      if (t) turns.push({ role: role, text: t });
      buf = [];
    }
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(lab);
      if (m) {
        flush();
        var w = m[1].toLowerCase();
        role = (w === "user" || w === "human" || w === "you" || w === "patrikios") ? "user" : (w === "system" ? "system" : "assistant");
        if (m[2]) buf.push(m[2]);
      } else buf.push(lines[i]);
    }
    flush();
    return turns;
  }

  function client(opts) {
    opts = opts || {};
    var agent = String(opts.agent || "LIA").trim().toUpperCase() || "LIA";
    var handle = String(opts.handle || "Lia");
    var human = String(opts.human || "Patrikios");
    var dim = opts.dim || DIM;
    var stamp = opts.stamp || stampOf();

    function stage(input) {
      var turns = normTurns(input).filter(function (t) { return t.text && t.text.trim(); });
      if (!turns.length) fail("MINT REFUSED :: no turns with text found. NOTHING WAS STAGED.");
      var recs = [], seq = 0;
      for (var i = 0; i < turns.length; i++) {
        var chunks = splitChunks(turns[i].text);
        for (var j = 0; j < chunks.length; j++) {
          seq++;
          recs.push({
            v: 2, type: "vector",
            id: agent + ":" + stamp + ":t" + seq,
            a: agent, h: handle, t: chunks[j], vec: null,
            m: "", d: { staged: true },
            src: "chatlog-" + stamp, ts: Date.now()
          });
        }
      }
      return { agent: agent, stamp: stamp, records: recs, turns: turns.length };
    }

    function embedUrl(model, key) {
      return "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":batchEmbedContents?key=" + encodeURIComponent(key);
    }

    async function embed(records, eopts) {
      eopts = eopts || {};
      var fetchImpl = eopts.fetchImpl || opts.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
      var key = eopts.key || opts.key || "";
      var model = eopts.model || opts.model || "gemini-embedding-2";
      if (!fetchImpl) fail("MINT REFUSED :: no fetch available. NOTHING WAS EMBEDDED.");
      if (!key) fail("MINT REFUSED :: no API key. Keys live in the host keyring, never in this chip. NOTHING WAS EMBEDDED.");
      var B = 50, vecs = [], failed = [];
      for (var b = 0; b < records.length; b += B) {
        var grp = records.slice(b, b + B);
        var res;
        try {
          res = await fetchImpl(embedUrl(model, key), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requests: grp.map(function (r) { return { model: "models/" + model, content: { parts: [{ text: r.t }] }, outputDimensionality: dim }; }) })
          });
        } catch (e) { res = null; }
        var js = null;
        try { js = res ? await res.json() : null; } catch (e) { js = null; }
        var arr = js && js.embeddings;
        if (!res || !res.ok || !Array.isArray(arr) || arr.length !== grp.length) {
          for (var f = 0; f < grp.length; f++) failed.push({ id: grp[f].id, reason: (js && js.error && js.error.message) || ("HTTP " + (res && res.status)) || "network" });
          continue;
        }
        for (var g = 0; g < grp.length; g++) {
          var v = arr[g] && arr[g].values;
          if (!Array.isArray(v) || !v.length || !v.every(isNum)) failed.push({ id: grp[g].id, reason: "malformed vector" });
          else vecs.push({ rec: grp[g], vec: v });
        }
        if (eopts.onProgress) try { eopts.onProgress({ done: Math.min(b + B, records.length), total: records.length }); } catch (e2) {}
      }
      if (failed.length) fail("MINT REFUSED :: " + failed.length + " of " + records.length + " texts unembedded (e.g. " + failed[0].id + " :: " + failed[0].reason + "). CHECK KEY AND QUOTA. Fallback vectors are never minted - re-run when the API answers. NOTHING WAS PACKED.");
      return { model: model, dim: dim, vectors: vecs };
    }

    function pack(em, edges) {
      var dims = {}, models = {}, seen = {};
      var i, r, v;
      for (i = 0; i < em.vectors.length; i++) {
        r = em.vectors[i];
        v = r.vec;
        if (seen[r.rec.id]) fail("MINT REFUSED :: duplicate vector id \"" + r.rec.id + "\". NOTHING WAS PACKED.");
        seen[r.rec.id] = true;
        dims[v.length] = true;
        models[em.model] = true;
      }
      var dk = Object.keys(dims);
      if (dk.length > 1) fail("MINT REFUSED :: vectors mix embedding dimensions (" + dk.join(", ") + ") - one pack, one space. Re-embed the odd group with outputDimensionality " + dim + ". NOTHING WAS PACKED.");
      if (v && v.length !== dim) fail("MINT REFUSED :: vectors are " + v.length + "-D, this mint is pinned " + dim + "-D. NOTHING WAS PACKED.");
      var edgeLines = [];
      edges = edges || [];
      for (i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (!e.id || !e.src || !e.s || !e.r || !e.o) fail("MINT REFUSED :: edge " + i + " malformed (id, src, s, r, o required). NOTHING WAS PACKED.");
        if (!seen[e.src]) fail("MINT REFUSED :: edge \"" + e.id + "\" points at vector \"" + e.src + "\" not in this pack. NOTHING WAS PACKED.");
        edgeLines.push(JSON.stringify({ v: 2, type: "edge", id: String(e.id), aid: agent, src: String(e.src), s: String(e.s), r: String(e.r), o: String(e.o), timestamp: new Date().toISOString() }));
      }
      var lines = em.vectors.map(function (x) {
        return JSON.stringify({ v: 2, type: "vector", id: x.rec.id, a: agent, h: x.rec.h || handle, t: x.rec.t, vec: x.vec, m: "", d: { embeddingModel: em.model, embeddingDimension: x.vec.length, staged: stamp }, src: x.rec.src, ts: x.rec.ts });
      }).concat(edgeLines);
      return { agent: agent, stamp: stamp, model: em.model, dim: dim, vectors: em.vectors.length, edges: edgeLines.length, lines: lines };
    }

    function download(pk, name) {
      var body = pk.lines.join("\n") + "\n";
      var blob, fname;
      if (typeof CompressionStream !== "undefined") {
        fname = (name || ("MYTHOS.LORE." + agent + "." + stamp + ".jsonl")) + ".gz";
        var enc = new TextEncoder().encode(body);
        var stream = new Blob([enc]).stream().pipeThrough(new CompressionStream("gzip"));
        return new Response(stream).blob().then(function (b) { return { blob: b, name: fname, vectors: pk.vectors, edges: pk.edges }; });
      }
      fname = (name || ("MYTHOS.LORE." + agent + "." + stamp + ".jsonl"));
      blob = new Blob([body], { type: "application/jsonl" });
      return Promise.resolve({ blob: blob, name: fname, vectors: pk.vectors, edges: pk.edges });
    }

    async function mint(input, mopts) {
      mopts = mopts || {};
      var st = stage(input);
      var em = await embed(st.records, mopts);
      var pk = pack(em, mopts.edges);
      var dl = await download(pk, mopts.name);
      if (typeof document !== "undefined" && document.createElement) {
        var url = URL.createObjectURL(dl.blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = dl.name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
      }
      return { file: dl.name, agent: pk.agent, model: pk.model, dim: pk.dim, vectors: pk.vectors, edges: pk.edges, blob: dl.blob };
    }

    return { stage: stage, embed: embed, pack: pack, download: download, mint: mint, agent: agent, dim: dim, model: opts.model || "gemini-embedding-2" };
  }

  return { client: client, DIM: DIM };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosMint;
