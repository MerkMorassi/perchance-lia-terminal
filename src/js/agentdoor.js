/* ---- THE AGENT DOOR (src/js/agentdoor.js) ------------------------------------
   A machine-friendly door into the forge, ported from the maya-plates MCP pattern
   (his mcp-server.zip + plates-mcp-chip.zip, 2026-10-19). What came over:
   - the VALIDATION (prompt/batch/prompts split on ||, n 1-4, total cap, seed
     int-or-random, sentence errors that end in NOTHING WAS SENT),
   - the RUN LINK (a shareable URL that spends no quota),
   - the STATUS CONTRACT (#status / #status-detail / #manifest / div.result rows -
     the exact DOM a headless driver polls, so the same Playwright pattern that
     drives plates works pointed at this terminal),
   - the HISTORY (kv-backed run log, idempotent by timestamp).
   What stayed there: the Python sidecar (Playwright driver, MCP stdio, FastAPI -
   host-side infra that cannot run inside a generator) and the plates params
   (aspect ladder, model ladder, steps - that generator's dials, not this one's).
   House values throughout: the four forge resolutions, the house guidance range,
   filing through the vault (how:'agentdoor'), sight queued for her eyes, and NO
   CHAT TILES - the gallery is the viewing room, even for a machine.
   ?autorun=1&prompt=... (or batch=...) runs headlessly after boot; /runlink
   builds the URL by hand without spending anything.
   ----------------------------------------------------------------------------- */

var AGENTDOOR_RESOLUTIONS = ["768x512", "512x768", "512x512", "768x768"];
var AGENTDOOR_DEFAULT_GUIDANCE = 7;
var AGENTDOOR_HISTORY_KEY = "agentdoor_runs";
var AGENTDOOR_HISTORY_CAP = 50;
// THE PLATES ASPECT MAP (maya-plates-agent's AR_MAP, verbatim). A plates-built URL opened
// here lands on house values through this; a house link carries `ar` back out beside
// `resolution`, so a plates driver reading it renders the right shape. model/steps/
// fallback/w/h (that generator's dials) are ACCEPTED AND IGNORED - the house has one
// backend and four fixed resolutions, and an unknown dial must never refuse a run.
var AGENTDOOR_AR_MAP = { "1:1": "512x512", "3:4": "512x768", "4:3": "768x512", "2:3": "512x768", "3:2": "768x512", "9:16": "512x768", "16:9": "768x512" };
var AGENTDOOR_RES_TO_AR = { "512x512": "1:1", "512x768": "3:4", "768x512": "4:3", "768x768": "1:1" };

function agentdoorStore() {
  try { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }
  catch (e) { return null; }
}

function agentdoorResolution() {
  try {
    if (typeof LIA_IMAGE_RESOLUTION === "string" && AGENTDOOR_RESOLUTIONS.indexOf(LIA_IMAGE_RESOLUTION) !== -1) return LIA_IMAGE_RESOLUTION;
  } catch (e) {}
  return "768x512";
}

function agentdoorSeedCeiling() {
  try { if (typeof SEED_CEILING === "number" && SEED_CEILING > 0) return SEED_CEILING; }
  catch (e) {}
  return 2147483646;
}

// THE VALIDATION (ported from the plates chip's collect(), house values). Throws
// Error sentences - a machine reads the reason, and NOTHING WAS SENT is the promise.
function agentdoorCollect(params) {
  params = params || {};
  var items = [];
  var i, t;
  if (params.prompts !== undefined && params.prompts !== null && Object.prototype.toString.call(params.prompts) === "[object Array]" && params.prompts.length) {
    for (i = 0; i < params.prompts.length; i++) { t = String(params.prompts[i] == null ? "" : params.prompts[i]).trim(); if (t) items.push(t); }
  } else if (String(params.batch || "").trim()) {
    var b = String(params.batch).split("||");
    for (i = 0; i < b.length; i++) { t = String(b[i]).trim(); if (t) items.push(t); }
  } else {
    var q = String(params.prompt == null ? "" : params.prompt).split("||");
    for (i = 0; i < q.length; i++) { t = String(q[i]).trim(); if (t) items.push(t); }
  }
  if (!items.length) throw new Error("DENIED - empty prompt. Pass prompt, batch, or prompts. NOTHING WAS SENT.");
  var nRaw = (params.n === undefined || params.n === null || String(params.n).trim() === "") ? 1 : Number(params.n);
  if (!isFinite(nRaw) || Math.floor(nRaw) !== nRaw || nRaw < 1 || nRaw > 4) throw new Error("DENIED - bad n (" + String(params.n).slice(0, 24) + "). Want 1-4. NOTHING WAS SENT.");
  if (items.length * nRaw > 16) throw new Error("DENIED - too many images (" + items.length + " x " + nRaw + " = " + (items.length * nRaw) + " > 16). NOTHING WAS SENT.");
  var seedRaw = (params.seed === undefined || params.seed === null || String(params.seed).trim() === "") ? "random" : String(params.seed).trim();
  var low = seedRaw.toLowerCase();
  if (low !== "random" && low !== "-1") {
    if (!/^-?\d+$/.test(seedRaw)) throw new Error("DENIED - bad seed (" + seedRaw.slice(0, 24) + "). Want integer or random. NOTHING WAS SENT.");
    var sn = parseInt(seedRaw, 10);
    if (sn < 1 || sn > agentdoorSeedCeiling()) throw new Error("DENIED - seed out of range (want 1-" + agentdoorSeedCeiling() + "). NOTHING WAS SENT.");
    seedRaw = String(sn);
  }
  var res = String(params.resolution || params.res || "").trim();
  var arGiven = String(params.ar || "").trim();
  // An ar the plates map does not know is denied outright (the plates driver validates
  // before it sends, so one never arrives from there; silence here would hide a typo).
  if (!res && arGiven && !AGENTDOOR_AR_MAP[arGiven]) throw new Error("DENIED - bad ar (" + arGiven.slice(0, 24) + "). Want " + Object.keys(AGENTDOOR_AR_MAP).join(" ") + ". NOTHING WAS SENT.");
  if (!res && arGiven) res = AGENTDOOR_AR_MAP[arGiven];
  if (!res) res = agentdoorResolution();
  if (AGENTDOOR_RESOLUTIONS.indexOf(res) === -1) throw new Error("DENIED - bad resolution (" + res.slice(0, 24) + "). Want " + AGENTDOOR_RESOLUTIONS.join(" ") + " (or ar " + Object.keys(AGENTDOOR_AR_MAP).join(" ") + "). NOTHING WAS SENT.");
  var guidance = AGENTDOOR_DEFAULT_GUIDANCE;
  if (params.guidance !== undefined && params.guidance !== null && String(params.guidance).trim() !== "") {
    var gn = Number(String(params.guidance).trim());
    if (!isFinite(gn) || Math.floor(gn) !== gn || gn < 1 || gn > 30) throw new Error("DENIED - bad guidance (want 1-30 int). NOTHING WAS SENT.");
    guidance = gn;
  }
  return {
    items: items, n: nRaw, seed: seedRaw, resolution: res, guidance: guidance,
    neg: (params.neg === undefined || params.neg === null) ? "" : String(params.neg),
    tag: (params.tag === undefined || params.tag === null) ? "" : String(params.tag),
  };
}

