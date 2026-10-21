(function () {
  var KEY = "draft";
  var FOLDER = "lia_settings";

  // THE HELD DRAFT. What the pencil came back with, and whether the pencil is still holding it: the
  // marker on the button and the boot line are its only advertisement, because the words are NOT in
  // the box (see restore()). A load is a fresh session; nothing puts text in a box by itself.
  var held = null;

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function box() { return el("userInput"); }
  function panel() { return el("draftPanel"); }
  function area() { return el("draftText"); }
  function countEl() { return el("draftCount"); }

  function counts() {
    var t = area() ? String(area().value || "") : "";
    var words = t.trim() ? t.trim().split(/\s+/).length : 0;
    return { words: words, chars: t.length };
  }

  function paint() {
    var c = counts();
    if (countEl()) countEl().textContent = proposal
      ? "REWRITE WAITING · ACCEPT OR DISCARD"
      : (c.words + " WORDS · " + c.chars + " CHARS");
    var b = el("draftBtn");
    if (b) b.setAttribute("aria-pressed", panel() && !panel().hidden ? "true" : "false");
  }

  function wordCount(t) { return String(t || "").trim() ? String(t).trim().split(/\s+/).length : 0; }

  function ago(at) {
    if (!at) return "A WHILE AGO";
    var s = Math.max(0, Math.round((Date.now() - at) / 1000));
    if (s < 90) return s + " SECOND" + (s === 1 ? "" : "S") + " AGO";
    var m = Math.round(s / 60);
    if (m < 90) return m + " MINUTE" + (m === 1 ? "" : "S") + " AGO";
    var h = Math.round(m / 60);
    if (h < 36) return h + " HOUR" + (h === 1 ? "" : "S") + " AGO";
    return Math.round(h / 24) + " DAYS AGO";
  }

  // The pencil wears a green ring while it is holding something - the same idiom as the microphone's
  // own rings, and the only thing that says a paragraph is waiting in there at all.
  function paintHeld() {
    var b = el("draftBtn");
    if (!b) return;
    var on = !!held;
    if (on) b.classList.add("has"); else b.classList.remove("has");
    b.title = on
      ? "the pencil is holding an unsent draft from " + ago(held.at) + " (" + held.text.length + " chars, " + wordCount(held.text) + " words). it is not in the box - press this to bring it back, and SEND or CLEAR there. it is only in this browser."
      : "edit the draft before it is sent - spellcheck, word count, and AI POLISH, kept on this device only. nothing here reaches the archive, the export, or her until SEND.";
  }

  function isOpen() { var p = panel(); return !!(p && !p.hidden); }

  function open() {
    var p = panel(), a = area(), b = box();
    if (!p || !a) return;
    if (b && !a.value) a.value = b.value || "";
    p.hidden = false;
    paintProposal();
    paint();
    if (proposal) { var pt = el("draftProposalText"); try { if (pt) { pt.focus(); } } catch (e) {} }
    else { try { a.focus(); a.setSelectionRange(a.value.length, a.value.length); } catch (e) {} }
  }

  function close() {
    var p = panel();
    if (p) p.hidden = true;
    paint();
    var b = box();
    if (b) try { b.focus(); } catch (e) {}
  }

  function toggle() { if (isOpen()) close(); else open(); }

  async function keep(silent) {
    var k = kv(), a = area();
    if (!k || !a) return false;
    var t = String(a.value || "");
    try { await k.set(KEY, { text: t, style: styleId, at: Date.now() }); } catch (e) {}
    var b = box();
    if (b && document.activeElement === a) b.value = a.value;
    held = t ? { text: t, at: Date.now() } : null;
    paintHeld();
    if (!silent) paint();
    return true;
  }

  // A LOAD IS A FRESH SESSION. The unsent draft is put in THIS PANEL and marked on the pencil - it is
  // NOT painted into the input box any more. A reload (which is what a SAVE is) used to fill the box
  // with yesterday's paragraph, and a box that fills itself is a box that cannot be trusted to be
  // empty. The draft is not lost: it is here, one press away, and nothing in this module ever threw it
  // away for being unused.
  async function restore() {
    var k = kv();
    if (!k) return;
    try {
      var d = await k.get(KEY);
      var t = d && typeof d.text === "string" ? d.text : (typeof d === "string" ? d : "");
      if (d && (d.style || d.styleId)) styleId = styleOf(d.style || d.styleId).id;
      if (t && area() && !area().value) area().value = t;
      held = t ? { text: t, at: (d && d.at) || 0 } : null;
    } catch (e) {}
    paintStyles();
    paintProposal();
    paint();
    paintHeld();
    if (held && typeof window.print === "function") {
      window.print("SYSTEM", "DRAFT :: AN UNSENT DRAFT FROM " + ago(held.at) + " IS IN THE PENCIL (" + held.text.length + " CHARS, " + wordCount(held.text) + " WORDS). IT IS NOT PUT IN THE BOX ANY MORE, SO A FRESH LOAD STARTS EMPTY - PRESS THE PENCIL, EDIT IT THERE, AND SEND OR CLEAR IT. IT HAS NEVER BEEN ANYWHERE BUT THIS BROWSER.");
    }
  }

  function send() {
    // THE GATE, AT THE LAST DOOR. A rewrite that is still waiting for a yes or a no is not sent -
    // pressing SEND only accepts or discards, never both at once (Patrikios, 2026-09-29: *"User must
    // approve before end"*). The refusal is loud, and it names both buttons.
    if (proposal) {
      polishNote("A REWRITE IS WAITING - ACCEPT (or RESTORE) OR DISCARD IT FIRST");
      if (typeof print === "function") print("SYSTEM", "DRAFT :: NOTHING WAS SENT. A REWRITE IS STILL WAITING FOR YOUR YES OR NO - PRESS ACCEPT TO TAKE IT (THE WORDS IT REPLACES ARE KEPT, AND RESTORE PUTS THEM BACK) OR DISCARD TO THROW IT AWAY. SEND CARRIES THE DRAFT ONLY WHEN NEITHER IS STANDING.");
      return;
    }
    var a = area(), b = box();
    if (a && b) b.value = a.value;
    close();
    if (a) { a.value = ""; paint(); }
    keep(true);
    if (window.send) window.send();
  }

  function clear() {
    var a = area();
    if (a) { a.value = ""; paint(); try { a.focus(); } catch (e) {} }
    // CLEAR EMPTIES THE DRAFT, AND THE PROPOSAL GOES WITH IT: a rewrite of an empty draft is not a
    // thing (and silently keeping it would be worse). Said out loud, so it is never a surprise.
    if (proposal) {
      var st = proposal.style;
      proposal = null;
      paintProposal();
      if (typeof print === "function") print("SYSTEM", "DRAFT CLEARED :: THE WAITING " + styleOf(st).label + " REWRITE WENT WITH IT - A PROPOSED REWRITE IS A REWRITE OF A DRAFT, AND THE DRAFT IS GONE.");
    }
    keep(true);
  }

  // A MESSAGE WENT IN. Whatever the pencil was holding belongs to a message that has now been written
  // (or to one he has moved on from), so the held copy is finished with and the green ring comes off.
  // A SLASH COMMAND MOVES ON FROM NOTHING: /voice wire quiet 1500 is not a message, so it leaves the
  // draft exactly where it was.
  function sent(text) {
    var t = String(text == null ? "" : text).trim();
    if (!t || !held) return;
    if (t.charAt(0) === "/" && t !== String(held.text || "").trim()) return;
    held = null;
    // The draft this proposal was written for has gone into the conversation, so the proposal goes
    // with it (a rewrite of a message that has already been sent is a rewrite of nothing).
    if (proposal) { proposal = null; paintProposal(); }
    var a = area();
    if (a && String(a.value || "").trim()) { a.value = ""; }
    paint();
    keep(true);
  }

  // ---- THE PROPOSAL (nothing an AI writes reaches the draft until he says so) ------------
  //
  // Patrikios, 2026-09-29: *"AI on pencil button in the chat with polish, fic, etc.. User must
  // approve before end"*. So a rewrite is no longer written into the draft the moment it arrives
  // (which is what this file used to do, and what "polish" means everywhere else). It is shown in
  // its own box, in its own words, where it can be read and even edited - and the draft is left
  // exactly as he wrote it, byte for byte, until ACCEPT. DISCARD throws the proposal away and
  // changes nothing at all. SEND refuses to carry the draft while a proposal is standing, so a
  // rewrite can never be half-applied by accident: one of the two buttons has to be pressed first.
  //
  // The words an ACCEPT replaces are kept in memory for as long as the panel is open, and the
  // RESTORE button in the action row puts them back - because the one thing a gate must not do is
  // make a slip of the mouse eat a paragraph. Nothing here is persisted: a proposal is not a draft,
  // and a reload starts with the draft and no proposal (see restore()).
  var proposal = null;    // { text, from, style, at } - the rewrite on offer
  var replaced = null;    // { text, at } - what the last ACCEPT put its rewrite over

  function proposalTextNow() {
    var t = el("draftProposalText");
    return t ? String(t.value || "") : (proposal ? proposal.text : "");
  }

  function paintProposal() {
    var box = el("draftProposal");
    if (box) box.hidden = !proposal;
    if (proposal) {
      var t = el("draftProposalText");
      // Never overwrite what he is typing in the review box - only the panel's own redraws land here.
      if (t && document.activeElement !== t) t.value = proposal.text;
      var note = el("draftProposalNote");
      if (note) {
        var moved = String(area() ? area().value : "").trim() !== String(proposal.from || "").trim();
        note.textContent = "PROPOSED IN \u201c" + styleOf(proposal.style).label + "\u201d \u00b7 "
          + wordCount(proposal.text) + " WORDS \u00b7 " + proposal.text.length + " CHARS"
          + (moved ? " \u00b7 THE DRAFT HAS MOVED ON SINCE THIS WAS WRITTEN" : "");
      }
    }
    var rb = el("draftRestore");
    if (rb) {
      rb.hidden = !replaced;
      rb.title = replaced
        ? "put back the words an ACCEPT replaced, as the draft. The rewrite that took their place is not lost - it is offered back as a proposal."
        : "";
    }
    paint();
  }

  function accept() {
    if (!proposal) return false;
    var text = proposalTextNow();
    var a = area();
    if (!a || !String(text).trim()) {
      polishNote("NOTHING TO ACCEPT - THE PROPOSAL IS EMPTY");
      return false;
    }
    var before = String(a.value || "");
    a.value = text;
    replaced = before.trim() ? { text: before, at: Date.now() } : null;
    var st = proposal.style, was = wordCount(before);
    proposal = null;
    var b = box();
    if (b) b.value = a.value;
    keep(true);
    paintProposal();
    if (typeof print === "function") print("SYSTEM", "AI POLISH ACCEPTED (\u201c" + styleOf(st).label + "\u201d) :: THE DRAFT IS NOW THE REWRITE"
      + (was ? " (" + was + " WORDS -> " + wordCount(text) + ")" : "")
      + ".\nNOTHING IS SENT YET: THE BOX, THE ARCHIVE, THE EXPORT AND HER CONTEXT SEE NOTHING UNTIL SEND"
      + (replaced ? " - AND THE WORDS IT REPLACED ARE ONE PRESS AWAY (RESTORE)." : "."));
    try { a.focus(); } catch (e) {}
    return true;
  }

  function discardProposal(silent) {
    if (!proposal) return false;
    var st = proposal.style;
    proposal = null;
    paintProposal();
    if (!silent && typeof print === "function") print("SYSTEM", "AI POLISH DISCARDED :: THE " + styleOf(st).label + " REWRITE IS THROWN AWAY AND THE DRAFT IS UNTOUCHED - NOT A CHARACTER OF IT WAS EVER SWAPPED.");
    return true;
  }

  // The other side of ACCEPT: what the rewrite replaced goes back into the draft, and the rewrite
  // itself is offered as a proposal - so the two can be swapped back and forth with the buttons.
  function restoreReplaced() {
    if (!replaced) return false;
    var a = area();
    if (!a) return false;
    var now = String(a.value || "");
    a.value = replaced.text;
    proposal = now.trim() ? { text: now, from: replaced.text, style: styleId, at: Date.now() } : null;
    var had = replaced;
    replaced = null;
    var b = box();
    if (b) b.value = a.value;
    keep(true);
    paintProposal();
    if (typeof print === "function") print("SYSTEM", "RESTORED :: THE DRAFT IS THE " + wordCount(had.text) + " WORDS THAT WERE THERE BEFORE THE ACCEPT"
      + (proposal ? ".\nTHE REWRITE THEY REPLACED IS OFFERED BACK AS A PROPOSAL - ACCEPT THAT TO SWAP BACK, OR DISCARD IT." : "."));
    return true;
  }

  // AI POLISH: a spellcheck and style pass over the draft, in place, before anything is
  // sent. The chosen style rewrites the words; the result lands back HERE for editing - never
  // sent, never archived, never in her context until SEND. One model call, with a moving
  // indicator while it runs.
  //
  // THE COLOURS ARE IN THIS CALL TOO (src/js/moods.js). The MOOD row under these chips is the SAME
  // console as the SYSTEM panel's - the same store, the same press, both rows painted from that
  // module - and a rewrite is handed to the model wearing it: the STYLE decides the JOB (fix it,
  // shorten it, veil it) and the MOODS decide the REGISTER it comes back in. The words are still
  // his, so the colours are given as register only: meaning, facts and detail do not move.
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
  var styleId = "fix";
  var polishing = false;
  var dotsTimer = null;

  function styleOf(id) {
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return STYLES[i];
    return STYLES[0];
  }

  function paintStyles() {
    var host = el("draftStyles");
    if (!host) return;
    host.textContent = "";
    STYLES.forEach(function (st) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = st.label;
      b.title = st.rule;
      if (st.id === styleId) b.className = "on";
      b.addEventListener("click", function () { styleId = st.id; keep(true); paintStyles(); });
      host.appendChild(b);
    });
  }

  function polishNote(t) { if (countEl()) countEl().textContent = t; }

  async function polish() {
    var a = area();
    if (!a || polishing) return;
    var src = String(a.value || "").trim();
    if (!src) { polishNote("NOTHING TO POLISH - WRITE THE DRAFT FIRST"); return; }
    if (!window.root || !window.root.generateText) { polishNote("NO TEXT ENGINE ON THIS PAGE"); return; }
    var had = !!proposal;
    polishing = true;
    var btn = el("draftPolish");
    if (btn) { btn.disabled = true; btn.textContent = "WORKING"; }
    var dots = 0;
    polishNote("POLISHING .");
    dotsTimer = setInterval(function () { dots = (dots + 1) % 4; polishNote("POLISHING " + ".".repeat(dots || 1)); }, 350);
    try {
      var st = styleOf(styleId);
      var mood = (window.moods && window.moods.pencilText) ? String(window.moods.pencilText() || "") : "";
      // THE SHAPE OF THE ASK MATTERS (measured 2026-09-29). It used to be
      //   <the style's rule> \n\n <the colours> \n\n "Reply with ONLY the rewritten text" \n\n "DRAFT:\n" <draft>
      // and with the colours on - his console holds a dozen, each with a rule of its own - the model
      // read the whole thing as ONE DOCUMENT and answered by rewriting the WRONG PART: it produced a
      // "corrected" copy of the colours, and the draft was never touched. Nothing was lost (the
      // proposal gate had just been built, so the nonsense was shown and not applied - which is the
      // first thing the gate ever did), but the ask itself had to be fixed. Now the job comes first,
      // the colours are fenced off as REGISTER and said not to be text to rewrite, the draft is the
      // only thing between markers, and the closing instruction is the LAST thing the model reads -
      // so there is nothing after the draft to continue and one obvious thing to do.
      var ask = "REWRITE THE DRAFT BELOW.\n\n"
        + "THE JOB: " + st.rule + "\n"
        + (mood ? "\nTHE REGISTER IT MUST COME BACK IN (this is how the rewrite should sound - it is NOT text to rewrite, and none of it may appear in your reply):\n" + mood + "\n" : "")
        + "\nTHE DRAFT (the only thing to rewrite):\n<<<\n" + src + "\n>>>\n\n"
        + "Reply with ONLY the rewritten draft - no commentary, no preamble, no quotes around it, and nothing else.";
      var out = await window.root.generateText(ask);
      var clean = String(out == null ? "" : (typeof out === "string" ? out : out.text || "")).trim()
        .replace(/^["“”']+|["“”']+$/g, "").trim();
      // A PROPOSAL, NOT THE DRAFT (see the section above). The draft he wrote is not touched here -
      // not the textarea, not the box, not the copy on this device - and the review box is filled
      // with the model's words and the style that produced them. The proposal that was already
      // standing (if he polished twice) is replaced, and it says so rather than vanishing.
      if (clean) {
        proposal = { text: clean, from: src, style: st.id, at: Date.now() };
        paintStyles();
        paintProposal();
        polishNote("REWRITE READY - ACCEPT OR DISCARD");
        if (typeof print === "function") print("SYSTEM", "AI POLISH :: A " + st.label + " REWRITE IS WAITING FOR YOUR YES OR NO"
          + (had ? " (IT REPLACED THE ONE ALREADY STANDING)" : "")
          + ".\nNOTHING HAS CHANGED YET: YOUR DRAFT IS EXACTLY AS YOU WROTE IT. READ THE REWRITE, EDIT IT IN ITS OWN BOX IF YOU WANT, THEN PRESS ACCEPT TO TAKE IT OR DISCARD TO THROW IT AWAY. SEND WAITS UNTIL ONE OF THE TWO IS PRESSED.");
      } else {
        polishNote("THE MODEL CAME BACK EMPTY - THE DRAFT IS UNTOUCHED");
      }
    } catch (e) {
      if (typeof print === "function") print('SYSTEM', "POLISH FAILED :: " + ((e && e.message) || e) + " :: THE DRAFT IS UNTOUCHED.");
      polishNote("POLISH FAILED");
    }
    if (dotsTimer) { clearInterval(dotsTimer); dotsTimer = null; }
    polishing = false;
    if (btn) { btn.disabled = false; btn.textContent = "POLISH"; }
    paint();
    if (!proposal) { try { a.focus(); } catch (e) {} }
  }

  function mirrorBox(e) {
    if (!e || !e.target || e.target.id !== "userInput") return;
    var da = area();
    if (da && isOpen() && document.activeElement !== da && da.value !== e.target.value) { da.value = e.target.value; paint(); }
  }

  function wire() {
    var db = el("draftBtn");
    if (db && !db.dataset.wired) { db.dataset.wired = "1"; db.addEventListener("click", toggle); }
    var a = area();
    if (a && !a.dataset.wired) {
      a.dataset.wired = "1";
      a.addEventListener("input", function () {
        paint();
        var b = box();
        if (b && isOpen()) b.value = a.value;
      });
      a.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); close(); }
        else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
        e.stopPropagation();
      });
      ["keyup", "keypress"].forEach(function (ev) { a.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    }
    var b = box();
    document.removeEventListener("input", mirrorBox);
    document.addEventListener("input", mirrorBox);
    var s = el("draftSend"), k = el("draftKeep"), c = el("draftClear"), x = el("draftClose");
    if (s && !s.dataset.wired) { s.dataset.wired = "1"; s.addEventListener("click", send); }
    if (k && !k.dataset.wired) { k.dataset.wired = "1"; k.addEventListener("click", function () { keep(); close(); }); }
    if (c && !c.dataset.wired) { c.dataset.wired = "1"; c.addEventListener("click", clear); }
    if (x && !x.dataset.wired) { x.dataset.wired = "1"; x.addEventListener("click", close); }
    var pb = el("draftPolish");
    if (pb && !pb.dataset.wired) { pb.dataset.wired = "1"; pb.addEventListener("click", polish); }
    // THE APPROVAL GATE (see the section above): the two buttons, the third that puts back what an
    // ACCEPT replaced, and the review box's own typing (which only repaints the note - the text is
    // read at the press, never kept in step).
    var acc = el("draftAccept"), dis = el("draftDiscard"), rst = el("draftRestore");
    if (acc && !acc.dataset.wired) { acc.dataset.wired = "1"; acc.addEventListener("click", function () { accept(); }); }
    if (dis && !dis.dataset.wired) { dis.dataset.wired = "1"; dis.addEventListener("click", function () { discardProposal(false); }); }
    if (rst && !rst.dataset.wired) { rst.dataset.wired = "1"; rst.addEventListener("click", function () { restoreReplaced(); }); }
    var ptx = el("draftProposalText");
    if (ptx && !ptx.dataset.wired) {
      ptx.dataset.wired = "1";
      ptx.addEventListener("input", function () {
        if (proposal) proposal.text = String(ptx.value || "");
        var note = el("draftProposalNote");
        if (note && proposal) {
          note.textContent = "PROPOSED IN \u201c" + styleOf(proposal.style).label + "\u201d \u00b7 "
            + wordCount(ptx.value) + " WORDS \u00b7 " + String(ptx.value || "").length + " CHARS"
            + (String(area() ? area().value : "").trim() !== String(proposal.from || "").trim() ? " \u00b7 THE DRAFT HAS MOVED ON SINCE THIS WAS WRITTEN" : "")
            + " \u00b7 EDITED BY YOU";
        }
        paint();
      });
    }
    paintStyles();
    paintProposal();
    // The MOOD row in this panel is the same console as the SYSTEM panel's (src/js/moods.js) and is
    // painted from there; asking it again here means the row is right whichever module wires first.
    if (window.moods && window.moods.paint) window.moods.paint();
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) close();
    });
    restore();
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);
  wire();

  window.draft = {
    toggle: toggle, open: open, close: close, send: send, keep: keep, clear: clear, isOpen: isOpen, sent: sent,
    held: function () { return held ? { text: held.text, at: held.at } : null; },
    // THE PROPOSAL (see the section above): what AI POLISH came back with, still waiting for his yes
    // or no. Read-only from the outside apart from the three verbs - a proposal is the panel's, and
    // nothing else in the terminal has any business taking it.
    proposal: function () { return proposal ? { text: proposal.text, from: proposal.from, style: proposal.style, at: proposal.at } : null; },
    accept: accept, discard: function () { return discardProposal(false); }, restore: restoreReplaced,
    styles: function () { return STYLES.map(function (s) { return { id: s.id, label: s.label }; }); }
  };
})();
