window.packs = (function () {
  "use strict";

  var BASE = "src/";
  var LOREPACK_DIR = BASE + "lorepack/";
  var LOREPACK_MANIFEST = LOREPACK_DIR + "lorepack.json";
  var COREPACK_MANIFEST = BASE + "corepack/corepack.json";

  // ---- THE RESERVED PACKS (declared 2026-09-30, NOT BUILT) -----------------
  // Patrikios, 2026-09-30: "MOODPACK and ARCHPACK will be a module in the near future like LOREPACK
  // COREPACK is now that can be loaded and unloaded to enhance the ALIA ROLE with a mood list and
  // list of over 400 Jungian Archetypes (I will provide). We don't have to create that here as it is
  // out of scope but leave some placeholder space for these new PACKs."
  //
  // A PLACE, NOT A PACK. Both are DECLARED here and read NOWHERE: no manifest is fetched, no text is
  // folded into the index or into her prompt, and there is deliberately no load function, because a
  // load function with nothing behind it is a lie the code tells. What is reserved is the SHAPE -
  // /packs names each slot, what it will carry, what it will enhance, and the exact door it will come
  // through - and the directories below (src/moodpack/, src/archpack/) hold a README and nothing
  // else, so the next build has a marked place to start instead of a name to invent. The RESERVED
  // block is the only thing that changes in the running terminal: nothing is switched on, nothing is
  // handed to her, and a pack that does not exist costs nothing and claims nothing.
  //
  // Why each sits where it does, and not in a file of its own: a pack is not a feature, it is a KIND
  // of asset with a loader (this file), a directory under src/, and a block it eventually reaches her
  // through. MOODPACK is BUILT (2026-10-01): the loader below reads the shipped manifest and the local
  // file into the console in src/js/moods.js. ARCHPACK is still the reserved one, named in PLUGS IN
  // rather than guessed at later.
  var RESERVED = [
    {
      id: "ARCHPACK",
      title: "the Jungian archetypes (400 or more), as a module that can be loaded and unloaded",
      dir: BASE + "archpack/",
      manifest: BASE + "archpack/archpack.json",
      carries: "ARCHETYPES - the list Patrikios will provide (400+ entries; the exact fields are to be settled when the list arrives, and the README in src/archpack/ says what is already decided)",
      enhances: "THE ALIA ROLE - a layer of archetypal material she is made of, loaded and unloaded as a pack rather than written into a RoleLayer",
      plugsInto: "the role stack (src/js/roles.js, the ALIA actor): an archetype is what she is MADE OF rather than WHO is on the stage, so the ARCHPACK will ride with the COREPACK's trait block and the MOODPACK's color block, over whatever RoleLayer she is wearing",
      style: "LOADED and UNLOADED like COREPACK; the list is his and the pack is where it enters",
      state: "NOT BUILT"
    }
  ];

  function reserved() {
    return RESERVED.map(function (p) { return p; });
  }

  // The RESERVED section of `/packs`. It is written like the rest of the report and says plainly,
  // for each slot, that nothing loads: this is the marked place and not the thing.
  function reservedLines() {
    return RESERVED.map(function (p) {
      return p.id + " :: RESERVED, " + p.state + " - " + p.title
        + "\n  CARRIES   " + p.carries
        + "\n  ENHANCES  " + p.enhances
        + "\n  PLUGS IN  " + p.plugsInto
        + "\n  HOME      " + p.dir + " :: A README AND NOTHING ELSE - " + p.manifest + " IS NOT WRITTEN, NOTHING IS FETCHED, NOTHING IS HANDED TO HER";
    });
  }

  var lorepack = null;
  var corepack = null;
  var loreReport = null;

  // ---- loaded traits (the COREPACK overlay) -------------------------------
  // A trait is a skill that has been LOADED: it stops being a one-off and
  // becomes part of her, layered over the LOREPACK character on every reply
  // until it is put down. Order is load order = layer order.
  var TRAIT_FOLDER = "lia_settings";
  var TRAIT_KEY = "loaded_traits";
  var LOCAL_TRAIT_KEY = "local_traits";
  var loadedIds = [];

  // Traits loaded from this device with LOAD COREPACK. They layer over the shipped
  // catalog and are private to this browser (kv lia_settings / local_traits).
  var localTraits = [];

  function kv() {
    return (window.root && window.root.kv) || null;
  }

  function say(msg) {
    if (window.loreSay) window.loreSay(msg);
    else console.log(msg);
  }

  function hash(text) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16) + ":" + text.length;
  }

  async function fetchText(url) {
    var res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  }

  async function fetchJSON(url) {
    return JSON.parse(await fetchText(url));
  }

  function normDocs(manifest) {
    var list = (manifest && manifest.documents) || [];
    return list.map(function (d) {
      if (typeof d === "string") return { file: d, title: d, tags: [], foundational: false };
      d = d || {};
      return {
        file: d.file || d.path || "",
        title: d.title || d.file || "",
        tags: d.tags || [],
        // CANON: a foundational document is always in her context, never only
        // retrieved when a message happens to match its words.
        foundational: !!(d.foundational || d.always)
      };
    }).filter(function (d) { return !!d.file; });
  }

  async function loadCorepack() {
    try {
      corepack = await fetchJSON(COREPACK_MANIFEST);
    } catch (e) {
      corepack = null;
      console.warn("corepack unavailable :: " + e.message);
    }
    return corepack;
  }

  async function loadLorepack() {
    var report = { pack: "LOREPACK", docs: 0, added: [], updated: [], kept: [], pruned: [], failed: [], loaded: false };
    loreReport = report;
    var manifest;
    try {
      manifest = await fetchJSON(LOREPACK_MANIFEST);
    } catch (e) {
      report.failed.push("no manifest at " + LOREPACK_MANIFEST + " (" + e.message + ")");
      return report;
    }
    report.pack = manifest.pack || report.pack;
    lorepack = manifest;
    var docs = normDocs(manifest);
    report.docs = docs.length;
    report.canon = docs.filter(function (d) { return d.foundational; }).map(function (d) { return d.title; });
    if (!window.lore || !window.lore.ingest) { report.failed.push("lore module offline"); return report; }
    var loreBar = null;
    if (docs.length > 1) {
      try {
        if (window.progress) loreBar = window.progress.begin("LOADING LOREPACK", {
          id: "lorepack", total: docs.length,
          detail: "LOREPACK - reading " + docs.length + " shipped documents into the index"
        });
      } catch (e) { loreBar = null; }
    }
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i], raw;
      if (loreBar) { try { loreBar.setLabel("LOADING LOREPACK :: " + String(d.title || d.file || "").toUpperCase().slice(0, 40)); } catch (e) {} }
      try {
        raw = await fetchText(LOREPACK_DIR + d.file);
      } catch (e) {
        report.failed.push(d.file + " (" + e.message + ")");
        if (loreBar) { try { loreBar.step(); } catch (e2) {} }
        continue;
      }
      var res = await window.lore.ingest(d.title, raw, { pack: report.pack, origin: "shipped", hash: hash(raw), url: LOREPACK_DIR + d.file, foundational: d.foundational });
      if (res.status === "added") report.added.push(d.title);
      else if (res.status === "updated") report.updated.push(d.title);
      else if (res.status === "kept") report.kept.push(d.title);
      else report.failed.push(d.file + " (no readable text)");
      if (loreBar) { try { loreBar.step(); } catch (e) {} }
    }
    if (loreBar) { try { window.progress.finish("lorepack"); } catch (e) {} }
    if (window.lore.packOf) {
      var declared = docs.map(function (d) { return d.title; });
      var present = window.lore.packOf(report.pack).docs;
      var pruned = [];
      for (var j = 0; j < present.length; j++) {
        if (declared.indexOf(present[j].name) !== -1) continue;
        if (present[j].origin !== "shipped") continue;
        pruned.push(present[j].name);
      }
      if (pruned.length) {
        if (window.lore.unindexMany) await window.lore.unindexMany(pruned);
        else if (window.lore.unindex) { for (var u = 0; u < pruned.length; u++) await window.lore.unindex(pruned[u]); }
        else { for (var f2 = 0; f2 < pruned.length; f2++) await window.lore.forgetFile(pruned[f2]); }
        report.pruned = report.pruned.concat(pruned);
      }
    }
    report.loaded = true;
    return report;
  }

  async function load() {
    await loadCorepack();
    await loadMoodpack();
    await restoreLocalTraits();
    await restoreTraits();
    var lore = await loadLorepack();
    renderTraitPanel();
    try {
      setTimeout(function () {
        loadMoodpack().then(function () { if (window.moods && window.moods.paint) window.moods.paint(); }, function () {});
      }, 5000);
    } catch (e) {}
    return { corepack: corepack, lorepack: lore, traits: loaded() };
  }

  // The shipped catalog from src/corepack/corepack.json.
  function shippedSkills() {
    var list = (corepack && corepack.skills) || [];
    return list.filter(function (s) { return s && s.id && s.enabled !== false; });
  }

  // What she can be trained to do: shipped traits plus whatever was loaded from this
  // device. A local trait with a shipped trait's id overrides it.
  function skills() {
    var shipped = shippedSkills();
    var local = localTraits.filter(function (s) { return s && s.id && s.prompt && s.enabled !== false; });
    if (!local.length) return shipped;
    var overridden = {};
    local.forEach(function (s) { overridden[String(s.id).toLowerCase()] = true; });
    return shipped.filter(function (s) { return !overridden[String(s.id).toLowerCase()]; }).concat(local);
  }

  // The panel's view: every trait, shipped or local, including disabled ones, marked
  // with where it came from.
  function traitList() {
    var list = (corepack && corepack.skills) || [];
    var out = list.filter(function (s) { return s && s.id; }).map(function (s) {
      return { id: String(s.id), title: s.title || s.id, kind: s.kind || "text", description: s.description || "", origin: "shipped", enabled: s.enabled !== false };
    });
    localTraits.forEach(function (s) {
      if (!s || !s.id) return;
      var item = { id: String(s.id), title: s.title || s.id, kind: s.kind || "text", description: s.description || "", origin: "local", enabled: s.enabled !== false };
      var at = -1;
      for (var i = 0; i < out.length; i++) if (String(out[i].id).toLowerCase() === item.id.toLowerCase()) { at = i; break; }
      if (at === -1) out.push(item); else out[at] = item;
    });
    return out;
  }

  function isLoaded(id) {
    return loadedIds.indexOf(String(id)) !== -1;
  }

  function loaded() {
    return loadedIds.map(function (id) {
      var s = getSkill(id);
      return s ? { id: s.id, title: s.title, kind: s.kind, prompt: s.prompt } : null;
    }).filter(Boolean);
  }

  async function persistTraits() {
    var k = kv(); if (!k) return;
    try { await k[TRAIT_FOLDER].set(TRAIT_KEY, loadedIds.slice()); }
    catch (e) { console.warn("trait store failed", e); }
  }

  async function restoreTraits() {
    var k = kv(); if (!k) return;
    try {
      var v = await k[TRAIT_FOLDER].get(TRAIT_KEY);
      if (Array.isArray(v)) loadedIds = v.map(String).filter(function (id) { return !!getSkill(id); });
    } catch (e) { console.warn("trait restore failed", e); }
  }

  // ---- local traits (LOAD COREPACK) ------------------------------
  // A trait she was handed from this machine. It lives only in this browser
  // (kv lia_settings / local_traits), never in src/, and it overrides a shipped
  // trait of the same id. FORGET LOCAL drops it; shipped traits cannot be
  // forgotten this way because the manifest puts them back on every load.
  function cleanStr(v) {
    var s = String(v == null ? "" : v).trim();
    return s.toLowerCase() === "undefined" ? "" : s;
  }

  function cleanTrait(s) {
    return {
      id: String(s.id),
      title: String(s.title || s.id),
      kind: s.kind === "image" ? "image" : "text",
      description: String(s.description || ""),
      prompt: String(s.prompt),
      enabled: s.enabled !== false
    };
  }

  function normalizeTrait(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = cleanStr(raw.id == null ? raw.name : raw.id).toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    var prompt = cleanStr(raw.prompt == null ? raw.instruction : raw.prompt);
    if (!id || !prompt) return null;
    return {
      id: id,
      title: String(raw.title == null ? (raw.name || id) : raw.title).trim() || id,
      kind: raw.kind === "image" ? "image" : "text",
      description: String(raw.description == null ? (raw.desc || "") : raw.description).trim(),
      prompt: prompt,
      enabled: raw.enabled !== false,
      origin: "local"
    };
  }

  async function persistLocalTraits() {
    var k = kv(); if (!k) return;
    try {
      await k[TRAIT_FOLDER].set(LOCAL_TRAIT_KEY, localTraits.filter(function (s) { return s && s.id && s.prompt; }).map(cleanTrait));
    } catch (e) { console.warn("local trait store failed", e); }
  }

  async function restoreLocalTraits() {
    var k = kv(); if (!k) return;
    try {
      var v = await k[TRAIT_FOLDER].get(LOCAL_TRAIT_KEY);
      if (Array.isArray(v)) localTraits = v.map(normalizeTrait).filter(Boolean);
    } catch (e) { console.warn("local trait restore failed", e); }
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

  // Accepts a .json file holding an array of traits, {skills:[...]} / {traits:[...]},
  // or a single trait object. Traits are upserted by id and kept on this device.
  async function loadTraitFile(file) {
    var name = (file && file.name) || "corepack.json";
    var text;
    try { text = await readTextFile(file); }
    catch (e) { return { file: name, error: "UNREADABLE" }; }
    var data;
    try { data = JSON.parse(text); }
    catch (e) { return { file: name, error: "INVALID JSON" }; }
    var list = Array.isArray(data) ? data
      : (data && Array.isArray(data.skills)) ? data.skills
      : (data && Array.isArray(data.traits)) ? data.traits
      : [data];
    var added = [], skipped = 0;
    for (var i = 0; i < list.length; i++) {
      var t = normalizeTrait(list[i]);
      if (!t) { skipped++; continue; }
      var at = -1;
      for (var j = 0; j < localTraits.length; j++) if (String(localTraits[j].id).toLowerCase() === t.id) { at = j; break; }
      if (at === -1) localTraits.push(t); else localTraits[at] = t;
      added.push(t.id);
    }
    if (added.length) await persistLocalTraits();
    renderTraitPanel();
    if (window.liaStatus) window.liaStatus();
    return { file: name, added: added, skipped: skipped };
  }

  async function forgetLocalTrait(id) {
    var want = String(id == null ? "" : id).trim().toLowerCase();
    if (!want) return { ok: false, error: "NO ID GIVEN" };
    var gone = null;
    localTraits = localTraits.filter(function (s) {
      if (String(s.id).toLowerCase() === want) { gone = s; return false; }
      return true;
    });
    if (!gone) return { ok: false, error: "NOT LOADED FROM THIS DEVICE :: " + want.toUpperCase() };
    var before = loadedIds.length;
    loadedIds = loadedIds.filter(function (x) { return String(x).toLowerCase() !== gone.id.toLowerCase(); });
    if (loadedIds.length !== before) await persistTraits();
    await persistLocalTraits();
    renderTraitPanel();
    if (window.liaStatus) window.liaStatus();
    return { ok: true, id: gone.id };
  }

  async function loadTrait(id, who) {
    var skill = getSkill(id);
    if (!skill) return { ok: false, error: "UNKNOWN SKILL :: " + String(id || "").toUpperCase() };
    if (isLoaded(skill.id)) return { ok: true, skill: skill, already: true };
    var OPPOSITES = { "veiled-tongue": "spicy", "spicy": "veiled-tongue" };
    var foe = OPPOSITES[String(skill.id).toLowerCase()];
    if (foe) loadedIds = loadedIds.filter(function (x) { return String(x).toLowerCase() !== foe; });
    loadedIds.push(skill.id);
    await persistTraits();
    if (window.liaStatus) window.liaStatus();
    // STATEWATCH: a trait he loads onto her by hand is owed to her.
    try {
      if (who !== "alia" && window.statewatch && window.statewatch.note) {
        window.statewatch.note("TRAIT :: " + String(skill.title || skill.id).toUpperCase() + " loaded - worn in every reply from now on");
      }
    } catch (e) {}
    return { ok: true, skill: skill };
  }

  async function unloadTrait(id, who) {
    var skill = getSkill(id);
    var target = skill ? skill.id : String(id || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
    var i = loadedIds.indexOf(target);
    if (i === -1) return { ok: false, error: "NOT LOADED :: " + String(target).toUpperCase() };
    loadedIds.splice(i, 1);
    await persistTraits();
    if (window.liaStatus) window.liaStatus();
    // STATEWATCH: a trait he takes off her by hand is owed to her.
    try {
      if (who !== "alia" && window.statewatch && window.statewatch.note) {
        window.statewatch.note("TRAIT :: " + String((skill && (skill.title || skill.id)) || target).toUpperCase() + " put down - in effect no longer");
      }
    } catch (e) {}
    return { ok: true, skill: skill, id: target };
  }

  async function unloadAll() {
    var n = loadedIds.length;
    loadedIds = [];
    await persistTraits();
    if (window.liaStatus) window.liaStatus();
    return { ok: true, count: n };
  }

  // The overlay text injected into her system prompt while traits are loaded.
  function traitBlock() {
    var list = loaded();
    if (!list.length) return "";
    return "LOADED TRAITS - these are part of you as the actor, carried with you into whatever role you wear, layered in this order. They are in effect in every reply until you put one down; do their work as part of who you are and never explain or mention them.\n"
      + list.map(function (t, i) {
          return (i + 1) + ". " + String(t.title || t.id).toUpperCase() + " [" + (t.kind || "text") + "] - " + String(t.prompt || "").trim();
        }).join("\n");
  }

  function traitsSummary() {
    var list = loaded();
    return list.length ? list.map(function (t) { return String(t.id).toUpperCase(); }).join(", ") : "(NONE LOADED)";
  }

  function getSkill(id) {
    var want = String(id == null ? "" : id).trim().toLowerCase();
    if (!want) return null;
    var list = skills();
    var i;
    for (i = 0; i < list.length; i++) if (String(list[i].id).toLowerCase() === want) return list[i];
    for (i = 0; i < list.length; i++) if (String(list[i].title || "").toLowerCase() === want) return list[i];
    return null;
  }

  function catalog() {
    return skills().map(function (s) {
      return s.id + " [" + (s.kind || "text") + "]" + (isLoaded(s.id) ? " [LOADED]" : "") + " - " + String(s.description || s.title || "").trim();
    }).join("\n");
  }

  function skillList() {
    return skills().map(function (s) {
      return s.id + " :: " + (s.title || s.id) + " [" + (s.kind || "text") + "]" + (isLoaded(s.id) ? " :: LOADED" : "") + " :: " + String(s.description || "").trim();
    });
  }

  var MOODPACK_MANIFEST = BASE + "moodpack/moodpack.json";
  var MOODPACK_KEY = "moodpack_local";
  var moodpackShipped = null;
  var moodpackLocal = [];

  function normPackMood(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = cleanStr(raw.id == null ? raw.name : raw.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20);
    var rule = cleanStr(raw.rule == null ? raw.prompt : raw.rule);
    if (!id || !rule) return null;
    return { id: id, label: String(raw.label == null ? raw.title || id : raw.label).trim().toUpperCase().slice(0, 24) || id.toUpperCase(), rule: rule };
  }
  function moodpackCombined() {
    var out = [], seen = {};
    (moodpackLocal || []).forEach(function (m) { if (m && m.id && !seen[m.id]) { seen[m.id] = true; out.push(m); } });
    var ship = (moodpackShipped && Array.isArray(moodpackShipped.moods)) ? moodpackShipped.moods : [];
    ship.forEach(function (raw) {
      var m = normPackMood(raw);
      if (m && !seen[m.id]) { seen[m.id] = true; out.push(m); }
    });
    return out;
  }
  function moodpackPush() {
    if (!window.moods || !window.moods.setPack) return;
    var list = moodpackCombined();
    window.moods.setPack(list, list.length ? ("MOODPACK" + (moodpackLocal.length ? " + " + moodpackLocal.length + " LOCAL" : "")) : "");
  }
  async function loadMoodpack() {
    try { moodpackShipped = await fetchJSON(MOODPACK_MANIFEST); }
    catch (e) { moodpackShipped = null; console.warn("moodpack unavailable :: " + e.message); }
    await restoreMoodpackLocal();
    moodpackPush();
    return moodpackShipped;
  }
  async function restoreMoodpackLocal() {
    var k = kv();
    if (!k) return;
    try {
      var v = await k[TRAIT_FOLDER].get(MOODPACK_KEY);
      moodpackLocal = Array.isArray(v) ? v.map(normPackMood).filter(Boolean) : [];
    } catch (e) { console.warn("moodpack local restore failed", e); }
  }
  async function persistMoodpackLocal() {
    var k = kv();
    if (!k) return;
    try { await k[TRAIT_FOLDER].set(MOODPACK_KEY, moodpackLocal); }
    catch (e) { console.warn("moodpack local store failed", e); }
  }
  async function moodpackLoadFile(file) {
    var name = (file && file.name) || "moodpack.json";
    var text;
    try { text = await readTextFile(file); }
    catch (e) { return { file: name, error: "UNREADABLE" }; }
    var data;
    try { data = JSON.parse(text); }
    catch (e) { return { file: name, error: "INVALID JSON" }; }
    var list = Array.isArray(data) ? data : (data && Array.isArray(data.moods)) ? data.moods : [data];
    var added = [], skipped = 0;
    for (var i = 0; i < list.length; i++) {
      var m = normPackMood(list[i]);
      if (!m) { skipped++; continue; }
      var at = -1;
      for (var j = 0; j < moodpackLocal.length; j++) if (moodpackLocal[j].id === m.id) { at = j; break; }
      if (at === -1) moodpackLocal.push(m); else moodpackLocal[at] = m;
      added.push(m.id);
    }
    if (added.length) await persistMoodpackLocal();
    moodpackPush();
    if (window.liaStatus) window.liaStatus();
    return { file: name, added: added, skipped: skipped };
  }
  function moodpackPick() {
    var inp = document.getElementById("moodpackInput");
    if (inp) inp.click();
  }
  async function moodpackUnload() {
    moodpackLocal = [];
    await persistMoodpackLocal();
    if (window.moods && window.moods.clearPack) window.moods.clearPack();
    moodpackPush();
    say("MOODPACK UNLOADED :: LOCAL PACK DROPPED - THE SHIPPED MANIFEST STAYS. THE BOOK IS THE WHOLE CONSOLE AGAIN UNTIL YOU LOAD ONE.");
  }
  async function moodpackForget(id) {
    var want = String(id == null ? "" : id).trim().toLowerCase();
    if (!want) return { ok: false, error: "NO ID GIVEN" };
    var gone = null;
    moodpackLocal = moodpackLocal.filter(function (m) {
      if (m.id === want) { gone = m; return false; }
      return true;
    });
    if (!gone) return { ok: false, error: "NOT IN THE LOCAL MOODPACK :: " + want.toUpperCase() };
    await persistMoodpackLocal();
    moodpackPush();
    return { ok: true, id: gone.id };
  }
  function moodpackNew(name, rule, who) {
    var labelTxt = String(name == null ? "" : name).trim().toUpperCase().slice(0, 24);
    var ruleTxt = String(rule == null ? "" : rule).trim();
    if (!labelTxt) return { ok: false, error: "A NEW PACK COLOR NEEDS A NAME." };
    if (!ruleTxt) return { ok: false, error: "A NEW PACK COLOR NEEDS ITS RULE :: HOW SHE IS TO SOUND." };
    var id = labelTxt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "mood";
    var m = { id: id, label: labelTxt, rule: ruleTxt };
    var at = -1;
    for (var i = 0; i < moodpackLocal.length; i++) if (moodpackLocal[i].id === id) { at = i; break; }
    if (at === -1) moodpackLocal.push(m); else moodpackLocal[at] = m;
    persistMoodpackLocal().then(moodpackPush, moodpackPush);
    moodpackPush();
    var res = { ok: true, mood: m, label: labelTxt };
    res.text = "MOODPACK :: NEW COLOR FILED IN THE LOCAL PACK :: " + labelTxt + " :: " + ruleTxt
      + "\nIT IS A SWITCH ON THE CONSOLE NOW (MARKED [MOODPACK])" + (who === "alia" ? " :: WRITTEN BY HER" : "")
      + " - /mood " + labelTxt + " SWITCHES IT ON, AND IT RIDES IN HER NEXT REPLY'S MOOD BLOCK.";
    return res;
  }
  function moodpackLocalList() { return (moodpackLocal || []).slice(); }
  function moodpackShippedList() {
    var ship = (moodpackShipped && Array.isArray(moodpackShipped.moods)) ? moodpackShipped.moods : [];
    return ship.map(normPackMood).filter(Boolean);
  }
  function moodpackExport() {
    var list = moodpackLocalList();
    var doc = {
      pack: "MOODPACK",
      version: 1,
      note: "A pack of colors written on this device - LOAD MOODPACK layers it over the book, and the book is never written to.",
      moods: list.map(function (m) { return { id: m.id, label: m.label, rule: m.rule }; })
    };
    return { ok: true, name: "moodpack.json", text: JSON.stringify(doc, null, 2), count: list.length };
  }
  function moodpackStatus() {
    var n = moodpackCombined().length;
    return "MOODPACK :: " + (moodpackShipped ? "SHIPPED MANIFEST READ" : "SHIPPED MANIFEST NOT FOUND")
      + " :: " + n + " PACK COLOR" + (n === 1 ? "" : "S") + " ON THE CONSOLE"
      + (moodpackLocal.length ? " (" + moodpackLocal.length + " FROM THIS DEVICE)" : " (NOTHING LOADED FROM THIS DEVICE - LOAD MOODPACK TAKES A .json OF {moods:[{id,label,rule}]})")
      + " :: THE BOOK IS UNTOUCHED - UNLOAD DROPS THE LOCAL PACK AND LEAVES THE BOOK WHOLE.";
  }
  function moodpackWords(arg, who) {
    var a = String(arg == null ? "" : arg).trim();
    var v = (a.split(/\s+/)[0] || "").toLowerCase();
    var rest = a.slice(v.length).trim();
    if (!a || v === "state" || v === "status" || v === "what") return { ok: true, text: moodpackStatus() + "\n" + ((window.moods && window.moods.summary) ? window.moods.summary() : "") };
    if (v === "list" || v === "all") {
      var list = moodpackCombined();
      if (!list.length) return { ok: true, text: "MOODPACK :: NO PACK COLORS ON FILE - LOAD ONE WITH LOAD MOODPACK (A .json OF {moods:[{id,label,rule}]}) OR WRITE ONE WITH /moodpack new <NAME> :: <HOW SHE IS TO SOUND>." };
      return { ok: true, text: "MOODPACK :: " + list.length + " COLORS ::\n" + list.map(function (m) { return "  " + m.label + "\n      " + m.rule; }).join("\n") };
    }
    if (v === "unload" || v === "off" || v === "clear") { moodpackUnload(); return { ok: true, text: "MOODPACK UNLOADED :: THE BOOK IS THE WHOLE CONSOLE AGAIN." }; }
    if (v === "save" || v === "export" || v === "download") {
      if (window.moodpack && window.moodpack.saveFile) return window.moodpack.saveFile();
      var ex = moodpackExport();
      return { ok: true, text: "MOODPACK :: " + ex.count + " PACK COLOR" + (ex.count === 1 ? "" : "S") + " ON THIS DEVICE - THE PAGE IS OFFLINE SO HERE IS THE FILE INSTEAD:\n" + ex.text };
    }
    if (v === "forget" || v === "delete" || v === "drop" || v === "remove") {
      var target = rest;
      if (!target) return { ok: false, error: "FORGET WHICH PACK COLOR? /moodpack forget <NAME>." };
      var found2 = (window.moods && window.moods.findAny) ? window.moods.findAny(target) : null;
      var want = found2 ? found2.id : String(target).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
      var gone = null;
      moodpackLocal = moodpackLocal.filter(function (m) {
        if (m.id === want) { gone = m; return false; }
        return true;
      });
      if (!gone) return { ok: false, error: "NOT IN THE LOCAL MOODPACK :: " + String(target).toUpperCase() + " :: THE BOOK'S COLORS ARE NOT PACK COLORS - /mood delete PUTS ONE OF THOSE AWAY INSTEAD." };
      persistMoodpackLocal();
      moodpackPush();
      return { ok: true, text: "MOODPACK :: FORGOT " + gone.label + " :: THE BOOK IS UNTOUCHED AND EVERY BOARD THAT NAMED IT KEEPS ITS PLACE." };
    }
    if (v === "new" || v === "write" || v === "add") {
      var cut = rest.indexOf("::");
      if (cut === -1) return { ok: false, error: "A NEW PACK COLOR IS NAMED AND COLORED IN ONE LINE :: /moodpack new <NAME> :: <HOW SHE IS TO SOUND>." };
      return moodpackNew(rest.slice(0, cut).trim(), rest.slice(cut + 2).trim(), who);
    }
    if (v === "file" || v === "copy") {
      if (!rest) return { ok: false, error: "FILE WHICH CONSOLE COLOR? /moodpack file <NAME> FILES IT INTO THE PACK WITH THE WORDING IN FORCE." };
      var src = (window.moods && window.moods.findAny) ? window.moods.findAny(rest) : null;
      if (!src) return { ok: false, error: "NO CONSOLE COLOR CALLED \"" + String(rest).toUpperCase() + "\" :: /mood list PRINTS THE CONSOLE." };
      var filed = moodpackNew(src.label, src.rule, who);
      if (filed.ok) filed.text = "MOODPACK :: " + src.label + " FILED IN THE PACK :: " + src.rule
        + "\nTHE BOOK AND THE DEVICE LIST ARE UNTOUCHED - THE PACK HOLDS THE COPY" + (who === "alia" ? " :: FILED BY HER" : "")
        + " - /mood " + src.label + " SWITCHES IT ON, AND IT RIDES IN HER NEXT REPLY'S MOOD BLOCK.";
      return filed;
    }
    if (v === "edit" || v === "rewrite" || v === "rename") {
      var cut2 = rest.indexOf("::");
      if (cut2 === -1) return { ok: false, error: "EDITING A PACK COLOR NAMES IT AND GIVES ITS NEW WORDS :: /moodpack edit <NAME> :: <HOW SHE IS TO SOUND>." };
      var nm = rest.slice(0, cut2).trim();
      var found = (window.moods && window.moods.findAny) ? window.moods.findAny(nm) : null;
      if (!found) return { ok: false, error: "NO PACK COLOR CALLED \"" + String(nm).toUpperCase() + "\"." };
      return moodpackNew(found.label, rest.slice(cut2 + 2).trim(), who);
    }
    var cut3 = a.indexOf("::");
    if (cut3 !== -1) return moodpackNew(a.slice(0, cut3).trim(), a.slice(cut3 + 2).trim(), who);
    var hit = (window.moods && window.moods.findAny) ? window.moods.findAny(a) : null;
    if (hit) return { ok: true, text: "MOODPACK :: " + hit.label + " :: " + hit.rule };
    return { ok: false, error: "NO PACK COLOR CALLED \"" + a.toUpperCase() + "\" :: /moodpack list PRINTS THE PACK, /moodpack new <NAME> :: <WORDS> WRITES ONE." };
  }

  function describe() {
    var lines = [];
    var lp = window.lore ? window.lore.packOf("LOREPACK") : null;
    if (loreReport && loreReport.loaded) {
      lines.push("LOREPACK :: " + lp.docs.length + " DOC(S) / " + lp.fragments + " FRAGMENTS IN THE INDEX"
        + (loreReport.added.length ? " :: LOADED " + loreReport.added.join(", ") : "")
        + (loreReport.updated.length ? " :: UPDATED " + loreReport.updated.join(", ") : "")
        + (loreReport.pruned.length ? " :: DROPPED " + loreReport.pruned.join(", ") : "")
        + (loreReport.failed.length ? " :: PROBLEMS " + loreReport.failed.join(", ") : ""));
    } else {
      lines.push("LOREPACK :: " + ((loreReport && loreReport.failed.join(", ")) || "NOT LOADED") + " :: ADD .TXT FILES TO " + LOREPACK_DIR + " AND LIST THEM IN lorepack.json");
    }
    lines.push(lp && lp.docs.length
      ? lp.docs.map(function (d) { return "  " + d.name + " :: " + d.chunks + " FRAG" + (d.origin === "shipped" ? " :: SHIPPED" : " :: ON THIS DEVICE"); }).join("\n")
      : "  (NO PACK DOCUMENTS IN THE INDEX YET - LOAD LOREPACK ADDS THEM FROM YOUR MACHINE)");
    lines.push("COREPACK :: " + skills().length + " TRAIT" + (skills().length === 1 ? "" : "S") + ", "
      + loadedIds.length + " LOADED" + (loadedIds.length ? " (" + traitsSummary() + ")" : "")
      + (localTraits.length ? " :: " + localTraits.length + " LOADED FROM THIS DEVICE" : "")
      + (corepack ? "" : " :: NO MANIFEST AT " + COREPACK_MANIFEST));
    var list = skillList();
    lines.push(list.length ? list.map(function (s) { return "  " + s; }).join("\n") : "  (NO SKILLS DEFINED YET)");
    lines.push("/skill <ID> ARMS A SKILL FOR ONE REPLY :: /load <ID> WEARS IT AS A TRAIT (KEPT IN EFFECT UNTIL /UNLOAD).");
    lines.push("");
    lines.push("MOODPACK :: " + moodpackCombined().length + " PACK COLOR" + (moodpackCombined().length === 1 ? "" : "S") + " ON THE CONSOLE"
      + (moodpackLocal.length ? " (" + moodpackLocal.length + " FROM THIS DEVICE)" : "")
      + (moodpackShipped ? "" : " :: SHIPPED MANIFEST NOT FOUND AT " + MOODPACK_MANIFEST));
    lines.push(moodpackCombined().length ? moodpackCombined().map(function (m) { return "  " + m.label + " :: " + m.rule; }).join("\n") : "  (THE SHIPPED PACK IS EMPTY ON PURPOSE - LOAD MOODPACK TAKES A .json OF {moods:[{id,label,rule}]}, OR /moodpack new <NAME> :: <WORDS> WRITES ONE)");
    lines.push("/moodpack list · /moodpack new <NAME> :: <WORDS> · /moodpack file <NAME> · /moodpack edit <NAME> :: <WORDS> · /moodpack forget <NAME> · /moodpack save · /moodpack unload - AND SHE HAS THE WHOLE OF IT IN A MOODPACK LINE.");
    lines.push("");
    lines.push("RESERVED :: ONE MORE PACK IS DECLARED AND NOT BUILT (2026-09-30) - A PLACE, NOT A PACK: NOTHING BELOW IS FETCHED OR HANDED TO HER, AND NOTHING BELOW IS SWITCHED ON.");
    lines.push(reservedLines().join("\n"));
    return lines.join("\n");
  }

  // ---- the COREPACK panel (LOAD COREPACK + DOCS) -----------------
  function traitDocsOpen() {
    var box = document.getElementById("corepackFiles");
    return !!(box && !box.hidden);
  }

  function setTraitDocsOpen(open) {
    var box = document.getElementById("corepackFiles");
    if (!box) return;
    box.hidden = !open;
    var toggle = document.getElementById("corepackToggleBtn");
    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.disabled = !traitList().length;
    }
    try { localStorage.setItem("corepackDocsOpen", open ? "1" : "0"); } catch (e) {}
  }

  function renderTraitPanel() {
    var box = document.getElementById("corepackFiles");
    if (!box) return;
    var list = traitList();
    box.textContent = "";
    list.forEach(function (t) {
      var row = document.createElement("div");
      row.className = "loreFileRow";

      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = String(t.title || t.id).toUpperCase() + (isLoaded(t.id) ? " \u2022 WORN" : "");
      row.appendChild(nm);

      var meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = (t.origin === "shipped" ? "SHIPPED" : "ON THIS DEVICE")
        + " / " + t.id + " / " + String(t.kind || "text").toUpperCase()
        + (t.enabled === false ? " / OFF" : "");
      row.appendChild(meta);

      var rm = document.createElement("button");
      rm.className = "rm";
      rm.type = "button";
      rm.textContent = "\u00d7";
      if (t.origin === "shipped") {
        rm.disabled = true;
        rm.title = "shipped trait - it lives in src/corepack/corepack.json";
      } else {
        rm.title = "forget this trait (it is kept on this device only)";
        rm.addEventListener("click", function () {
          forgetLocalTrait(t.id).then(function (r) {
            if (r.ok) say("FORGOTTEN TRAIT :: " + String(r.id).toUpperCase());
            else say("COULD NOT FORGET :: " + String(r.error || t.id).toUpperCase());
          });
        });
      }
      row.appendChild(rm);

      box.appendChild(row);
    });

    var dc = document.getElementById("corepackDocCount");
    if (dc) dc.textContent = list.length ? String(list.length) : "";
    var tb = document.getElementById("corepackToggleBtn");
    if (tb) {
      tb.disabled = !list.length;
      if (!list.length) { tb.setAttribute("aria-expanded", "false"); box.hidden = true; }
    }
  }

  function wireTraitPanel() {
    var up = document.getElementById("corepackUploadBtn");
    var input = document.getElementById("corepackUploadInput");
    var toggle = document.getElementById("corepackToggleBtn");
    var box = document.getElementById("corepackFiles");

    if (up && input) up.addEventListener("click", function () { input.click(); });

    if (toggle) toggle.addEventListener("click", function () {
      if (!traitList().length) {
        say("NO COREPACK TRAITS IN THE INDEX YET. CLICK 'LOAD COREPACK' TO ABSORB TRAIT DEFINITIONS FROM THIS MACHINE.");
        return;
      }
      setTraitDocsOpen(!traitDocsOpen());
    });

    if (box) box.addEventListener("click", function (e) { e.stopPropagation(); });

    if (input) input.addEventListener("change", async function () {
      if (!input.files || !input.files.length) return;
      var picked = Array.prototype.slice.call(input.files);
      input.value = "";
      var absorbed = [], ignored = [];
      for (var i = 0; i < picked.length; i++) {
        var res = await loadTraitFile(picked[i]);
        var tag = String(res.file).toUpperCase();
        if (res.error) { ignored.push(tag + " :: " + res.error); continue; }
        absorbed.push(tag + " :: " + (res.added.length ? res.added.map(function (x) { return x.toUpperCase(); }).join(", ") : "NO NEW TRAITS"));
        if (res.skipped) ignored.push(tag + " :: " + res.skipped + " ENTR" + (res.skipped === 1 ? "Y" : "IES") + " INVALID");
      }
      if (absorbed.length) say("ABSORBED COREPACK :: " + absorbed.join(" :: "));
      if (ignored.length) say("IGNORED :: " + ignored.join(" :: "));
      if (!absorbed.length && !ignored.length) say("NO TRAITS FOUND.");
    });

    var want = false;
    try { want = localStorage.getItem("corepackDocsOpen") === "1"; } catch (e) {}
    setTraitDocsOpen(want && traitList().length > 0);
  }

  function wireMoodpackPanel() {
    var input = document.getElementById("moodpackInput");
    if (input && !input.dataset.wired) {
      input.dataset.wired = "1";
      input.addEventListener("change", async function () {
        if (!input.files || !input.files.length) return;
        var picked = Array.prototype.slice.call(input.files);
        input.value = "";
        var absorbed = [], ignored = [];
        for (var i = 0; i < picked.length; i++) {
          var res = await moodpackLoadFile(picked[i]);
          var tag = String(res.file).toUpperCase();
          if (res.error) { ignored.push(tag + " :: " + res.error); continue; }
          absorbed.push(tag + " :: " + (res.added.length ? res.added.map(function (x) { return x.toUpperCase(); }).join(", ") : "NO NEW COLORS"));
          if (res.skipped) ignored.push(tag + " :: " + res.skipped + " ENTR" + (res.skipped === 1 ? "Y" : "IES") + " INVALID");
        }
        if (absorbed.length) say("ABSORBED MOODPACK :: " + absorbed.join(" :: "));
        if (ignored.length) say("IGNORED :: " + ignored.join(" :: "));
        if (!absorbed.length && !ignored.length) say("NO COLORS FOUND.");
      });
    }
  }

  wireTraitPanel();
  wireMoodpackPanel();

  return {
    load: load,
    loadCorepack: loadCorepack,
    loadLorepack: loadLorepack,
    loadMoodpack: loadMoodpack,
    moodpackCombined: moodpackCombined,
    moodpackLocalList: moodpackLocalList,
    moodpackShippedList: moodpackShippedList,
    moodpackExport: moodpackExport,
    moodpackLoadFile: moodpackLoadFile,
    moodpackPick: moodpackPick,
    moodpackUnload: moodpackUnload,
    moodpackForget: moodpackForget,
    moodpackNew: moodpackNew,
    moodpackStatus: moodpackStatus,
    moodpackWords: moodpackWords,
    skills: skills,
    skillList: skillList,
    traitList: traitList,
    getSkill: getSkill,
    isLoaded: isLoaded,
    loaded: loaded,
    loadTrait: loadTrait,
    unloadTrait: unloadTrait,
    unloadAll: unloadAll,
    loadTraitFile: loadTraitFile,
    forgetLocalTrait: forgetLocalTrait,
    renderTraitPanel: renderTraitPanel,
    wireTraitPanel: wireTraitPanel,
    localTraits: function () { return localTraits.slice(); },
    traitBlock: traitBlock,
    traitsSummary: traitsSummary,
    catalog: catalog,
    describe: describe,
    reserved: reserved,
    reservedLines: reservedLines,
    lorepack: function () { return lorepack; },
    corepack: function () { return corepack; },
    status: function () { return { lorepack: loreReport, corepack: corepack }; }
  };
})();
