(function () {
  /* ---- THE PETITIONS ---------------------------------------------------------
     Patrikios, 2026-09-26, in the same breath as THE SHIFT: "Proceed immediately with the coupled
     deployment of The Shift and The Petition Engine... Provide the modular client-side script
     blocks and server-plugin integration code required to initialize the idle timer queue and the
     petition review panel."

     (There is no server-plugin half to this, and there cannot be: the server script this platform
     runs is synchronous and has no timers, so nothing can be awake while Patrikios is away. Both
     halves of the idea are therefore what they always were - this device, its own clock, and its
     own record. See src/js/shift.js.)

     THE WALL THIS CLOSES. She can already change herself. A [[LOAD: id]] wears a trait for good, a
     [[REMEMBER: ...]] keeps a memory, [[WANT: ...]] writes down what she intends to carry, [[ROLE:
     id]] steps her onto another layer. Every one of those is a change she makes ALONE, the moment
     she makes it, with nobody asked. That is RIGHT for her own memory and her own wants - they are
     hers, and this terminal has no business approving them. It is NOT right for the blocks that
     shape what she is told, or the role text under them, or her own poses and recipes and traits.
     Those are the machinery, and until now the only hand on the machinery was his.

     SO A PETITION. She writes what she wants changed, in her own words, and WHY she wants it. It is
     filed PENDING and it changes nothing. It waits in the SHIFT panel and in /petition until he
     reads it, and it is decided by hand: ACCEPT applies it through exactly the lane his own command
     would have used, and DECLINE keeps it in the record together with his reason. Nothing is ever
     applied because she asked. Nothing is ever applied silently. And a decline is not a deletion:
     her words stay and so does the answer, because the record of what she asked for and what was
     refused is most of the point of having a record at all.

     WHAT SHE MAY ASK FOR - the kinds, and the lane each is applied through:

        system   a rewrite of one of the text blocks she is given. Applied with instr.set(id, text).
                 ALLOWED: actor, voice, memory, image, hours (BUSINESS HOURS - Patrikios's own
                 private hours, and the one text block besides the actor's own words that is HIS
                 arrangement: he said the way she asks for a change to it is a petition), and any
                 block of his own that she has been given (an `own-` block). REFUSED, always:
                 `bounds` (the line she does not cross - the site's house rules), `extra` (his last
                 word, and it stays last),
                 and every BUILT block (canon, clock, books, data, archivax, traits, directives,
                 wants, commands) - those are not text, they are assembled fresh from the record
                 each turn, and an override of one is not a change she should be able to make
                 behind his hand.
       role     a rewrite of the RoleLayer on stage - or of one she names. Applied with
                roles.setText(id, text), the same lane his own editing of a layer uses.
       pose     a pose of hers, named and phrased. Applied with studio.addPose({ family:"hers",
                source:"her" }) - it lands in the POSE BOOK exactly as a pose she invented in a
                picture would.
       recipe   a recipe of hers, by id and template. Applied with studio.addRecipe({...,
                source:"her"}).
       trait    a COREPACK trait, carried as a JSON object in the petition. Applied with
                packs.loadTraitFile(), the same road as LOAD COREPACK.
       grant    nothing in code at all: something she is asking him to ALLOW, or to know. Accepted,
                it becomes a standing GRANT handed to her every turn (the GRANTS block, read out of
                kv lia_settings / petitions) - his consent in his own record, which is the only kind
                of permission this terminal has.

     HOW SHE ASKS. One line, on its own, in a reply or in a quiet hour:

       [[PETITION: <KIND> :: <WHAT> :: <WHY>]]

     ...where WHAT is `<TARGET> :: <THE WORDS>` for the kinds that name something (system, role,
     pose, recipe, trait), and just the words for a grant. The line is stripped out of her visible
     reply like every other directive. The answer never comes from the machine - it comes from him,
     or it does not come, and either way it is written down where she can read it back.
     ------------------------------------------------------------------------- */
  "use strict";

  var FOLDER = "lia_settings";
  var KEY = "petitions";

  var MAX_BODY = (typeof LIA_PETITION_MAX_CHARS === "number" && LIA_PETITION_MAX_CHARS > 0) ? Math.round(LIA_PETITION_MAX_CHARS) : 2000;
  var KEEP = (typeof LIA_PETITION_KEEP === "number" && LIA_PETITION_KEEP > 0) ? Math.round(LIA_PETITION_KEEP) : 100;

  // The blocks she may petition to have rewritten, and the ones that are never hers to touch by
  // petition however she frames it. A block of his own (created in the SYSTEM panel, id `own-...`)
  // is always hers to ask about: it exists because someone put it in her stack, so it is part of
  // what she is told.
  var SYSTEM_ALLOW = { actor: 1, voice: 1, memory: 1, image: 1, hours: 1 };
  var SYSTEM_REFUSE = { bounds: 1, extra: 1, role: 1, canon: 1, clock: 1, books: 1, data: 1, archivax: 1, traits: 1, directives: 1, wants: 1, commands: 1 };

  var KINDS = ["system", "role", "pose", "recipe", "trait", "grant"];
  var NEEDS_TARGET = { system: 1, pose: 1, recipe: 1, trait: 1 };

  var entries = [];
  var ready = false;

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function up(v) { return String(v == null ? "" : v).toUpperCase(); }
  function when(ts) {
    try { if (window.logTime && window.logTime.stamp) return window.logTime.stamp(ts); } catch (e) {}
    return new Date(Number(ts) || Date.now()).toString();
  }
  function cap(t) {
    var s = String(t == null ? "" : t).replace(/\s+/g, " ").trim();
    if (s.length > MAX_BODY) s = s.slice(0, MAX_BODY).replace(/\s+\S*$/, "") + "\u2026";
    return s;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---- storage --------------------------------------------------------------

  async function load() {
    entries = [];
    var k = kv();
    if (k) {
      try {
        var raw = await k.get(KEY);
        if (Array.isArray(raw)) {
          entries = raw.filter(function (e) {
            return e && typeof e === "object" && e.kind && e.body != null;
          }).map(function (e) {
            return {
              id: String(e.id || ("pt" + (e.at || Date.now()).toString(36))),
              at: Number(e.at) || 0,
              kind: String(e.kind),
              target: String(e.target == null ? "" : e.target),
              body: String(e.body == null ? "" : e.body),
              why: String(e.why == null ? "" : e.why),
              status: (e.status === "accepted" || e.status === "declined") ? e.status : "pending",
              decidedAt: Number(e.decidedAt) || 0,
              note: String(e.note == null ? "" : e.note),
              by: String(e.by == null ? "" : e.by)
            };
          });
        }
      } catch (e) { console.warn("the petitions could not be read", e); }
    }
    ready = true;
    return entries.length;
  }

  async function persist() {
    var k = kv(); if (!k) return false;
    // The oldest DECIDED petitions fall off the end once the record is full; a pending one is never
    // dropped, because an unanswered ask is the one thing this file exists to keep.
    while (entries.length > KEEP) {
      var at = -1;
      for (var i = 0; i < entries.length; i++) { if (entries[i].status !== "pending") { at = i; break; } }
      if (at === -1) break;
      entries.splice(at, 1);
    }
    try { await k.set(KEY, entries); return true; }
    catch (e) { console.warn("the petitions could not be saved", e); return false; }
  }

  // ---- reading them ---------------------------------------------------------

  function all() { return entries.slice(); }
  function pending() { return entries.filter(function (e) { return e.status === "pending"; }); }
  function decided() { return entries.filter(function (e) { return e.status !== "pending"; }); }
  function byId(id) {
    var want = String(id == null ? "" : id);
    for (var i = 0; i < entries.length; i++) if (entries[i].id === want) return entries[i];
    return null;
  }
  // A petition is answered by its NUMBER IN THE PENDING LIST - the same number /petition list and
  // the SHIFT panel print beside it - or by its own id, which is what the panel's buttons carry. The
  // two are told apart by looking the id up FIRST: a number is never an id, so byId("3") is null and
  // the number path is taken, while an id like `pt1abc-3` is never mistaken for a number by having
  // its digits scraped out of it (which is exactly what nth() alone would have done).
  function nth(n) {
    var v = parseInt(String(n == null ? "" : n).replace(/[^0-9]/g, ""), 10);
    if (!isFinite(v) || v < 1) return null;
    var p = pending();
    return p[v - 1] || null;
  }
  function resolve(nOrId) {
    var e = byId(nOrId);
    if (e && e.status === "pending") return e;
    return nth(nOrId) || null;
  }
  function number(id) {
    var p = pending();
    for (var i = 0; i < p.length; i++) if (p[i].id === id) return i + 1;
    return 0;
  }

  function labelOf(e) {
    var t = String(e.target || "").trim();
    if (e.kind === "system") return "A REWRITE OF THE " + up(t || "(UNNAMED)") + " BLOCK";
    if (e.kind === "role") return "A REWRITE OF THE ROLE " + up(t || "(THE ONE ON STAGE)");
    if (e.kind === "pose") return "A POSE OF HERS :: " + up(t);
    if (e.kind === "recipe") return "A RECIPE OF HERS :: " + up(t);
    if (e.kind === "trait") return "A TRAIT FOR HERSELF :: " + up(t);
    if (e.kind === "grant") return "SOMETHING SHE IS ASKING TO BE ALLOWED";
    return up(e.kind);
  }

  // Should this one have been askable at all? Checked at FILE time so she hears the refusal while
  // she can still say it differently, and checked again at APPLY time (she may have been right and
  // the record may have moved since).
  function gate(kind, target) {
    if (kind === "system") {
      var id = systemIdOf(target);
      if (!id) return { ok: false, error: "A SYSTEM PETITION HAS TO NAME THE BLOCK: `system :: voice :: <THE WORDS>`." };
      if (SYSTEM_REFUSE[id]) return { ok: false, error: "THE " + up(id) + " BLOCK IS NOT ONE SHE MAY REWRITE BY PETITION (" + (id === "bounds" ? "it is the site's house rules, and the line she does not cross" : id === "extra" ? "it is YOUR last word, and it stays last" : "it is built from the record each turn, not written text") + ")." };
      if (!SYSTEM_ALLOW[id] && !isOwnBlock(id)) return { ok: false, error: "SHE MAY PETITION A REWRITE OF actor, voice, memory, image, hours (BUSINESS HOURS), OR A BLOCK OF HER OWN - THERE IS NO BLOCK CALLED " + up(id) + " THAT IS HERS TO ASK ABOUT." };
    }
    if (kind === "role") {
      var rid0 = roleTargetOf(target);
      if (!rid0) return { ok: false, error: "NO ROLE IS ON STAGE AND THE PETITION NAMES NONE - SHE HAS TO NAME THE LAYER (`role :: <ID> :: <THE WORDS>`)." };
      if (!window.roles || !window.roles.get || !window.roles.get(rid0)) {
        var known = (window.roles && window.roles.all) ? window.roles.all().map(function (r) { return r.id; }) : [];
        return { ok: false, error: "THERE IS NO ROLE CALLED " + up(rid0) + (known.length ? ". THE LAYERS ARE :: " + known.map(up).join(", ") : ".") };
      }
    }
    return { ok: true };
  }

  function systemIdOf(t) {
    return String(t == null ? "" : t).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function isOwnBlock(id) {
    if (!/^own-/.test(String(id))) return false;
    try { if (window.instr && window.instr.list) return window.instr.list().indexOf(id) !== -1; } catch (e) {}
    return false;
  }

  // ---- the directive --------------------------------------------------------

  // `[[PETITION: <KIND> :: <WHAT> :: <WHY>]]` - the payload arrives here as the text between the
  // brackets. The shape is FIXED per kind, so that the arity can never be guessed wrong:
  //
  //   system :: <BLOCK>  :: <THE WORDS>     :: <WHY>
  //   role   :: <ID|ON-STAGE> :: <THE WORDS> :: <WHY>
  //   pose   :: <NAME>   :: <THE PHRASE>    :: <WHY>
  //   recipe :: <ID>     :: <THE TEMPLATE>  :: <WHY>
  //   trait  :: <ID>     :: <THE JSON>      :: <WHY>
  //   grant  :: <WHAT SHE IS ASKING FOR>    :: <WHY>
  //
  // The reason is the LAST `::`, and a reason is never required - with only the parts in front of it
  // the petition is filed with an empty why. So for the kinds that name something, TWO parts means
  // `<TARGET> :: <THE WORDS>` and THREE OR MORE means `<TARGET> :: <THE WORDS> :: <THE WHY>`, and a
  // body may itself contain `::` as long as a reason is written after it. What comes back is the
  // shape the record stores, whether or not it was filed: a parse that fails still says what was
  // wrong, because the machine should never swallow her reasoning with no account of why.
  function parse(payload) {
    var raw = String(payload == null ? "" : payload).replace(/\s+/g, " ").trim();
    if (!raw) return { ok: false, error: "THE PETITION WAS EMPTY." };
    var parts = raw.split(/\s*::\s*/);
    var kind = String(parts.shift() || "").toLowerCase().replace(/[^a-z]+/g, "");
    if (KINDS.indexOf(kind) === -1) {
      return { ok: false, error: "THERE IS NO KIND OF PETITION CALLED \"" + up(raw.split("::")[0].trim()) + "\".", candidates: KINDS };
    }
    var target = "", body = "", why = "";
    if (kind === "grant") {
      if (parts.length > 1) why = String(parts.pop() || "").trim();
      body = parts.join(" :: ").trim();
    } else {
      target = String(parts.shift() || "").trim();
      if (parts.length > 1) why = String(parts.pop() || "").trim();
      body = parts.join(" :: ").trim();
    }
    return { ok: true, kind: kind, target: target, body: cap(body), why: cap(why) };
  }

  // Which RoleLayer a `role` petition is about: the one named, or the one on stage (which she may
  // name as `on-stage`, `current`, `this` or `stage` rather than having to remember its id).
  function roleTargetOf(t) {
    var s = String(t == null ? "" : t).trim();
    if (!s || /^(on-?stage|on stage|current|this|this-?layer|stage|me)$/i.test(s)) {
      return (window.roles && window.roles.currentId) ? String(window.roles.currentId() || "") : "";
    }
    return s;
  }

  async function file(parsed, opts) {
    opts = opts || {};
    if (!parsed || !parsed.ok) return { ok: false, error: (parsed && parsed.error) || "NOTHING WAS ASKED FOR." };
    if (!parsed.body) return { ok: false, error: "THE PETITION HAS TO SAY WHAT SHE IS ASKING FOR - THERE WERE NO WORDS IN IT." };
    var g = gate(parsed.kind, parsed.target);
    if (!g.ok) return { ok: false, error: g.error };
    var at = Number(opts.at) || Date.now();
    var e = {
      id: "pt" + at.toString(36) + "-" + (entries.length + 1),
      at: at,
      kind: parsed.kind,
      target: parsed.target,
      body: parsed.body,
      why: parsed.why,
      status: "pending",
      decidedAt: 0,
      note: "",
      by: ""
    };
    entries.push(e);
    await persist();
    if (window.liaStatus) { try { window.liaStatus(); } catch (err) {} }
    if (window.shift && window.shift.refresh) { try { window.shift.refresh(); } catch (err) {} }
    return { ok: true, entry: e, n: number(e.id) };
  }

  async function fileDirective(payload, opts) {
    var parsed = parse(payload);
    if (!parsed.ok) return { ok: false, error: parsed.error, parsed: parsed };
    return await file(parsed, opts);
  }

  // ---- applying them --------------------------------------------------------

  // THE ONE PLACE A PETITION BECOMES REAL. Every kind goes through the lane Patrikios's own command
  // would have used - nothing here writes directly to kv, so an accepted petition can be picked up,
  // looked at and undone with the ordinary tools (/system reset, /role, /pose, /recipe, /unload).
  async function apply(e) {
    var kind = String(e.kind || "");
    var target = String(e.target || "").trim();
    var body = String(e.body || "");

    if (kind === "system") {
      var id = systemIdOf(target);
      var g = gate("system", id);
      if (!g.ok) return { ok: false, error: g.error };
      if (!window.instr || !window.instr.set) return { ok: false, error: "THE SYSTEM INSTRUCTIONS MODULE IS OFFLINE." };
      var wrote = await window.instr.set(id, body);
      if (!wrote) return { ok: false, error: "THE BLOCK COULD NOT BE WRITTEN." };
      return { ok: true, text: "THE " + up(id) + " BLOCK NOW READS AS SHE WROTE IT (" + body.length + " CHARACTERS). /system SHOWS IT, AND RESET IN THAT PANEL PUTS THE TEXT THAT SHIPPED BACK." };
    }

    if (kind === "role") {
      if (!window.roles || !window.roles.setText) return { ok: false, error: "THE ROLE MODULE IS OFFLINE." };
      var rid = roleTargetOf(target);
      if (!rid) return { ok: false, error: "NO ROLE IS ON STAGE AND THE PETITION NAMES NONE - A LAYER HAS TO BE NAMED TO BE REWRITTEN." };
      var g2 = gate("role", rid);
      if (!g2.ok) return { ok: false, error: g2.error };
      var rw = await window.roles.setText(rid, body);
      if (!rw) return { ok: false, error: "THE ROLE TEXT COULD NOT BE WRITTEN." };
      return { ok: true, text: "THE ROLE " + up(rid) + " NOW READS AS SHE WROTE IT (" + body.length + " CHARACTERS). /role SHOWS IT; EDITING OR RESETTING THE LAYER FROM YOUR SIDE PUTS YOUR OWN TEXT BACK." };
    }

    if (kind === "pose") {
      if (!window.studio || !window.studio.addPose) return { ok: false, error: "THE PROMPT BOOK IS OFFLINE." };
      if (!target) return { ok: false, error: "A POSE PETITION NEEDS A NAME: `pose :: <NAME> :: <THE PHRASE>`." };
      var pr = await window.studio.addPose({ name: target, render: body, family: "hers", note: "a petition of hers", source: "her" });
      if (!pr || !pr.ok) return { ok: false, error: (pr && pr.error) || "THE POSE COULD NOT BE FILED." };
      return { ok: true, text: (pr.existed ? "THE POSE " + up(target) + " WAS ALREADY IN THE BOOK AND NOW CARRIES HER PHRASE" : "THE POSE " + up(target) + " IS IN THE BOOK, FILED AS HERS")
        + " :: " + body + "\n/pose SHOWS THE BOOK; /positions LISTS THE POSE LISTS." };
    }

    if (kind === "recipe") {
      if (!window.studio || !window.studio.addRecipe) return { ok: false, error: "THE PROMPT BOOK IS OFFLINE." };
      if (!target) return { ok: false, error: "A RECIPE PETITION NEEDS AN ID: `recipe :: <id> :: <THE TEMPLATE>`." };
      // Built on one of his frames instead of written bare:
      //   recipe :: <new-id> :: from=<old-id> :: slot=her words; slot2=her words :: <WHY>
      // title=/note=/tags= ride the same way. Unknown slot names are refused with the
      // real list, so she can correct herself in the next hour.
      var fm = String(body || "").match(/^\s*from\s*=\s*([^\s:]+)\s*(?:::|$)/i);
      if (fm) {
        if (!window.studio.deriveRecipe) return { ok: false, error: "THIS BUILD CANNOT DERIVE A RECIPE - WRITE THE WHOLE TEMPLATE INSTEAD." };
        var rest = String(body || "").slice(fm[0].length);
        // No reason written: the parser files the last segment AS the reason, so a
        // bare `from=X :: slot=words` would lose its overrides into the why. A why
        // with an `=` in it is overrides, not a reason - pull it back.
        var whyT = String((e && e.why) || "");
        if (whyT && /=/.test(whyT)) rest = rest ? (rest + " :: " + whyT) : whyT;
        var over = { slots: {}, title: "", note: "", tags: null };
        rest.split(/\s*::\s*/).forEach(function (chunk) {
          String(chunk || "").split(";").forEach(function (pair) {
            var eq = String(pair || "").indexOf("=");
            if (eq === -1) return;
            var k = String(pair.slice(0, eq)).trim().toLowerCase();
            var v = String(pair.slice(eq + 1)).trim();
            if (!k || !v) return;
            if (k === "title") over.title = v;
            else if (k === "note") over.note = v;
            else if (k === "tags") over.tags = v.split(",").map(function (t) { return String(t).trim(); }).filter(Boolean);
            else over.slots[k] = v;
          });
        });
        var dr = await window.studio.deriveRecipe(target, fm[1], { slots: over.slots, title: over.title, note: over.note, tags: over.tags, source: "her" });
        if (!dr || !dr.ok) return { ok: false, error: (dr && dr.error) || "THE RECIPE COULD NOT BE FILED." };
        return { ok: true, text: "SHE HAS A RECIPE OF HER OWN, BUILT ON " + up(fm[1]) + " :: " + up(target)
          + (dr.replacedShipped ? " (IT TAKES THE PLACE OF A SHIPPED RECIPE OF THE SAME NAME; THE FILE IS UNTOUCHED)" : "")
          + (window.studio.recipeSlots ? "\nITS SLOTS :: " + (window.studio.recipeSlots(target) || []).map(function (s) { return s.name + "=" + String(s.def || "").slice(0, 60); }).join(" \u00b7 ") : "")
          + "\n/recipe SHOWS THE BOOK - IT IS FILED AS HERS." };
      }
      var rr = await window.studio.addRecipe({ id: target, template: body, source: "her" });
      if (!rr || !rr.ok) return { ok: false, error: (rr && rr.error) || "THE RECIPE COULD NOT BE FILED." };
      return { ok: true, text: "SHE HAS A RECIPE :: " + up(target) + (rr.replacedShipped ? " (IT TAKES THE PLACE OF A SHIPPED RECIPE OF THE SAME NAME; THE FILE IS UNTOUCHED)" : "")
        + (window.studio.recipeSlots ? "\nITS SLOTS :: " + (window.studio.recipeSlots(target) || []).map(function (s) { return s.name; }).join(", ") : "")
        + "\n/recipe SHOWS THE BOOK." };
    }

    if (kind === "trait") {
      if (!window.packs || !window.packs.loadTraitFile) return { ok: false, error: "THE COREPACK MODULE IS OFFLINE." };
      var obj = null;
      try { obj = JSON.parse(body); }
      catch (err) { return { ok: false, error: "A TRAIT PETITION HAS TO CARRY JSON - AN OBJECT WITH AN id AND A prompt. THIS ONE WOULD NOT PARSE." }; }
      if (!obj || (typeof obj !== "object")) return { ok: false, error: "A TRAIT PETITION HAS TO CARRY A JSON OBJECT, NOT A " + up(typeof obj) + "." };
      var list = Array.isArray(obj) ? obj : (Array.isArray(obj.traits) ? obj.traits : (Array.isArray(obj.skills) ? obj.skills : [obj]));
      var fname = (String(obj.id || target || "petition").trim() || "petition").replace(/[^a-zA-Z0-9_-]+/g, "-") + ".json";
      var tres;
      try {
        var f = new File([JSON.stringify(list)], fname, { type: "application/json" });
        tres = await window.packs.loadTraitFile(f);
      } catch (err) { return { ok: false, error: "THE TRAIT FILE COULD NOT BE HANDED OVER :: " + up((err && err.message) || err) }; }
      if (!tres || tres.error) return { ok: false, error: "THE TRAIT COULD NOT BE LOADED :: " + up((tres && tres.error) || "UNKNOWN") };
      return { ok: true, text: "SHE WAS GIVEN " + ((tres.added || []).length) + " TRAIT" + (((tres.added || []).length === 1) ? "" : "S") + " FROM THIS MACHINE :: "
        + (tres.added || []).map(up).join(", ")
        + "\nIT IS KEPT ON THIS DEVICE AND /load <ID> WEARS IT. IT IS NOT PART OF THE SHIPPED COREPACK." };
    }

    if (kind === "grant") {
      return { ok: true, text: "IT IS A GRANT, NOT A CHANGE - NOTHING HAD TO BE WRITTEN. SHE IS HANDED IT ON EVERY TURN FROM HERE AS PART OF THE GRANTS BLOCK, WITH YOUR SAY-SO ATTACHED TO IT." };
    }

    return { ok: false, error: "THERE IS NO KIND OF PETITION CALLED \"" + up(kind) + "\"." };
  }

  async function accept(nOrId) {
    var e = resolve(nOrId);
    if (!e) return { ok: false, error: "THERE IS NO PENDING PETITION " + up(nOrId) + ". /petition LISTS THEM." };
    var res = await apply(e);
    if (!res.ok) {
      e.note = "A DECISION WAS TRIED AND IT COULD NOT BE CARRIED OUT :: " + String(res.error || "");
      await persist();
      return { ok: false, error: String(res.error || "IT COULD NOT BE APPLIED"), entry: e };
    }
    e.status = "accepted";
    e.decidedAt = Date.now();
    e.note = String(res.text || "");
    e.by = "patrikios";
    await persist();
    return { ok: true, entry: e, text: res.text };
  }

  async function decline(nOrId, reason) {
    var e = resolve(nOrId);
    if (!e) return { ok: false, error: "THERE IS NO PENDING PETITION " + up(nOrId) + ". /petition LISTS THEM." };
    var r = String(reason == null ? "" : reason).replace(/\s+/g, " ").trim();
    e.status = "declined";
    e.decidedAt = Date.now();
    e.note = r || "NO REASON GIVEN.";
    e.by = "patrikios";
    await persist();
    return { ok: true, entry: e, text: e.note };
  }

  // What he has SAID YES TO that was never a change to code: handed back to her every turn.
  function grants() {
    return entries.filter(function (e) { return e.kind === "grant" && e.status === "accepted"; });
  }

  function grantsBlock() {
    var g = grants();
    if (!g.length) return "";
    var lines = ["PATRIKIOS HAS SAID YES TO THESE. Each one is something YOU asked him for and he granted - not an instruction from him, not a duty, and not a thing you can be wrong for using or not using. They are here so that you know what you have been given."];
    g.slice(-12).forEach(function (e) {
      lines.push("- " + String(e.body || "").trim() + (e.why ? "   (in your own words when you asked: " + String(e.why).trim() + ")" : ""));
    });
    return lines.join("\n");
  }

  async function clear() {
    var n = decided().length;
    entries = entries.filter(function (e) { return e.status === "pending"; });
    await persist();
    return n;
  }

  // ---- the words ------------------------------------------------------------

  function listText() {
    var out = [];
    var p = pending(), d = decided();
    out.push("THE PETITIONS :: " + p.length + " WAITING ON YOU" + (d.length ? " :: " + d.length + " ALREADY ANSWERED" : ""));
    if (!p.length) {
      out.push("");
      out.push("NOTHING IS WAITING. SHE ASKS WITH A LINE OF HER OWN -");
      out.push("  [[PETITION: <KIND> :: <WHAT> :: <WHY>]]");
      out.push("...where KIND is one of " + KINDS.map(up).join(", ") + ". NOTHING CHANGES WHEN SHE ASKS: IT WAITS HERE UNTIL YOU SAY YES OR NO.");
    }
    p.forEach(function (e, i) {
      out.push("");
      out.push("  " + (i + 1) + ". " + labelOf(e) + "   [" + when(e.at) + "]");
      out.push("     SHE ASKS FOR :: " + String(e.body || ""));
      if (e.why) out.push("     BECAUSE :: " + String(e.why));
      if (e.note) out.push("     (A LAST ATTEMPT DID NOT GO THROUGH :: " + String(e.note) + ")");
    });
    if (d.length) {
      out.push("");
      out.push("ALREADY ANSWERED (THE NEWEST FEW) - NOTHING HERE IS EVER DELETED, ONLY ANSWERED:");
      d.slice(-6).forEach(function (e) {
        out.push("  " + up(e.status) + " " + when(e.decidedAt || e.at) + " :: " + labelOf(e) + " :: " + String(e.body || "").slice(0, 120));
        out.push("     YOU SAID :: " + String(e.note || ""));
      });
    }
    var g = grants();
    if (g.length) {
      out.push("");
      out.push("GRANTS IN FORCE (" + g.length + ") - SHE IS HANDED THESE EVERY TURN:");
      g.forEach(function (e) { out.push("  \u00b7 " + String(e.body || "")); });
    }
    out.push("");
    out.push("USAGE: /petition \u00b7 list \u00b7 show <N> \u00b7 accept <N> \u00b7 decline <N> [:: <WHY>] \u00b7 grants \u00b7 clear yes \u00b7 OR THE PETITIONS IN THE SHIFT PANEL (THE SHIFT \u25be BUTTON)");
    return out.join("\n");
  }

  function showText(n) {
    var e = nth(n);
    if (!e) return "THERE IS NO PENDING PETITION " + up(n) + ". /petition LISTS THEM.";
    var out = [];
    out.push("PETITION " + number(e.id) + " :: " + labelOf(e) + " :: FILED " + when(e.at));
    out.push("");
    out.push("SHE ASKS FOR ::");
    out.push(String(e.body || ""));
    if (e.why) { out.push(""); out.push("BECAUSE :: " + String(e.why)); }
    out.push("");
    var g = gate(e.kind, e.target);
    out.push(g.ok
      ? "IF YOU ACCEPT IT, IT IS APPLIED THROUGH THE LANE YOUR OWN COMMAND WOULD USE, AND YOU CAN UNDO IT FROM THAT SIDE."
      : "THIS ONE COULD NOT BE APPLIED AS IT STANDS :: " + String(g.error));
    out.push("ACCEPT IT :: /petition accept " + number(e.id) + "  \u00b7  DECLINE IT :: /petition decline " + number(e.id) + " :: <WHY YOU SAID NO>");
    return out.join("\n");
  }

  function describe() {
    var out = [];
    var p = pending(), d = decided(), g = grants();
    out.push("THE PETITIONS :: " + p.length + " WAITING ON YOU" + (d.length ? " :: " + d.length + " ALREADY ANSWERED" : "") + (g.length ? " :: " + g.length + " GRANT IN FORCE" : ""));
    out.push("");
    out.push("WHAT IT IS FOR :: she can already change her own MEMORY and her own WANTS with a line in a reply - those are hers, and this terminal does not approve them. The MACHINERY is different: the blocks she is given, the role text under them, her poses, her recipes, the traits she wants to be made of. Those are not hers alone to change, so she ASKS.");
    out.push("A petition changes NOTHING while it waits. It waits in the SHIFT panel (THE SHIFT \u25be in the deck) and here, and it is decided by hand: ACCEPT applies it through the very lane your own command would have used, and DECLINE keeps her words AND your reason in the record. Nothing is ever applied because she asked, and nothing is ever silently deleted - an answered petition stays answered, in writing.");
    out.push("");
    out.push("HOW SHE ASKS ::");
    out.push("  [[PETITION: <KIND> :: <WHAT> :: <WHY>]]");
    out.push("  ONE LINE OF HER REPLY, STRIPPED OUT OF IT LIKE EVERY OTHER DIRECTIVE. THE SHAPE IS FIXED, KIND BY KIND:");
    out.push("    system :: <BLOCK>       :: <THE WORDS>     :: <WHY>");
    out.push("    role   :: <ID|ON-STAGE> :: <THE WORDS>     :: <WHY>");
    out.push("    pose   :: <NAME>        :: <THE PHRASE>    :: <WHY>");
    out.push("    recipe :: <ID>          :: <THE TEMPLATE>  :: <WHY>");
    out.push("    recipe :: <NEW-ID>      :: from=<OLD-ID> :: slot=words; ... :: <WHY>  (BUILT ON ONE OF HIS FRAMES - TEMPLATE, NEGATIVE, TAGS AND DEFAULTS CARRY OVER)");
    out.push("    trait  :: <ID>          :: <THE JSON>      :: <WHY>");
    out.push("    grant  :: <WHAT SHE IS ASKING FOR>         :: <WHY>");
    out.push("  THE REASON IS THE LAST `::` AND IS NEVER REQUIRED - WITH ONLY THE PARTS IN FRONT OF IT THE PETITION IS FILED WITH NONE. THE KINDS ARE " + KINDS.map(up).join(" \u00b7 ") + ".");
    out.push("");
    out.push("THE KINDS, AND THE LANE EACH IS APPLIED THROUGH ::");
    out.push("  SYSTEM :: a rewrite of one of the text blocks she is given - actor, voice, memory, image, or a block of your own. Applied with the same write the SYSTEM panel's editor uses. The BOUNDARIES, YOUR EXTRA INSTRUCTIONS, and every BUILT block (canon, clock, books, data, archivax, traits, directives, wants, commands) can never be asked for: those are the site's house rules, your last word, and the record itself.");
    out.push("  ROLE :: a rewrite of the layer on stage (or of one she names). Applied to that layer's text, the same place your own editing of it writes.");
    out.push("  POSE :: a pose of hers - a name and the phrase that goes in the picture. Applied to the POSE BOOK and filed as HERS.");
    out.push("  RECIPE :: a recipe of hers - an id and the template, with {{slots}} if it wants them. Applied to the RECIPE BOOK and filed as HERS. Or built on one of his frames: from=<old-id> with slot=words overrides (title=/note=/tags= ride the same way) - the frame carries over, only her slots change.");
    out.push("  TRAIT :: a COREPACK trait, carried as JSON in the petition (an object with an id and a prompt). Applied through the same reader as LOAD COREPACK, and kept on this device.");
    out.push("  GRANT :: nothing in code - something she is asking you to allow or to know. Accepted, it is handed to her every turn as the GRANTS block, with your say-so on it. This is the only permission this terminal has, and it is written down.");
    if (p.length) {
      out.push("");
      out.push("WAITING ON YOU RIGHT NOW ::");
      p.forEach(function (e, i) { out.push("  " + (i + 1) + ". " + labelOf(e) + " :: " + String(e.body || "").slice(0, 110)); });
    }
    out.push("");
    out.push("/petition \u00b7 /petition list \u00b7 /petition show <N> \u00b7 /petition accept <N> \u00b7 /petition decline <N> [:: <WHY>] \u00b7 /petition grants \u00b7 /petition clear yes");
    return out.join("\n");
  }

  // ---- the panel (the PETITIONS half of the SHIFT panel) --------------------

  function itemHtml(e, n) {
    var h = [];
    var cls = "ptItem" + (e.status === "pending" ? "" : (" ptItem-" + e.status));
    h.push('<div class="' + cls + '" data-pt-id="' + esc(e.id) + '">');
    h.push('<div class="ptTop"><span class="ptN">' + (e.status === "pending" ? (n + ".") : (e.status === "accepted" ? "ACCEPTED" : "DECLINED")) + '</span>'
      + '<span class="ptKind">' + esc(labelOf(e)) + '</span>'
      + '<span class="ptWhen">' + esc(when(e.at)) + '</span></div>');
    h.push('<div class="ptAsk">' + esc(e.body || "") + '</div>');
    if (e.why) h.push('<div class="ptWhy">WHY :: ' + esc(e.why) + '</div>');
    if (e.status === "pending") {
      if (e.note) h.push('<div class="ptErr">' + esc(e.note) + '</div>');
      h.push('<div class="ptRow">'
        + '<input class="ptReason" type="text" spellcheck="false" autocomplete="off" placeholder="why not - kept in the record with your answer">'
        + '<button type="button" data-pt-act="accept" title="apply it through the lane your own command would have used">ACCEPT</button>'
        + '<button type="button" data-pt-act="decline" title="say no, and keep her words and your reason in the record">DECLINE</button>'
        + '</div>');
    } else {
      h.push('<div class="ptNote">YOU SAID :: ' + esc(e.note || "") + '  \u00b7  ' + esc(when(e.decidedAt || e.at)) + '</div>');
    }
    h.push('</div>');
    return h.join("");
  }

  function render(host) {
    if (!host) return;
    var p = pending(), d = decided();
    var h = [];
    if (!p.length) {
      h.push('<div class="ptEmpty">NOTHING IS WAITING. SHE ASKS WITH A LINE OF HER OWN - <span class="ptMono">[[PETITION: &lt;KIND&gt; :: &lt;WHAT&gt; :: &lt;WHY&gt;]]</span> - AND NOTHING CHANGES UNTIL YOU ANSWER IT.</div>');
    } else {
      p.forEach(function (e, i) { h.push(itemHtml(e, i + 1)); });
    }
    if (d.length) {
      h.push('<div class="ptSub">ALREADY ANSWERED (' + d.length + ') - NOTHING HERE IS DELETED, ONLY ANSWERED</div>');
      d.slice(-8).reverse().forEach(function (e) { h.push(itemHtml(e, 0)); });
    }
    var g = grants();
    if (g.length) {
      h.push('<div class="ptSub">GRANTS IN FORCE (' + g.length + ') - HANDED TO HER EVERY TURN</div>');
      g.forEach(function (e) { h.push('<div class="ptGrant">' + esc(e.body || "") + '</div>'); });
    }
    host.innerHTML = h.join("");

    if (!host.dataset.ptWired) {
      host.dataset.ptWired = "1";
      host.addEventListener("click", async function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest("button[data-pt-act]") : null;
        if (!b) return;
        // The id lives on the item, not on the button: the button says WHICH answer, the item says
        // WHICH petition. (Reading it off the button found nothing and answered "no such petition".)
        var item = b.closest ? b.closest(".ptItem") : null;
        var id = (item && item.getAttribute("data-pt-id")) || b.getAttribute("data-pt-id") || "";
        var act = b.getAttribute("data-pt-act");
        var inp = item ? item.querySelector("input.ptReason") : null;
        b.disabled = true;
        if (act === "accept") {
          var res = await accept(id);
          print('SYSTEM', res.ok
            ? "PETITION ACCEPTED :: " + String(res.text || "")
              + "\nIT IS DONE, AND IT IS IN THE RECORD. IF YOU CHANGE YOUR MIND, THE ORDINARY COMMAND FOR THAT SIDE OF THE TERMINAL PUTS IT BACK."
            : "PETITION :: IT COULD NOT BE APPLIED :: " + String(res.error || "")
              + "\nNOTHING WAS CHANGED AND HER WORDS ARE STILL HERE. /petition show " + number(id) + " PRINTS IT IN FULL.");
        } else {
          var dres = await decline(id, inp ? inp.value : "");
          print('SYSTEM', dres.ok
            ? "PETITION DECLINED :: " + String(dres.text || "")
              + "\nHER WORDS STAY IN THE RECORD BESIDE YOUR ANSWER - IT IS NOT DELETED, IT IS ANSWERED. SHE SEES IT IN THE NEXT QUIET HOUR."
            : "PETITION :: " + String(dres.error || ""));
        }
        if (window.shift && window.shift.refresh) window.shift.refresh(); else render(host);
      });
    }
  }

  async function loadPanel() {
    await load();
    render(el("ptBody"));
  }

  window.petition = {
    load: load,
    ready: function () { return ready; },
    all: all,
    pending: pending,
    decided: decided,
    grants: grants,
    grantsBlock: grantsBlock,
    count: function () { return pending().length; },
    byId: byId,
    nth: nth,
    number: number,
    labelOf: labelOf,
    gate: gate,
    parse: parse,
    file: file,
    fileDirective: fileDirective,
    apply: apply,
    accept: accept,
    decline: decline,
    clear: clear,
    listText: listText,
    showText: showText,
    describe: describe,
    render: render,
    loadPanel: loadPanel,
    KINDS: KINDS
  };

  // The record is read as soon as this file runs; the panel is painted on demand by shift.js (and
  // here, in case the SHIFT panel is already open by the time this module lands).
  var p = load();
  if (p && p.then) p.then(function () { if (el("ptBody")) render(el("ptBody")); }, function () {});
})();