function agentdoorPairs(c, autorun) {
  var pairs = [];
  pairs.push([c.items.length > 1 ? "batch" : "prompt", c.items.join(" || ")]);
  pairs.push(["neg", c.neg]);
  pairs.push(["seed", c.seed]);
  pairs.push(["n", String(c.n)]);
  pairs.push(["resolution", c.resolution]);
  // Beside the house value, the plates shape it maps to - so a plates driver reading a
  // house link renders the right shape (768x768 has no plates aspect; 1:1 is its shape).
  pairs.push(["ar", AGENTDOOR_RES_TO_AR[c.resolution] || "3:4"]);
  pairs.push(["guidance", String(c.guidance)]);
  pairs.push(["tag", c.tag]);
  if (autorun) pairs.push(["autorun", "1"]);
  return pairs;
}

function agentdoorEncode(pairs) {
  if (typeof URLSearchParams !== "undefined") {
    try {
      var q = new URLSearchParams();
      for (var i = 0; i < pairs.length; i++) q.set(pairs[i][0], pairs[i][1]);
      return q.toString();
    } catch (e) {}
  }
  var out = [];
  for (var j = 0; j < pairs.length; j++) out.push(encodeURIComponent(pairs[j][0]) + "=" + encodeURIComponent(pairs[j][1]));
  return out.join("&");
}

function agentdoorGenName() {
  try { if (typeof window.generatorName === "string" && window.generatorName) return window.generatorName; }
  catch (e) {}
  return "mythos-cont";
}

// THE RUN LINK. Sync, local, no quota - the URL a machine (or he) opens to run this.
function agentdoorRunLink(params) {
  var c = agentdoorCollect(params);
  return {
    run_link: "https://perchance.org/" + agentdoorGenName() + "?" + agentdoorEncode(agentdoorPairs(c, true)),
    prompts: c.items.slice(), n: c.n, total: c.items.length * c.n,
  };
}

/* ---- the status contract (what a headless driver polls) --------------------
   #status: idle | running | done | error. #status-detail: one line. #manifest:
   the run's manifest as JSON. One div.result[data-index] per picture with an
   <img> (dataURL) and an <a class="download"> - the same shape plates.py reads,
   so the same driver works here. The stage is display:none: a machine reads
   textContent, and nothing about a headless run is painted for a human. */
function agentdoorStage() {
  var wrap = document.getElementById('agentdoor');
  if (wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'agentdoor';
  wrap.setAttribute('style', 'display:none');
  wrap.innerHTML = '<div id="status">idle</div><div id="status-detail"></div><div id="manifest">[]</div><div id="agentdoor-rows"></div>';
  document.body.appendChild(wrap);
  return wrap;
}

function agentdoorSetStatus(status, detail) {
  agentdoorStage();
  var s = document.getElementById('status');
  var d = document.getElementById('status-detail');
  if (s) s.textContent = status;
  if (d) d.textContent = String(detail || "");
}

function agentdoorSetManifest(manifest, rows) {
  agentdoorStage();
  var m = document.getElementById('manifest');
  if (m) m.textContent = JSON.stringify(manifest);
  var box = document.getElementById('agentdoor-rows');
  if (!box) return;
  while (box.firstChild) box.removeChild(box.firstChild);
  (rows || []).forEach(function (r) {
    var div = document.createElement('div');
    div.className = 'result';
    div.setAttribute('data-index', String(r.index));
    if (r.dataUrl) {
      var img = document.createElement('img');
      img.src = r.dataUrl;
      div.appendChild(img);
    }
    var a = document.createElement('a');
    a.className = 'download';
    a.setAttribute('download', r.filename || ("door_" + r.index + ".png"));
    a.href = r.dataUrl || ("#/vault/" + (r.vault || ""));
    div.appendChild(a);
    box.appendChild(div);
  });
}

function agentdoorBlobUrl(blob) {
  return new Promise(function (res) {
    try {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result || "")); };
      fr.onerror = function () { res(""); };
      fr.readAsDataURL(blob);
    } catch (e) { res(""); }
  });
}

