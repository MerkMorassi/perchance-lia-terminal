window.MythosPencil = (function () {
  "use strict";
  var STYLES = [
    { id: "fix", label: "FIX", rule: "Fix spelling, grammar, and punctuation only. Keep every word choice, the tone, and the length exactly as written." },
    { id: "work", label: "WORK", rule: "Rewrite as polished professional prose: clear, direct, courteous. Keep the meaning and all facts." },
    { id: "chat", label: "CHAT", rule: "Rewrite as warm conversational prose, like a message to a friend. Keep the meaning and all facts." },
    { id: "play", label: "PLAY", rule: "Rewrite with playful energy and colour, still easy to read. Keep the meaning and all facts." },
    { id: "fic", label: "FIC", rule: "Rewrite it as a passage of prose fiction: tell it as a moment in a story rather than as a message - close third person, concrete sensory detail, action in the present, no framing and no commentary. Keep every fact, every meaning and my intent." },
    { id: "short", label: "SHORT", rule: "Make it as short as it can be without losing any meaning or fact." },
    { id: "veiled", label: "VEILED", rule: "Rewrite in the Veiled Tongue: speak of the body only in the coined register - Pillar of Light for the penis, Gate of Eleuthia for the anus, Gate of Aphrodite for the vagina, Sacred Pearl for the clitoris, Gate of Hymns and Song for the mouth. Sensual and mythic, explicit in meaning but veiled in word. Keep the meaning and all facts." },
    { id: "spicy", label: "SPICY", rule: "Rewrite raw and profane for explicit adult talk: plain sexual speech with a few choice and impactful words - arse, cunt, cock, fuck, fucking - used sparingly where they land hardest, never as filler. Profane, not pornographic: no graphic porn language, no crude excess. Keep the meaning and all facts." },
    { id: "sapphic", label: "SAPPHIC", rule: "Render it in Ancient Greek as a Sapphic stanza: three long lines and one short closing line, lyric and intimate, in the voice of Sappho. Keep every meaning, fact and intent; only the tongue and the music change." },
    { id: "homeric", label: "HOMERIC", rule: "Render it in Ancient Greek as epic verse in the Homeric manner: stately dactylic lines, stock epithets and formulae where they fit, the tone of the Iliad and Odyssey. Keep every meaning, fact and intent; only the tongue and the music change." }
  ];
  function str(s) { return String(s == null ? "" : s); }
  function upper(s) { return str(s).toUpperCase(); }
  function trim(s) { return str(s).trim(); }
  function memStore() {
    var d = null;
    return { load: function () { return Promise.resolve(d); }, save: function (v) { d = v; return Promise.resolve(); } };
  }
  function kvAdapter(kv, key) {
    return {
      load: function () { try { return kv.get(key); } catch (e) { return Promise.resolve(null); } },
      save: function (v) { try { return kv.set(key, v); } catch (e) { return Promise.resolve(); } }
    };
  }
  function styleOf(id) {
    var want = trim(id).toLowerCase();
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === want) return STYLES[i];
    for (var j = 0; j < STYLES.length; j++) if (STYLES[j].label === upper(id)) return STYLES[j];
    return STYLES[0];
  }
  function words(t) { return trim(t) ? trim(t).split(/\s+/).length : 0; }
  function cleanReply(out) {
    var t = str(out && typeof out === "object" && out.text !== undefined ? out.text : out);
    return trim(t.replace(/^["\u201c\u201d']+|["\u201c\u201d']+$/g, ""));
  }
  function client(rawOpts) {
    var opts = rawOpts || {};
    var store = opts.store || memStore();
    if (!store.load && !store.save && typeof store.get === "function" && typeof store.set === "function") store = kvAdapter(store, str(opts.key || "pencil"));
    if (!store.load || !store.save) store = memStore();
    var draft = str(opts.draft || "");
    var styleId = styleOf(opts.style || "fix").id;
    var proposal = null;
    var replaced = null;
    var polishing = false;
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    function persist() {
      try { store.save({ draft: draft, style: styleId, at: Date.now() }); } catch (e) {}
    }
    async function load() {
      try {
        var d = await store.load();
        if (d && typeof d === "object") {
          if (typeof d.draft === "string") draft = d.draft;
          if (d.style) styleId = styleOf(d.style).id;
        } else if (typeof d === "string") draft = d;
      } catch (e) { say("PENCIL UNREADABLE :: STARTING EMPTY WITH FIX."); }
      return { ok: true, words: words(draft), chars: draft.length, style: styleOf(styleId).label };
    }
    function register() {
      try {
        if (opts.moods && typeof opts.moods.pencilText === "function") return str(opts.moods.pencilText() || "");
      } catch (e) {}
      if (typeof opts.register === "function") { try { return str(opts.register() || ""); } catch (e) { return ""; } }
      return str(opts.register || "");
    }
    function buildAsk(src, style, reg) {
      return "REWRITE THE DRAFT BELOW.\n\n"
        + "THE JOB: " + style.rule + "\n"
        + (reg ? "\nTHE REGISTER IT MUST COME BACK IN (this is how the rewrite should sound - it is NOT text to rewrite, and none of it may appear in your reply):\n" + reg + "\n" : "")
        + "\nTHE DRAFT (the only thing to rewrite):\n<<<\n" + src + "\n>>>\n\n"
        + "Reply with ONLY the rewritten draft - no commentary, no preamble, no quotes around it, and nothing else.";
    }
    function engine() {
      if (typeof opts.generate === "function") return opts.generate;
      if (typeof opts.generateText === "function") return opts.generateText;
      return null;
    }
    async function polish() {
      var src = trim(draft);
      if (!src) return { ok: false, error: "NOTHING TO POLISH - WRITE THE DRAFT FIRST." };
      if (polishing) return { ok: false, error: "ALREADY POLISHING - WAIT FOR THE ONE IN HAND." };
      var gen = engine();
      if (!gen) return { ok: false, error: "NO TEXT ENGINE - PASS generate: (ask) => text." };
      var had = !!proposal;
      var st = styleOf(styleId);
      polishing = true;
      say("POLISHING :: " + st.label + " …");
      try {
        var out = await gen(buildAsk(src, st, register()));
        var text = cleanReply(out);
        if (!text) { polishing = false; return { ok: false, error: "THE MODEL CAME BACK EMPTY - THE DRAFT IS UNTOUCHED." }; }
        proposal = { text: text, from: src, style: st.id, at: Date.now() };
        polishing = false;
        var msg = "AI POLISH :: A " + st.label + " REWRITE IS WAITING FOR YOUR YES OR NO" + (had ? " (IT REPLACED THE ONE ALREADY STANDING)" : "") + ".\nNOTHING HAS CHANGED YET: YOUR DRAFT IS EXACTLY AS YOU WROTE IT. ACCEPT TO TAKE IT OR DISCARD TO THROW IT AWAY. SEND WAITS UNTIL ONE OF THE TWO IS PRESSED.";
        say(msg);
        return { ok: true, replaced: had, style: st.label, proposal: { text: proposal.text, style: proposal.style }, text: msg };
      } catch (e) {
        polishing = false;
        return { ok: false, error: "POLISH FAILED :: " + str((e && e.message) || e) + " :: THE DRAFT IS UNTOUCHED." };
      }
    }
    function accept(editText) {
      if (!proposal) return { ok: false, error: "NOTHING WAITS - POLISH FIRST, THEN ACCEPT OR DISCARD." };
      var text = trim(editText !== undefined ? editText : proposal.text);
      if (!text) return { ok: false, error: "NOTHING TO ACCEPT - THE PROPOSAL IS EMPTY." };
      var before = draft;
      draft = text;
      replaced = trim(before) ? { text: before, at: Date.now() } : null;
      var st = styleOf(proposal.style);
      proposal = null;
      persist();
      var msg = "AI POLISH ACCEPTED (\u201c" + st.label + "\u201d) :: THE DRAFT IS NOW THE REWRITE" + (words(before) ? " (" + words(before) + " WORDS -> " + words(text) + ")" : "") + ".\nNOTHING IS SENT YET" + (replaced ? " - AND THE WORDS IT REPLACED ARE ONE PRESS AWAY (RESTORE)." : ".");
      say(msg);
      return { ok: true, style: st.label, text: msg };
    }
    function discard(silent) {
      if (!proposal) return { ok: false, error: "NOTHING WAITS - THERE IS NOTHING TO THROW AWAY." };
      var st = styleOf(proposal.style).label;
      proposal = null;
      if (!silent) say("AI POLISH DISCARDED :: THE " + st + " REWRITE IS THROWN AWAY AND THE DRAFT IS UNTOUCHED - NOT A CHARACTER OF IT WAS EVER SWAPPED.");
      return { ok: true, style: st, text: "DISCARDED :: THE DRAFT STANDS AS WRITTEN." };
    }
    function restore() {
      if (!replaced) return { ok: false, error: "NOTHING WAS REPLACED - THERE IS NOTHING TO PUT BACK." };
      var now = draft;
      draft = replaced.text;
      var had = replaced;
      replaced = null;
      proposal = trim(now) ? { text: now, from: draft, style: styleId, at: Date.now() } : null;
      persist();
      var msg = "RESTORED :: THE DRAFT IS THE " + words(had.text) + " WORDS THAT WERE THERE BEFORE THE ACCEPT" + (proposal ? ".\nTHE REWRITE THEY REPLACED IS OFFERED BACK AS A PROPOSAL - ACCEPT THAT TO SWAP BACK, OR DISCARD IT." : ".");
      say(msg);
      return { ok: true, text: msg };
    }
    function gate() {
      if (proposal) return { ok: false, error: "A REWRITE IS WAITING - ACCEPT (OR RESTORE) OR DISCARD IT FIRST. SEND CARRIES NOTHING WHILE ONE STANDS." };
      if (!trim(draft)) return { ok: false, error: "NOTHING TO SEND - THE DRAFT IS EMPTY." };
      return { ok: true, draft: draft };
    }
    function sent(text) {
      var t = trim(text);
      if (!t) return { ok: false, error: "NOTHING WENT IN - THE PENCIL STILL HOLDS WHAT IT HELD." };
      if (t.charAt(0) === "/" && t !== trim(draft)) return { ok: true, kept: true, text: "A COMMAND MOVES ON FROM NOTHING - THE DRAFT STANDS." };
      draft = "";
      proposal = null;
      persist();
      return { ok: true, text: "SENT :: THE PENCIL IS EMPTY AGAIN." };
    }
    function setDraft(t) {
      draft = str(t == null ? "" : t);
      if (proposal && trim(draft) !== trim(proposal.from)) proposal = proposal;
      persist();
      return { ok: true, words: words(draft), chars: draft.length };
    }
    return {
      load: load,
      styles: function () { return STYLES.map(function (s) { return { id: s.id, label: s.label }; }); },
      style: function () { return styleOf(styleId); },
      setStyle: function (id) { var st = styleOf(id); styleId = st.id; persist(); return { ok: true, style: st.label, text: "STYLE :: " + st.label + " - " + st.rule }; },
      buildAsk: function (src, id) { var st = styleOf(id || styleId); return buildAsk(trim(src !== undefined ? src : draft), st, register()); },
      polish: polish,
      proposal: function () { return proposal ? { text: proposal.text, from: proposal.from, style: proposal.style, at: proposal.at } : null; },
      accept: accept, discard: discard, restore: restore,
      gate: gate, sent: sent,
      setDraft: setDraft,
      getDraft: function () { return draft; },
      standing: function () { return !!proposal; },
      busy: function () { return polishing; }
    };
  }
  var ids = STYLES.map(function (s) { return s.id; });
  return { client: client, STYLES: ids.slice() };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosPencil;
