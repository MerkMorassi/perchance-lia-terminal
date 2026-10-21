var commpack = (function () {
  var CHUNK_CHARS = 200000;
  var INDEX_CAP = 4000;
  var TAIL_CAP = 40;
  var MEM = {};
  function memGet(k) { return Object.prototype.hasOwnProperty.call(MEM, k) ? MEM[k] : null; }
  function memSet(k, v) { MEM[k] = v; }
  function kvGet(k) {
    if (Object.prototype.hasOwnProperty.call(MEM, k)) return MEM[k];
    var v;
    try {
      if (typeof localStorage === "undefined") return memGet(k);
      v = localStorage.getItem(k);
    } catch (e) { return memGet(k); }
    if (v === null || v === undefined) return memGet(k);
    memSet(k, v);
    return v;
  }
  function kvSet(k, v) {
    memSet(k, v);
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  function kMeta(a) { return "commpack_meta_" + a; }
  function kChunk(a, n) { return "commpack_chunk_" + a + "_" + n; }
  function kIndex(a) { return "commpack_index_" + a; }
  function kAgents() { return "commpack_agents"; }
  function fnv1a(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    var x = h.toString(16);
    while (x.length < 8) x = "0" + x;
    return x;
  }
  function blocked(why) { throw new Error("BLOCKED_SOURCE_ARTIFACT_MISMATCH: " + why); }
  function readAgents() {
    try { var a = JSON.parse(kvGet(kAgents()) || "[]"); return Object.prototype.toString.call(a) === "[object Array]" ? a : []; }
    catch (e) { return []; }
  }
  function readMeta(a) {
    try { var m = JSON.parse(kvGet(kMeta(a)) || "null"); return m && typeof m === "object" ? m : null; }
    catch (e) { return null; }
  }
  function writeMeta(a, m) { kvSet(kMeta(a), JSON.stringify(m)); }
  function readIndex(a) {
    try { var x = JSON.parse(kvGet(kIndex(a)) || "[]"); return Object.prototype.toString.call(x) === "[object Array]" ? x : []; }
    catch (e) { return []; }
  }
  function writeIndex(a, x) { kvSet(kIndex(a), JSON.stringify(x.slice(-INDEX_CAP))); }
  function fpOf(s) { return fnv1a(s) + "-" + s.length.toString(16); }
  function chainFp(prev, line) { return fpOf(prev + "\n" + line); }
  function stamp() {
    var d = new Date();
    function p(n, w) { n = String(n); while (n.length < (w || 2)) n = "0" + n; return n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }
  function defaultParams() { return { avatar: "", voice: "", voiceCloneID: "", model: "", actor: "", personaRev: 1 }; }
  function mergeParams(base, patch) {
    var p = {};
    var d = defaultParams();
    var k;
    for (k in d) p[k] = d[k];
    if (base) for (k in base) p[k] = base[k];
    if (patch) for (k in patch) p[k] = patch[k];
    return p;
  }
  function appendRaw(a, line) {
    var m = readMeta(a);
    if (!m) blocked("no-pack:" + a);
    var n = m.chunks - 1;
    if (n < 0) { n = 0; m.chunks = 1; }
    var cur = kvGet(kChunk(a, n)) || "";
    if (cur.length + line.length > CHUNK_CHARS && cur.length > 0) { n++; cur = ""; m.chunks = n + 1; }
    cur += line;
    kvSet(kChunk(a, n), cur);
    m.chars += line.length;
    m.fp = chainFp(m.fp, line);
    m.len = m.chars.toString(16);
    writeMeta(a, m);
    return m;
  }
  function pushTail(m, entry) {
    m.tail = m.tail || [];
    m.tail.push(entry);
    if (m.tail.length > TAIL_CAP) m.tail = m.tail.slice(-TAIL_CAP);
  }
  function ensure(a, opts) {
    var m = readMeta(a);
    if (m) return m;
    opts = opts || {};
    var created = Date.now();
    var header = {
      v: 1, type: "commpack-header", format: "commpack/1",
      agentID: a, agentName: opts.agentName || a, roster: "charter-v4", created: created,
      paramsVersion: 1, params: mergeParams(null, opts.params), fingerprint: ""
    };
    var line = JSON.stringify(header) + "\n";
    header.fingerprint = fpOf(line);
    line = JSON.stringify(header) + "\n";
    m = { agentID: a, agentName: header.agentName, created: created, paramsVersion: 1, params: header.params, seq: 0, chunks: 1, chars: 0, fp: header.fingerprint, len: "0", tail: [] };
    writeMeta(a, m);
    kvSet(kChunk(a, 0), line);
    m.chars = line.length;
    m.len = m.chars.toString(16);
    writeMeta(a, m);
    var agents = readAgents();
    if (agents.indexOf(a) < 0) { agents.push(a); kvSet(kAgents(), JSON.stringify(agents)); }
    writeIndex(a, []);
    return m;
  }
  function normRole(r) {
    r = String(r || "").toLowerCase();
    if (r === "human" || r === "user") return "user";
    if (r === "agent" || r === "sia" || r === "model" || r === "assistant") return "assistant";
    return "";
  }
  function record(o) {
    o = o || {};
    var a = String(o.agentID || "");
    if (!a) blocked("record-missing-agentID");
    var role = normRole(o.role);
    if (!role) return null;
    var text = String(o.text !== undefined && o.text !== null ? o.text : "");
    if (!text) return null;
    var platform = String(o.platform || "perchance");
    var sessionID = String(o.sessionID || "sess-0");
    var m = ensure(a, o);
    var seq = (m.seq || 0) + 1;
    var id = a + ":" + sessionID + ":t" + seq;
    var turn = {
      v: 2, type: "turn", id: id, a: a,
      h: String(o.handle || (role === "assistant" ? m.agentName : "user")),
      t: text, ts: Date.now(),
      src: "commpack :: " + platform + " :: " + sessionID + " :: t" + seq,
      d: { origin: "voxtalk", platform: platform, sessionID: sessionID, paramsVersion: m.paramsVersion, role: role, seq: seq, stagingId: id },
      vec: null
    };
    if (o.attachments && o.attachments.length) {
      var att = [];
      for (var ai = 0; ai < o.attachments.length && ai < 8; ai++) {
        var ae = o.attachments[ai] || {};
        var me = { name: String(ae.name || "file"), kind: ae.kind === "image" ? "image" : "text" };
        if (me.kind === "image") me.bytes = Math.max(0, Number(ae.bytes) || 0);
        else me.chars = Math.max(0, Number(ae.chars) || 0);
        if (ae.capped) me.capped = true;
        att.push(me);
      }
      turn.d.attachments = att;
    }
    var line = JSON.stringify(turn) + "\n";
    if (role === "assistant" && o.agentName && o.agentName !== m.agentName) {
      m.agentName = String(o.agentName);
    }
    m.seq = seq;
    writeMeta(a, m);
    appendRaw(a, line);
    m = readMeta(a);
    pushTail(m, { id: id, h: turn.h, ts: turn.ts });
    writeMeta(a, m);
    var idx = readIndex(a);
    idx.push(id);
    writeIndex(a, idx);
    return { id: id, seq: seq };
  }
  function bumpParams(a, patch) {
    var m = readMeta(a);
    if (!m) blocked("no-pack:" + a);
    var ev = { v: 1, type: "commpack-params", agentID: a, paramsVersion: m.paramsVersion + 1, params: mergeParams(m.params, patch), ts: Date.now() };
    m.paramsVersion = ev.paramsVersion;
    m.params = ev.params;
    writeMeta(a, m);
    appendRaw(a, JSON.stringify(ev) + "\n");
    return ev.paramsVersion;
  }
  function readAll(a) {
    var m = readMeta(a);
    if (!m) blocked("no-pack:" + a);
    var s = "";
    for (var n = 0; n < m.chunks; n++) s += kvGet(kChunk(a, n)) || "";
    return { meta: m, jsonl: s };
  }
  function toMd(a, jsonl) {
    var lines = jsonl.split("\n");
    var out = [];
    var head = null;
    var i, o;
    for (i = 0; i < lines.length; i++) {
      if (!lines[i]) continue;
      try { o = JSON.parse(lines[i]); } catch (e) { continue; }
      if (o.type === "commpack-header") { head = o; continue; }
      if (o.type !== "turn") continue;
      out.push("[" + new Date(o.ts).toISOString() + "] **" + o.h + "**: " + o.t);
    }
    var md = "# " + (head ? head.agentName : a) + " (" + a + ")\n\n";
    if (head) md += "roster " + head.roster + " · params v" + head.paramsVersion + " · created " + new Date(head.created).toISOString() + "\n\n";
    md += out.join("\n\n");
    return md;
  }
  function fileStem(a, agentName) { return a + "-" + String(agentName || a).replace(/[^A-Za-z0-9]+/g, "-") + "-" + stamp(); }
  return {
    record: record,
    params: bumpParams,
    state: function (a) {
      var m = readMeta(a);
      if (!m) return { agentID: a, turns: 0, chars: 0, chunks: 0, paramsVersion: 0, fingerprint: "", len: "0" };
      var chars = m.chars || 0;
      var st = { agentID: a, turns: m.seq || 0, chars: chars, chunks: m.chunks || 0, paramsVersion: m.paramsVersion || 0, fingerprint: m.fp || "", len: m.len || "0" };
      if (chars > 3000000) st.warn = "PACK NEAR LOCALSTORAGE CAP";
      return st;
    },
    warm: function () {
      var agents = readAgents();
      for (var i = 0; i < agents.length; i++) {
        var m = readMeta(agents[i]);
        var total = (m && m.chunks) || 1;
        kvGet(kIndex(agents[i]));
        for (var n = 0; n < total; n++) kvGet(kChunk(agents[i], n));
      }
      return agents.length;
    },
    evict: function (a) {
      var keys = [kMeta(a), kIndex(a)];
      var m = null;
      try { m = JSON.parse(memGet(kMeta(a)) || kvGet(kMeta(a)) || "null"); } catch (e) {}
      var total = (m && m.chunks) || 1;
      for (var n = 0; n < total; n++) keys.push(kChunk(a, n));
      for (var i = 0; i < keys.length; i++) {
        if (Object.prototype.hasOwnProperty.call(MEM, keys[i])) delete MEM[keys[i]];
      }
      return keys.length;
    },
    describe: function (a) {
      var m = readMeta(a);
      if (!m) return { agentID: a, agentName: a, roster: "charter-v4", created: 0, paramsVersion: 0, params: defaultParams(), turns: 0, fingerprint: "" };
      return { agentID: a, agentName: m.agentName, roster: "charter-v4", created: m.created, paramsVersion: m.paramsVersion, params: m.params, turns: m.seq || 0, fingerprint: m.fp || "" };
    },
    export: function (a) {
      var r = readAll(a);
      return { jsonl: r.jsonl, md: toMd(a, r.jsonl), filename: fileStem(a, r.meta.agentName) };
    },
    import: function (a, text) {
      if (typeof text !== "string" || !text) blocked("import-empty");
      var hasNL = text.charAt(text.length - 1) === "\n";
      var parts = text.split("\n");
      var body = hasNL ? parts.slice(0, -1) : parts;
      var objs = [];
      var i, o;
      for (i = 0; i < body.length; i++) {
        if (!body[i]) continue;
        try { o = JSON.parse(body[i]); }
        catch (e) {
          if (i === body.length - 1 && !hasNL) blocked("import-truncated-tail");
          blocked("import-bad-line:" + (i + 1));
        }
        objs.push(o);
      }
      if (!objs.length || objs[0].type !== "commpack-header") blocked("import-no-header");
      if (String(objs[0].agentID) !== String(a)) blocked("import-agent-mismatch");
      var m = readMeta(a);
      var added = 0, skipped = 0;
      if (!m) {
        var h = objs[0];
        m = {
          agentID: a, agentName: h.agentName || a, created: h.created || Date.now(),
          paramsVersion: h.paramsVersion || 1, params: mergeParams(null, h.params),
          seq: 0, chunks: 0, chars: 0, fp: h.fingerprint || "0", len: "0", tail: []
        };
        writeMeta(a, m);
        var agents = readAgents();
        if (agents.indexOf(a) < 0) { agents.push(a); kvSet(kAgents(), JSON.stringify(agents)); }
        var seen = {};
        for (i = 0; i < objs.length; i++) {
          o = objs[i];
          var key = o.type === "turn" ? o.id : (o.type + "@v" + o.paramsVersion);
          if (o.type !== "commpack-header" && seen[key]) { skipped++; continue; }
          seen[key] = 1;
          if (o.type === "turn") {
            var sq = parseInt(String(o.id || "").split(":t").pop(), 10);
            if (!isNaN(sq) && sq > m.seq) m.seq = sq;
            if (typeof o.ts !== "number" || !o.t) blocked("import-bad-turn:" + o.id);
            if (o.d && normRole(o.d.role)) o.d.role = normRole(o.d.role);
          }
          if (o.type === "commpack-params" && o.paramsVersion > m.paramsVersion) {
            m.paramsVersion = o.paramsVersion;
            m.params = mergeParams(m.params, o.params);
          }
          writeMeta(a, m);
          appendRaw(a, JSON.stringify(o) + "\n");
          m = readMeta(a);
          if (o.type === "turn") {
            pushTail(m, { id: o.id, h: o.h, ts: o.ts });
            writeMeta(a, m);
            var ix = readIndex(a);
            ix.push(o.id);
            writeIndex(a, ix);
          }
          if (o.type !== "commpack-header") added++;
        }
        return { added: added, skipped: skipped };
      }
      var have = {};
      var ix0 = readIndex(a);
      for (i = 0; i < ix0.length; i++) have[ix0[i]] = 1;
      for (i = 1; i < objs.length; i++) {
        o = objs[i];
        if (o.type === "turn") {
          if (!o.id || typeof o.ts !== "number" || !o.t) blocked("import-bad-turn:" + (o.id || "?"));
          if (o.d && normRole(o.d.role)) o.d.role = normRole(o.d.role);
          if (have[o.id]) { skipped++; continue; }
          var sq2 = parseInt(String(o.id).split(":t").pop(), 10);
          if (!isNaN(sq2) && sq2 > m.seq) m.seq = sq2;
          writeMeta(a, m);
          appendRaw(a, JSON.stringify(o) + "\n");
          m = readMeta(a);
          pushTail(m, { id: o.id, h: o.h, ts: o.ts });
          writeMeta(a, m);
          ix0.push(o.id);
          writeIndex(a, ix0);
          have[o.id] = 1;
          added++;
        } else if (o.type === "commpack-params") {
          if (o.paramsVersion > m.paramsVersion) {
            m.paramsVersion = o.paramsVersion;
            m.params = mergeParams(m.params, o.params);
            writeMeta(a, m);
            appendRaw(a, JSON.stringify(o) + "\n");
            added++;
          } else skipped++;
        } else skipped++;
      }
      return { added: added, skipped: skipped };
    },
    tail: function (a, n) {
      var m = readMeta(a);
      if (!m) return [];
      n = Math.max(1, Math.min(100, Number(n) || 20));
      var found = [];
      for (var c = (m.chunks || 1) - 1; c >= 0 && found.length < n; c--) {
        var s = kvGet(kChunk(a, c)) || "";
        var ls = s.split("\n");
        var i, o;
        for (i = ls.length - 1; i >= 0 && found.length < n; i--) {
          if (!ls[i]) continue;
          try { o = JSON.parse(ls[i]); } catch (e) { continue; }
          if (!o || o.type !== "turn") continue;
          found.push(o);
        }
      }
      found.reverse();
      return found;
    }
  };
})();
if (typeof window !== "undefined") window.commpack = commpack;