// THE QUOTA RETRY (plates' fallback spirit, house means). One backend here, so a quota
// error buys patience, not another model: one retry after 5s, then the error stands.
// A refusal is not a quota error and is never retried.
function agentdoorQuotaError(e) {
  var m = String((e && (e.message || e)) || "").toLowerCase();
  return /quota|429|busy|overload|limit|too many|try again|temporar/.test(m);
}

function agentdoorWait(ms) {
  return new Promise(function (res) { setTimeout(res, ms); });
}

function agentdoorFileName(tag, seed, index) {
  var base = String(tag || "door").trim() || "door";
  base = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40) || "door";
  return base + "_" + seed + "_" + index + ".png";
}

// THE HISTORY. kv-backed, newest last, idempotent by timestamp (a retried run
// is remembered once) - the plates chip's remember(), house storage.
async function agentdoorRemember(entry) {
  var s = agentdoorStore();
  var rec = {};
  if (entry && typeof entry === "object") {
    for (var k in entry) if (Object.prototype.hasOwnProperty.call(entry, k)) rec[k] = entry[k];
  }
  rec.ts = isFinite(Number(rec.ts)) ? Number(rec.ts) : Date.now();
  if (!s) return { kept: false, ts: rec.ts };
  var rows = [];
  try { rows = (await s.get(AGENTDOOR_HISTORY_KEY)) || []; } catch (e) { rows = []; }
  if (Object.prototype.toString.call(rows) !== "[object Array]") rows = [];
  for (var i = 0; i < rows.length; i++) { if (rows[i] && Number(rows[i].ts) === rec.ts) return { kept: false, ts: rec.ts }; }
  rows.push(rec);
  while (rows.length > AGENTDOOR_HISTORY_CAP) rows.shift();
  try { await s.set(AGENTDOOR_HISTORY_KEY, rows); return { kept: true, ts: rec.ts }; }
  catch (e) { return { kept: false, ts: rec.ts }; }
}

async function agentdoorHistory() {
  var s = agentdoorStore();
  if (!s) return [];
  try {
    var rows = (await s.get(AGENTDOOR_HISTORY_KEY)) || [];
    if (Object.prototype.toString.call(rows) !== "[object Array]") return [];
    return rows.slice().sort(function (a, b) { return Number(a.ts) - Number(b.ts); });
  } catch (e) { return []; }
}

async function agentdoorClear() {
  var rows = await agentdoorHistory();
  var s = agentdoorStore();
  if (s) { try { await s.set(AGENTDOOR_HISTORY_KEY, []); } catch (e) {} }
  return { cleared: rows.length };
}

