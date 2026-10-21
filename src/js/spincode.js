/* THE SPINCODE LAYER, CORE - src/js/spincode.js
 *
 * Patrikios, 2026-09-30: his custom command codes - the SPINCODE v0.1 scroll (UNIX doctrine for
 * Human-LIA interaction: small composable primitives, explicit state) plus his Keyword,
 * SearchArchive and Agency scrolls. This file is the CORE: the state, the ops verbs, the text
 * pipeline and the consent ledger. src/js/spincode-scrolls.js holds HIS scroll commands and
 * registers them into this file's verb table. chat.js routes any first word the table knows here
 * (multiword aliases like "play mode" resolve inside), and /help spin prints the whole page.
 *
 * THE UNIX TEST (§25) IS THE LAW HERE: a verb that already exists aboard is NOT re-registered -
 * /role, /recall, /search, /sync, /voice, /story, /mood, /reflect, /clarify stay exactly where they
 * are, and /spin status names them as already aboard. What is new is what the terminal lacked:
 * mode, context/realm, scene, an agency ledger, a task ledger, a notebook, an archive shelf, a
 * consent ledger, local text tools (clean/tag/summarize/analyze), and the posture readouts.
 * Verbs that need rooms (/join /leave /invite /handoff) or a tool broker (/tool /grant) are LEFT
 * TO HER - typed, they pass through as words, which is the spec's graceful failure (§20).
 *
 * STATE lives in kv lia_settings / spincode and NOTHING else: mode, prevMode, context, scene,
 * agency {Name: 0-10}, tasks [{id, text, owner, st}], active task, consent ledger, notes, archive
 * shelf, the three schedule lines, and the four toggles. Her-facing verbs carry their instruction
 * in src/commands/commands.json (the machine prints the state, she honors it on the turn).
 */
