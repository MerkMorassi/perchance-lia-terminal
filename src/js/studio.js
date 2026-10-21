/* ------------------------------------------------------------------
   PROMPT BOOK (studio) - the layer between Patrikios' documents and
   the image service.

   There are three jobs here, and all three exist because the image
   service is NOT a blank sheet:

   1. THE TAG HANDLER. Perchance's text-to-image plugin treats
      `(key:::value)` inside a prompt as ITS OWN option syntax. It
      deletes those fragments from the prompt text and turns them into
      settings - and because it parses them BEFORE it looks at the
      caller's options, a `(seed:::N)` pasted inside a prompt OVERRIDES
      the seed the form was given, and `(negativePrompt:::...)` cuts
      everything from that marker to the end of the prompt out of the
      positive text and makes it the negative prompt instead. Patrikios'
      documents carry exactly that syntax (his prompts were written for
      another pipeline), so a file dropped into the forge used to lose
      its tags and its settings silently. So: the tags are parsed HERE,
      first, routed to the fields they mean, reported, and removed - by
      the time the plugin sees the prompt there is nothing left for it
      to eat.

   2. THE SPLITTER. His documents are not one prompt, they are a
      structured file: a positive section, a NEGATIVE PROMPT section, a
      SEEDS block, sometimes an ART STYLE line. Pasted whole into the
      positive box, his negative list becomes a list of things the image
      is asked FOR. So the sections are found and separated, and the
      negative list goes where it belongs.

   3. THE GLOSSARY (THE VEILED TONGUE). His coined register - "Pillar of
      Light", "Gate of Eleuthia" - was a work-around for services that
      refuse explicit text. It is right for speech and useless for a
      renderer, which has never seen those words. Body terms are
      TRANSLATED to the literal term the models know; lore terms are
      held out of the render; a coined phrase that is in neither list is
      held out and reported rather than sent and hoped for. Nothing is
      ever silently dropped.

   The data itself lives in src/studio/*.json so it can be corrected
   without touching this file. If those files cannot be read (an
   unsaved preview in a browser with no service worker), the layer says
   so and translates NOTHING - it never pretends to have read them.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var GLOSSARY_FILE = "src/studio/glossary.json";
  var POSITIONS_FILE = "src/studio/positions.json";
  var RECIPES_FILE = "src/studio/recipes.json";

  // The plugin's own key list. Anything here would be eaten out of a prompt, so anything here is
  // handled here instead. `negativePrompt` is not in this list: it is not a value, it is a CUT.
  var TAG_KEYS = ["seed", "size", "style", "resolution", "width", "height", "guidanceScale", "saveTitle", "saveDescription"];
  var VALID_RES = ["512x512", "512x768", "768x512", "768x768"];

  var glossary = null, positions = null, loading = null;
  var bodyRules = [], worldRules = [], coinedRe = null;
  var DEFAULT_GUIDANCE = 7;

  function low(s) { return String(s == null ? "" : s).toLowerCase(); }
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function tidy(s) {
    return String(s == null ? "" : s)
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+([,.;:!?])/g, "$1")
      .replace(/\s\b(?:and|or|the|a|an|my|her|his|their|with|of|to|on|in|at|from)\b\s*(?=[,.;:!?])/gi, "")
      .replace(/,\s*,+/g, ",")
      .replace(/\(\s*\)/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /* ---- the data ------------------------------------------------------------ */
  async function load() {
    if (loading) return loading;
    loading = (async function () {
      try {
        var g = await fetch(GLOSSARY_FILE).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });
        if (g && (g.body || g.world)) glossary = g;
      } catch (e) {
        console.warn("studio: the glossary could not be read (" + GLOSSARY_FILE + ")", e);
      }
      try {
        var p = await fetch(POSITIONS_FILE).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });
        if (p && p.poses) positions = p;
      } catch (e) {
        console.warn("studio: the position list could not be read (" + POSITIONS_FILE + ")", e);
      }
      try {
        var rc = await fetch(RECIPES_FILE).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });
        if (rc && Array.isArray(rc.recipes)) recipes = rc;
      } catch (e) {
        console.warn("studio: the recipe book could not be read (" + RECIPES_FILE + ")", e);
      }
      compile();
      await loadBook();
      notifyBook();
      await loadRecipeBook();
      notifyRecipes();
      return { glossary: !!glossary, positions: !!positions, book: !!book, recipes: !!(recipes && recipes.recipes) };
    })();
    return loading;
  }

  // One regex per term, longest phrase first so "Gate of Hymns and Song" is never eaten by a
  // shorter rule, with a lookup so a match can be checked against what is already known.
  function compile() {
    bodyRules = []; worldRules = []; coinedRe = null;
    if (!glossary) return;
    var bodyTerms = [], worldTerms = [];
    (glossary.body || []).forEach(function (entry) {
      if (!entry || !entry.render) return;
      (entry.terms || []).forEach(function (t) { if (String(t).trim()) bodyTerms.push({ term: String(t), entry: entry }); });
    });
    (glossary.world || []).forEach(function (entry) {
      (entry.terms || []).forEach(function (t) { if (String(t).trim()) worldTerms.push({ term: String(t), entry: entry }); });
    });
    bodyTerms.sort(function (a, b) { return b.term.length - a.term.length; });
    worldTerms.sort(function (a, b) { return b.term.length - a.term.length; });
    bodyRules = bodyTerms.map(function (x) { return { re: new RegExp("\\b" + escRe(x.term) + "\\b", "gi"), term: x.term, entry: x.entry }; });
    worldRules = worldTerms.map(function (x) { return { re: new RegExp("\\b" + escRe(x.term) + "\\b", "gi"), term: x.term, entry: x.entry }; });
    if (glossary.coinagePattern) {
      try { coinedRe = new RegExp(glossary.coinagePattern, "g"); } catch (e) { coinedRe = null; }
    }
  }

  function knownTerm(text) {
    var t = low(text);
    for (var i = 0; i < bodyRules.length; i++) if (low(bodyRules[i].term) === t) return "body";
    for (var j = 0; j < worldRules.length; j++) if (low(worldRules[j].term) === t) return "world";
    return null;
  }

  /* ---- the glossary ------------------------------------------------------- */
  // Body terms become the literal term; lore terms and unknown coinages are held OUT of what is
  // sent, so a renderer is never handed a word it has no meaning for.
  function translate(text) {
    var out = String(text == null ? "" : text);
    var swaps = [], lore = [], held = [];
    if (!glossary) return { text: out, swaps: swaps, lore: lore, held: held, translated: false };
    bodyRules.forEach(function (r) {
      out = out.replace(r.re, function (all) { swaps.push({ from: all, to: r.entry.render }); return r.entry.render; });
    });
    worldRules.forEach(function (r) {
      out = out.replace(r.re, function (all) { lore.push(all); return " "; });
    });
    if (coinedRe) {
      out = out.replace(coinedRe, function (all) {
        if (knownTerm(all)) return all;      // already handled above (or a lore term)
        held.push(all);
        return " ";
      });
    }
    return { text: tidy(out), swaps: swaps, lore: lore, held: held, translated: true };
  }

  /* ---- the tags ----------------------------------------------------------- */
  // Exactly what the plugin would take, taken first. `negativePrompt` is a cut to the end of the
  // prompt (or to its matching bracket), so it is handled the same way the plugin handles it.
  function takeNegative(text) {
    var s = String(text == null ? "" : text);
    var i = s.toLowerCase().indexOf("(negativeprompt:::");
    if (i === -1) return null;
    var start = i + "(negativePrompt:::".length;
    var depth = 0, end = -1, value = "";
    for (var j = start; j < s.length; j++) {
      var ch = s[j];
      if (ch === "(") depth++;
      else if (ch === ")") {
        if (depth === 0) { end = j; break; }
        depth--;
      }
      value += ch;
    }
    // No closing bracket: the plugin takes everything to the end - so do we.
    var rest = (end === -1) ? s.slice(0, i) : (s.slice(0, i) + " " + s.slice(end + 1));
    return { value: tidy(value), rest: rest };
  }

  function parseTags(text) {
    var out = {
      text: String(text == null ? "" : text),
      seeds: [], seed: 0, guidance: 0, resolution: "", style: "",
      saveTitle: "", saveDescription: "",
      routed: [], notes: [], negativePrompt: "",
    };
    var neg = takeNegative(out.text);
    if (neg) {
      out.negativePrompt = neg.value;
      out.text = neg.rest;
      out.routed.push("negativePrompt");
    }
    TAG_KEYS.forEach(function (key) {
      var re = new RegExp("\\(\\s*" + key + "\\s*:::\\s*([^)]*?)\\s*\\)", "gi");
      out.text = out.text.replace(re, function (all, value) {
        var v = String(value == null ? "" : value).trim();
        if (key === "seed") {
          var n = Math.floor(Number(String(v).replace(/[^0-9]/g, "")));
          if (isFinite(n) && n > 0) {
            out.seed = n;                       // last one wins, the way the plugin's loop does
            out.seeds.push(n);
            out.routed.push("seed " + n);
          } else {
            out.notes.push("SEED TAG \"" + v + "\" IGNORED (NOT A NUMBER)");
          }
        } else if (key === "guidanceScale") {
          var g = Math.floor(Number(String(v).replace(/[^0-9]/g, "")));
          if (isFinite(g) && g >= 1 && g <= 30) { out.guidance = g; out.routed.push("guidance " + g); }
          else out.notes.push("GUIDANCE TAG \"" + v + "\" IGNORED (THE SERVICE TAKES 1-30)");
        } else if (key === "resolution") {
          if (VALID_RES.indexOf(low(v)) !== -1) { out.resolution = low(v); out.routed.push("size " + low(v)); }
          else out.notes.push("SIZE TAG \"" + v + "\" IGNORED (THE SERVICE TAKES " + VALID_RES.join(", ") + ")");
        } else if (key === "size" || key === "width" || key === "height") {
          out.notes.push(key.toUpperCase() + " TAG \"" + v + "\" IGNORED (USE THE SIZE CHIPS - THE SERVICE TAKES " + VALID_RES.join(", ") + ")");
        } else if (key === "style") {
          out.style = v;
          out.notes.push("STYLE TAG \"" + v + "\" REMOVED (THE SERVICE HAS NO STYLE FIELD)");
        } else if (key === "saveTitle") {
          out.saveTitle = v;
        } else if (key === "saveDescription") {
          out.saveDescription = v;
        }
        return "";
      });
    });
    out.text = tidy(out.text);
    return out;
  }

  /* ---- the sections ------------------------------------------------------- */
  var HEADS = {
    positive: ["positive prompt", "positive", "prompt", "scene prompt", "scene", "setting", "subject"],
    negative: ["negative prompt", "negative prompts", "negative"],
    seeds: ["seeds", "seed"],
    guidance: ["guidance scale", "guidance", "cfg"],
    style: ["art style", "style", "aesthetic"],
    notes: ["notes", "note", "caption", "description", "comment"],
  };

  function headOf(line) {
    var t = String(line || "").trim().replace(/[:\uFF1A]+\s*$/, "");
    var after = "";
    var m = String(line || "").trim().match(/^([^:\uFF1A]{2,40})[:\uFF1A]\s*(.*)$/);
    if (m) { t = m[1].trim(); after = m[2].trim(); }
    var lt = low(t).replace(/^[#*\s]+|[#*\s]+$/g, "");
    for (var key in HEADS) {
      if (HEADS[key].indexOf(lt) !== -1) return { key: key, after: after };
    }
    return null;
  }

  // Finds his document's shape. A file with no headers at all is one positive prompt, untouched.
  function splitSections(text) {
    var lines = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
    var out = { positive: "", negative: "", seeds: "", guidance: "", style: "", notes: "", found: [] };
    var current = "positive", buf = { positive: [], negative: [], seeds: [], guidance: [], style: [], notes: [] };
    lines.forEach(function (line) {
      var head = headOf(line);
      if (head) {
        current = head.key;
        if (out.found.indexOf(head.key) === -1) out.found.push(head.key);
        if (head.after) buf[current].push(head.after);
        return;
      }
      buf[current].push(line);
    });
    for (var key in buf) out[key] = tidy(buf[key].join("\n"));
    if (out.found.length === 0) out.positive = tidy(String(text == null ? "" : text));
    return out;
  }

  /* ---- THE CHOICE: {a|b|c} inside a prompt --------------------------------

     Perchance's own inline alternation, made to work where a perchance generator does NOT normally
     reach: the prompt boxes, her [[VISION: ...]] lines, and everything else handed to the renderer
     as a plain string. The image service has no such syntax (checked: its only prompt syntax is
     `(key:::value)`), so an unexpanded `{a|b}` used to be sent as literal punctuation - which is why
     the pose list is worth more here than as a slash command: a prompt can say "one of these" and
     get a DIFFERENT one for every image in a batch, with the names it already knows.

       {Doggy Style|Blow Job}          one of them, evenly
       {Doggy Style^3|Blow Job}        perchance's own odds: 3 to 1
       {Doggy Style|Blow Job|60}       60% of the time one of them, 40% of the time nothing at all
       {standing|{kneeling|sitting}}   nesting works
       {pose}                          a pose drawn from THE BOOK
       {pose:hetero}                   ...from one list of it
       \{  \}  \|                      a literal bracket or a literal pipe

     A brace group with no `|` in it and no pose token is left EXACTLY as written, so the braces his
     documents are full of are never touched. Expansion is once PER IMAGE, which is the whole point
     of it here: a batch of nine with `{Doggy Style|Blow Job}` is nine different poses, not nine
     copies of one. Nothing is ever silently dropped: a group that cannot be resolved (a pose list
     with nothing in it) is left as written and reported.
     ------------------------------------------------------------------------- */
  var ESC_OPEN = "\uE000", ESC_CLOSE = "\uE001", ESC_PIPE = "\uE002";
  var POSE_TOKEN = /^poses?\s*(?::\s*([a-z0-9][a-z0-9 _-]*))?$/i;
  var LIST_TOKEN = /^([A-Za-z][A-Za-z0-9_]*)$/;

  // A whole-group `{name}` draw: one item from a shot-list dimension (by name or label,
  // with his added phrases in the pool) or from any other list in main.pjs - perchance's
  // own selectOne, so weights, branches and computed items all work. null = no such list,
  // and the group is left exactly as written. `pose` is NOT a list here: the pose token
  // keeps its own road above.
  function drawListToken(name) {
    var key = String(name || "");
    if (!key || POSE_TOKEN.test(key)) return null;
    try {
      if (window.idea && window.idea.drawOne) {
        var v = window.idea.drawOne(key);
        if (v) return { text: v, from: "shot list" };
      }
    } catch (e) {}
    try {
      var L = window.root && window.root[key];
      if (L && L.selectOne && L.selectOne.evaluateItem != null) {
        var t = String(L.selectOne.evaluateItem).trim();
        if (t && t !== "[object Object]") return { text: t, from: "main.pjs" };
      }
    } catch (e) {}
    return null;
  }

  // The alternatives inside a group, split on the pipes at ITS OWN depth, so a nested {a|b} inside
  // one alternative is not torn apart. Escaped brackets and pipes were parked out of reach first.
  function splitAlternatives(inner) {
    var out = [], buf = "", depth = 0, i;
    for (i = 0; i < inner.length; i++) {
      var ch = inner[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      if (ch === "|" && depth === 0) { out.push(buf); buf = ""; continue; }
      buf += ch;
    }
    out.push(buf);
    return out;
  }

  // One alternative: plain words, `words^3` (odds), a bare integer or `60%` (a chance on the whole
  // group rather than an option), or the pose token.
  function parseAlt(raw) {
    var out = { text: String(raw).trim(), weight: 1, chance: null, pose: null };
    var m = out.text.match(/^(.*?)\s*\^\s*([0-9]+(?:\.[0-9]+)?)$/);
    if (m && m[1].trim()) { out.text = m[1].trim(); out.weight = Number(m[2]); return out; }
    if (/^[0-9]{1,3}\s*%?$/.test(out.text)) {
      out.chance = Math.max(0, Math.min(100, parseInt(out.text, 10)));
      out.text = "";
      return out;
    }
    m = out.text.match(POSE_TOKEN);
    if (m) { out.pose = (m[1] || "").trim().toLowerCase().replace(/\s+/g, "-"); out.text = ""; }
    return out;
  }

  // A pose, drawn the same way the forge draws one: its render phrase if it has one, else its name
  // (the names are the tokens the training data already knows). null = the book has nothing to give.
  function poseAlternative(family) {
    var list = null;
    if (family) {
      list = poses(family);
      if (!list.length) {
        var key = familyKey(family);
        list = poses().filter(function (p) { return keyOf(p.family).indexOf(keyOf(key)) !== -1; });
      }
    } else list = poses();
    if (!list || !list.length) return null;
    var p = list[Math.floor(Math.random() * list.length)];
    return p.render || p.name;
  }

  function describeChoice(inner, parsed, chance, options) {
    var bits = ["{" + inner + "}"];
    if (chance != null) bits.push(chance + "% OF THE TIME, OTHERWISE NOTHING");
    if (options.some(function (o) { return o.weight !== 1; })) {
      bits.push("ODDS " + options.map(function (o) {
        return (o.pose != null ? (o.pose ? "POSE:" + o.pose.toUpperCase() : "POSE") : (o.text || "?")) + "^" + o.weight;
      }).join(" "));
    }
    options.forEach(function (o) {
      if (o.pose == null) return;
      var n = o.pose ? poses(o.pose).length : poses().length;
      bits.push("A POSE FROM THE BOOK" + (o.pose ? " (" + o.pose.toUpperCase() + ")" : "") + " :: " + n + " TO DRAW FROM");
    });
    return bits.join(" :: ");
  }

  // Walks the text, expanding the outermost eligible group, then whatever follows it - so several
  // groups in one prompt, and nesting, both work. `pick:false` reports without choosing.
  function expandScan(text, opts, found, picks, depth) {
    if (depth > 8) return text;
    var out = "", rest = String(text);
    while (rest) {
      var open = rest.indexOf("{");
      if (open === -1) { out += rest; break; }
      var close = -1, d = 0, i;
      for (i = open; i < rest.length; i++) {
        if (rest[i] === "{") d++;
        else if (rest[i] === "}") { d--; if (d === 0) { close = i; break; } }
      }
      // An unmatched brace is not a group at all: left exactly as written.
      if (close === -1) { out += rest; break; }
      var inner = rest.slice(open + 1, close);
      out += rest.slice(0, open);
      // A whole-group `{name}` is a draw from a list, not a choice: one item from that
      // shot-list dimension (or main.pjs list), fresh on every render. Unknown names fall
      // through to the literal road below. Inside a group (`{a|name}`) words stay words -
      // only the whole group draws, so no literal is ever hijacked out of an alternation.
      if (inner.indexOf("|") === -1) {
        var tok = inner.trim().match(LIST_TOKEN);
        if (tok && !POSE_TOKEN.test(tok[1])) {
          var drawn = drawListToken(tok[1]);
          if (drawn) {
            found.push("{" + tok[1] + "} :: DRAW FROM THE " + String(drawn.from).toUpperCase() + " (" + tok[1].toUpperCase() + ")");
            if (opts.pick === false) out += rest.slice(open, close + 1);
            else {
              picks.push("{" + tok[1] + "} > " + String(drawn.text).slice(0, 90));
              out += expandScan(drawn.text, opts, found, picks, depth + 1);
            }
            rest = rest.slice(close + 1);
            continue;
          }
        }
      }
      var alts = splitAlternatives(inner);
      var eligible = alts.length > 1 || POSE_TOKEN.test(inner.trim());
      // Not a choice: braces with no | and no pose token belong to whoever wrote them.
      if (!eligible) { out += rest.slice(open, close + 1); rest = rest.slice(close + 1); continue; }

      var parsed = alts.map(parseAlt);
      var chance = null, options = [];
      parsed.forEach(function (a) {
        if (a.chance != null && parsed.length > 1) chance = a.chance;
        else options.push(a);
      });
      if (!options.length) { out += rest.slice(open, close + 1); rest = rest.slice(close + 1); continue; }

      var chosen = null, taken = null;
      if (opts.pick === false) {
        found.push(describeChoice(inner, parsed, chance, options));
        out += rest.slice(open, close + 1);
        rest = rest.slice(close + 1);
        continue;
      }
      if (chance != null && Math.random() * 100 >= chance) {
        chosen = "";
        taken = "{" + inner + "} > (LEFT OUT THIS TIME)";
      } else {
        var total = 0;
        options.forEach(function (o) { total += (o.weight > 0 ? o.weight : 0); });
        var r = Math.random() * total, hit = options[options.length - 1];
        for (var k = 0; k < options.length; k++) {
          r -= (options[k].weight > 0 ? options[k].weight : 0);
          if (r < 0) { hit = options[k]; break; }
        }
        if (hit.pose != null) {
          var pn = poseAlternative(hit.pose);
          if (pn == null) {
            // The book has nothing to draw from: say so, and leave the group as it was written.
            found.push(describeChoice(inner, parsed, chance, options) + " :: THE BOOK HAS NO POSE TO DRAW FROM - LEFT AS WRITTEN");
            out += rest.slice(open, close + 1);
            rest = rest.slice(close + 1);
            continue;
          }
          chosen = pn;
          taken = "{" + inner + "} > " + pn;
        } else {
          chosen = hit.text;
          taken = "{" + inner + "} > " + hit.text;
        }
      }
      found.push(describeChoice(inner, parsed, chance, options));
      if (taken) picks.push(taken);
      out += expandScan(chosen, opts, found, picks, depth + 1);
      rest = rest.slice(close + 1);
    }
    return out;
  }

  // The public door. `{a|b}` -> one of them; `pick:false` reports the groups without touching the
  // text. The result is tidied of the punctuation a group can leave behind (a comma with nothing
  // after it, because the group this time produced nothing).
  function expand(text, opts) {
    opts = opts || {};
    var src = String(text == null ? "" : text);
    if (src.indexOf("{") === -1) return { text: src, groups: [], picks: [] };
    var work = src.replace(/\\\{/g, ESC_OPEN).replace(/\\\}/g, ESC_CLOSE).replace(/\\\|/g, ESC_PIPE);
    var found = [], picks = [];
    var out = expandScan(work, opts, found, picks, 0);
    if (opts.pick !== false) {
      out = out
        .replace(/[ \t]*,[ \t]*(?=[,.;:!?])/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } else out = src;
    out = out.replace(new RegExp(ESC_OPEN, "g"), "{").replace(new RegExp(ESC_CLOSE, "g"), "}").replace(new RegExp(ESC_PIPE, "g"), "|");
    return { text: out, groups: found, picks: picks };
  }

  /* ---- resolve: one prompt in, one request out ---------------------------- */
  // The rule, stated plainly: a value the user typed in the form WINS; when the form is sitting
  // at its default the value in the document is used; and every decision is reported. Nothing
  // about the words themselves is ever rewritten except through the glossary.
  function resolve(text, opts) {
    opts = opts || {};
    var raw = String(text == null ? "" : text);
    var sec = splitSections(raw);
    // Everything except the negative section goes to the tag handler: his SEEDS block and his
    // ART STYLE line carry `(seed:::…)` / `(guidanceScale:::…)` tags too, and an art-style line
    // is part of the prompt (it is folded into the positive, not dropped).
    var headParts = [sec.positive, sec.style, sec.seeds, sec.guidance].filter(function (x) { return String(x || "").trim(); });
    var tags = parseTags(headParts.join("\n"));
    var rep = {
      split: sec.found.slice(), routed: tags.routed.slice(), notes: tags.notes.slice(),
      swaps: [], lore: [], held: [], choices: [],
      seedsInFile: tags.seeds.slice(), style: tags.style,
      seed: 0, seedFrom: "", guidance: 0, guidanceFrom: "", resolution: "", resolutionFrom: "",
      negativeFrom: "", panelNegativeSetAside: false, folded: [], notSent: [],
    };
    if (sec.style && String(sec.style).trim() && tags.text.indexOf(sec.style) === -1) rep.folded.push("ART STYLE");
    if (sec.notes && String(sec.notes).trim()) rep.notSent.push("NOTES SECTION");

    // SEED - the form's, unless it is blank.
    var panelSeed = Math.floor(Number(opts.seed || 0)) || 0;
    if (panelSeed) {
      rep.seed = panelSeed; rep.seedFrom = "form";
      if (tags.seed && tags.seed !== panelSeed) rep.notes.push("THE PROMPT'S SEED " + tags.seed + " SET ASIDE (THE SEED FIELD SAYS " + panelSeed + ")");
    } else if (tags.seed) {
      rep.seed = tags.seed; rep.seedFrom = "prompt";
      if (tags.seeds.length > 1) rep.notes.push("SEEDS IN THE PROMPT: " + tags.seeds.join(", ") + " - USING THE LAST (" + tags.seed + "), PIN ONE TO CHOOSE");
    }

    // GUIDANCE - the form's, unless the form is at its default and the document says otherwise.
    var panelG = Math.floor(Number(opts.guidance || 0)) || 0;
    var defG = Math.floor(Number(opts.defaultGuidance || DEFAULT_GUIDANCE)) || DEFAULT_GUIDANCE;
    if (panelG && panelG !== defG) {
      rep.guidance = panelG; rep.guidanceFrom = "form";
      if (tags.guidance && tags.guidance !== panelG) rep.notes.push("THE PROMPT'S GUIDANCE " + tags.guidance + " SET ASIDE (THE FORM SAYS " + panelG + ")");
    } else if (tags.guidance) {
      rep.guidance = tags.guidance; rep.guidanceFrom = "prompt";
    } else {
      rep.guidance = panelG || defG; rep.guidanceFrom = panelG ? "form" : "default";
    }

    // SIZE - the same rule.
    var panelR = String(opts.resolution || "");
    var defR = String(opts.defaultResolution || "");
    if (panelR && defR && panelR !== defR) {
      rep.resolution = panelR; rep.resolutionFrom = "form";
      if (tags.resolution && tags.resolution !== panelR) rep.notes.push("THE PROMPT'S SIZE " + tags.resolution + " SET ASIDE (THE FORM SAYS " + panelR + ")");
    } else if (tags.resolution) {
      rep.resolution = tags.resolution; rep.resolutionFrom = "prompt";
    } else {
      rep.resolution = panelR || defR || "768x512"; rep.resolutionFrom = panelR ? "form" : "default";
    }

    // NEGATIVE - the form's, unless it is empty. THE WORD "none" MEANS NONE, and it is read in every
    // place a negative can come from (the box, the document's own NEGATIVE PROMPT section, a
    // (negativePrompt:::) cut) - because a render that carries nothing now falls back to the HOUSE
    // LIST (see below) and there has to be a way to say "I mean it: no negative at all" without
    // typing a list of one's own.
    var NEG_OFF = /^(none|no|off|nothing)$/i;
    var negs = [], negOff = false;
    var formNeg = String(opts.negative || "").trim();
    if (formNeg) {
      if (NEG_OFF.test(formNeg)) { negOff = true; rep.negativeFrom = "none"; }
      else {
        negs.push(formNeg);
        rep.negativeFrom = "form";
        if (sec.negative) rep.panelNegativeSetAside = true;
      }
    } else if (String(sec.negative || "").trim()) {
      if (NEG_OFF.test(String(sec.negative).trim())) { negOff = true; rep.negativeFrom = "none"; }
      else { negs.push(sec.negative); rep.negativeFrom = "file"; }
    }
    if (tags.negativePrompt) {
      var tagNeg = String(tags.negativePrompt).trim();
      if (rep.negativeFrom === "form") rep.notes.push("THE PROMPT'S OWN NEGATIVE SECTION WAS SET ASIDE (THE NEGATIVE FIELD IS FILLED)");
      else if (NEG_OFF.test(tagNeg)) { negs = []; negOff = true; rep.negativeFrom = "none"; }
      else { negs.push(tags.negativePrompt); rep.negativeFrom = "prompt"; }
    }

    // THE DEFAULT IS BLANK (Patrikios, 2026-10-01: "She can make whatever she wants, leave it
    // blank for now"). A render with no negative of its own - a plain CREATE with an empty box,
    // /image, a picture SHE described herself - is sent with NO negative at all. The house list in
    // src/studio/recipes.json is still there for recipes that name it explicitly, and /recipe
    // negative still shows it - but nothing is applied unless asked for. Whatever negative a render
    // IS sent with is written on the picture's own record (images.js lightbox), so every picture
    // lists the negative it was made with. THE WORD "none" still means none, in every place a
    // negative can come from (the box, the document's own NEGATIVE PROMPT section, a
    // (negativePrompt:::) cut).
    if (!negs.length && !negOff) {
      rep.negativeFrom = "blank";
    }

    // THE GLOSSARY - the words themselves.
    var pos = translate(tags.text);
    var negTr = translate(negs.join("\n"));
    rep.swaps = pos.swaps.slice();
    rep.lore = pos.lore.slice();
    rep.held = pos.held.slice();
    // THE CHOICE - {a|b} groups are REPORTED here (once, before a single render starts) and actually
    // taken per image, at the moment of sending: see expand() above and images.js's render.
    rep.choices = expand(pos.text, { pick: false }).groups.concat(expand(negTr.text, { pick: false }).groups);

    var seedLine = tags.seeds.length && !panelSeed ? tags.seed : (panelSeed || tags.seed || 0);
    return {
      resolved: true,
      positive: pos.text,
      negative: negTr.text,
      seed: rep.seed,
      guidance: rep.guidance,
      resolution: rep.resolution,
      seeds: tags.seeds.slice(),
      seedForRun: seedLine,
      saveTitle: tags.saveTitle,
      saveDescription: tags.saveDescription,
      style: tags.style,
      glossaryLoaded: !!glossary,
      changed: !!(rep.split.length || rep.routed.length || rep.notes.length || rep.swaps.length || rep.lore.length || rep.held.length || rep.folded.length || rep.notSent.length || rep.choices.length),
      report: rep,
    };
  }

  /* ---- the report --------------------------------------------------------- */
  // Everything the layer did, in the terminal's voice, for the lines above the images.
  function reportLines(rep) {
    if (!rep) return [];
    var out = [], seen = {};
    function uniq(list) { return list.filter(function (x) { var k = low(x); if (seen[k]) return false; seen[k] = 1; return true; }); }
    if (!glossary) out.push("PROMPT BOOK :: THE GLOSSARY IS NOT LOADED HERE (src/studio/glossary.json) :: NOTHING WAS TRANSLATED");
    if (rep.split && rep.split.length) out.push("PROMPT BOOK :: SPLIT :: " + rep.split.join(" + ").toUpperCase().replace(/ \+ /g, " SECTION + ") + " SECTION");
    if (rep.folded && rep.folded.length) out.push("PROMPT BOOK :: FOLDED INTO THE POSITIVE :: " + rep.folded.join(", ") + " (IT IS PART OF THE PROMPT, NOT A FIELD)");
    if (rep.notSent && rep.notSent.length) out.push("PROMPT BOOK :: NOT SENT (NOT IMAGE TEXT) :: " + rep.notSent.join(", "));
    (rep.choices || []).forEach(function (c) {
      out.push("PROMPT BOOK :: CHOICE :: " + c + " :: ONE IS TAKEN FOR EACH IMAGE");
    });
    if (rep.routed && rep.routed.length) out.push("PROMPT BOOK :: TAKEN FROM THE PROMPT :: " + uniq(rep.routed).join(", ").toUpperCase());
    var swaps = {};
    (rep.swaps || []).forEach(function (s) { var k = low(s.from); swaps[k] = swaps[k] || { from: s.from, to: s.to, n: 0 }; swaps[k].n++; });
    var sKeys = Object.keys(swaps);
    if (sKeys.length) out.push("PROMPT BOOK :: VEILED TONGUE TRANSLATED :: " + sKeys.map(function (k) { return "\"" + swaps[k].from + "\" > " + swaps[k].to + (swaps[k].n > 1 ? " (" + swaps[k].n + ")" : ""); }).join(" :: "));
    var lore = uniq(rep.lore || []);
    if (lore.length) out.push("PROMPT BOOK :: LORE, HELD OUT OF THE RENDER :: " + lore.map(function (x) { return "\"" + x + "\""; }).join(", "));
    var held = uniq(rep.held || []);
    if (held.length) out.push("PROMPT BOOK :: NOT SENT (COINED, NOT IN THE GLOSSARY) :: " + held.map(function (x) { return "\"" + x + "\""; }).join(", ") + " :: ADD IT TO THE GLOSSARY IF IT MEANS SOMETHING");
    (rep.notes || []).forEach(function (n) { out.push("PROMPT BOOK :: " + n); });
    return out;
  }

  /* ---- THE BOOK: the lists he - and she - can rewrite ---------------------
     src/studio/positions.json is the SEED, shipped with the terminal and never
     touched here. Everything done to the book at runtime is an OVERLAY kept in
     this browser (kv lia_settings / pose_book), so the shipped file stays a
     clean default while his book grows: a pose renamed or re-filed, a phrase
     that renders better than its name, a whole new list, and the poses only
     SHE thought of, filed under her own family. The overlay is small and
     additive:

       families  { key: { note } }                        a list made here
       poses     [ { name, family, render, note, source, ts } ]   poses that never shipped
       edit      { shippedName: { name?, family?, render? } }     his changes to a shipped pose
       hide      [ shippedName ]                          a shipped pose he does not want
       picks     [ { ts, asked, names, why, made } ]      what she chose, and when

     A shipped pose is keyed by its own name, so a rename never loses its
     identity (and never fights a later version of the file it came from).
  ------------------------------------------------------------------------- */
  var book = null, bookLoaded = false;
  var FAMILY_HERS = "hers";

  function bookStore() {
    return (window.root && window.root.kv && window.root.kv.lia_settings) || null;
  }
  function normName(s) { return low(s).replace(/\s+/g, " ").trim(); }
  function keyOf(s) { return normName(s).replace(/[^a-z0-9() ]/g, ""); }
  function blankBook() { return { families: {}, poses: [], edit: {}, hide: [], picks: [] }; }

  // Whatever was in storage is treated as untrusted: a book that cannot be read is a seed book,
  // not a crash on boot.
  function cleanBook(raw) {
    var b = blankBook();
    if (!raw || typeof raw !== "object") return b;
    if (raw.families && typeof raw.families === "object") {
      Object.keys(raw.families).forEach(function (k) {
        var key = String(k).trim().toLowerCase().replace(/\s+/g, "-");
        if (!key) return;
        b.families[key] = { note: String((raw.families[k] || {}).note || "") };
      });
    }
    (Array.isArray(raw.poses) ? raw.poses : []).forEach(function (p) {
      if (!p || !String(p.name || "").trim()) return;
      b.poses.push({
        name: String(p.name).trim(),
        family: String(p.family || FAMILY_HERS).trim().toLowerCase().replace(/\s+/g, "-"),
        render: String(p.render || "").trim(),
        note: String(p.note || "").trim(),
        source: (p.source === "her") ? "her" : "his",
        ts: Number(p.ts) || 0,
      });
    });
    if (raw.edit && typeof raw.edit === "object") {
      Object.keys(raw.edit).forEach(function (k) {
        var e = raw.edit[k] || {}, out = {};
        if (String(e.name || "").trim()) out.name = String(e.name).trim();
        if (String(e.family || "").trim()) out.family = String(e.family).trim().toLowerCase().replace(/\s+/g, "-");
        if (typeof e.render === "string") out.render = e.render.trim();
        b.edit[String(k)] = out;
      });
    }
    b.hide = (Array.isArray(raw.hide) ? raw.hide : []).map(function (h) { return String(h); });
    b.picks = (Array.isArray(raw.picks) ? raw.picks : []).slice(-50);
    return b;
  }

  async function loadBook() {
    if (bookLoaded) return book;
    if (!book) book = blankBook();
    var s = bookStore();
    // No keyring yet (the plugin has not answered): leave the book UNLOADED so a later call reads
    // it for real, rather than marking an empty book as "already loaded" and losing his edits.
    if (!s) return book;
    try {
      var raw = await s.get("pose_book");
      if (raw) book = cleanBook(raw);
    } catch (e) { console.warn("studio: the pose book could not be read", e); }
    bookLoaded = true;
    if (!positions) console.warn("studio: the pose book is loaded, but the shipped seed (" + POSITIONS_FILE + ") is not");
    return book;
  }

  async function saveBook() {
    var s = bookStore();
    if (!s) { console.warn("studio: nowhere to keep the pose book (kv is not loaded)"); return false; }
    try { await s.set("pose_book", book); return true; }
    catch (e) { console.warn("studio: the pose book could not be saved", e); return false; }
  }

  function shippedPoses() { return (positions && positions.poses) ? positions.poses : []; }

  // The book as it reads right now: the seed, with his edits applied and his hidden poses
  // dropped, then everything added since. Each pose carries the KEY it is stored under.
  function merged() {
    if (!book) book = blankBook();   // no storage read yet: the seed is still the book

    var out = [], seen = {};
    shippedPoses().forEach(function (p) {
      var key = String(p.name);
      if (book.hide.indexOf(key) !== -1) return;
      var e = book.edit[key] || {};
      out.push({
        key: key, name: e.name || p.name, family: e.family || p.family,
        render: (typeof e.render === "string") ? e.render : (p.render || ""),
        note: p.note || "", source: "book",
      });
      seen[keyOf(p.name)] = 1;
    });
    book.poses.forEach(function (p) {
      var key = String(p.name);
      if (book.hide.indexOf(key) !== -1) return;
      if (seen[keyOf(p.name)]) return;      // an add that only shadows a shipped pose
      out.push({ key: key, name: p.name, family: p.family, render: p.render || "", note: p.note || "", source: p.source || "his" });
    });
    return out;
  }

  function poses(family) {
    var list = merged();
    if (!family) return list;
    return list.filter(function (p) { return p.family === family; });
  }

  // Every list in the book: the seeded order first, then the lists made here, then any family a
  // pose actually uses (so a list is never invisible just because it was never declared).
  function families() {
    var out = [], seen = {};
    function put(f) {
      var k = String(f || "").trim().toLowerCase();
      if (!k || seen[k]) return;
      seen[k] = 1; out.push(k);
    }
    ((positions && positions.families) ? positions.families : []).forEach(put);
    Object.keys((book && book.families) || {}).forEach(put);
    poses().forEach(function (p) { put(p.family); });
    return out;
  }

  function findPose(name) {
    var t = keyOf(name);
    if (!t) return null;
    var list = poses(), i;
    for (i = 0; i < list.length; i++) if (keyOf(list[i].name) === t) return list[i];
    // Her wording is not the book's wording. Two shapes of near-miss, and they resolve in
    // opposite directions: a name that CONTAINS what was written ("Splits" for "split") wants the
    // SHORTEST match, and a name that was written as PART of a longer phrase ("Missionary" for
    // "missionary position") wants the LONGEST. Anything else is no match at all.
    var contains = null, containsLen = 0, contained = null, containedLen = 0;
    for (i = 0; i < list.length; i++) {
      var k = keyOf(list[i].name);
      if (!k) continue;
      if (k.indexOf(t) !== -1) {
        if (!contains || k.length < containsLen) { contains = list[i]; containsLen = k.length; }
      } else if (t.indexOf(k) !== -1) {
        if (k.length > containedLen) { contained = list[i]; containedLen = k.length; }
      }
    }
    return contains || contained;
  }

  // The phrase a pose contributes to a prompt: its own render field if it has one, else its name
  // (the names are the tokens the training data already knows).
  function posePhrase(name) {
    var p = findPose(name);
    if (!p) return "";
    return p.render || p.name;
  }

  // ---- writing to the book -------------------------------------------------
  function familyKey(f) { return String(f || "").trim().toLowerCase().replace(/\s+/g, "-"); }

  // A pose is matched against the whole book first: giving an existing pose a name that is
  // already taken EDITS it rather than filing a second one beside it.
  async function addPose(pose) {
    await loadBook();
    var name = String((pose && pose.name) || "").trim();
    if (!name) return { ok: false, error: "a pose needs a name" };
    var family = familyKey(pose.family || FAMILY_HERS) || FAMILY_HERS;
    var render = String(pose.render || "").trim();
    var note = String(pose.note || "").trim();
    var source = (pose.source === "her") ? "her" : "his";
    var existing = findPose(name);
    if (existing) {
      await editPose(existing.key, { name: name, family: family, render: render });
      return { ok: true, existed: true, pose: findPose(name) };
    }
    book.poses.push({ name: name, family: family, render: render, note: note, source: source, ts: Date.now() });
    if (!book.families[family]) book.families[family] = { note: "" };
    await saveBook();
    notifyBook();
    return { ok: true, existed: false, pose: findPose(name) };
  }

  async function editPose(key, patch) {
    await loadBook();
    var shipped = shippedPoses().filter(function (p) { return String(p.name) === String(key); })[0] || null;
    if (shipped) {
      var e = book.edit[String(key)] || {};
      if (typeof patch.name === "string" && patch.name.trim()) e.name = patch.name.trim();
      if (typeof patch.family === "string" && patch.family.trim()) e.family = familyKey(patch.family);
      if (typeof patch.render === "string") e.render = patch.render.trim();
      book.edit[String(key)] = e;
    } else {
      var added = book.poses.filter(function (p) { return String(p.name) === String(key); })[0] || null;
      if (!added) return { ok: false, error: "no such pose in the book" };
      if (typeof patch.name === "string" && patch.name.trim()) added.name = patch.name.trim();
      if (typeof patch.family === "string" && patch.family.trim()) added.family = familyKey(patch.family);
      if (typeof patch.render === "string") added.render = patch.render.trim();
    }
    await saveBook();
    notifyBook();
    return { ok: true, pose: findPose((patch.name || key)) };
  }

  async function removePose(key) {
    await loadBook();
    var k = String(key);
    var shipped = shippedPoses().some(function (p) { return String(p.name) === k; });
    if (shipped) {
      if (book.hide.indexOf(k) === -1) book.hide.push(k);
      delete book.edit[k];
    } else {
      book.poses = book.poses.filter(function (p) { return String(p.name) !== k; });
    }
    await saveBook();
    notifyBook();
    return { ok: true };
  }

  async function addFamily(key, note) {
    await loadBook();
    var k = familyKey(key);
    if (!k) return { ok: false, error: "a list needs a name" };
    var existed = families().indexOf(k) !== -1;
    if (!book.families[k]) book.families[k] = { note: String(note || "").trim() };
    await saveBook();
    notifyBook();
    return { ok: true, family: k, existed: existed };
  }

  async function recordPick(entry) {
    await loadBook();
    book.picks.push({
      ts: Date.now(),
      asked: String((entry && entry.asked) || ""),
      family: familyKey((entry && entry.family) || "") || "",
      names: ((entry && entry.names) || []).map(String),
      why: ((entry && entry.why) || []).map(String),
      made: ((entry && entry.made) || []).map(String),
    });
    book.picks = book.picks.slice(-50);
    await saveBook();
    notifyBook();
    return true;
  }

  async function resetBook() {
    book = blankBook();
    bookLoaded = true;
    await saveBook();
    notifyBook();
    return true;
  }

  function bookJSON() { return JSON.stringify(book || blankBook(), null, 2); }

  // Listeners that want to know the book changed (the forge's pose rows). Kept dumb on purpose:
  // one notification per write, no state.
  var bookWatchers = [];
  function onBookChange(fn) { if (typeof fn === "function") bookWatchers.push(fn); }
  function notifyBook() { bookWatchers.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  /* ---- THE RECIPE BOOK: whole prompt templates with named slots ------------

     His uploaded documents are full of prompts that WORK - the Baseline
     sheets, the structured interior scene, the one-line muse shot, the
     aphrohermetic close-up. They are the same pictures over and over with a
     few words changed, which is exactly what a recipe is for.

     A recipe is a FRAME plus the words that fill it:

       template   the prompt, with slots written as {{slot}}
       slots      what each slot holds when nothing is said - HIS wording, so
                  a recipe renders as a complete picture with nothing changed
       negative   "house" (the shared list in the file), its own text, or none

     Two ways to fill it: name a slot (setting=Knossos) and it takes your
     words; leave it out and it keeps the house words. The filled text goes
     through exactly the same pipeline as a pasted document - sections split,
     (key:::value) tags routed, the veiled tongue translated, {a|b} chosen per
     image - so a recipe is not a second renderer, only a better starting
     point. `{{` and `}}` are inert to THE CHOICE (a brace group with no `|`
     in it is left exactly as written), so a slot can never be mistaken for an
     alternation.

     src/studio/recipes.json is the SEED, shipped with the terminal and never
     rewritten here. Recipes Patrikios saves in the terminal are an OVERLAY
     kept in this browser (kv lia_settings / recipe_book), like the pose book:

       mine   [ { id, title, note, tags, template, negative, slots } ]
       hide   [ id ]                     a shipped recipe he does not want
       picks  [ { ts, id, values, used } ]   what was composed, and when

     If recipes.json cannot be read (an unsaved preview in a browser with no
     service worker), the book is EMPTY and says so - it never pretends.
  ------------------------------------------------------------------------- */
  var RECIPE_KEY = "recipe_book";
  var recipes = null;                    // the shipped seed
  var recipeBook = null, recipeLoaded = false;
  var RECIPE_PARAM_TAGS = ["seed", "guidance", "size", "resolution"];
  var RECIPE_HOUSE = "house";

  function recipeStore() { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }
  function blankRecipeBook() { return { mine: [], hide: [], picks: [] }; }
  function houseNegative() { return (recipes && typeof recipes.negative === "string") ? recipes.negative : ""; }
  function shippedRecipes() { return (recipes && Array.isArray(recipes.recipes)) ? recipes.recipes : []; }

  function recipeId(s) {
    return String(s == null ? "" : s).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  }

  // Untrusted in, a recipe out: an entry that cannot be read is dropped, not crashed on.
  function cleanRecipe(r) {
    if (!r || typeof r !== "object") return null;
    var id = recipeId(r.id);
    var template = String(r.template || "").trim();
    if (!id || !template) return null;
    var slots = {};
    if (r.slots && typeof r.slots === "object") {
      Object.keys(r.slots).forEach(function (k) {
        var name = String(k).trim().toLowerCase().replace(/\s+/g, " ");
        if (!name) return;
        var v = r.slots[k];
        // Two shapes reach here: the editor's {default, note} and the stored
        // {def, note} - an explicit default wins, the stored one carries over.
        // Without this, every reload silently emptied every slot default.
        if (v && typeof v === "object") {
          var dv = (v.default != null && String(v.default) !== "") ? v.default : v.def;
          slots[name] = { def: String(dv == null ? "" : dv), note: String(v.note || "").trim() };
        }
        else slots[name] = { def: String(v == null ? "" : v), note: "" };
      });
    }
    return {
      id: id,
      title: String(r.title || id).trim(),
      note: String(r.note || "").trim(),
      tags: (Array.isArray(r.tags) ? r.tags : []).map(function (t) { return String(t).trim(); }).filter(Boolean),
      template: template,
      negative: (typeof r.negative === "string") ? r.negative : "",
      slots: slots,
      source: (r.source === "his" || r.source === "her") ? r.source : "book",
    };
  }

  function cleanRecipeBook(raw) {
    var b = blankRecipeBook();
    if (!raw || typeof raw !== "object") return b;
    (Array.isArray(raw.mine) ? raw.mine : []).forEach(function (r) {
      var c = cleanRecipe(r);
      if (c) { c.source = (r.source === "her") ? "her" : "his"; b.mine.push(c); }
    });
    b.hide = (Array.isArray(raw.hide) ? raw.hide : []).map(function (h) { return recipeId(h); }).filter(Boolean);
    b.picks = (Array.isArray(raw.picks) ? raw.picks : []).slice(-50);
    return b;
  }

  async function loadRecipeBook() {
    if (recipeLoaded) return recipeBook;
    if (!recipeBook) recipeBook = blankRecipeBook();
    var s = recipeStore();
    if (!s) return recipeBook;    // no kv yet: read it for real on a later call
    try {
      var raw = await s.get(RECIPE_KEY);
      if (raw) recipeBook = cleanRecipeBook(raw);
    } catch (e) { console.warn("studio: the recipe book could not be read", e); }
    recipeLoaded = true;
    return recipeBook;
  }

  async function saveRecipeBook() {
    var s = recipeStore();
    if (!s) { console.warn("studio: nowhere to keep the recipe book (kv is not loaded)"); return false; }
    try { await s.set(RECIPE_KEY, recipeBook); return true; }
    catch (e) { console.warn("studio: the recipe book could not be saved", e); return false; }
  }

  // The book as it reads right now: the shipped seed minus what he hid, then his own over it.
  function mergedRecipes() {
    if (!recipeBook) recipeBook = blankRecipeBook();
    var out = [], seen = {};
    function put(c) {
      if (!c) return;
      var k = String(c.id).toLowerCase();
      if (seen[k]) return;
      seen[k] = 1; out.push(c);
    }
    shippedRecipes().forEach(function (r) {
      var c = cleanRecipe(r);
      if (!c) return;
      if (recipeBook.hide.indexOf(c.id) !== -1) return;
      c.source = "book";
      put(c);
    });
    // HIS OWN RECIPES ARE NEVER HIDDEN BY THE hide LIST - that list only means "this shipped one,
    // I do not want it", and a recipe saved over a shipped id (which hides the shipped one) must
    // still be in the book. `removeRecipe` is what takes one of his out.
    recipeBook.mine.forEach(function (r) { put(r); });
    return out;
  }

  function recipeKey(s) { return low(s).replace(/^recipe\s*[:\-]\s*/, "").replace(/[^a-z0-9]+/g, " ").trim(); }

  // By id first, then by title, then loosely - she and he will both say the recipe's name rather
  // than its id ("the baseline goddess" for `baseline`).
  function findRecipe(name) {
    var t = recipeKey(name);
    if (!t) return null;
    var list = mergedRecipes(), i;
    for (i = 0; i < list.length; i++) if (recipeKey(list[i].id) === t) return list[i];
    for (i = 0; i < list.length; i++) if (recipeKey(list[i].title) === t) return list[i];
    for (i = 0; i < list.length; i++) if (recipeKey(list[i].id).indexOf(t) === 0) return list[i];
    for (i = 0; i < list.length; i++) if (recipeKey(list[i].id).indexOf(t) !== -1) return list[i];
    for (i = 0; i < list.length; i++) if (recipeKey(list[i].title).indexOf(t) !== -1) return list[i];
    return null;
  }

  // The slots a template actually uses, in the order they appear, with what each one holds by
  // default (an explicit default wins over an inline {{slot|fallback}}).
  function slotsOf(recipe) {
    var out = [], seen = {};
    var text = String((recipe && recipe.template) || "");
    var re = new RegExp(/\{\{\s*([a-z0-9][a-z0-9_ -]*?)\s*(?:\|\s*([^}]*?)\s*)?\}\}/gi.source, "gi");
    var m;
    while ((m = re.exec(text))) {
      var n = String(m[1] || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (!n || seen[n]) continue;
      seen[n] = 1;
      var s = ((recipe && recipe.slots) || {})[n] || {};
      var inline = String(m[2] == null ? "" : m[2]).trim();
      var def = (s.def != null && String(s.def) !== "") ? String(s.def) : inline;
      out.push({ name: n, def: def, note: s.note || "" });
    }
    return out;
  }

  /* fillTemplate(template, values, defs)
     A value the caller gave WINS; else the slot's own default; else the inline fallback; else
     nothing (and the slot is reported as missing, so a blank is never a secret). */
  function fillTemplate(template, values, defs) {
    values = values || {}; defs = defs || {};
    var used = {}, defaulted = {}, missing = [];
    function take(name, fallback) {
      var k = String(name).trim().toLowerCase().replace(/\s+/g, " ");
      var given = values[k];
      if (given != null && String(given).trim() !== "") { used[k] = String(given).trim(); return used[k]; }
      var def = defs[k];
      if (def != null && String(def) !== "") { defaulted[k] = String(def); return String(def); }
      var fb = String(fallback == null ? "" : fallback).trim();
      if (fb) { defaulted[k] = fb; return fb; }
      missing.push(k);
      return "";
    }
    var text = String(template == null ? "" : template).replace(/\{\{\s*([a-z0-9][a-z0-9_ -]*?)\s*(?:\|\s*([^}]*?)\s*)?\}\}/gi, function (all, name, fallback) {
      return take(name, fallback);
    });
    // The punctuation a filled slot can leave behind (a comma with nothing after it, a doubled
    // space, a blank line where a whole clause was).
    text = text
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+([,.;:])/g, "$1")
      .replace(/,\s*,+/g, ",")
      .replace(/\(\s*\)/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { text: text, used: used, defaulted: defaulted, missing: missing };
  }

  // "scene :: setting=Knossos; mood=electric" -> { id: "scene", values: {...} }. The first `::`
  // separates the recipe from its slots; pairs are split on `;` or a newline (never on a comma, so
  // a value may contain commas); `key=value` or `key: value`; quotes are stripped.
  function parseRecipeSpec(spec) {
    var raw = String(spec == null ? "" : spec).trim().replace(/^\[\[?\s*recipe\s*:\s*/i, "").replace(/\]\]?\s*$/, "").replace(/^recipe\s*[:\-]\s*/i, "");
    var id = raw, rest = "";
    var at = raw.indexOf("::");
    if (at !== -1) { id = raw.slice(0, at); rest = raw.slice(at + 2); }
    var values = {};
    rest.replace(/\r?\n/g, ";").split(";").forEach(function (pair) {
      var p = String(pair).trim();
      if (!p) return;
      var m = p.match(/^([a-z0-9_ -]{1,32})\s*[:=]\s*([\s\S]*)$/i);
      if (!m) return;
      var k = m[1].trim().toLowerCase().replace(/\s+/g, " ");
      var v = m[2].trim().replace(/^["']/, "").replace(/["']$/, "").trim();
      if (k) values[k] = v;
    });
    return { id: id.trim(), values: values };
  }

  // Reserved names are not slots: seed / guidance / size / resolution ride as (key:::value) tags,
  // which the prompt book already routes to the fields they mean, and `negative` replaces the
  // recipe's own negative purely for this one render.
  //
  // `guidance` is the SLOT's name (that is what he types: `:: guidance=8`); the TAG the prompt book
  // actually knows is `guidanceScale` (see TAG_KEYS, and parseTags below). Writing `(guidance:::8)`
  // would leave the fragment in the prompt as literal text - the renderer would never see the
  // setting, and nothing would say so. So the slot's name is translated here, the same way `size`
  // becomes `resolution`.
  function paramsToTags(values) {
    var tags = [];
    RECIPE_PARAM_TAGS.forEach(function (k) {
      var v = values[k];
      if (v == null || String(v).trim() === "") return;
      var key = (k === "size") ? "resolution" : (k === "guidance" ? "guidanceScale" : k);
      tags.push("(" + key + ":::" + String(v).trim() + ")");
    });
    return tags;
  }

  /* renderRecipe(spec) - the one door. spec is "id" or "id :: slot=words; slot=words", or
     { id, values }. Returns the filled positive prompt (and the negative this render should use),
     plus what each slot took - so a caller can print exactly what was decided. */
  function renderRecipe(spec) {
    var parsed = (typeof spec === "string")
      ? parseRecipeSpec(spec)
      : { id: String((spec && spec.id) || ""), values: (spec && spec.values) || {} };
    if (!mergedRecipes().length) {
      return { ok: false, error: "THE RECIPE BOOK IS EMPTY OR COULD NOT BE READ (" + RECIPES_FILE + ").", id: parsed.id, values: parsed.values };
    }
    var r = findRecipe(parsed.id);
    if (!r) {
      var near = mergedRecipes().map(function (x) { return x.id; });
      return { ok: false, error: "NO RECIPE CALLED \"" + String(parsed.id).toUpperCase() + "\" IN THE BOOK. THE BOOK HAS: " + near.join(", "), id: parsed.id, values: parsed.values };
    }
    var values = {}, reserved = {};
    Object.keys(parsed.values).forEach(function (k) {
      if (RECIPE_PARAM_TAGS.indexOf(k) !== -1 || k === "negative") reserved[k] = parsed.values[k];
      else values[k] = parsed.values[k];
    });
    var defs = {};
    var slots = slotsOf(r);
    slots.forEach(function (s) { defs[s.name] = s.def; });
    var filled = fillTemplate(r.template, values, defs);
    var tags = paramsToTags(reserved);
    // The tags ride after the prompt with a SPACE, not a comma: the prompt book takes them back out
    // on the way to the renderer (parseTags), and a comma in front of them would be left behind as a
    // stray comma at the end of the prompt that is actually sent.
    var text = tags.length ? (filled.text.replace(/[\s,]+$/, "") + " " + tags.join(" ")) : filled.text;
    var negative = "";
    if (reserved.negative != null) {
      var nv = String(reserved.negative).trim();
      negative = /^(none|no|off|nothing)$/i.test(nv) ? "" : nv;
    } else if (r.negative === RECIPE_HOUSE) negative = houseNegative();
    else negative = String(r.negative || "").trim();
    return {
      ok: true, recipe: r, id: r.id, title: r.title,
      text: text, negative: negative,
      used: filled.used, defaulted: filled.defaulted, missing: filled.missing,
      slots: slots,
      unknown: Object.keys(values).filter(function (k) { return !Object.prototype.hasOwnProperty.call(defs, k); }),
    };
  }

  // The report a fill prints, whoever asked for it - the forge's FILL, his /recipe, or her own
  // [[RECIPE: ...]] line. One function, so the two sides can never drift about what happened.
  function recipeReport(r, who, opts) {
    opts = opts || {};
    var used = (r && r.used) || {};
    var keys = Object.keys(used);
    var lines = ['RECIPE BOOK :: ' + String(who || 'FILLED').toUpperCase() + ' :: '
      + String(r.title || r.id).toUpperCase() + '   [' + r.id + ']'];
    if (keys.length) {
      lines.push('  SLOTS SET :: ' + keys.map(function (k) {
        return k.toUpperCase() + ' = "' + String(used[k]).slice(0, 90) + (String(used[k]).length > 90 ? ' ...' : '') + '"';
      }).join('   \u00b7   '));
      lines.push('  EVERY OTHER SLOT KEEPS THE WORDS THE RECIPE SHIPS WITH');
    } else {
      lines.push('  NOTHING CHANGED :: EVERY SLOT KEEPS THE WORDS THE RECIPE SHIPS WITH');
    }
    if (r.missing && r.missing.length) lines.push('  EMPTY SLOT' + (r.missing.length === 1 ? '' : 'S') + ' :: '
      + r.missing.join(', ').toUpperCase() + ' :: NOTHING IN THE RECIPE FOR ' + (r.missing.length === 1 ? 'IT' : 'THEM'));
    if (r.unknown && r.unknown.length) lines.push('  NOT A SLOT, IGNORED :: ' + r.unknown.join(', ').toUpperCase());
    if (opts.ownWords) lines.push('  HER OWN WORDS ARE ADDED AT THE END OF THE RECIPE\'S PROMPT, SO IT IS STILL ONE IMAGE');
    if (r.negative) lines.push('  THE RENDER ALSO USES THE RECIPE\'S NEGATIVE LIST (' + String(r.negative).length + ' CHARS)');
    (opts.extra || []).forEach(function (x) { if (x) lines.push('  ' + x); });
    return lines.join('\n');
  }

  // What /recipe <id> prints: the recipe, what each slot holds, and who wrote what.
  function describeRecipe(r, values) {
    values = values || {};
    var lines = [];
    lines.push("RECIPE :: " + String(r.title || r.id).toUpperCase() + "   [" + r.id + "]"
      + (r.source === "her" ? "   (HERS)" : (r.source === "his" ? "   (YOURS)" : ""))
      + (r.tags && r.tags.length ? "   " + r.tags.join(" \u00b7 ") : ""));
    if (r.note) lines.push("  " + r.note);
    var slots = slotsOf(r);
    lines.push("  SLOTS (" + slots.length + ") :: " + slots.map(function (s) { return s.name; }).join(" \u00b7 "));
    slots.forEach(function (s) {
      var given = values[s.name];
      var mine = (given != null && String(given).trim() !== "");
      lines.push("    " + s.name + " :: " + (mine ? ("YOUR WORDS: " + String(given).trim()) : ("house: " + (s.def || "(nothing)"))));
      if (s.note) lines.push("      " + s.note);
    });
    if (r.negative === RECIPE_HOUSE) lines.push("  NEGATIVE :: THE HOUSE LIST (" + houseNegative().length + " CHARS) - /recipe negative TO SEE IT");
    else if (r.negative) lines.push("  NEGATIVE :: " + r.negative.slice(0, 220) + (r.negative.length > 220 ? " ..." : ""));
    else lines.push("  NEGATIVE :: NONE");
    return lines.join("\n");
  }

  // ---- writing to the recipe book ------------------------------------------
  async function addRecipe(rec) {
    await loadRecipeBook();
    var c = cleanRecipe(rec);
    if (!c) return { ok: false, error: "a recipe needs an id and a template" };
    if (!rec || typeof rec !== "object") return { ok: false, error: "a recipe needs an id and a template" };
    c.source = (rec.source === "her") ? "her" : "his";
    var shipped = shippedRecipes().some(function (r) { return recipeId(r.id) === c.id; });
    if (shipped) {
      // Saving over a shipped recipe HIDES it and puts his in its place - the shipped file is
      // never rewritten (the same rule the pose book follows).
      book_hide(c.id);
    }
    recipeBook.mine = recipeBook.mine.filter(function (r) { return r.id !== c.id; });
    recipeBook.mine.push(c);
    await saveRecipeBook();
    notifyRecipes();
    return { ok: true, recipe: findRecipe(c.id) || c, replacedShipped: shipped };
  }

  // Derive a new recipe from an old one: the same frame, retuned slots. The copy
  // carries the template, the negative list, the tags and every slot default;
  // `over.slots` replaces the defaults of the slots it names (over.title/note/tags
  // replace those fields when given). Names that are not slots of the old recipe
  // are REFUSED, not ignored - a retune that names nothing real is a mistake, and
  // it should say so before anything is kept. His hand (clone) and her petitions
  // (from=) walk through this one door.
  async function deriveRecipe(newId, baseName, over) {
    await loadRecipeBook();
    over = over || {};
    var base = findRecipe(baseName);
    if (!base) {
      var words = String(baseName || "").split(/\s+/).filter(function (w) { return w.length > 2; });
      var near = mergedRecipes().filter(function (r) {
        var t = (String(r.id) + " " + String(r.title || "")).toLowerCase();
        return words.some(function (w) { return t.indexOf(String(w).toLowerCase()) !== -1; });
      }).slice(0, 5).map(function (r) { return r.id; });
      return { ok: false, error: "no recipe called \"" + String(baseName).toUpperCase() + "\" in the book" + (near.length ? " - close: " + near.join(", ") : "") };
    }
    var names = slotsOf(base).map(function (s) { return s.name; });
    var rawGiven = (over.slots && typeof over.slots === "object") ? over.slots : {};
    var given = {};
    Object.keys(rawGiven).forEach(function (k) {
      var n = String(k).trim().toLowerCase().replace(/\s+/g, " ");
      if (n) given[n] = rawGiven[k];
    });
    var bad = Object.keys(given).filter(function (n) { return names.indexOf(n) === -1; });
    if (bad.length) return { ok: false, error: "\"" + base.id + "\" has no slot" + (bad.length === 1 ? "" : "s") + " called " + bad.join(", ") + " - its slots are: " + (names.length ? names.join(", ") : "none") };
    var slots = {};
    names.forEach(function (n) {
      var cur = ((base.slots || {})[n]) || {};
      var v = (given[n] != null) ? String(given[n]).trim() : "";
      slots[n] = {
        default: (v !== "") ? v : String(cur.def != null ? cur.def : ""),
        note: String(cur.note || "").trim(),
      };
    });
    var tags = Array.isArray(over.tags) ? over.tags : ((base.tags || []).slice());
    return await addRecipe({
      id: newId,
      title: (over.title != null && String(over.title).trim() !== "") ? String(over.title).trim() : (base.title || base.id),
      note: (over.note != null && String(over.note).trim() !== "") ? String(over.note).trim() : ("derived from " + base.id),
      tags: tags,
      template: base.template,
      negative: (typeof base.negative === "string") ? base.negative : "",
      slots: slots,
      source: (over.source === "her") ? "her" : "his",
    });
  }

  function book_hide(id) {
    if (!recipeBook) recipeBook = blankRecipeBook();
    if (recipeBook.hide.indexOf(id) === -1) recipeBook.hide.push(id);
  }

  async function removeRecipe(name) {
    await loadRecipeBook();
    var r = findRecipe(name);
    if (!r) return { ok: false, error: "no such recipe in the book" };
    if (r.source === "book") {
      book_hide(r.id);
      await saveRecipeBook();
      notifyRecipes();
      return { ok: true, hidden: true, recipe: r };
    }
    recipeBook.mine = recipeBook.mine.filter(function (x) { return x.id !== r.id; });
    recipeBook.hide = recipeBook.hide.filter(function (x) { return x !== r.id; });
    await saveRecipeBook();
    notifyRecipes();
    return { ok: true, hidden: false, recipe: r };
  }

  async function resetRecipes() {
    recipeBook = blankRecipeBook();
    recipeLoaded = true;
    await saveRecipeBook();
    notifyRecipes();
    return true;
  }

  // THE PUT-AWAY SHELF. removeRecipe() on a shipped recipe HIDES it rather than deleting it -
  // but nothing could list or unhide one without rewriting the whole overlay. These two are
  // that shelf: what is put away, and one back.
  function hiddenRecipes() {
    if (!recipeBook) recipeBook = blankRecipeBook();
    var out = [];
    shippedRecipes().forEach(function (r) {
      var c = cleanRecipe(r);
      if (!c) return;
      if (recipeBook.hide.indexOf(c.id) === -1) return;
      // A recipe saved over this shipped id still stands in the book - only list what is gone.
      if (recipeBook.mine.some(function (m) { return m.id === c.id; })) return;
      c.source = "book";
      out.push(c);
    });
    return out;
  }

  async function restoreRecipe(name) {
    await loadRecipeBook();
    var id = recipeId(name);
    if (!id || recipeBook.hide.indexOf(id) === -1) return false;
    recipeBook.hide = recipeBook.hide.filter(function (x) { return x !== id; });
    await saveRecipeBook();
    notifyRecipes();
    return true;
  }

  async function recordRecipeUse(entry) {
    await loadRecipeBook();
    recipeBook.picks.push({
      ts: Date.now(),
      id: String((entry && entry.id) || ""),
      values: (entry && entry.values) || {},
      used: ((entry && entry.used) || []).map(String),
    });
    recipeBook.picks = recipeBook.picks.slice(-50);
    await saveRecipeBook();
    notifyRecipes();
    return true;
  }

  function recipeBookJSON() { return JSON.stringify(recipeBook || blankRecipeBook(), null, 2); }

  /* ---- THE BOOKS, BY NAME -------------------------------------------------
     Patrikios, 2026-09-22: "Give her access to the image creator so she can create her own images
     based on our approved prompts and elements."

     She already had the three lanes ([[RECIPE: id :: slot=words]], [[POSE: name]], and a
     [[VISION: ...]] description of her own) - what she did NOT have was a single name to put in
     them. The image rule tells her the recipe book exists and that "the command list below
     (/recipe)" lists it, but the command list is built from commands.json and carries prose ABOUT
     the book, never its ids: every recipe here, including the ones he kept from pictures he wanted
     to remember, was effectively unreachable by name. Her poses had the same hole, and the shot
     list that every picture he rolls is drawn from was invisible to her altogether.

     So this is the block that hands the books over: the recipes by id with their slots, the pose
     lists by name (she writes {pose:listname} to draw from one), and the elements - one line per
     dimension of the shot list. It is BUILT each turn (chat.js asks for it like canon and traits),
     and it is deliberately DETERMINISTIC: it reads the raw text of each list item rather than
     evaluating it, so the block does not change from turn to turn and the prompt cache holds.
     Templated entries are left out rather than shown as source - a line of {[root.pose...]} would
     be noise to her, not a name.
     ------------------------------------------------------------------------ */
  function clipLine(s, n) {
    var t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n - 1) + "\u2026" : t;
  }

  function booksBlock() {
    if (!recipeBook) recipeBook = blankRecipeBook();
    var out = [];
    out.push("THE BOOKS YOU COMPOSE FROM. These are Patrikios's own materials, and they are yours to reach for by name - a recipe or a pose you name is the house style already answered well, rather than a description built from nothing. What is listed here is what exists right now (he adds to these from his side; /recipe, /pose and /idea print each one in full).");

    // RECIPES - the templates, with the slots each one takes.
    var recs = mergedRecipes();
    if (recs.length) {
      out.push("");
      out.push("RECIPES - write [[RECIPE: id :: slot=your words]]. Every slot you do not name keeps his own wording, so a recipe works with nothing filled in at all. The first few words of an id are enough (he matches the beginning), so a long id can be shortened.");
      out.push("YOUR OWN FROM HIS FRAMES - a recipe of yours starts as a petition: [[PETITION: recipe :: <new-id> :: from=<old-id> :: slot=your words; ... :: why you want it]]. The frame, the negative list, the tags and every slot default carry over; only the slots you name change. Work his mythos shelf by tag - the tags on each line below are the families.");
      recs.forEach(function (r) {
        var slots = slotsOf(r).map(function (s) { return s.name; });
        out.push("  " + r.id + " :: " + clipLine(r.title || r.id, 60)
          + (slots.length ? "  :: slots: " + clipLine(slots.join(", "), 200) : "  :: no slots - it runs as it stands")
          + (((r.tags || []).length) ? "  :: tags: " + clipLine(r.tags.join(", "), 120) : "")
          + (r.source === "mine" ? "  [kept from one of his own pictures]" : ""));
      });
    }

    // POSES - the lists, so a {pose:listname} token or a [[POSE: name]] line has a target.
    var fams = families();
    if (fams.length) {
      out.push("");
      out.push("THE POSE LISTS - write [[POSE: a name]], or {pose:listname} inside a [[VISION: ...]] description to draw one from that list yourself.");
      fams.forEach(function (f) {
        var list = poses(f);
        var names = list.slice(0, 6).map(function (p) { return p.name; }).filter(Boolean);
        out.push("  " + f + " (" + list.length + "): " + clipLine(names.join(", "), 140)
          + (list.length > names.length ? ", \u2026" : ""));
      });
    }

    // ELEMENTS - one line per dimension of the shot list (src/js/idea.js reads the same lists).
    if (window.idea && window.idea.parts) {
      var parts = window.idea.parts();
      var lines = [];
      parts.forEach(function (p) {
        if (!p || !p.list || p.into === "negative") return;
        var nodes = null;
        try { nodes = window.root[p.list] ? window.root[p.list].selectAll : null; } catch (e) { nodes = null; }
        if (!nodes || !nodes.length) return;
        var words = [];
        for (var i = 0; i < nodes.length && words.length < 5; i++) {
          var raw = clipLine(nodes[i].getName, 48);
          if (!raw || /[\[\]{}]/.test(raw)) continue;   // a template, not a name
          words.push(raw);
        }
        if (!words.length) return;
        lines.push("  " + (p.label || p.list) + " (" + nodes.length + "): " + words.join("  \u00b7  "));
      });
      if (lines.length) {
        out.push("");
        out.push("THE ELEMENTS - the shot list every picture he rolls is drawn from, one line per dimension. A description that uses these words lands in the house style. AND EVERY ONE IS A TOKEN: write {name} in a [[VISION: ...]] description - {setting}, {light}, {camera}, any dimension by name or label - and one item is drawn from that list on every render, his added phrases included.");
        out.push.apply(out, lines);
      }
    }

    out.push("");
    out.push("THE LOOSE LISTS - opt-in draws by name, outside the roll: {locale} draws one modern place, {cinema} draws one piece of cinematic language (frame, focus, light, air, skin, grade). Write either in a [[VISION: ...]] description the way you write {setting} - one item drawn on every render, unknown names left as written.");

    out.push("");
    out.push("A recipe line or a [[VISION: ...]] line is your ONE image for that reply. Reach for a recipe first - his frames are the quality bar, and your words in their slots are the improvisation. Naming the books is how you choose deliberately; describing freely is still yours to do, in the same cinematic-still language: lens, light, camera, never animation.");
    return out.join("\n");
  }

  var recipeWatchers = [];
  function onRecipeChange(fn) { if (typeof fn === "function") recipeWatchers.push(fn); }
  function notifyRecipes() { recipeWatchers.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  window.studio = {
    load: load,
    booksBlock: booksBlock,
    ready: function () { return !!glossary; },
    resolved: function () { return { glossary: !!glossary, positions: !!positions, body: bodyRules.length, world: worldRules.length, book: !!book, poses: merged().length, families: families().length, recipes: mergedRecipes().length, recipeBook: !!recipeBook }; },
    resolve: resolve,
    parseTags: parseTags,
    splitSections: splitSections,
    translate: translate,
    reportLines: reportLines,
    expand: expand,
    poses: poses,
    findPose: findPose,
    posePhrase: posePhrase,
    families: families,
    // THE BOOK - the lists he and she can rewrite. Every writer saves the overlay and tells the
    // watchers; nothing here touches the shipped seed.
    loadBook: loadBook,
    bookData: function () { return book || blankBook(); },
    bookJSON: bookJSON,
    addPose: addPose,
    editPose: editPose,
    removePose: removePose,
    addFamily: addFamily,
    recordPick: recordPick,
    picks: function () { return book ? book.picks.slice() : []; },
    resetBook: resetBook,
    onBookChange: onBookChange,
    FAMILY_HERS: FAMILY_HERS,
    glossaryData: function () { return glossary; },
    GLOSSARY_FILE: GLOSSARY_FILE,
    POSITIONS_FILE: POSITIONS_FILE,
    /* THE RECIPE BOOK - whole prompt templates with named slots, filled from his own
       documents. recipes()/findRecipe()/recipeSlots() read it; renderRecipe() is the one
       door that fills one; the writers keep his own recipes in this browser. */
    recipes: mergedRecipes,
    findRecipe: findRecipe,
    recipeSlots: slotsOf,
    renderRecipe: renderRecipe,
    fillTemplate: fillTemplate,
    parseRecipeSpec: parseRecipeSpec,
    describeRecipe: describeRecipe,
    recipeReport: recipeReport,
    houseNegative: houseNegative,
    loadRecipeBook: loadRecipeBook,
    recipeBookData: function () { return recipeBook || blankRecipeBook(); },
    recipeBookJSON: recipeBookJSON,
    addRecipe: addRecipe,
    deriveRecipe: deriveRecipe,
    removeRecipe: removeRecipe,
    resetRecipes: resetRecipes,
    hiddenRecipes: hiddenRecipes,
    restoreRecipe: restoreRecipe,
    recordRecipeUse: recordRecipeUse,
    recipePicks: function () { return recipeBook ? recipeBook.picks.slice() : []; },
    onRecipeChange: onRecipeChange,
    RECIPES_FILE: RECIPES_FILE,
  };
})();