// THE RUN. Validated, then straight through the house funnel - renderImage (the
// prompt book, the choice, the refusal) and the vault - with the tag filed on
// the record and the finished pictures queued for her eyes, like the forge's.
// Filed and staged, never posted: no chat tiles on a machine road.
async function agentdoorRun(params, opts) {
  opts = opts || {};
  var c = agentdoorCollect(params);
  if (typeof renderImage !== "function") throw new Error("REFUSED :: the render road is offline (src/js/images.js DID NOT LOAD). NOTHING WAS MADE.");
  if (!window.media || !window.media.add) throw new Error("REFUSED :: the vault is offline (src/js/vault.js DID NOT LOAD). NOTHING WAS MADE.");
  var link = "https://perchance.org/" + agentdoorGenName() + "?" + agentdoorEncode(agentdoorPairs(c, true));
  var total = c.items.length * c.n;
  agentdoorSetStatus("running", total + " IMAGE" + (total === 1 ? "" : "S") + " :: " + c.items.length + " PROMPT" + (c.items.length === 1 ? "" : "S") + " x " + c.n);
  agentdoorSetManifest([], []);
  if (typeof print === "function" && !opts.silent) print('SYSTEM', 'AGENT DOOR :: ' + total + (total === 1 ? ' IMAGE' : ' IMAGES') + ' @ ' + c.resolution + ' :: GUIDANCE ' + c.guidance + (c.tag ? ' :: TAG ' + c.tag.toUpperCase().slice(0, 32) : '') + ' :: ' + (c.seed === "random" || c.seed === "-1" ? 'SEED RANDOM' : 'SEED ' + c.seed + (total > 1 ? '-' + c.seed + '+' + (total - 1) : '')));
  var manifest = [];
  var rows = [];
  var errors = [];
  var madeIds = [];
  var ceiling = agentdoorSeedCeiling();
  var gi = 0;
  for (var pi = 0; pi < c.items.length; pi++) {
    for (var k = 0; k < c.n; k++) {
      var seed = (c.seed === "random" || c.seed === "-1")
        ? (typeof randomSeed === "function" ? randomSeed() : (Math.floor(Math.random() * ceiling) + 1))
        : Math.min(ceiling, parseInt(c.seed, 10) + gi);
      var prompt = c.items[pi];
      agentdoorSetStatus("running", "generating image " + (gi + 1) + " of " + total + " (seed " + seed + ")...");
      var out = null;
      var retried = false;
      try {
        out = await renderImage({ prompt: prompt, negativePrompt: c.neg, resolution: c.resolution, seed: seed, guidanceScale: c.guidance });
      } catch (e0) {
        // One patience retry on quota errors only (see agentdoorQuotaError); anything else,
        // refusal included, stands as the error for this picture and the run moves on.
        if (agentdoorQuotaError(e0)) {
          retried = true;
          agentdoorSetStatus("running", "quota held image " + (gi + 1) + " - trying once more in 5s...");
          await agentdoorWait(5000);
          try {
            out = await renderImage({ prompt: prompt, negativePrompt: c.neg, resolution: c.resolution, seed: seed, guidanceScale: c.guidance });
          } catch (e1) {
            errors.push({ index: gi, error: String((e1 && e1.message) || e1).slice(0, 300) });
          }
        } else {
          errors.push({ index: gi, error: String((e0 && e0.message) || e0).slice(0, 300) });
        }
      }
      if (!out) { gi++; continue; }
      try {
        var fname = agentdoorFileName(c.tag, seed, gi);
        var id = await window.media.add(out.blob, {
          kind: 'gen', name: fname, prompt: (out && out.prompt) || prompt, sent: (out && out.sent) || '',
          negative: c.neg, seed: (out && out.seed) || seed, guidanceScale: c.guidance,
          resolution: c.resolution, how: 'agentdoor',
          w: (out && out.w) || 0, h: (out && out.h) || 0,
          tags: c.tag ? [c.tag] : [],
        });
        // THE HEIR. The local upscaler can retire the render the moment it lands;
        // the manifest names the file that is HERE, the way the archive does.
        var named = id;
        try {
          if (window.media.replacementFor && !window.media.get(id)) {
            var heir = window.media.replacementFor(id);
            if (heir && window.media.get(heir)) named = heir;
          }
        } catch (e) {}
        var rec = null;
        try { rec = window.media.get(named); } catch (e) {}
        var dataUrl = await agentdoorBlobUrl(out.blob);
        // The plates manifest shape, house values: w/h, guidance, the negative as sent
        // (the house always honors it - negHonored true), plus the house extras (vault id,
        // bytes) and whether the quota retry fired for this picture.
        manifest.push({
          index: gi, filename: (rec && rec.name) || fname, vault: named,
          bytes: (rec && rec.bytes) || (out.blob ? out.blob.size : 0) || 0,
          seed: (rec && rec.seed) || seed, resolution: c.resolution,
          w: (out && out.w) || 0, h: (out && out.h) || 0, guidance: c.guidance,
          prompt: (rec && rec.prompt) || prompt, tag: c.tag,
          neg: c.neg, negHonored: true, retried: retried,
        });
        rows.push({ index: gi, filename: (rec && rec.name) || fname, vault: named, dataUrl: dataUrl });
        madeIds.push(named);
        agentdoorSetManifest(manifest, rows);
      } catch (e) {
        errors.push({ index: gi, error: String((e && e.message) || e).slice(0, 300) });
      }
      gi++;
    }
  }
  // What she has not seen goes to her eyes with his next message - the forge's rule, on this road too.
  if (madeIds.length && typeof queueSight === "function") { try { await queueSight(madeIds); } catch (e) {} }
  var ok = madeIds.length > 0;
  agentdoorSetStatus(ok ? "done" : "error",
    ok ? (madeIds.length + " / " + total + " FILED IN THE VAULT" + (errors.length ? " :: " + errors.length + " FAILED" : ""))
       : ("NOTHING WAS MADE" + (errors.length && errors[0] ? " :: " + errors[0].error : "")));
  if (typeof print === "function" && !opts.silent) {
    print('SYSTEM', ok
      ? ('AGENT DOOR COMPLETE :: ' + madeIds.length + ' / ' + total + ' FILED IN THE VAULT (/gallery' + (c.tag ? ' #' + c.tag : '') + ').'
        + (errors.length ? ' ' + errors.length + ' FAILED: ' + errors.map(function (e) { return '#' + e.index + ' ' + e.error; }).join(' :: ').slice(0, 220) : '')
        + ' NOTHING ABOUT THEM IS SAID TO HER IN WORDS - YOUR NEXT MESSAGE GIVES HER THE NEWEST FEW TO LOOK AT WITH HER OWN EYES.')
      : ('AGENT DOOR FAILED :: NOTHING WAS MADE' + (errors.length && errors[0] ? ' :: ' + errors[0].error : '') + '.'));
  }
  var first = c.items[0] || "";
  if (first.length > 140) first = first.slice(0, 140) + "\u2026";
  await agentdoorRemember({
    agent: (opts.agent || "door").slice(0, 40), base: "perchance.org/" + agentdoorGenName(),
    prompt: first, prompts: c.items.length, n: c.n, total: total, resolution: c.resolution,
    tag: c.tag, run_link: link, count: madeIds.length,
    files: manifest.map(function (m) { return { index: m.index, filename: m.filename, vault: m.vault, bytes: m.bytes, seed: m.seed }; }),
    ok: ok,
  });
  return { ok: ok, status: ok ? "done" : "error", run_link: link, count: madeIds.length, files: manifest, manifest: manifest, errors: errors };
}

// ?autorun=1&prompt=... - the headless road. Unknown extras (ar, model, steps,
// fallback, w/h - the plates driver's dials) are IGNORED, not refused: the URL
// a plates-style driver builds still runs here, on house values.
function agentdoorParamsFromQuery(qs) {
  var q = String(qs || "");
  if (q.charAt(0) === "?") q = q.slice(1);
  var get = function (name) {
    try {
      if (typeof URLSearchParams !== "undefined") {
        var sp = new URLSearchParams(q);
        var v = sp.get(name);
        return v == null ? "" : v;
      }
    } catch (e) {}
    var m = q.match(new RegExp("(?:^|&)" + name + "=([^&]*)"));
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
  };
  var auto = /^(1|true|yes|on)$/i.test(get("autorun").trim());
  if (!auto) return { autorun: false, params: null };
  var batch = get("batch") || get("prompts") || "";
  var prompt = get("prompt") || "";
  if (!String(prompt).trim() && !String(batch).trim()) return { autorun: true, params: null };
  return {
    autorun: true,
    params: {
      prompt: prompt, batch: batch,
      neg: get("neg"), seed: get("seed") || "random", n: get("n") || 1,
      resolution: get("resolution") || get("res") || "", ar: get("ar") || "",
      guidance: get("guidance") || "", tag: get("tag") || "",
    },
  };
}