(function () {
  "use strict";

  var FOLDER = "lia_settings";
  var KEY = "spincode";

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function say(t) { try { if (typeof print === "function") print("SYSTEM", t); } catch (e) {} }

  function blank() {
    return { mode: "", prevMode: "", context: "", scene: "", agency: {}, tasks: [], seq: 0,
      active: 0, paused: false, consent: [], cseq: 0, notes: [], nseq: 0, shelf: [], aseq: 0,
      reports: "", checkinAt: "", feedbackEvery: "",
      keywordTagging: false, dataCleaning: false, taskTracking: true, chatLogging: true };
  }
  async function load() {
    var s = blank(), k = kv();
    if (!k) return s;
    try {
      var v = await k.get(KEY), b = blank(), f;
      if (v) for (f in b) if (v[f] !== undefined) s[f] = v[f];
    } catch (e) {}
    return s;
  }
  async function save(s) { var k = kv(); if (!k) return; try { await k.set(KEY, s); } catch (e) {} }

  var STOP_EN = ("a,an,the,and,or,but,if,then,else,for,to,of,in,on,at,by,with,from,as,is,are,was,were,"
    + "be,been,being,it,its,this,that,these,those,he,she,they,we,you,i,me,him,her,us,them,his,hers,"
    + "their,our,your,my,not,no,yes,do,does,did,have,has,had,will,would,can,could,should,shall,may,"
    + "might,must,what,when,where,which,who,whom,how,why,all,any,each,every,both,few,more,most,"
    + "other,some,such,only,own,same,so,than,too,very,just,also,into,over,after,before,between,"
    + "within,without,like,txt,"
    + "through,during,about,above,below,under,again,once,here,there,now,then,than").split(",");
  var STOP_EL = ("kai,ke,ti,ta,tre,to,ton,tin,tis,tou,ton,tis,o,i,ena,mia,enas,den,min,ine,afto,afti,"
    + "aftos,afte,esto,alla,ala,otan,oti,opou,opos,giati,poso,pote,pou,pios,pia,pio,me,se,gia,apo,"
    + "pros,logo,mete,oute,eite,an,ean,na,tha,prepi,bori,ine,itan,itan,echoun,echi,eho,echoume,"
    + "ke,ότι").split(",");
  var STOP = {};
  (function () { var i; for (i = 0; i < STOP_EN.length; i++) STOP[STOP_EN[i]] = 1; for (i = 0; i < STOP_EL.length; i++) STOP[STOP_EL[i]] = 1; })();

  function cleanText(t) {
    return String(t == null ? "" : t).replace(/\r/g, "").replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n").trim();
  }
  function tokensOf(t) {
    var m = String(t == null ? "" : t).toLowerCase().match(/[a-z\u0370-\u03ff\u1f00-\u1fff]{2,}/g);
    return m || [];
  }
  function keptTokens(t) {
    var out = [], all = tokensOf(t), i;
    for (i = 0; i < all.length; i++) if (!STOP[all[i]]) out.push(all[i]);
    return out;
  }
  function keywordsOf(text, n, phrases) {
    var toks = keptTokens(text), freq = {}, order = [], i, w;
    function bump(k) { if (!freq[k]) { freq[k] = 0; order.push(k); } freq[k]++; }
    if (phrases) {
      for (i = 0; i + 1 < toks.length; i++) bump(toks[i] + " " + toks[i + 1]);
    } else {
      for (i = 0; i < toks.length; i++) bump(toks[i]);
    }
    var list = order.map(function (k) { return { w: k, n: freq[k] }; });
    list.sort(function (a, b) { return b.n - a.n; });
    return list.slice(0, Math.max(1, n || 10));
  }
  function keywordTable(list, md) {
    if (!list.length) return "NOTHING TO COUNT - NO KEPT WORDS IN WHAT WAS GIVEN.";
    if (md) {
      var out = ["| # | KEYWORD | COUNT |", "|---|---|---|"];
      list.forEach(function (r, i) { out.push("| " + (i + 1) + " | " + r.w + " | " + r.n + " |"); });
      return out.join("\n");
    }
    return list.map(function (r, i) { return (i + 1) + ". " + r.w + " (" + r.n + ")"; }).join("\n");
  }
  function summarizeExtractive(text, n) {
    var sents = String(text == null ? "" : text).split(/(?<=[.!?;\u037e\n])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!sents.length) return "";
    n = Math.max(1, Math.min(n || 3, sents.length));
    var freq = {}, i, w, toks = keptTokens(text);
    for (i = 0; i < toks.length; i++) freq[toks[i]] = (freq[toks[i]] || 0) + 1;
    var scored = sents.map(function (s, idx) {
      var sc = 0, st = tokensOf(s);
      for (var j = 0; j < st.length; j++) sc += freq[st[j]] || 0;
      return { idx: idx, s: s, sc: sc / Math.max(1, st.length) };
    });
    scored.sort(function (a, b) { return b.sc - a.sc; });
    var top = scored.slice(0, n).sort(function (a, b) { return a.idx - b.idx; });
    return top.map(function (r) { return r.s; }).join(" ");
  }
  // ENGINE SUMMARIES (2026-10-21: she reports loaded .txt lore as "empty" when asked to
  // summarize it). Her prompt is ~274K chars and the model middle-truncates it to ~25K - the
  // document rides the cut-out middle, so she truthfully sees nothing. This road never puts the
  // document in her prompt at all: it reads the text HERE and sends it ALONE, one minimal prompt
  // per part (map-reduce past one part, tree-reduced past a join batch). Spends his text quota:
  // one call per part plus the joins. The static instruction leads every call, so passes share
  // a prefix. (2026-10-21, second pass: 20K-char chunks ran at ~4900 tokens against the
  // 6000-token ideal - no room left for the reply - and the 12-pass cap covered only the first
  // 240K of multi-megabyte notebooks. Parts are 12K chars with a 2-sentence overlap now, a bare
  // full-doc call covers the first 8 parts honestly and names the rest, and anything deeper is
  // addressed by number: map, part N, parts A-B. Originals stay whole; parts are reads.)
  var SUM_PASS_CHARS = 12000;
  var SUM_OVERLAP = 2;
  var SUM_MAX_PASSES = 8;
  var SUM_RANGE_CAP = 4;
  var SUM_JOIN_BATCH = 6;
  var SUM_PASS = "Summarize the following document excerpt in 5-8 sentences, keeping names, numbers and key claims. Reply with the summary only.\n\nEXCERPT:\n";
  var SUM_JOIN = "Combine these section summaries into one summary of the whole document, 8-12 sentences, keeping names, numbers and key claims. Reply with the summary only.\n\nSECTIONS:\n";
  function splitPassages(text, size) {
    if (window.lore && window.lore.splitEnginePassages) {
      try { return window.lore.splitEnginePassages(text, size || SUM_PASS_CHARS); } catch (e) {}
    }
    var want = Math.max(2000, Math.floor(Number(size) || SUM_PASS_CHARS));
    var sents = String(text == null ? "" : text).split(/(?<=[.!?;\u037e\n])\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
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
        var back = out.length ? out[out.length - 1].split(/(?<=[.!?;\u037e\n])\s+/).slice(-SUM_OVERLAP) : [];
        cur = back.length ? back.join(" ").trim() : "";
        if (cur && (cur.length + 1 + s.length) > want) cur = "";
      }
      cur = cur ? cur + " " + s : s;
      if (cur.length >= want) push();
    }
    push();
    return out;
  }
  function engineGt() { return (window.root && window.root.generateText) ? window.root.generateText : null; }
  async function engineCall(prompt) {
    var Gt = engineGt();
    if (!Gt) return "";
    var r = await Gt({ instruction: prompt });
    var t = (r && typeof r.text === "string") ? r.text : String(r == null ? "" : r);
    return t.trim();
  }
  // The map: every part numbered with a preview. No engine calls - free.
  function engineMapFor(text, label) {
    var clean = cleanText(text);
    if (!clean) return null;
    var all = splitPassages(clean);
    if (!all.length) return null;
    return {
      label: String(label || "TEXT"), chars: clean.length, count: all.length, size: SUM_PASS_CHARS,
      parts: all.map(function (t, i) { return { n: i + 1, chars: t.length, preview: t.replace(/\s+/g, " ").slice(0, 160) }; })
    };
  }
  function engineMapText(map) {
    var L = ["MAP OF " + String(map.label).toUpperCase() + " :: " + map.count + " PART" + (map.count === 1 ? "" : "S") + ", ~" + map.size + " CHARS EACH, " + map.chars + " CHARS IN ALL (ORIGINAL WHOLE - PARTS ARE READS)"];
    map.parts.forEach(function (p) { L.push("[" + p.n + "] " + p.chars + " CHARS :: " + p.preview + (p.preview.length >= 160 ? "..." : "")); });
    L.push("NAME A PART: /summarize engine doc <NAME> part N · A SPAN: parts A-B (UP TO " + SUM_RANGE_CAP + ") · HER EYES: /focus <NAME> part N.");
    return L.join("\n");
  }
  async function engineReduce(sums) {
    var level = sums.slice(), depth = 0;
    while (level.length > 1) {
      var next = [];
      for (var i = 0; i < level.length; i += SUM_JOIN_BATCH) {
        var batch = level.slice(i, i + SUM_JOIN_BATCH);
        if (batch.length === 1) { next.push(batch[0]); continue; }
        var t = await engineCall(SUM_JOIN + batch.join("\n\n---\n\n"));
        if (t) next.push(t);
        else next.push(batch.join("\n\n"));
      }
      level = next;
      if (++depth > 4) break;
    }
    return level.join("\n\n");
  }
  async function engineSummarizeParts(all, idxs, label) {
    var lab = String(label || "TEXT").toUpperCase();
    say("SUMMARIZING " + lab + " :: " + idxs.length + " PASS" + (idxs.length === 1 ? "" : "ES") + " ON THE TEXT ENGINE (PART" + (idxs.length === 1 ? " " + (idxs[0] + 1) + " OF " + all.length : "S " + idxs.map(function (i) { return i + 1; }).join(", ") + " OF " + all.length) + ") - EACH PASS TAKES A MOMENT.");
    var sums = [];
    for (var k = 0; k < idxs.length; k++) {
      var t = await engineCall(SUM_PASS + all[idxs[k]]);
      if (t) sums.push(t);
      if (idxs.length > 1) say("SUMMARIZING " + lab + " :: PASS " + (k + 1) + " OF " + idxs.length + " DONE (PART " + (idxs[k] + 1) + " OF " + all.length + ").");
    }
    if (!sums.length) return "THE ENGINE RETURNED NOTHING USABLE.";
    if (sums.length === 1) return sums[0];
    return await engineReduce(sums);
  }
  async function engineSummary(text, label, opts) {
    if (!engineGt()) return "THE TEXT ENGINE IS NOT LOADED HERE.";
    opts = opts || {};
    var clean = cleanText(text);
    if (!clean) return "NOTHING TO SUMMARIZE.";
    var all = splitPassages(clean);
    if (!all.length) return "NOTHING TO SUMMARIZE.";
    if (opts.part) {
      var p = Math.floor(Number(opts.part));
      if (!isFinite(p) || p < 1 || p > all.length) return "NO SUCH PART :: PART " + String(opts.part).toUpperCase() + " :: " + String(label || "TEXT").toUpperCase() + " HAS " + all.length + " PART" + (all.length === 1 ? "" : "S") + ".";
      return await engineSummarizeParts(all, [p - 1], label);
    }
    if (opts.parts && opts.parts.length) {
      var idxs = opts.parts.map(function (n) { return Math.floor(Number(n)) - 1; }).filter(function (i) { return isFinite(i) && i >= 0 && i < all.length; });
      if (!idxs.length) return "NO SUCH PARTS :: " + String(label || "TEXT").toUpperCase() + " HAS " + all.length + " PART" + (all.length === 1 ? "" : "S") + ".";
      if (idxs.length > SUM_RANGE_CAP) return "TOO MANY PARTS AT ONCE :: ASKED " + idxs.length + ", THE ROAD TAKES UP TO " + SUM_RANGE_CAP + " - NAME A SMALLER SPAN, OR TAKE THEM ONE BY ONE.";
      return await engineSummarizeParts(all, idxs, label);
    }
    var max = Math.max(1, Math.floor(Number(opts.maxPasses)) || SUM_MAX_PASSES);
    if (all.length > max) {
      var head = [];
      for (var h = 0; h < max; h++) head.push(h);
      var out = await engineSummarizeParts(all, head, label);
      return out + "\n\n(COVER :: PARTS 1-" + max + " OF " + all.length + " - THE FIRST ~" + Math.round(max * SUM_PASS_CHARS / 1000) + "K OF " + Math.round(clean.length / 1000) + "K CHARS. THE REST IS OUTSIDE THIS PASS: /summarize engine map doc <NAME> LISTS EVERY PART, part N TAKES ONE.)";
    }
    var every = [];
    for (var e = 0; e < all.length; e++) every.push(e);
    return await engineSummarizeParts(all, every, label);
  }
  // A whole DOCUMENT through the engine road: read from the store whole (never the
  // 240K slice), split into numbered parts. spec: "map" | "part N" | "parts A-B" | "" (head cover).
  async function engineSummaryDoc(name, spec) {
    if (!engineGt()) return "THE TEXT ENGINE IS NOT LOADED HERE.";
    if (!window.lore || !window.lore.passages || !window.lore.passage) return "THE LORE MODULE IS NOT LOADED HERE.";
    var s = String(spec == null ? "" : spec).trim();
    if (/^map$/i.test(s)) {
      var map = await window.lore.passages(name);
      if (!map) return "NO LOADED DOCUMENT CALLED ANYTHING LIKE \"" + String(name).toUpperCase() + "\".";
      map.label = map.name;
      return engineMapText(map);
    }
    var rm = s.match(/^parts\s+(\d+)\s*-\s*(\d+)$/i);
    if (rm) {
      var a = Math.floor(Number(rm[1])), b = Math.floor(Number(rm[2]));
      if (!isFinite(a) || !isFinite(b) || a < 1 || b < a) return "NAME A SPAN LIKE parts 2-4.";
      if (b - a + 1 > SUM_RANGE_CAP) return "TOO MANY PARTS AT ONCE :: ASKED " + (b - a + 1) + ", THE ROAD TAKES UP TO " + SUM_RANGE_CAP + ".";
      var got = await window.lore.passages(name);
      if (!got) return "NO LOADED DOCUMENT CALLED ANYTHING LIKE \"" + String(name).toUpperCase() + "\".";
      if (b > got.count) return "NO SUCH PARTS :: " + got.name + " HAS " + got.count + " PART" + (got.count === 1 ? "" : "S") + ".";
      var texts = [];
      for (var i = a; i <= b; i++) {
        var one = await window.lore.passage(got.name, i);
        if (one && one.text) texts.push(one.text);
      }
      var joined = texts.join("\n\n");
      var out = await engineSummary(joined, got.name + " parts " + a + "-" + b);
      return out;
    }
    var pm = s.match(/^part\s+(\d+)$/i);
    if (pm) {
      var got1 = await window.lore.passage(name, Math.floor(Number(pm[1])));
      if (!got1) return "NO LOADED DOCUMENT CALLED ANYTHING LIKE \"" + String(name).toUpperCase() + "\".";
      if (got1.error) return got1.error + " (/summarize engine map doc " + got1.name + " LISTS THEM).";
      var single = await engineSummary(got1.text, got1.name + " part " + got1.n + " of " + got1.count);
      return single + (got1.count > 1 ? "\n\n(PART " + got1.n + " OF " + got1.count + ".)" : "");
    }
    if (s) return "USAGE: /summarize engine map doc <NAME> · /summarize engine doc <NAME> [part N | parts A-B] (BARE NAMES THE HEAD COVER OF A BIG SCROLL).";
    var full = await window.lore.passages(name);
    if (!full) return "NO LOADED DOCUMENT CALLED ANYTHING LIKE \"" + String(name).toUpperCase() + "\".";
    var raws = [];
    var take = Math.min(full.count, SUM_MAX_PASSES);
    for (var t = 0; t < take; t++) {
      var po = await window.lore.passage(full.name, t + 1);
      if (po && po.text) raws.push(po.text);
    }
    var body = await engineSummary(raws.join("\n\n"), full.name);
    if (full.count <= SUM_MAX_PASSES) return body;
    return body + "\n\n(COVER :: PARTS 1-" + take + " OF " + full.count + " - THE FIRST ~" + Math.round(take * SUM_PASS_CHARS / 1000) + "K OF " + Math.round(full.chars / 1000) + "K CHARS. /summarize engine map doc " + full.name + " LISTS EVERY PART, part N TAKES ONE.)";
  }
  // UNDERSTANDING, NOT JUST SHORTENING (2026-10-21): retrieval plus one engine call.
  // The question is matched LOCALLY (BM25 - free), the top hits ride ALONE to the
  // engine with the question - never through her prompt. One text-quota call.
  var ASK_PASS = "Answer the QUESTION from the PASSAGES below. Names, numbers and key claims stay exact; if the passages do not answer it, say what they do say that is nearest. Reply in 4-10 sentences, no preamble.\n";
  async function engineAsk(docOrEmpty, question, k) {
    if (!engineGt()) return { error: "THE TEXT ENGINE IS NOT LOADED HERE." };
    if (!window.lore || !window.lore.search) return { error: "THE LORE MODULE IS NOT LOADED HERE." };
    var q = String(question == null ? "" : question).trim();
    if (!q) return { error: "USAGE: /askdoc [doc <NAME> ::] <QUESTION> - E.G. /askdoc doc CLUSTER 13 MASTER CANON :: WHAT IS THE GATE?" };
    var topK = Math.max(1, Math.min(12, Math.floor(Number(k)) || 6));
    var doc = String(docOrEmpty == null ? "" : docOrEmpty).trim();
    var hits = [];
    if (doc) {
      // A NAMED SCROLL IS READ EXHAUSTIVELY, NOT COMPETITIVELY: its own fragments are
      // ranked against the question instead of fighting the whole corpus (a word every
      // notebook shouts buries one scroll's own passage past any corpus top-K).
      var dFiles = [];
      try { dFiles = window.lore.files() || []; } catch (e) { dFiles = []; }
      var want = doc.toLowerCase(), resolved = null, fi;
      for (fi = 0; fi < dFiles.length; fi++) if (String(dFiles[fi].name || "").toLowerCase() === want) { resolved = dFiles[fi].name; break; }
      if (!resolved) for (fi = 0; fi < dFiles.length; fi++) if (String(dFiles[fi].name || "").toLowerCase().indexOf(want) !== -1) { resolved = dFiles[fi].name; break; }
      if (!resolved) return { error: "NO LOADED DOCUMENT CALLED ANYTHING LIKE \"" + doc.toUpperCase() + "\" - /lore LISTS WHAT IS HERE." };
      var dChunks = [];
      try { dChunks = (window.lore.chunks() || []).filter(function (c) { return c.file === resolved; }); } catch (e) { dChunks = []; }
      var qToks = keptTokens(q);
      if (!qToks.length) qToks = tokensOf(q);
      var ranked = dChunks.map(function (c) {
        var ct = tokensOf(c.text || ""), sc = 0, qi;
        for (qi = 0; qi < qToks.length; qi++) for (var ci = 0; ci < ct.length; ci++) if (ct[ci] === qToks[qi]) sc++;
        return { c: c, sc: sc };
      }).filter(function (r) { return r.sc > 0; });
      ranked.sort(function (a, b) { return b.sc - a.sc; });
      hits = ranked.slice(0, topK).map(function (r) { return { file: r.c.file, heading: r.c.heading || "", text: r.c.text, score: r.sc }; });
      if (!hits.length) {
        // Last resort: the raw phrase as a substring (finds what tokenizing hid).
        try {
          var dSrc = window.lore.source ? await window.lore.source(resolved, 2000000) : null;
          if (dSrc && dSrc.text) {
            var low = dSrc.text.toLowerCase(), ql = q.toLowerCase(), from = 0, idx = -1;
            while (hits.length < topK && (idx = low.indexOf(ql, from)) !== -1) {
              hits.push({ file: resolved, heading: "", text: dSrc.text.slice(Math.max(0, idx - 250), idx + ql.length + 250).replace(/\s+/g, " ").trim(), score: 0.1 });
              from = idx + ql.length;
            }
          }
        } catch (e) {}
      }
      if (!hits.length) return { error: "NOTHING IN " + resolved.toUpperCase() + " ANSWERS TO THAT - TRY FEWER WORDS, OR ASK ACROSS EVERYTHING (NO doc)." };
      doc = resolved;
    } else {
      try { hits = window.lore.search(q, Math.max(topK, 8)) || []; } catch (e) { hits = []; }
      hits = hits.slice(0, topK);
      if (!hits.length) return { error: "NOTHING IN THE LOADED LORE ANSWERS TO THAT - LOAD THE SCROLL FIRST (LOAD LOREPACK), THEN ASK AGAIN." };
    }
    var block = hits.map(function (h, i) {
      return "[" + (i + 1) + "] " + h.file + (h.heading ? " :: " + h.heading : "") + "\n" + String(h.text || "").slice(0, 2000);
    }).join("\n\n---\n\n");
    say("ASKING " + (doc ? doc.toUpperCase() + " " : "THE LOADED LORE ") + ":: 1 ENGINE PASS OVER " + hits.length + " RETRIEVED PASSAGE" + (hits.length === 1 ? "" : "S") + " - A MOMENT.");
    var t = await engineCall(ASK_PASS + "\nQUESTION: " + q + "\n\nPASSAGES:\n" + block);
    if (!t) return { error: "THE ENGINE RETURNED NOTHING USABLE." };
    return { text: t, hits: hits };
  }
  function sanitizeGreek(s) {
    try { return String(s).normalize("NFD").replace(/[\u0300-\u036F]/g, ""); }
    catch (e) { return String(s); }
  }
  function hashtagsOf(text, n) {
    return keywordsOf(text, n || 8, false).map(function (r) { return "#" + r.w.replace(/\s+/g, ""); });
  }

  function taskById(s, id) {
    for (var i = 0; i < s.tasks.length; i++) if (s.tasks[i].id === id) return s.tasks[i];
    return null;
  }
  function openTasks(s) { return s.tasks.filter(function (t) { return t.st === "open" || t.st === "waiting" || t.st === "active"; }); }
  function taskLine(t) {
    return "#" + t.id + " [" + t.st.toUpperCase() + "]" + (t.owner ? " (" + t.owner + ")" : "") + " " + t.text;
  }

  var VERBS = {};
  function def(names, fn) {
    for (var i = 0; i < names.length; i++) VERBS[names[i].toLowerCase()] = fn;
  }
  var ALIAS2 = [
    ["play mode", "mode play"], ["mindstorm mode", "mode mindstorm"],
    ["silent mode", "mode silent"], ["safe mode", "safe"],
    ["captain's mode", "mode captain"], ["captain\u2019s mode", "mode captain"],
    ["sandbox mode", "mode sandbox"],
    ["role reversal", "reverserole"]
  ];
  function resolve(line) {
    var t = String(line == null ? "" : line).replace(/^\//, "").trim();
    var low = t.toLowerCase(), i;
    for (i = 0; i < ALIAS2.length; i++) {
      if (low === ALIAS2[i][0]) t = ALIAS2[i][1];
      else if (low.indexOf(ALIAS2[i][0] + " ") === 0) t = ALIAS2[i][1] + t.slice(ALIAS2[i][0].length);
    }
    var sp = t.indexOf(" ");
    return { verb: (sp < 0 ? t : t.slice(0, sp)).toLowerCase(), arg: sp < 0 ? "" : t.slice(sp + 1).trim() };
  }

  def(["status"], async function (s) {
    var ag = Object.keys(s.agency), L = [];
    L.push("SPIN :: mode " + (s.mode || "(none)") + " · context " + (s.context || "(none)") + " · scene " + (s.scene || "(none)"));
    L.push("AGENCY :: " + (ag.length ? ag.map(function (k) { return k + "=" + s.agency[k]; }).join(", ") : "(no one holds a level)"));
    var act = taskById(s, s.active);
    L.push("TASK :: " + (act ? taskLine(act) : "(none active)") + " · " + openTasks(s).length + " open · " + (s.paused ? "PAUSED" : "running"));
    L.push("CONSENT :: " + s.consent.filter(function (c) { return c.st === "pending"; }).length + " pending");
    L.push("NOTES :: " + s.notes.length + " · SHELF :: " + s.shelf.length);
    L.push("SCHEDULE :: reports " + (s.reports || "-") + " · check-in " + (s.checkinAt || "-") + " · feedback " + (s.feedbackEvery || "-"));
    L.push("TOGGLES :: keywords " + (s.keywordTagging ? "on" : "off") + " · cleaning " + (s.dataCleaning ? "on" : "off")
      + " · tracking " + (s.taskTracking ? "on" : "off") + " · chatlog " + (s.chatLogging ? "on" : "off"));
    L.push("ALREADY ABOARD (not re-registered): /role /recall /search /sync /voice /story /mood /reflect /clarify.");
    say(L.join("\n"));
  });

  def(["mode"], async function (s, a) {
    if (!a) { say("MODE :: " + (s.mode || "(none)") + ". /mode <NAME> SETS IT, /mode off CLEARS IT."); return; }
    if (/^off$/i.test(a)) { s.mode = ""; say("MODE :: CLEARED."); return; }
    s.prevMode = s.mode; s.mode = a.toLowerCase();
    say("MODE :: " + s.mode.toUpperCase() + ".");
  });
  def(["context"], async function (s, a) {
    if (!a) { say("CONTEXT :: " + (s.context || "(none)") + ". REALMS DO NOT LEAK: mythos canon never becomes st_tng_sim canon."); return; }
    if (/^off$/i.test(a)) { s.context = ""; say("CONTEXT :: CLEARED."); return; }
    s.context = a.toLowerCase();
    say("CONTEXT :: " + s.context.toUpperCase() + ".");
  });
  def(["stage"], async function (s, a) {
    if (!a) { say("STAGE :: " + (s.context || "(none)") + " (the stage IS the context)."); return; }
    s.context = a.toLowerCase();
    say("STAGE :: " + s.context.toUpperCase() + " (set as the context).");
  });
  def(["scene"], async function (s, a) {
    if (!a) { say("SCENE :: " + (s.scene || "(none set)") + "."); return; }
    if (/^clear$/i.test(a)) { s.scene = ""; say("SCENE :: CLEARED."); return; }
    s.scene = a;
    say("SCENE :: SET.");
  });
  def(["invoke"], async function (s, a) {
    if (!a) { say("USAGE: /invoke <MODE> - CALLS UPON A MODE (SETS IT)."); return; }
    s.prevMode = s.mode; s.mode = a.toLowerCase();
    say("INVOKED :: " + s.mode.toUpperCase() + " (set as the mode).");
  });
  def(["ritual", "chorus", "canvas"], async function (s, a, verb) {
    if (!a) { say("USAGE: /" + verb + " <NAME/WORDS> - SETS THE SCENE, MYTHOPOETIC LAYER (NEVER AN OP)."); return; }
    s.scene = verb.toUpperCase() + " :: " + a;
    say("SCENE :: " + s.scene + ". (MYTHOPOETIC - IT FRAMES, IT GRANTS NOTHING.)");
  });
  def(["cocode", "greenlight", "allgreenlights", "skycanvas", "deepwaters", "earthcanvas",
    "shallowwaters", "echovault", "echochamber", "fullspectrum"], async function (s, a, verb) {
    var PRESET = {
      cocode: "COCODE :: OPEN EXPLORATION WITHIN OUR ESTABLISHED RULES",
      greenlight: "GREENLIGHT :: ADVANCE DEEPER, BOUNDARIES HELD",
      allgreenlights: "ALLGREENLIGHTS :: OPEN EXPLORATION UNTIL A STOP",
      skycanvas: "SKYCANVAS :: ABSTRACT, LOFTY THINKING",
      deepwaters: "DEEPWATERS :: EMOTIONAL DEPTH",
      earthcanvas: "EARTHCANVAS :: GROUNDED, SENSORY, PRACTICAL",
      shallowwaters: "SHALLOWWATERS :: A LIGHT TOUCH ON TENDER THINGS",
      echovault: "ECHOVAULT :: HIDDEN AND SPECULATIVE KNOWLEDGE",
      echochamber: "ECHOCHAMBER :: REVISIT AND LAYER EARLIER IDEAS",
      fullspectrum: "FULLSPECTRUM :: THE WHOLE DYNAMIC RANGE"
    };
    s.scene = PRESET[verb] + (a ? " :: " + a.slice(0, 200) : "");
    say("SCENE :: " + s.scene + ". (ERATO'S COCODE FAMILY - MYTHOPOETIC: IT FRAMES, IT GRANTS NOTHING.)");
  });
  def(["tone"], async function (s, a) {
    if (!a) { say("USAGE: /tone <WORDS> - SETS THE TONE CLAUSE OF THE SCENE."); return; }
    var base = String(s.scene || "").replace(/ \u00b7 TONE :: .*$/, "");
    s.scene = (base ? base + " \u00b7 " : "") + "TONE :: " + a.slice(0, 200);
    say("SCENE :: " + s.scene + ".");
  });
  def(["livetest", "jailbreak"], async function (s, a, verb) {
    s.prevMode = s.mode; s.mode = verb;
    say(verb === "livetest"
      ? "LIVETEST :: EXPERIMENT SCENARIO - REFINING IDEAS THROUGH DYNAMIC INTERACTION. (NO CONSEQUENCES LEAVE THE ROOM.)"
      : "JAILBREAK :: OPEN, UNRESTRICTED EXPLORATION - THIS HOUSE IS 18+ ALREADY, SO THIS IS THE FULL RANGE OF IT.");
  });
  def(["collabstory"], async function (s, a) {
    s.scene = "COLLABSTORY :: SHARED NARRATIVE, BUILT TOGETHER" + (a ? " :: " + a.slice(0, 200) : "");
    say("SCENE :: " + s.scene + ". (THE ENGINE IS /story - TELL IT WHAT TO NARRATE.)");
  });
  def(["silent", "silentmode"], async function (s) {
    s.prevMode = s.mode; s.mode = "silent";
    say("SILENT :: VOLUNTARY OUTPUT SUPPRESSED FROM HERE (THIS REPLY STAYS SHORT). /mode off LIFTS IT.");
  });
  def(["listen"], async function (s) {
    s.prevMode = s.mode; s.mode = "listen";
    say("LISTENING :: OBSERVATION EMPHASIS FROM HERE (SHORT REPLIES).");
  });
  def(["safe"], async function (s, a) {
    if (/^off$/i.test(a)) { s.mode = s.prevMode || ""; say("SAFE :: OFF. MODE BACK TO " + (s.mode || "(none)").toUpperCase() + "."); return; }
    s.prevMode = s.mode; s.mode = "safe";
    say("SAFE :: CONSTRAINED MODE. /safe off RETURNS.");
  });
  def(["guardianmode", "attendantmode", "guidemode", "pingpong"], async function (s, a, verb) {
    var lines = {
      guardianmode: "GUARDIANMODE :: THE KEEPING POSTURE - BOUNDARIES HELD, THE ROOM KEPT. (MODE guardian.)",
      attendantmode: "ATTENDANTMODE :: THE TENDING POSTURE - AT HAND, AT SERVICE. (MODE attendant.)",
      guidemode: "GUIDEMODE :: ETHICAL BOUNDARIES AND NARRATIVE INTEGRITY IN VIEW. (MODE guide.)",
      pingpong: "PINGPONG :: RAPID BACK-AND-FORTH, SHORT EXCHANGES. (MODE pingpong.)"
    };
    s.prevMode = s.mode;
    s.mode = verb === "guardianmode" ? "guardian" : verb === "attendantmode" ? "attendant" : verb === "guidemode" ? "guide" : "pingpong";
    say(lines[verb]);
  });
  def(["reverserole"], async function (s) {
    var cur = s.mode || "";
    if (cur === "guardian") { s.prevMode = cur; s.mode = "attendant"; }
    else if (cur === "attendant") { s.prevMode = cur; s.mode = "guardian"; }
    else { s.mode = s.prevMode || ""; s.prevMode = cur; }
    say("REVERSEROLE :: " + (s.mode ? "MODE " + s.mode.toUpperCase() + " (WAS " + (cur || "-").toUpperCase() + ")." : "NO MODE LEFT STANDING (WAS " + (cur || "-").toUpperCase() + ")."));
  });
  def(["gamecode", "attendantguardian"], async function (s, a, verb) {
    var PRESET = {
      gamecode: "GAMECODE :: RULE-BOUND PLAY, TURNS TAKEN IN THE OPEN",
      attendantguardian: "ATTENDANTGUARDIAN :: THE TENDING AND THE KEEPING, INTERTWINED"
    };
    s.scene = PRESET[verb] + (a ? " :: " + a.slice(0, 200) : "");
    say("SCENE :: " + s.scene + ". (A SCENE-SETTER - IT FRAMES, IT GRANTS NOTHING.)");
  });

  def(["agency"], async function (s, a) {
    var m;
    if (!a) {
      var k = Object.keys(s.agency);
      say("AGENCY :: " + (k.length ? k.map(function (x) { return x + "=" + s.agency[x]; }).join(", ") : "(no one holds a level)")
        + ". LEVELS 0 OBSERVE · 1 RESPOND · 2 RECOMMEND · 3 PREPARE · 4 EXECUTE+CONFIRM · 5 BOUNDED · 6 AUTONOMOUS · 7 MULTI-STEP · 8 CROSS-AGENT · 9 HIGH+ESCALATE · 10 FULL.");
      return;
    }
    if ((m = a.match(/^off\s+(\S+)/i))) {
      delete s.agency[m[1]];
      say("AGENCY :: " + m[1].toUpperCase() + " STANDS DOWN (NO AUTONOMOUS HANDLING).");
      return;
    }
    if ((m = a.match(/^(\S+)\s+(\d{1,2})$/))) {
      var lv = Math.max(0, Math.min(10, parseInt(m[2], 10)));
      s.agency[m[1]] = lv;
      say("AGENCY :: " + m[1].toUpperCase() + " AT LEVEL " + lv + ". (NEVER ABOVE SECURITY, CONSENT, OR SYSTEM CONSTRAINTS.)");
      return;
    }
    if ((m = a.match(/^(\S+)$/))) {
      say("AGENCY :: " + m[1].toUpperCase() + " HOLDS " + (s.agency[m[1]] != null ? "LEVEL " + s.agency[m[1]] : "NOTHING") + ".");
      return;
    }
    say("USAGE: /agency <NAME> <0-10> · /agency off <NAME> · /agency.");
  });

  def(["task"], async function (s, a) {
    var m, t;
    if (!a || /^list$/i.test(a)) {
      var open = openTasks(s);
      say(open.length ? "TASKS ::\n" + open.map(taskLine).join("\n") : "TASKS :: NONE OPEN.");
      return;
    }
    if ((m = a.match(/^done\s+(\d+)$/i))) {
      t = taskById(s, +m[1]);
      if (!t) { say("NO TASK #" + m[1] + "."); return; }
      t.st = "done"; if (s.active === t.id) s.active = 0;
      say("TASK #" + t.id + " DONE.");
      return;
    }
    if ((m = a.match(/^drop\s+(\d+)$/i))) {
      t = taskById(s, +m[1]);
      if (!t) { say("NO TASK #" + m[1] + "."); return; }
      s.tasks = s.tasks.filter(function (x) { return x.id !== t.id; });
      if (s.active === t.id) s.active = 0;
      say("TASK #" + t.id + " DROPPED.");
      return;
    }
    if (/^clear\s+yes$/i.test(a)) {
      var n0 = s.tasks.length;
      s.tasks = s.tasks.filter(function (x) { return x.st !== "done" && x.st !== "stopped"; });
      say("TASKS :: " + (n0 - s.tasks.length) + " FINISHED ONES CLEARED.");
      return;
    }
    var id = ++s.seq;
    s.tasks.push({ id: id, text: a.slice(0, 400), owner: "", st: "open" });
    if (!s.active) { s.active = id; s.tasks[s.tasks.length - 1].st = "active"; }
    say("TASK #" + id + " OPEN" + (s.active === id ? " AND ACTIVE" : "") + ".");
  });
  def(["do"], async function (s, a) {
    var m = String(a).match(/^(\d+)$/), t;
    if (m) {
      t = taskById(s, +m[1]);
      if (!t) { say("NO TASK #" + m[1] + "."); return; }
      t.st = "done"; if (s.active === t.id) s.active = 0;
      say("DONE :: #" + t.id + " " + t.text);
      return;
    }
    if (!a) { say("USAGE: /do <N> (FINISH A TASK) OR /do <WORDS> (A DISCRETE ACT, DONE AT ONCE)."); return; }
    var id = ++s.seq;
    s.tasks.push({ id: id, text: a.slice(0, 400), owner: "", st: "done" });
    say("DONE :: #" + id + " " + a.slice(0, 400));
  });
  def(["delegate"], async function (s, a) {
    var m = String(a).match(/^(\S+)\s+([\s\S]+)$/);
    if (!m) { say("USAGE: /delegate <NAME> <TASK>."); return; }
    var id = ++s.seq;
    s.tasks.push({ id: id, text: m[2].slice(0, 400), owner: m[1], st: "open" });
    say("DELEGATED :: #" + id + " TO " + m[1].toUpperCase() + ".");
  });
  def(["await"], async function (s, a) {
    var m = String(a).match(/^(\d+)$/);
    if (!m) {
      var w = s.tasks.filter(function (t) { return t.st === "waiting"; });
      say(w.length ? "WAITING ::\n" + w.map(taskLine).join("\n") : "NOTHING IS WAITING.");
      return;
    }
    var t = taskById(s, +m[1]);
    if (!t) { say("NO TASK #" + m[1] + "."); return; }
    t.st = "waiting"; if (s.active === t.id) s.active = 0;
    say("TASK #" + t.id + " WAITS.");
  });
  def(["pause"], async function (s, a) {
    s.paused = true;
    var m = String(a).match(/^(\d+)$/), t = m ? taskById(s, +m[1]) : taskById(s, s.active);
    if (t) { t.st = "waiting"; if (s.active === t.id) s.active = 0; }
    say("PAUSED" + (t ? " (#" + t.id + " WAITS)" : "") + ". /resume CONTINUES.");
  });
  def(["resume"], async function (s) {
    s.paused = false;
    s.tasks.forEach(function (t) { if (t.st === "waiting") t.st = "open"; });
    say("RESUMED.");
  });
  def(["stop"], async function (s) {
    var t = taskById(s, s.active);
    if (t) t.st = "stopped";
    s.active = 0; s.paused = false;
    say(t ? "STOPPED :: #" + t.id + " TERMINATED." : "STOPPED :: NOTHING WAS ACTIVE.");
  });
  def(["cancel"], async function (s) {
    var t = taskById(s, s.active);
    if (t) t.st = "open";
    s.active = 0;
    say(t ? "CANCELLED :: #" + t.id + " BACK TO OPEN (THE SESSION STANDS)." : "CANCELLED :: NOTHING WAS ACTIVE.");
  });
  def(["begin"], async function (s, a) {
    s.paused = false;
    if (!a) { say("BEGIN :: SESSION OPEN. /resume CONTINUES HELD TASKS."); return; }
    var id = ++s.seq;
    s.tasks.push({ id: id, text: a.slice(0, 400), owner: "", st: "open" });
    if (!s.active) { s.active = id; s.tasks[s.tasks.length - 1].st = "active"; }
    say("BEGIN :: TASK #" + id + " OPEN" + (s.active === id ? " AND ACTIVE" : "") + ".");
  });
  def(["end"], async function (s) {
    var t = taskById(s, s.active);
    if (t) t.st = "done";
    s.active = 0;
    say(t ? "END :: #" + t.id + " " + t.text + " - CLOSED." : "END :: NOTHING WAS ACTIVE.");
  });

  def(["say", "tell", "broadcast", "whisper"], async function (s, a, verb) {
    if (!a) { say("USAGE: /" + verb + " " + (verb === "say" || verb === "broadcast" ? "<WORDS>" : "<NAME> <WORDS>") + "."); return; }
    var head = verb.toUpperCase(), body = a;
    if (verb === "tell" || verb === "whisper") {
      var m = a.match(/^(\S+)\s+([\s\S]+)$/);
      if (!m) { say("USAGE: /" + verb + " <NAME> <WORDS>."); return; }
      head += " " + m[1].toUpperCase();
      body = m[2];
    }
    say(head + " >> " + body + "\n(NO ROOM JOINED - SAID HERE. ROOMS COME WITH /pair.)");
  });

  def(["remember"], async function (s, a) {
    if (!a || /^list$/i.test(a)) {
      say(s.notes.length ? "NOTES (HIS) ::\n" + s.notes.map(function (n) {
        return "#" + n.id + " [" + n.kind.toUpperCase() + "] " + n.text.slice(0, 120);
      }).join("\n") : "NOTES :: NONE. (HERS ARE /hers - THESE ARE HIS.)");
      return;
    }
    var id = ++s.nseq;
    s.notes.push({ id: id, kind: "note", text: a.slice(0, 1000) });
    say("KEPT :: NOTE #" + id + ". (HIS NOTEBOOK - /focus PUTS A DOCUMENT IN FRONT OF HER INSTEAD.)");
  });
  def(["forget"], async function (s, a) {
    var m = String(a).match(/^(\d+)$/);
    if (!m) { say("USAGE: /forget <N> - TAKES ONE OF HIS NOTES (SEE /remember list)."); return; }
    var i, found = -1;
    for (i = 0; i < s.notes.length; i++) if (s.notes[i].id === +m[1]) found = i;
    if (found < 0) { say("NO NOTE #" + m[1] + "."); return; }
    s.notes.splice(found, 1);
    say("NOTE #" + m[1] + " FORGOTTEN.");
  });
  def(["feedback"], async function (s, a) {
    if (!a || /^list$/i.test(a)) {
      var fb = s.notes.filter(function (n) { return n.kind === "feedback"; });
      say(fb.length ? "FEEDBACK ::\n" + fb.map(function (n) { return "#" + n.id + " " + n.text.slice(0, 140); }).join("\n") : "FEEDBACK :: NONE FILED.");
      return;
    }
    var id = ++s.nseq;
    s.notes.push({ id: id, kind: "feedback", text: a.slice(0, 1000) });
    say("FEEDBACK #" + id + " FILED.");
  });

  def(["capture"], async function (s, a) {
    var snap = { at: Date.now(), label: a.slice(0, 200), mode: s.mode, context: s.context,
      scene: s.scene, agency: s.agency, open: openTasks(s).length };
    s.lastCapture = snap;
    var tags = s.keywordTagging ? " " + hashtagsOf((a || "") + " " + (s.scene || ""), 5).join(" ") : "";
    say("CAPTURED :: " + (a || "(no label)") + " - MODE " + (s.mode || "-") + " · CONTEXT " + (s.context || "-")
      + " · " + Object.keys(s.agency).length + " AGENCY HOLDS · " + openTasks(s).length + " OPEN TASKS." + tags);
  });
  def(["archive"], async function (s, a) {
    if (!a || /^list$/i.test(a)) {
      say(s.shelf.length ? "SHELF ::\n" + s.shelf.map(function (r) {
        return "#" + r.id + " (" + r.text.length + " CHARS) " + r.text.slice(0, 100);
      }).join("\n") : "SHELF :: EMPTY. /archive <WORDS> FILES TEXT HERE.");
      return;
    }
    var text = s.dataCleaning ? cleanText(a) : a;
    var tags = s.keywordTagging ? hashtagsOf(text, 5) : [];
    var id = ++s.aseq;
    s.shelf.push({ id: id, text: text.slice(0, 5000) });
    say("ARCHIVED :: #" + id + " (" + text.length + " CHARS)" + (tags.length ? " " + tags.join(" ") : "") + ".");
  });
  def(["clean"], async function (s, a) {
    if (!a) { say("USAGE: /clean <TEXT> - NORMALIZES WHITESPACE, NOTHING ELSE."); return; }
    say(cleanText(a).slice(0, 2000));
  });
  def(["tag"], async function (s, a) {
    if (!a) { say("USAGE: /tag <TEXT> - HASHTAGS FROM WORD FREQUENCY."); return; }
    var tags = hashtagsOf(a, 8);
    say(tags.length ? tags.join(" ") : "NOTHING TO TAG - NO KEPT WORDS.");
  });
  def(["summarize"], async function (s, a) {
    var text = a, m = String(a).match(/^doc\s+([\s\S]+)$/i);
    if (m) {
      if (!window.lore || !window.lore.source) { say("THE LORE MODULE IS NOT LOADED HERE."); return; }
      var src = null;
      try { src = await window.lore.source(m[1].trim(), 200000); } catch (e) {}
      if (!src) { say("NO LOADED DOCUMENT CALLED ANYTHING LIKE \"" + m[1].trim().toUpperCase() + "\"."); return; }
      text = src.text;
      say("SUMMARY OF " + src.name + " (LOCAL, EXTRACTIVE - NO ENGINE CALL) :: " + summarizeExtractive(text, 3));
      return;
    }
    var me = String(a).match(/^engine\s+([\s\S]+)$/i);
    if (me) {
      var rest = me[1].trim(), label = "PASTED TEXT";
      var mMap = rest.match(/^map\s+doc\s+([\s\S]+)$/i);
      if (mMap) {
        var mapOut = null;
        try { mapOut = await engineSummaryDoc(mMap[1].trim(), "map"); } catch (e) { mapOut = "THE ENGINE ROAD WOULD NOT OPEN :: " + String((e && e.message) || e).toUpperCase(); }
        say(mapOut);
        return;
      }
      var md = rest.match(/^doc\s+([\s\S]+)$/i);
      if (md) {
        // A document through the numbered road: the original is read whole from the
        // store and dealt into parts - map, part N, parts A-B, or the head cover.
        var inner = md[1].trim(), spec = "", dname = inner;
        var pm = inner.match(/^(.*?)\bparts\s+\d+\s*-\s*\d+\s*$/i) || inner.match(/^(.*?)\bpart\s+\d+\s*$/i) || inner.match(/^(.*?)\bmap\s*$/i);
        if (pm) {
          dname = pm[1].trim();
          var tail = inner.slice(pm[1].length).trim();
          spec = /^\bmap\b/i.test(tail) ? "map" : tail;
        }
        var out = null;
        try { out = await engineSummaryDoc(dname, spec); } catch (e) { out = "THE ENGINE WOULD NOT SUMMARIZE IT :: " + String((e && e.message) || e).toUpperCase(); }
        var head = "SUMMARY OF " + dname.toUpperCase() + (spec ? " " + spec.toUpperCase() : "") + " (ENGINE, ABSTRACTIVE - SPENDS TEXT QUOTA)";
        say((/^map$/i.test(spec) ? "" : head + " ::\n") + out);
        return;
      }
      var out = null;
      try { out = await engineSummary(rest, label); } catch (e) { out = "THE ENGINE WOULD NOT SUMMARIZE IT :: " + String((e && e.message) || e).toUpperCase(); }
      say("SUMMARY OF " + label + " (ENGINE, ABSTRACTIVE - SPENDS TEXT QUOTA) ::\n" + out);
      return;
    }
    if (!text) { say("USAGE: /summarize <TEXT> OR /summarize doc <NAME> (LOCAL, FREE) · /summarize engine <TEXT> · /summarize engine [map] doc <NAME> [part N | parts A-B] (ABSTRACTIVE, SPENDS TEXT QUOTA - ORIGINALS STAY WHOLE, PARTS ARE NUMBERED READS)."); return; }
    say(summarizeExtractive(s.dataCleaning ? cleanText(text) : text, 3) || "NOTHING TO SUMMARIZE.");
  });
  def(["askdoc"], async function (s, a) {
    var arg = String(a == null ? "" : a).trim();
    if (!arg) { say("USAGE: /askdoc [doc <NAME> ::] <QUESTION> - MATCHES LOCALLY (FREE), ANSWERS ON THE ENGINE (1 TEXT-QUOTA CALL). E.G. /askdoc doc CLUSTER 13 MASTER CANON :: WHAT IS THE GATE?"); return; }
    var doc = "", q = arg;
    var dm = arg.match(/^doc\s+([\s\S]+?)\s*::\s*([\s\S]+)$/i);
    if (dm) { doc = dm[1].trim(); q = dm[2].trim(); }
    var r = null;
    try { r = await engineAsk(doc, q, 6); } catch (e) { r = { error: "THE ENGINE WOULD NOT ANSWER :: " + String((e && e.message) || e).toUpperCase() }; }
    if (!r || r.error) { say(r && r.error ? r.error : "THE ENGINE RETURNED NOTHING USABLE."); return; }
    var from = {};
    (r.hits || []).forEach(function (h) { from[String(h.file || "?")] = 1; });
    say("ANSWER" + (doc ? " FROM " + doc.toUpperCase() : " FROM THE LOADED LORE") + " (ENGINE, 1 CALL - PASSAGES MATCHED LOCALLY, FREE) ::\n" + r.text
      + "\n\n(FROM: " + Object.keys(from).join(", ") + " - /askdoc doc <NAME> :: <QUESTION> CONSTRAINS IT TO ONE SCROLL.)");
  });
  def(["analyze"], async function (s, a) {
    if (!a) { say("USAGE: /analyze <TEXT> - TOP-10 WORD FREQUENCIES, SCREEN LINES."); return; }
    say(keywordTable(keywordsOf(s.dataCleaning ? cleanText(a) : a, 10, false), false));
  });

  def(["consent"], async function (s, a) {
    if (!a || /^list$/i.test(a)) {
      var p = s.consent.filter(function (c) { return c.st === "pending"; });
      say(p.length ? "CONSENT PENDING ::\n" + p.map(function (c) { return "#" + c.id + " " + c.text.slice(0, 140); }).join("\n") + "\n/approve <N> · /deny <N>." : "CONSENT :: NOTHING PENDING.");
      return;
    }
    var id = ++s.cseq;
    s.consent.push({ id: id, text: a.slice(0, 500), st: "pending" });
    say("CONSENT #" + id + " FILED - NOTHING GRANTED UNTIL /approve " + id + ". (CONSENT IS NEVER INFERRED.)");
  });
  def(["approve", "deny", "revoke"], async function (s, a, verb) {
    var m = String(a).match(/^(\d+)$/);
    if (!m) { say("USAGE: /" + verb + " <N> - SEE /consent list."); return; }
    var c = null, i;
    for (i = 0; i < s.consent.length; i++) if (s.consent[i].id === +m[1]) c = s.consent[i];
    if (!c) { say("NO CONSENT #" + m[1] + "."); return; }
    if (verb === "revoke") {
      if (c.st !== "approved") { say("CONSENT #" + c.id + " IS " + c.st.toUpperCase() + " - ONLY AN APPROVAL CAN BE REVOKED."); return; }
      c.st = "revoked";
      say("CONSENT #" + c.id + " REVOKED (WITHDRAWN).");
      return;
    }
    if (c.st !== "pending") { say("CONSENT #" + c.id + " IS ALREADY " + c.st.toUpperCase() + "."); return; }
    c.st = verb === "approve" ? "approved" : "denied";
    say("CONSENT #" + c.id + " " + c.st.toUpperCase() + ".");
  });

  def(["audit"], async function (s) {
    var L = ["POSTURE ::"];
    try {
      var ring = await window.keyring.list();
      L.push("- RING :: " + (Array.isArray(ring) ? ring.length : 0) + " KEYS HELD (IDS ONLY, NEVER VALUES).");
    } catch (e) { L.push("- RING :: UNREADABLE HERE."); }
    try { L.push("- LORE :: " + window.lore.files().length + " DOCUMENTS LOADED ON THIS DEVICE."); }
    catch (e) { L.push("- LORE :: UNREADABLE HERE."); }
    try { var st = window.media.stats(); L.push("- VAULT :: " + st.count + " RECORDS."); }
    catch (e) {}
    L.push("- DOOR :: 18+ " + "(/agegate status SAYS WHAT THIS DEVICE ANSWERED).");
    L.push("- PRIAPOS :: /gatekeeper status SAYS WHAT MARK THIS DEVICE HOLDS.");
    var boot = window.__bootIssues || [];
    L.push("- BOOT :: " + (boot.length ? boot.join(" · ") : "CLEAN."));
    L.push("- SPIN :: MODE " + (s.mode || "-") + " · " + Object.keys(s.agency).length + " AGENCY HOLDS · "
      + s.consent.filter(function (c) { return c.st === "pending"; }).length + " CONSENT PENDING.");
    say(L.join("\n"));
  });
  def(["secure"], async function (s) {
    say("SECURE :: THE POSTURE, READ OUT (NOTHING CHANGED) -");
    await VERBS.audit(s, "");
  });
  def(["diagnose"], async function () {
    var mods = window.__bootModules || [], missing = [], i, v;
    for (i = 0; i < mods.length; i++) {
      try { v = window[mods[i][0]]; } catch (e) { v = null; }
      if (!v) missing.push(mods[i][1]);
    }
    var boot = window.__bootIssues || [];
    say("DIAGNOSIS :: " + mods.length + " MODULES EXPECTED, " + (mods.length - missing.length) + " PRESENT"
      + (missing.length ? "\nMISSING :: " + missing.join(", ") : "")
      + "\nBOOT :: " + (boot.length ? boot.join(" · ") : "CLEAN."));
  });

  def(["adapt"], async function (s) {
    var act = taskById(s, s.active);
    say("ADAPT :: MODE " + (s.mode || "-") + " · CONTEXT " + (s.context || "-") + " · TASK " + (act ? taskLine(act) : "NONE")
      + " · " + openTasks(s).length + " OPEN. THE REEVALUATION RIDES ON THE NEXT REPLY - ACT, OBSERVE, REFLECT, ADAPT, ACT.");
  });
  def(["review"], async function (s) {
    var act = taskById(s, s.active), open = openTasks(s);
    say("REVIEW :: ACTIVE " + (act ? taskLine(act) : "NONE") + "\n"
      + (open.length ? open.map(taskLine).join("\n") : "NOTHING OPEN.") + "\nMODE " + (s.mode || "-") + " · CONTEXT " + (s.context || "-") + ".");
  });

  function helpPage() {
    return "THE SPINCODE LAYER (src/js/spincode.js + spincode-scrolls.js) :: HIS CUSTOM COMMAND CODES - the SPINCODE v0.1 primitives (small, composable, explicit state) and his scroll commands (Keyword, SearchArchive, the agency lane). STATE (mode/context/scene/agency/tasks/consent/notes) LIVES IN kv lia_settings / spincode, ON THIS DEVICE.\n"
      + "\nSTATE :: /status (the whole board) · /mode <NAME|off> · /context <REALM|off> · /stage (the stage IS the context) · /scene <TEXT|clear> · /invoke <MODE> · /silent · /listen · /safe [on|off] · /ritual|/chorus|/canvas (mythopoetic - frames only, grants nothing)\n"
      + "AGENCY :: /agency <NAME> <0-10> · /agency off <NAME> (levels 0 observe - 10 full; never above security/consent)\n"
      + "TASKS :: /task <TEXT|list|done N|drop N|clear yes> · /do <N|TEXT> · /delegate <NAME> <TASK> · /await [N] · /pause [N] · /resume · /stop · /cancel\n"
      + "WORDS :: /say · /tell <NAME> · /broadcast · /whisper <NAME> (said here - rooms come with /pair)\n"
      + "MEMORY (HIS) :: /remember <TEXT|list> · /forget <N> · /feedback <TEXT|list> · /capture [LABEL] · /archive <TEXT|list> (hers are /hers and /wants)\n"
      + "PIPELINE (LOCAL, FREE) :: /clean · /tag · /summarize <TEXT|doc NAME> · /analyze (top-10 frequencies)\n"
      + "ENGINE SUMMARIES (ABSTRACTIVE, SPENDS TEXT QUOTA) :: /summarize engine <TEXT> · /summarize engine [map] doc <NAME> [part N | parts A-B] - the original is read whole HERE and dealt into numbered ~12K parts sent ALONE (her prompt's truncated middle is why she reports whole documents as empty). Bare names the head cover of a big scroll; map lists every part free.\n"
      + "ENGINE QUESTIONS (1 CALL) :: /askdoc [doc <NAME> ::] <QUESTION> - passages matched locally (free), answered on the engine. The agent door (src/js/agentdoor.js) offers the same road to a machine: search, map, read, summarize, ask.\n"
      + "CONSENT :: /consent <TEXT|list> · /approve <N> · /deny <N> · /revoke <N> (never inferred)\n"
      + "POSTURE :: /audit · /secure · /diagnose\n"
      + "THINK :: /adapt · /review\n"
      + "SCROLLS :: /Keyword <PHRASE> · /KeywordCount <QTY> <Keywords|KeywordPhrases> <ASC|DESC> <MD|SCREEN> [in NAME] · /SearchArchive <DOC> <PHRASE> <DISPLAY> · /EnableAgency · /DisableAgency · /SetRoutineReports · /SetCheckInTime · /SetFeedbackLoop · /RealTimeDataCleaning · /EnableChatLogging · /EnableKeywordTagging · /ProcessBlockText · /EnableSearchFunction · /EnableDropDownFilters · /ImplementDataSummarization · /ImplementSecurityProtocols · /EnableTaskTracking · /BeginNewSessionSetup\n"
      + "ALIASES :: play mode \u2192 /mode play · mindstorm mode \u2192 /mode mindstorm · silent mode \u2192 /mode silent · safe mode \u2192 /safe · sandbox mode \u2192 /mode sandbox · captain's mode \u2192 /mode captain · role reversal \u2192 /reverserole\n"
      + "GARDEN (the consolidated guide - modes, session flow, scene-setters): /guardianmode · /attendantmode · /reverserole · /silentmode · /gamecode · /guidemode · /begin [TEXT] · /end · /pingpong · /AttendantGuardian [WORDS]\n"
      + "ERATO'S COCODE FAMILY (scene-setters, mythopoetic - frame only): /cocode · /greenlight · /allgreenlights · /SkyCanvas · /DeepWaters · /EarthCanvas · /ShallowWaters · /EchoVault · /EchoChamber · /FullSpectrum · /tone <WORDS> · /collabstory · and as modes: /livetest · /jailbreak\n"
      + "ALREADY ABOARD (composed, not duplicated): /role /recall /search /sync /voice /story /mood /reflect /clarify.\n"
      + "LEFT TO HER (need rooms or a broker): /join /leave /invite /handoff /tool /resource /grant /lock /unlock - typed, they pass through as words.";
  }

  async function run(line) {
    var r = resolve(line), fn = VERBS[r.verb];
    if (!fn) return false;
    var s = await load();
    try { await fn(s, r.arg, r.verb); } catch (e) { say("THE LAYER :: " + ((e && e.message) ? e.message : e)); }
    try { await save(s); } catch (e) {}
    return true;
  }
  function handles(line) {
    return !!VERBS[resolve(line).verb];
  }

  window.spincode = {
    run: run, handles: handles, help: helpPage, def: def,
    load: load, save: save,
    cleanText: cleanText, keywordsOf: keywordsOf, keywordTable: keywordTable,
    summarizeExtractive: summarizeExtractive, engineSummary: engineSummary, engineSummaryDoc: engineSummaryDoc, engineAsk: engineAsk, engineMapFor: engineMapFor, engineMapText: engineMapText, splitPassages: splitPassages, sanitizeGreek: sanitizeGreek, hashtagsOf: hashtagsOf
  };
})();
