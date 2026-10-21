/* ------------------------------------------------------------------
   IDEA — THE SHOT LIST

   A picture here is not typed, it is ROLLED. Every list in main.pjs is one
   dimension of a picture:

     subject   who is in it          camera      what it was shot on
     setting   where it happens      lens        the focal length
     act       what the bodies do    lighting    the light
     shot      the framing           colorGrade  the grade
     angle     the camera angle      lut         the look it imitates
     ...and so on - 24 dimensions, the same state they were art-directed in.

   `rollAll()` draws one item from every dimension and glues the draws into one
   prompt; `rollOne(name)` draws again for ONE dimension and leaves the rest
   exactly where they are. That second verb is the whole point: a subject, a
   setting or a camera that stays put while the light is re-rolled is how a
   coherent run of stills gets made instead of twenty unrelated pictures.

   THE DICE. Rolling all 24 dimensions at once is too much at once, so the
   dimensions are grouped into dice (the `dice` list in main.pjs):

     d6    the scene - who is in it and where they are
     d20   everything the other dice did not claim (a catch-all)

   A die rolls only its own group, so a prompt is built in passes: roll d6 for
   the bones of the shot, look at it, roll d20 for the film language around it,
   then re-roll the one dimension that is wrong. Add a die to `dice` in main.pjs
   and a button appears for it here; uncomment a group there and the catch-all
   shrinks to fit - nothing in this file changes.

   THE LISTS LIVE IN main.pjs, on purpose. Perchance's own engine is the
   randomizer: an item may branch (`{blonde|brunette}`), carry odds (`^8`), or be
   computed (`[2+2] legs`), a whole item can take its own `^` weight, and a
   multi-line item is glued back into a ", "-separated chain by `joinFragments`.
   This file reads those items off `root` and never re-implements any of it - so
   the lists keep every bit of the machinery the standalone generator had, and a
   dimension is added by writing a list in main.pjs plus a part in PARTS below.

   THE ROLL IS WRITTEN INTO THE FORGE FORM when Patrikios asks for it (the roll
   buttons in the panel, `/idea`), through `window.forgeBook.write()`. Nothing is
   rendered from here: this file composes prompt text and hands it over.

   WHAT THE ROLL ADDS TO A LIST. A phrase he types that no list knows can be
   filed into a dimension (`/idea add camera :: shot on a Bolex`), and from then
   on it is drawn like any item of that list - with weight 1 next to the list's
   own `^` weights, which are read per item off `getOdds`. That is the "add it"
   loop: the list grows from his own words, not from a model's.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var FOLDER = "lia_settings";
  var KEY = "idea";          // lia_settings / idea         : the roll held right now
  var EXTRA_KEY = "idea_extras"; // lia_settings / idea_extras : phrases he has added, by list

  // ---------------------------------------------------------------- the parts
  //
  // One entry per dimension. `list` is the perchance list in main.pjs (and the
  // key everything else uses); `label` is what a chip shows; `glue` is the text
  // put in front of the dimension when the prompt is joined (", " for every
  // dimension after the first, "" for whatever opens it - so a missing opening
  // dimension can never leave a stray comma). `into` sends a dimension to another
  // field (only the negative list uses it). `replaces` is a dimension standing in
  // for others: a named person takes over the generic casting, so while a
  // character is held the dimensions it names are left out of the prompt instead
  // of arguing with it. `see` is for `act`, which is one line of alternation over
  // two other lists and therefore holds no words of its own.
  //
  // The order is the order the prompt reads in: who and what first, then the
  // scene, then the shot - crop, framing, angle, camera, file, lens, focus,
  // light - and the render style last, because it is the canonical tail.
  var PARTS = [
    { list: "subject", label: "subject", glue: "" },
    { list: "character", label: "character", glue: "", replaces: ["subject", "age", "physique", "skin"] },
    { list: "age", label: "age", glue: ", " },
    { list: "physique", label: "physique", glue: ", " },
    { list: "skin", label: "skin", glue: ", " },
    { list: "expression", label: "face", glue: ", " },
    { list: "wardrobe", label: "wardrobe", glue: ", " },
    { list: "hair", label: "hair", glue: ", " },
    { list: "details", label: "details", glue: ", " },
    { list: "setting", label: "setting", glue: ", " },
    { list: "space", label: "space", glue: ", " },
    { list: "props", label: "props", glue: ", " },
    { list: "act", label: "act", glue: ", ", see: ["pose", "action"] },
    { list: "timeOfDay", label: "time", glue: ", " },
    { list: "weather", label: "weather", glue: ", " },
    { list: "cropping", label: "crop", glue: ", " },
    { list: "shot", label: "shot", glue: ", " },
    { list: "angle", label: "angle", glue: ", " },
    { list: "camera", label: "camera", glue: ", " },
    { list: "capture", label: "capture", glue: ", " },
    { list: "lens", label: "lens", glue: ", " },
    { list: "depthOfField", label: "focus", glue: ", " },
    { list: "lighting", label: "light", glue: ", " },
    { list: "colorGrade", label: "grade", glue: ", " },
    { list: "lut", label: "lut", glue: ", " },
    { list: "style", label: "style", glue: ", " },
    { list: "negativePrompt", label: "negative", glue: ", ", into: "negative" },
  ];

  // What is held right now: { listName: value }. A dimension that is not there
  // has not been rolled in this session (or was dropped by its own ✕).
  var held = {};
  var loaded = false;
  var extras = {};     // { listName: [phrase, ...] }
  var listeners = [];

  function print(text, dim) {
    if (typeof window.print === "function" && text) window.print("SYSTEM", text, !!dim);
  }
  function store() {
    return (window.root && window.root.kv && window.root.kv[FOLDER]) || null;
  }
  function parts() { return PARTS; }
  function partOf(name) {
    var want = String(name == null ? "" : name).trim().toLowerCase();
    for (var i = 0; i < PARTS.length; i++) {
      if (PARTS[i].list.toLowerCase() === want || PARTS[i].label.toLowerCase() === want) return PARTS[i];
    }
    return null;
  }
  function listNames() { return PARTS.map(function (p) { return p.list; }); }
  function hasList(name) {
    try { return !!(window.root && window.root[name] && window.root[name].selectAll); }
    catch (e) { return false; }
  }

  // ------------------------------------------------------------ the draw
  //
  // One item from one list. With nothing added to the dimension this is plain
  // `selectOne` - perchance's own weighting, branching and evaluation, untouched.
  // Once the dimension has additions the pool is built by hand: every item of the
  // list is read WITH ITS OWN ODDS (`getOdds`, so a `^8` default stays eight times
  // as likely as a plain one) and each addition counts as one. That is what makes
  // "add it" mean something on the next roll and not only in the prompt.
  function draw(list) {
    var extra = extras[list] || [];
    try {
      if (!extra.length) return String(window.root[list].selectOne.evaluateItem).trim();
      var pool = window.root[list].selectAll.map(function (node) {
        return { node: node, weight: Number(node.getOdds) || 1 };
      });
      for (var i = 0; i < extra.length; i++) pool.push({ text: String(extra[i]), weight: 1 });
      var total = 0, k;
      for (k = 0; k < pool.length; k++) total += pool[k].weight;
      var roll = Math.random() * total;
      for (k = 0; k < pool.length; k++) {
        roll -= pool[k].weight;
        if (roll <= 0) break;
      }
      var chosen = pool[Math.min(k, pool.length - 1)];
      return String(chosen.node ? chosen.node.evaluateItem : chosen.text).trim();
    } catch (e) {
      return "";
    }
  }

  // One draw from a dimension by name OR label, with nothing held and nothing
  // mutated - the pure read the `{dimension}` prompt tokens use (src/js/studio.js),
  // so a token draws fresh on every render instead of spending the held roll.
  function drawOne(name) {
    var part = partOf(name);
    if (!part) return null;
    var v = "";
    try { v = draw(part.list); } catch (e) { v = ""; }
    return v ? String(v) : null;
  }

  // The dimensions another dimension is standing in for, right now. Declared
  // once so the prompt and the chips can never disagree about it.
  function suppressed(values) {
    values = values || held;
    var out = {};
    for (var i = 0; i < PARTS.length; i++) {
      var part = PARTS[i];
      if (!values[part.list]) continue;
      var rep = part.replaces || [];
      for (var j = 0; j < rep.length; j++) out[rep[j]] = true;
    }
    return out;
  }

  // values -> the text for one destination. `into` is the field being composed:
  // everything goes to the prompt except the negative list, which is the one
  // dimension routed to the negative box. A leading glue is trimmed so a missing
  // first dimension cannot leave a stray comma.
  function compose(values, into) {
    values = values || held;
    into = into || "prompt";
    var skip = suppressed(values);
    var text = "";
    for (var i = 0; i < PARTS.length; i++) {
      var part = PARTS[i];
      if ((part.into || "prompt") !== into) continue;
      if (skip[part.list]) continue;
      var value = values[part.list];
      if (!value) continue;
      text += (text ? part.glue : part.glue.replace(/^[,\s]+/, "")) + value;
    }
    return text;
  }

  // Roll every dimension. The suppressed ones are dropped rather than left
  // holding stale values, so a character rolled into the set really does take
  // over from the generic casting.
  function rollAll() {
    var values = {};
    for (var i = 0; i < PARTS.length; i++) {
      var v = draw(PARTS[i].list);
      if (v) values[PARTS[i].list] = v;
    }
    var skip = suppressed(values);
    for (var name in skip) if (Object.prototype.hasOwnProperty.call(skip, name)) delete values[name];
    held = values;
    return held;
  }

  // Roll ONE dimension into what is already held (its own ↻, or `/idea camera`).
  function rollOne(name) {
    var part = partOf(name);
    if (!part) return null;
    var v = draw(part.list);
    if (!v) return null;
    held[part.list] = v;
    var skip = suppressed(held);
    for (var gone in skip) if (Object.prototype.hasOwnProperty.call(skip, gone)) delete held[gone];
    return { list: part.list, label: part.label, value: v };
  }

  // Drop one dimension (a chip's ✕).
  function drop(name) {
    var part = partOf(name);
    if (!part) return false;
    if (held[part.list] === undefined) return false;
    delete held[part.list];
    return true;
  }

  // ------------------------------------------------------------- the dice
  //
  // Read from `dice` in main.pjs: a die's name is its button and its children are
  // the dimensions it rolls. A die with NO children is a catch-all and takes
  // whatever no other die has claimed - so adding a die never means editing this
  // file, and a named die always wins over the catch-all whatever order they are
  // written in.
  function dice() {
    var names = listNames();
    var out = [];
    try {
      var nodes = window.root.dice.selectAll;
      for (var i = 0; i < nodes.length; i++) {
        var declared = nodes[i].selectAll.length > 0;
        var own = [];
        for (var j = 0; j < nodes[i].selectAll.length; j++) {
          var child = String(nodes[i].selectAll[j].getName).trim();
          if (names.indexOf(child) !== -1) own.push(child);
          else console.warn("idea: \u201c" + child + "\u201d in \u201c" + String(nodes[i].getName) + "\u201d is not a dimension in PARTS");
        }
        out.push({ name: String(nodes[i].getName).trim(), rolls: own, catchAll: !declared });
      }
    } catch (e) {
      return [];
    }
    var claimed = {};
    var k;
    for (k = 0; k < out.length; k++) {
      if (out[k].catchAll) continue;
      out[k].rolls = out[k].rolls.filter(function (n) { return !claimed[n]; });
      for (var a = 0; a < out[k].rolls.length; a++) claimed[out[k].rolls[a]] = true;
    }
    for (k = 0; k < out.length; k++) {
      if (!out[k].catchAll) continue;
      out[k].rolls = names.filter(function (n) { return !claimed[n]; });
      for (var b = 0; b < out[k].rolls.length; b++) claimed[out[k].rolls[b]] = true;
    }
    return out.filter(function (die) { return die.rolls.length; });
  }

  // Roll one die: only its own dimensions move. Whatever the other dice put there
  // stays exactly as it is - that is what makes d6 then d20 read as one prompt
  // built in two passes rather than two prompts, one of them lost.
  function rollDie(name) {
    var want = String(name == null ? "" : name).trim().toLowerCase();
    var all = dice();
    var die = null;
    for (var i = 0; i < all.length; i++) if (all[i].name.toLowerCase() === want) die = all[i];
    if (!die) return null;
    var rolled = [];
    for (var j = 0; j < die.rolls.length; j++) {
      var part = partOf(die.rolls[j]);
      if (!part) continue;
      var v = draw(part.list);
      if (!v) continue;
      held[part.list] = v;
      rolled.push({ list: part.list, label: part.label, value: v });
    }
    var skip = suppressed(held);
    for (var gone in skip) if (Object.prototype.hasOwnProperty.call(skip, gone)) delete held[gone];
    return { name: die.name, rolled: rolled, catchAll: die.catchAll };
  }

  // -------------------------------------------------------- the scene title
  //
  // A headline naming the roll, so one shot can be told from the one before it
  // without reading 1,700 characters of prompt. It is composed OUT of the roll
  // and is never written anywhere: nothing a title says can reach a model.
  function fragment(value, take, words) {
    var bits = String(value == null ? "" : value).split(", ").map(function (s) { return s.trim(); }).filter(Boolean);
    if (!bits.length) return "";
    var text = take === "tail" ? bits[bits.length - 1] : bits[0];
    if (!words) return text;
    var split = text.split(/\s+/);
    return split.length <= words ? text : split.slice(0, words).join(" ") + "\u2026";
  }

  var SCENE_SEGMENTS = [
    { lists: ["character", "subject"], take: "head", words: 6 },
    { lists: ["act"], take: "head", words: 7 },
    { lists: ["setting"], take: "tail", words: 6 },
    { lists: ["timeOfDay"], take: "head", words: 3 },
    { lists: ["shot"], take: "head", words: 3 },
  ];
  var SCENE_MAX = 96;

  function sceneTitle(values) {
    values = values || held;
    var segments = [];
    for (var i = 0; i < SCENE_SEGMENTS.length; i++) {
      var seg = SCENE_SEGMENTS[i];
      var list = null;
      for (var j = 0; j < seg.lists.length; j++) if (values[seg.lists[j]]) { list = seg.lists[j]; break; }
      if (!list) continue;
      var text = fragment(values[list], seg.take, seg.words);
      if (text) segments.push(text);
    }
    var joined = function () { return segments.join(" \u00b7 "); };
    var guard = 0;
    while (joined().length > SCENE_MAX && guard++ < 40) {
      // The first segment is the actor - the one thing that says WHICH shot this
      // is - so it gives up words last. Everything after it is fair game.
      var longest = -1, longestLen = -1;
      for (var k = 1; k < segments.length; k++) {
        if (segments[k].split(/\s+/).length > 1 && segments[k].length > longestLen) { longest = k; longestLen = segments[k].length; }
      }
      if (longest < 0) break;
      var keptWords = segments[longest].replace(/\u2026$/, "").split(/\s+/);
      segments[longest] = keptWords.slice(0, -1).join(" ") + "\u2026";
    }
    var title = joined();
    if (title.length <= SCENE_MAX) return title;
    var cut = title.slice(0, SCENE_MAX - 1);
    var space = cut.lastIndexOf(" ");
    return (space > SCENE_MAX * 0.6 ? cut.slice(0, space) : cut).replace(/[\s\u00b7]+$/, "") + "\u2026";
  }

  // ------------------------------------------------------------- holding it
  function values() { return held; }
  function heldNames() {
    return PARTS.filter(function (p) { return !!held[p.list]; }).map(function (p) { return p.list; });
  }
  function chips() {
    var skip = suppressed(held);
    return PARTS.filter(function (p) { return !!held[p.list] && !skip[p.list]; }).map(function (p) {
      return { list: p.list, label: p.label, value: held[p.list], head: fragment(held[p.list], "head", 8) };
    });
  }
  function clear() { held = {}; save(); announce(); return true; }
  function onChange(fn) { if (typeof fn === "function") listeners.push(fn); }
  function announce() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) { console.warn("an idea listener threw", e); }
    }
  }

  // ------------------------------------------------------------- the store
  async function load() {
    var s = store();
    if (!s) { loaded = true; return held; }
    try {
      var saved = await s.get(KEY);
      if (saved && saved.values && typeof saved.values === "object") held = saved.values;
      var ex = await s.get(EXTRA_KEY);
      if (ex && typeof ex === "object") extras = ex;
    } catch (e) { console.warn("could not restore the shot list", e); }
    loaded = true;
    announce();
    return held;
  }
  async function save() {
    var s = store();
    if (!s) return false;
    try {
      await s.set(KEY, { values: held, at: Date.now() });
      return true;
    } catch (e) { console.warn("could not remember the shot list", e); return false; }
  }
  async function saveExtras() {
    var s = store();
    if (!s) return false;
    try { await s.set(EXTRA_KEY, extras); return true; }
    catch (e) { console.warn("could not remember the added phrases", e); return false; }
  }
  function extrasFor(list) { return (extras[list] || []).slice(); }
  function extrasCount() {
    var n = 0;
    for (var k in extras) if (Object.prototype.hasOwnProperty.call(extras, k)) n += extras[k].length;
    return n;
  }
  async function addPhrase(list, phrase) {
    var part = partOf(list);
    if (!part) return { ok: false, why: "no dimension called \u201c" + list + "\u201d" };
    var text = String(phrase == null ? "" : phrase).trim();
    if (!text) return { ok: false, why: "no phrase given" };
    var entries = extras[part.list] || (extras[part.list] = []);
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].toLowerCase() === text.toLowerCase()) return { ok: false, why: "the list already has it", list: part.list };
    }
    entries.push(text);
    await saveExtras();
    return { ok: true, list: part.list, label: part.label, count: entries.length };
  }
  async function forgetPhrase(list, phrase) {
    var part = partOf(list);
    if (!part) return false;
    var entries = extras[part.list] || [];
    var want = String(phrase == null ? "" : phrase).trim().toLowerCase();
    var kept = entries.filter(function (e) { return e.toLowerCase() !== want; });
    if (kept.length === entries.length) return false;
    if (kept.length) extras[part.list] = kept; else delete extras[part.list];
    await saveExtras();
    return true;
  }

  // --------------------------------------------------------------- writing
  //
  // The roll is written into the forge form on request. The positive prompt is
  // written outright - that IS the roll - and the negative list only into an
  // EMPTY negative box, the same rule the prompt book and the recipe book
  // follow: nothing Patrikios wrote there is ever overwritten by a roll.
  function write(opts) {
    opts = opts || {};
    var prompt = compose(held, "prompt");
    var negative = compose(held, "negative");
    if (!window.forgeBook || !window.forgeBook.write) {
      return { ok: false, why: "the forge is not loaded here", prompt: prompt, negative: negative };
    }
    var res = window.forgeBook.write(prompt, negative, opts);
    return { ok: true, prompt: prompt, negative: negative, written: res };
  }

  // A roll, as text: the scene line, the chips, and the composed prompt. What
  // `/idea` prints, and what a roll button in the panel prints.
  function report(what) {
    var lines = [];
    if (what) lines.push(what);
    var title = sceneTitle(held);
    if (title) lines.push("SCENE   " + title.toUpperCase());
    var rows = chips();
    if (!rows.length) {
      lines.push("NOTHING IS HELD :: /idea ROLLS EVERY DIMENSION, OR A DIE ROLLS ONE GROUP OF THEM.");
      return lines.join("\n");
    }
    lines.push(rows.map(function (c) { return c.label.toUpperCase() + " " + c.head; }).join("  \u00b7  "));
    var prompt = compose(held, "prompt");
    if (prompt) lines.push("PROMPT (" + prompt.length + " CHARS) " + prompt.slice(0, 300) + (prompt.length > 300 ? " ..." : ""));
    var negative = compose(held, "negative");
    if (negative) lines.push("NEGATIVE LIST (" + negative.length + " CHARS) " + negative.slice(0, 120) + (negative.length > 120 ? " ..." : ""));
    return lines.join("\n");
  }

  // The dice, for a listing: name, count, and whether it is the catch-all.
  function diceReport() {
    var all = dice();
    if (!all.length) return "NO DICE ARE DECLARED :: THE `dice` LIST IN main.pjs IS EMPTY.";
    return "THE DICE (" + all.length + ") :: " + all.map(function (d) {
      return d.name.toUpperCase() + " ROLLS " + d.rolls.length + (d.catchAll ? " (EVERYTHING NO OTHER DIE CLAIMS)" : " :: " + d.rolls.join(", "));
    }).join("\n  ");
  }

  function listReport() {
    var rows = PARTS.map(function (p) {
      var n = hasList(p.list) ? window.root[p.list].getLength : 0;
      var ex = (extras[p.list] || []).length;
      return "  " + (p.label + "        ").slice(0, 11) + (hasList(p.list) ? n : "MISSING") + " ITEM" + (n === 1 ? "" : "S")
        + (ex ? " + " + ex + " ADDED" : "")
        + (p.replaces ? "  (TAKES OVER " + p.replaces.join(", ") + ")" : "")
        + (p.into ? "  (ROUTES TO " + p.into.toUpperCase() + ")" : "");
    });
    return "THE SHOT LIST :: " + PARTS.length + " DIMENSIONS, ONE ITEM DRAWN FROM EACH\n" + rows.join("\n")
      + (extrasCount() ? "\n" + extrasCount() + " PHRASE" + (extrasCount() === 1 ? "" : "S") + " ADDED ON THIS DEVICE ARE PART OF THE DRAW." : "");
  }

  function help() {
    return [
      "THE SHOT LIST :: A PICTURE IS ROLLED, NOT TYPED. EVERY LIST IN main.pjs IS ONE DIMENSION",
      "OF A SHOT (WHO, WHERE, THE ACT, THE CROP, THE ANGLE, THE CAMERA, THE LENS, THE LIGHT, THE GRADE).",
      "A ROLL DRAWS ONE ITEM FROM EACH AND GLUES THEM INTO A PROMPT, WHICH GOES INTO THE FORGE FORM.",
      "",
      "  /idea                 ROLL EVERY DIMENSION AND WRITE THE PROMPT INTO THE FORGE",
      "  /idea dice            LIST THE DICE AND WHAT EACH ONE ROLLS",
      "  /idea <DIE>           ROLL ONE GROUP (d6 = THE SCENE, d20 = EVERYTHING ELSE)",
      "  /idea <DIMENSION>     RE-ROLL JUST THAT ONE - THE REST STAY EXACTLY WHERE THEY ARE",
      "  /idea list            EVERY DIMENSION, HOW MANY ITEMS IT HAS, AND WHAT HE HAS ADDED",
      "  /idea held            WHAT IS HELD NOW (THE CHIPS AND THE SCENE LINE)",
      "  /idea scene           THE SCENE LINE ONLY",
      "  /idea drop <DIM>      DROP ONE DIMENSION FROM THE ROLL",
      "  /idea clear           FORGET THE WHOLE ROLL",
      "  /idea add <DIM> :: PHRASE   FILE A PHRASE OF HIS OWN INTO A DIMENSION, SO IT IS DRAWN FROM THEN ON",
      "  /idea forget <DIM> :: PHRASE",
      "  {<DIMENSION>} IN A PROMPT DRAWS ONE ITEM FROM THAT DIMENSION ON EVERY RENDER - {setting}, {light},",
      "  {camera}, ANY NAME OR LABEL - WITH HIS ADDED PHRASES IN THE POOL. /idea list LISTS EVERY DIMENSION.",
      "",
      "THE DIMENSIONS :: " + listNames().join(", "),
    ].join("\n");
  }

  window.idea = {
    PARTS: PARTS,
    parts: parts,
    partOf: partOf,
    names: listNames,
    has: hasList,
    rollAll: rollAll,
    rollOne: rollOne,
    rollDie: rollDie,
    drawOne: drawOne,
    drop: drop,
    clear: clear,
    values: values,
    held: heldNames,
    chips: chips,
    compose: compose,
    sceneTitle: sceneTitle,
    dice: dice,
    diceReport: diceReport,
    listReport: listReport,
    report: report,
    write: write,
    extrasFor: extrasFor,
    extrasCount: extrasCount,
    addPhrase: addPhrase,
    forgetPhrase: forgetPhrase,
    load: load,
    save: save,
    ready: function () { return loaded; },
    onChange: onChange,
    help: help,
  };

  // Boot: the roll held on this device comes back with the rest of the form. A
  // failure here costs the holding, never the terminal.
  load().catch(function (e) { console.warn("the shot list could not be restored", e); });
})();