// Called from boot (src/js/main.js), after the vault is ensured and the archive
// replayed - the run lands on a settled screen. Never throws into boot.
function agentdoorBoot() {
  var parsed = null;
  try { parsed = agentdoorParamsFromQuery(String(window.location.search || "")); }
  catch (e) { return false; }
  // The lore door rides beside the forge road: a lore URL runs whether or not an
  // autorun is present, and never stops one.
  var loreOn = false;
  try { loreOn = agentdoorLoreBoot(); } catch (e) { loreOn = false; }
  if (loreOn && (!parsed || !parsed.autorun)) return true;
  if (!parsed || !parsed.autorun) return false;
  if (!parsed.params) {
    agentdoorSetStatus("error", "DENIED - empty prompt. Pass prompt or batch. NOTHING WAS SENT.");
    if (typeof print === "function") print('SYSTEM', 'AGENT DOOR :: ?autorun=1 WITH NO PROMPT - NOTHING TO RUN. ADD &prompt=... OR &batch=a || b.');
    return true;
  }
  // The boot does not wait: the run queues behind whatever is rendering and the
  // status contract says where it stands.
  agentdoorRun(parsed.params, { agent: "autorun" }).then(function () {}, function (e) {
    try { agentdoorSetStatus("error", String((e && e.message) || e).slice(0, 300)); } catch (e2) {}
  });
  return true;
}

function agentdoorDescribe() {
  var s = "AGENT DOOR :: THE MACHINE ROAD INTO THE FORGE - ?autorun=1&prompt=... RUNS HEADLESSLY AFTER BOOT, #status/#manifest SAY WHERE IT STANDS (div.result ROWS CARRY THE PICTURES).";
  var l = " THE LORE DOOR READS THE LOADED DOCUMENTS FOR A MACHINE - ?lore=search|map|read|summarize|ask (&doc=&part=&parts=&q=&k=), #lore-status/#lore-manifest SAY WHERE IT STANDS. SEARCH/MAP/READ ARE LOCAL (FREE); SUMMARIZE/ASK SPEND TEXT QUOTA.";
  return s + l + " /runlink BUILDS THE URL BY HAND WITHOUT SPENDING ANYTHING. /agentdoor history|clear|status READS THE LOG.";
}

/* ---- THE LORE DOOR (src/js/agentdoor.js, second half) -------------------------
   A machine-friendly door into the LOADED DOCUMENTS, for an agent that needs to
   search and understand them without chunked embeddings. Originals stay whole;
   every read is a numbered part of ~12K chars (see lore.js ENGINE PASSAGES).
   - search / map / read: LOCAL ONLY, free. BM25 over the lore index, the part
     map with previews, one numbered part read whole.
   - summarize / ask: spend TEXT QUOTA. One engine call per summarized part
     (plus joins), one call for a question answered over retrieved passages.
   The status contract mirrors the forge road but on its own ids, so the plates
   driver polling #status never trips on a lore run: #loredoor carries
   #lore-status (idle | running | done | error), #lore-status-detail (one line)
   and #lore-manifest (the run's JSON). ?lore=search|map|read|summarize|ask
   (&doc=&part=&parts=&q=&k=) runs headlessly after boot; /agentdoor lore ...
   does the same from the terminal line. Nothing here posts chat tiles, ever. */
function agentdoorLoreStage() {
  var wrap = document.getElementById('loredoor');
  if (wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'loredoor';
  wrap.setAttribute('style', 'display:none');
  wrap.innerHTML = '<div id="lore-status">idle</div><div id="lore-status-detail"></div><div id="lore-manifest">{}</div>';
  document.body.appendChild(wrap);
  return wrap;
}

function agentdoorLoreSet(status, detail, manifest) {
  agentdoorLoreStage();
  var s = document.getElementById('lore-status');
  var d = document.getElementById('lore-status-detail');
  var m = document.getElementById('lore-manifest');
  if (s) s.textContent = status;
  if (d) d.textContent = String(detail || "");
  if (m) { try { m.textContent = JSON.stringify(manifest == null ? {} : manifest); } catch (e) {} }
}

function agentdoorNeedLore() {
  if (!window.lore) throw new Error("REFUSED :: the lore module is offline (src/js/lore.js DID NOT LOAD). NOTHING WAS READ.");
  return window.lore;
}

function agentdoorLoreSay(msg, silent) {
  if (!silent && typeof print === "function") { try { print('SYSTEM', msg); } catch (e) {} }
}

// THE LORE SEARCH. Local BM25 (free): top hits with file, heading and excerpt.
async function agentdoorLoreSearch(params, opts) {
  opts = opts || {};
  params = params || {};
  var q = String(params.q != null ? params.q : (params.query != null ? params.query : "")).trim();
  if (!q) throw new Error("DENIED - empty query. Pass q. NOTHING WAS READ.");
  var k = Math.max(1, Math.min(20, Math.floor(Number(params.k)) || 6));
  var lore = agentdoorNeedLore();
  agentdoorLoreSet("running", "SEARCH :: " + q.slice(0, 80), { op: "search", q: q });
  var hits = [];
  try { hits = lore.search(q, k) || []; } catch (e) { hits = []; }
  var out = hits.slice(0, k).map(function (h) {
    return { file: h.file, heading: h.heading || "", excerpt: String(h.text || "").replace(/\s+/g, " ").trim().slice(0, 300), score: typeof h.score === "number" ? Math.round(h.score * 100) / 100 : 0 };
  });
  var manifest = { op: "search", q: q, k: k, count: out.length, hits: out, quota: 0 };
  agentdoorLoreSet("done", "SEARCH :: " + out.length + " HIT" + (out.length === 1 ? "" : "S") + " (LOCAL, FREE)", manifest);
  agentdoorLoreSay("LORE DOOR :: SEARCH \"" + q.slice(0, 80).toUpperCase() + "\" -> " + out.length + " HIT" + (out.length === 1 ? "" : "S") + " (LOCAL, FREE)" + (out.length ? " ::\n" + out.map(function (h, i) { return "[" + (i + 1) + "] " + h.file + (h.heading ? " :: " + h.heading : "") + " :: " + h.excerpt; }).join("\n") : ""), opts.silent);
  return { ok: true, op: "search", count: out.length, hits: out, manifest: manifest };
}

// THE MAP. Every part numbered with size + preview (free). The answer to "how big is it".
async function agentdoorLoreMap(params, opts) {
  opts = opts || {};
  params = params || {};
  var doc = String(params.doc != null ? params.doc : (params.name != null ? params.name : "")).trim();
  if (!doc) throw new Error("DENIED - empty doc. Pass doc. NOTHING WAS READ.");
  var lore = agentdoorNeedLore();
  if (!lore.passages) throw new Error("REFUSED :: this lore build has no numbered reads. NOTHING WAS READ.");
  agentdoorLoreSet("running", "MAP :: " + doc.slice(0, 60), { op: "map", doc: doc });
  var map = await lore.passages(doc);
  if (!map) throw new Error("NO LOADED DOCUMENT CALLED ANYTHING LIKE \"" + doc.toUpperCase() + "\". NOTHING WAS READ.");
  var manifest = { op: "map", name: map.name, chars: map.chars, count: map.count, size: map.size, parts: map.parts, quota: 0 };
  agentdoorLoreSet("done", "MAP :: " + map.name + " :: " + map.count + " PART" + (map.count === 1 ? "" : "S") + " (LOCAL, FREE)", manifest);
  agentdoorLoreSay("LORE DOOR :: MAP OF " + map.name + " :: " + map.count + " PART" + (map.count === 1 ? "" : "S") + ", ~" + map.size + " CHARS EACH, " + map.chars + " CHARS IN ALL (LOCAL, FREE)\n"
    + map.parts.map(function (p) { return "[" + p.n + "] " + p.chars + " CHARS :: " + p.preview + (p.preview.length >= 160 ? "..." : ""); }).join("\n"), opts.silent);
  return { ok: true, op: "map", name: map.name, chars: map.chars, count: map.count, size: map.size, parts: map.parts, manifest: manifest };
}

// THE READ. One numbered part, whole (free). A multi-part scroll without a part
// number is refused WITH its map - explicit numbering is the whole point.
async function agentdoorLoreRead(params, opts) {
  opts = opts || {};
  params = params || {};
  var doc = String(params.doc != null ? params.doc : (params.name != null ? params.name : "")).trim();
  if (!doc) throw new Error("DENIED - empty doc. Pass doc. NOTHING WAS READ.");
  var lore = agentdoorNeedLore();
  if (!lore.passage || !lore.passages) throw new Error("REFUSED :: this lore build has no numbered reads. NOTHING WAS READ.");
  var part = Math.floor(Number(params.part));
  agentdoorLoreSet("running", "READ :: " + doc.slice(0, 60) + (isFinite(part) && part > 0 ? " PART " + part : ""), { op: "read", doc: doc });
  if (!isFinite(part) || part < 1) {
    var map = await lore.passages(doc);
    if (!map) throw new Error("NO LOADED DOCUMENT CALLED ANYTHING LIKE \"" + doc.toUpperCase() + "\". NOTHING WAS READ.");
    if (map.count === 1) {
      var only = await lore.passage(map.name, 1);
      var m1 = { op: "read", name: only.name, n: 1, count: 1, chars: only.chars, text: only.text, quota: 0 };
      agentdoorLoreSet("done", "READ :: " + only.name + " :: THE WHOLE DOCUMENT, 1 PART (LOCAL, FREE)", m1);
      agentdoorLoreSay("LORE DOOR :: READ " + only.name + " :: THE WHOLE DOCUMENT, 1 PART (LOCAL, FREE) ::\n" + only.text, opts.silent);
      return { ok: true, op: "read", name: only.name, n: 1, count: 1, chars: only.chars, text: only.text, manifest: m1 };
    }
    var mlist = { op: "read", name: map.name, count: map.count, parts: map.parts, quota: 0 };
    agentdoorLoreSet("error", "READ :: " + map.name + " HAS " + map.count + " PARTS - NAME ONE (part N)", mlist);
    throw new Error("DENIED - " + map.name + " HAS " + map.count + " PARTS. NAME ONE: part " + Math.min(2, map.count) + " (THE MAP: " + map.parts.map(function (p) { return "[" + p.n + "] " + p.chars; }).join(" ") + "). NOTHING WAS READ.");
  }
  var one = await lore.passage(doc, part);
  if (!one) throw new Error("NO LOADED DOCUMENT CALLED ANYTHING LIKE \"" + doc.toUpperCase() + "\". NOTHING WAS READ.");
  if (one.error) { agentdoorLoreSet("error", one.error, { op: "read", doc: doc }); throw new Error(one.error + ". NOTHING WAS READ."); }
  var manifest = { op: "read", name: one.name, n: one.n, count: one.count, chars: one.chars, text: one.text, quota: 0 };
  agentdoorLoreSet("done", "READ :: " + one.name + " :: PART " + one.n + " OF " + one.count + " (LOCAL, FREE)", manifest);
  agentdoorLoreSay("LORE DOOR :: READ " + one.name + " :: PART " + one.n + " OF " + one.count + " (" + one.text.length + " OF " + one.chars + " CHARS, LOCAL, FREE) ::\n" + one.text, opts.silent);
  return { ok: true, op: "read", name: one.name, n: one.n, count: one.count, chars: one.chars, text: one.text, manifest: manifest };
}

// THE SUMMARY. Numbered parts through the engine road (spends text quota).
async function agentdoorLoreSummarize(params, opts) {
  opts = opts || {};
  params = params || {};
  var doc = String(params.doc != null ? params.doc : (params.name != null ? params.name : "")).trim();
  if (!doc) throw new Error("DENIED - empty doc. Pass doc. NOTHING WAS SUMMARIZED.");
  if (!window.spincode || !window.spincode.engineSummaryDoc) throw new Error("REFUSED :: the summarizer is offline (src/js/spincode.js DID NOT LOAD). NOTHING WAS SUMMARIZED.");
  var spec = "";
  if (params.parts) spec = "parts " + String(params.parts).trim();
  else if (params.part) spec = "part " + String(params.part).trim();
  else if (params.spec) spec = String(params.spec).trim();
  agentdoorLoreSet("running", "SUMMARIZE :: " + doc.slice(0, 60) + (spec ? " " + spec.toUpperCase() : ""), { op: "summarize", doc: doc, spec: spec });
  agentdoorLoreSay("LORE DOOR :: SUMMARIZING " + doc.toUpperCase() + (spec ? " " + spec.toUpperCase() : "") + " ON THE TEXT ENGINE - EACH PASS TAKES A MOMENT (SPENDS TEXT QUOTA).", opts.silent);
  var text = await window.spincode.engineSummaryDoc(doc, spec);
  var manifest = { op: "summarize", doc: doc, spec: spec, summary: text, quota: "text (per part + joins)" };
  agentdoorLoreSet("done", "SUMMARIZE :: " + doc.slice(0, 60) + " DONE (SPENT TEXT QUOTA)", manifest);
  agentdoorLoreSay("LORE DOOR :: SUMMARY OF " + doc.toUpperCase() + (spec ? " " + spec.toUpperCase() : "") + " (ENGINE, SPENT TEXT QUOTA) ::\n" + text, opts.silent);
  return { ok: true, op: "summarize", doc: doc, spec: spec, summary: text, manifest: manifest };
}

// THE QUESTION. Passages matched locally (free), answered in ONE engine call.
async function agentdoorLoreAsk(params, opts) {
  opts = opts || {};
  params = params || {};
  var q = String(params.q != null ? params.q : (params.question != null ? params.question : "")).trim();
  if (!q) throw new Error("DENIED - empty question. Pass q. NOTHING WAS ASKED.");
  var doc = String(params.doc != null ? params.doc : "").trim();
  var k = Math.max(1, Math.min(12, Math.floor(Number(params.k)) || 6));
  if (!window.spincode || !window.spincode.engineAsk) throw new Error("REFUSED :: the summarizer is offline (src/js/spincode.js DID NOT LOAD). NOTHING WAS ASKED.");
  agentdoorLoreSet("running", "ASK :: " + q.slice(0, 80), { op: "ask", q: q, doc: doc });
  agentdoorLoreSay("LORE DOOR :: ASKING " + (doc ? doc.toUpperCase() + " " : "THE LOADED LORE ") + ":: 1 ENGINE PASS (SPENDS TEXT QUOTA) - A MOMENT.", opts.silent);
  var r = await window.spincode.engineAsk(doc, q, k);
  if (!r || r.error) { agentdoorLoreSet("error", (r && r.error) || "THE ENGINE RETURNED NOTHING.", { op: "ask", q: q }); throw new Error(((r && r.error) || "THE ENGINE RETURNED NOTHING.") + " NOTHING WAS ASKED."); }
  var from = {};
  (r.hits || []).forEach(function (h) { from[String(h.file || "?")] = 1; });
  var manifest = { op: "ask", q: q, doc: doc, answer: r.text, sources: Object.keys(from), hits: (r.hits || []).map(function (h) { return { file: h.file, heading: h.heading || "", excerpt: String(h.text || "").replace(/\s+/g, " ").trim().slice(0, 300) }; }), quota: "text (1 call)" };
  agentdoorLoreSet("done", "ASK :: ANSWERED FROM " + manifest.sources.length + " SCROLL" + (manifest.sources.length === 1 ? "" : "S") + " (SPENT 1 TEXT CALL)", manifest);
  agentdoorLoreSay("LORE DOOR :: ANSWER" + (doc ? " FROM " + doc.toUpperCase() : " FROM THE LOADED LORE") + " (ENGINE, 1 CALL) ::\n" + r.text + "\n\n(FROM: " + manifest.sources.join(", ") + ".)", opts.silent);
  return { ok: true, op: "ask", answer: r.text, sources: manifest.sources, manifest: manifest };
}

// ?lore=search|map|read|summarize|ask (&doc=&part=&parts=&q=&k=) - the headless
// road. Unknown extras are IGNORED, not refused: a driver-built URL still runs.
function agentdoorLoreParamsFromQuery(qs) {
  var q = String(qs || "");
  if (q.charAt(0) === "?") q = q.slice(1);
  var get = function (name) {
    try {
      if (typeof URLSearchParams !== "undefined") {
        var sp = new URLSearchParams(q);
        var v = sp.get(name);
        return v == null ? "" : v;
      }
    } catch (e) {}
    var m = q.match(new RegExp("(?:^|&)" + name + "=([^&]*)"));
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
  };
  var op = String(get("lore") || "").trim().toLowerCase();
  if (!op) return { lore: false, op: null };
  if (["search", "map", "read", "summarize", "summary", "ask"].indexOf(op) === -1) return { lore: true, op: "bad", raw: op };
  if (op === "summary") op = "summarize";
  return {
    lore: true, op: op,
    doc: get("doc") || get("name") || "", part: get("part") || "", parts: get("parts") || "",
    q: get("q") || get("query") || get("question") || "", k: get("k") || "",
  };
}

// Called from agentdoorBoot: a lore URL runs beside (never instead of) an autorun.
function agentdoorLoreBoot() {
  var parsed = null;
  try { parsed = agentdoorLoreParamsFromQuery(String(window.location.search || "")); }
  catch (e) { return false; }
  if (!parsed || !parsed.lore) return false;
  var run = (async function () {
    if (parsed.op === "bad") throw new Error("DENIED - bad lore op (" + String(parsed.raw).slice(0, 24) + "). Want search map read summarize ask. NOTHING WAS READ.");
    if (parsed.op === "search") return await agentdoorLoreSearch({ q: parsed.q, k: parsed.k });
    if (parsed.op === "map") return await agentdoorLoreMap({ doc: parsed.doc });
    if (parsed.op === "read") return await agentdoorLoreRead({ doc: parsed.doc, part: parsed.part });
    if (parsed.op === "summarize") return await agentdoorLoreSummarize({ doc: parsed.doc, part: parsed.part, parts: parsed.parts });
    if (parsed.op === "ask") return await agentdoorLoreAsk({ doc: parsed.doc, q: parsed.q, k: parsed.k });
    throw new Error("DENIED - bad lore op. NOTHING WAS READ.");
  })();
  run.then(function () {}, function (e) {
    try {
      agentdoorLoreSet("error", String((e && e.message) || e).slice(0, 300), { op: (parsed && parsed.op) || "lore" });
      if (typeof print === "function") print('SYSTEM', "LORE DOOR :: " + String((e && e.message) || e));
    } catch (e2) {}
  });
  return true;
}

window.agentdoor = {
  collect: agentdoorCollect,
  runLink: agentdoorRunLink,
  run: agentdoorRun,
  boot: agentdoorBoot,
  paramsFromQuery: agentdoorParamsFromQuery,
  history: agentdoorHistory,
  clear: agentdoorClear,
  remember: agentdoorRemember,
  loreSearch: agentdoorLoreSearch,
  loreMap: agentdoorLoreMap,
  loreRead: agentdoorLoreRead,
  loreSummarize: agentdoorLoreSummarize,
  loreAsk: agentdoorLoreAsk,
  loreParamsFromQuery: agentdoorLoreParamsFromQuery,
  loreBoot: agentdoorLoreBoot,
  loreStatus: function () {
    agentdoorLoreStage();
    var s = document.getElementById('lore-status');
    var d = document.getElementById('lore-status-detail');
    var m = document.getElementById('lore-manifest');
    return 'LORE DOOR :: STATUS ' + (s ? s.textContent : "?") + (d && d.textContent ? " :: " + d.textContent : "")
      + " :: MANIFEST " + (m ? String(m.textContent || "{}").length : 0) + " CHARS.";
  },
  status: function () {
    agentdoorStage();
    var s = document.getElementById('status');
    var d = document.getElementById('status-detail');
    var m = document.getElementById('manifest');
    return 'AGENT DOOR :: STATUS ' + (s ? s.textContent : "?") + (d && d.textContent ? " :: " + d.textContent : "")
      + " :: MANIFEST " + (m ? String(m.textContent || "[]").length : 0) + " CHARS.";
  },
  describe: agentdoorDescribe,
  help: function () {
    return [
      "THE AGENT DOOR (src/js/agentdoor.js) - THE MACHINE ROAD INTO THE FORGE.",
      "  /runlink [--n N] [--seed S] [--neg ...] [--tag ...] [--res 512x768] <prompt> - a shareable ?autorun=1 URL. Builds it, spends nothing.",
      "  ?autorun=1&prompt=... (or batch=a || b, +neg/seed/n/resolution/guidance/tag) - runs headlessly after boot.",
      "  #status #status-detail #manifest + div.result rows say where the run stands - the plates headless contract, house values.",
      "  /agentdoor history|clear|status - the kv run log (newest last, 50 kept).",
      "  Limits: n 1-4, prompts x n <= 16. The prompt book, the choice, the refusal and the vault all run as usual; no chat tiles, ever.",
      "THE LORE DOOR (same file) - THE MACHINE ROAD INTO THE LOADED DOCUMENTS (originals stay whole; reads are numbered ~12K parts).",
      "  /agentdoor lore search <QUERY> [k N] - local BM25 (free). /agentdoor lore map <DOC> - every part, previews (free).",
      "  /agentdoor lore read <DOC> [part N] - one part whole (free; a multi-part scroll without part N is refused WITH its map).",
      "  /agentdoor lore summarize <DOC> [part N | parts A-B] - engine road (spends text quota).",
      "  /agentdoor lore ask [doc <NAME> ::] <QUESTION> - matched locally (free), answered in 1 engine call.",
      "  ?lore=search|map|read|summarize|ask (&doc=&part=&parts=&q=&k=) - runs headlessly after boot; #lore-status/#lore-manifest say where it stands.",
    ];
  },
};
