window.rtfmEditor = (function () {
  "use strict";

  /* THE RTFM EDITOR - the manual's own pages, written where they are read.

     /rtfm new [NAME] and /rtfm edit <DOC> open this over the terminal (rtfm.js is the reader; this is
     the writer). It is a monospace markdown editor with a live preview pane, and the preview is not a
     second renderer: it is `rtfm.markdown()`, the same function that prints a page in the terminal, so
     what he sees in the pane is exactly what /rtfm <DOC> will print.

     WHERE IT SAVES, AND WHY IT IS NOT IN src/
     Nothing on this page can write a file into the generator, and a page he writes is HIS before it is
     anybody's: it is kept in kv (lia_settings / rtfm_local) - the same store everything else of his is
     kept in - and it stays there until he chooses to export it. `/rtfm export <NAME>` hands it over as
     markdown, and dropping that file in src/rtfm/ (plus a line in the manifest, if it is not already
     there) is what makes it travel with the generator. The layout, folder by folder:
     src/rtfm/*.md is the SHIPPED truth; kv/rtfm_local is what he has made of it on this device.

     A SHIPPED PAGE IS SHADOWED, NEVER ALTERED
     Opening /rtfm edit turn and saving keeps his copy under that name and prints his copy; src/rtfm/turn.md
     is untouched and REVERT (or /rtfm rm turn) puts the file back in force. Exactly the arrangement
     roles.js uses for an edited role layer - the shipped thing is the truth, and what he makes of it
     sits on top of it.

     THE KEYS
       CTRL+S / CMD+S   save.      ESC   close (twice if there is unsaved work).
       TAB              two spaces in the body, rather than leaving the box.
     Nothing destructive happens on one press: DELETE and REVERT both arm first and say what they will
     do, and closing with unsaved work asks once. A page is never silently lost.

     THE UNSAVED DRAFT (why there is a third copy of what he is writing)
     This page is reloaded by the terminal's own machinery, and a phone throws a backgrounded tab away.
     A page written for twenty minutes and then lost to a reload is the one failure that would make the
     editor untrustworthy, so while he types, what he has typed is kept as a DRAFT in kv (lia_settings /
     rtfm_draft) - not the page: the page is what SAVE makes, and this shadow copy never touches
     rtfm_local, never shadows anything and never changes what /rtfm prints. Open a page that has a
     draft and the draft is put back in the fields, with the time it was written said plainly in the
     note; SAVE turns it into the page, and closing with CANCEL twice (or REVERT, or DELETE) throws it
     away, which is the point of being asked twice. Drafts are kept per page, at most 20 of them, and
     only ever while there are unsaved changes.

     Exports: open, openEdit, openNew, isOpen, close, save, revert, drop, body, note. */

  var el = null, idEl = null, titleEl = null, tagsEl = null, descEl = null, bodyEl = null;
  var prevEl = null, stateEl = null, noteEl = null, headTitleEl = null, prevBtn = null;
  var revertBtn = null, deleteBtn = null, cancelBtn = null, saveBtn = null;
  var shown = false;
  var cur = null;      // the page loaded here: { id, title, shadows, local, generated, fresh }
  var snap = "";       // the fields as they were loaded or last saved
  var armed = "";      // a button pressed once: "cancel" | "delete" | "revert" | "shadow"
  var tPrev = 0;
  var tDraft = 0;
  var lastDraftKey = "";  // the key this session last wrote a draft under (reset every time one opens)
  var drafts = null;   // { id: { fresh, title, tags, desc, body, at } } - what is typed but not saved

  var DRAFT_KEY = "rtfm_draft";
  var DRAFT_MAX = 20;

  function $(id) { return document.getElementById(id); }
  function norm(s) { return String(s == null ? "" : s).trim(); }

  // A receipt in the log, the way the other modules write one - the editor is an overlay and the log
  // is behind it, so what happened is there to read once it is closed.
  function say(text) { try { if (typeof print === "function") print("SYSTEM", text); } catch (e) {} }

  function note(text, bad) {
    if (!noteEl) return;
    noteEl.textContent = text || "";
    noteEl.className = "reNote" + (bad ? " bad" : "");
  }

  function splitTags(s) {
    return String(s || "").split(",").map(function (t) { return norm(t).toLowerCase(); }).filter(Boolean);
  }

  function wire() {
    if (el) return;
    el = $("rtfmEditor");
    if (!el) return;
    idEl = $("reId"); titleEl = $("reTitleInput"); tagsEl = $("reTags"); descEl = $("reDesc");
    bodyEl = $("reBody"); prevEl = $("rePrev"); stateEl = $("reState"); noteEl = $("reNote");
    headTitleEl = $("reTitle"); prevBtn = $("rePreview");
    revertBtn = $("reRevert"); deleteBtn = $("reDelete"); cancelBtn = $("reCancel"); saveBtn = $("reSave");

    saveBtn.addEventListener("click", save);
    cancelBtn.addEventListener("click", function () { requestClose(); });
    revertBtn.addEventListener("click", revert);
    deleteBtn.addEventListener("click", del);
    prevBtn.addEventListener("click", function () {
      el.classList.toggle("prev");
      prevBtn.classList.toggle("on", el.classList.contains("prev"));
      if (el.classList.contains("prev")) paintPreview();
    });
    bodyEl.addEventListener("input", onInput);
    [idEl, titleEl, tagsEl, descEl].forEach(function (x) { if (x) x.addEventListener("input", onInput); });
    // TAB IS AN INDENT, not a way out of the box: a page is written in here, and two spaces at the
    // start of a line is markdown (a nested list, a code fence) that would otherwise be unreachable.
    bodyEl.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      e.preventDefault();
      var s = bodyEl.selectionStart, t = bodyEl.selectionEnd;
      bodyEl.value = bodyEl.value.slice(0, s) + "  " + bodyEl.value.slice(t);
      bodyEl.selectionStart = bodyEl.selectionEnd = s + 2;
      onInput();
    });
    // The terminal's own paste handler turns a pasted IMAGE into a chat attachment (main.js). A paste
    // inside this editor is writing, not sending, so it is left alone here rather than stolen.
    document.addEventListener("paste", function (e) {
      if (!shown) return;
      var t = e.target;
      if (t && el.contains(t)) e.stopImmediatePropagation();
    }, true);
    document.addEventListener("keydown", onKey, true);
  }

  function onKey(e) {
    if (!shown) return;
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      requestClose();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      save();
    }
  }

  function stateStr() {
    return [idEl.value, titleEl.value, tagsEl.value, descEl.value, bodyEl.value].join("\u0000");
  }
  function dirty() { return stateStr() !== snap; }
  function takeSnap() { snap = stateStr(); }

  function paintCount() {
    if (!stateEl) return;
    var n = bodyEl.value.length;
    var ln = n ? bodyEl.value.split("\n").length : 0;
    stateEl.textContent = n + " CHARACTER" + (n === 1 ? "" : "S") + "  \u00b7  " + ln + " LINE" + (ln === 1 ? "" : "S")
      + "  \u00b7  " + (dirty() ? "UNSAVED" : "SAVED");
  }

  function paintPreview() {
    if (!prevEl) return;
    if (!window.rtfm) { prevEl.textContent = "THE READER IS OFFLINE (src/js/rtfm.js DID NOT LOAD)."; return; }
    var t = bodyEl.value;
    prevEl.textContent = norm(t)
      ? window.rtfm.markdown(t)
      : "(NOTHING WRITTEN YET - THE PREVIEW SHOWS THE PAGE EXACTLY AS THE TERMINAL WILL PRINT IT)";
  }

  function onInput() {
    armed = "";
    paintCount();
    if (tPrev) window.clearTimeout(tPrev);
    tPrev = window.setTimeout(paintPreview, 140);
    // The draft, a beat behind the typing rather than on every keystroke: a pause is what a draft
    // wants, and a page is not lost in a pause.
    if (tDraft) window.clearTimeout(tDraft);
    tDraft = window.setTimeout(draftWrite, 1200);
  }

  // The head line and which of the destructive buttons belong to this page: a shipped page can be
  // REVERTED (his copy dropped, the file back in force), a page of his own can be DELETED, a shipped
  // page or a generated one can be neither.
  function paintChrome() {
    if (!el) return;
    var fresh = !cur || cur.fresh;
    var shipped = !!(cur && cur.local && cur.shadows);
    var own = !!(cur && cur.local && !cur.shadows);
    if (fresh) headTitleEl.textContent = "THE RTFM EDITOR :: A NEW PAGE";
    else if (shipped) headTitleEl.textContent = "THE RTFM EDITOR :: " + upper(cur.title || cur.id) + "  (SHIPPED - YOUR COPY SHADOWS IT HERE)";
    else if (own) headTitleEl.textContent = "THE RTFM EDITOR :: " + upper(cur.title || cur.id) + "  (YOURS, ON THIS DEVICE)";
    else headTitleEl.textContent = "THE RTFM EDITOR :: " + upper(cur.title || cur.id) + "  (SHIPPED)";
    if (idEl) idEl.readOnly = !fresh && !own;
    if (revertBtn) revertBtn.hidden = !shipped;
    if (deleteBtn) deleteBtn.hidden = !own;
    if (own || fresh) idEl.title = "what the page is filed under, and what /rtfm <NAME> finds it by - letters, numbers and hyphens. Fixed once the page is saved.";
    else idEl.title = "the name this page is filed under - fixed here; /rtfm new <NAME> starts another page.";
  }
  function upper(s) { return norm(s).toUpperCase(); }

  // `skipSnap` is for a draft coming back: the snapshot is taken against the PAGE as it is on disk, so
  // that restored work is reported UNSAVED (it is - the only copy of it is the draft) and closing asks
  // before throwing it away, which is also what clears the draft.
  function finishOpen(skipSnap) {
    el.hidden = false;
    shown = true;
    lastDraftKey = "";
    el.classList.toggle("prev", window.innerWidth >= 820);
    if (prevBtn) prevBtn.classList.toggle("on", el.classList.contains("prev"));
    armed = "";
    note("");
    if (!skipSnap) takeSnap();
    paintChrome();
    paintCount();
    paintPreview();
    window.setTimeout(function () {
      try {
        if (!cur || cur.fresh) { idEl.focus(); idEl.select(); }
        else bodyEl.focus();
      } catch (e) {}
    }, 40);
  }

  // ---- the unsaved draft -----------------------------------------------------
  //
  // What is typed but NOT saved, kept so a reload cannot take it. This is not the page: `rtfm_local`
  // is what SAVE makes, and a draft never touches it, never shadows anything and never changes what
  // `/rtfm <DOC>` prints. One kv key per page (`rtfm_draft_<id>`), so a write while typing touches
  // only the page being typed and the others are left alone; the oldest are swept away at DRAFT_KEEP.

  var DRAFT_PREFIX = "rtfm_draft_";
  var DRAFT_KEEP = 20;

  function store() { return (window.rtfm && window.rtfm.storage) ? window.rtfm.storage() : null; }
  function pageKey() { return (window.rtfm ? window.rtfm.slug(idEl && idEl.value) : "") || "untitled"; }

  function draftWrite() {
    if (!shown || !dirty()) return;
    var k = store();
    if (!k) return;
    var key = pageKey();
    var rec = {
      fresh: !!(cur && cur.fresh), title: titleEl.value, tags: tagsEl.value,
      desc: descEl.value, body: bodyEl.value, at: new Date().toISOString()
    };
    // A page renamed while it is being typed moves its draft rather than leaving a copy of it stranded
    // under the old name - and only a key THIS session wrote is ever dropped, so switching pages can
    // never take another page's draft with it.
    var stale = (lastDraftKey && lastDraftKey !== key) ? lastDraftKey : "";
    lastDraftKey = key;
    try {
      var p = k.set(DRAFT_PREFIX + key, rec);
      if (p && p.catch) p.catch(function () {});
      if (stale) { try { k.delete(DRAFT_PREFIX + stale); } catch (e) {} }
    } catch (e) {}
  }

  // Throw the draft away. The keys are taken from the fields and the loaded page BEFORE the box is
  // cleared, because a rename has to clear both the name it is being saved under and the one it was
  // opened under, and because the caller may close the editor before this resolves.
  function draftClear() {
    var k = store();
    if (!k) return;
    var ks = [];
    if (idEl && idEl.value) ks.push(window.rtfm.slug(idEl.value));
    if (cur && cur.id) ks.push(cur.id);
    ks.forEach(function (key) { if (key) { try { k.delete(DRAFT_PREFIX + key); } catch (e) {} } });
  }

  async function draftRestore(key) {
    var k = store();
    if (!k || !key) return "";
    var d = null;
    try { d = await k.get(DRAFT_PREFIX + key); } catch (e) { return ""; }
    if (!d || typeof d !== "object") return "";
    // A draft that says exactly what the page says is nothing to restore - it is the echo of an open
    // editor, not lost work - so it goes quietly rather than being announced.
    if (String(d.title || "") === titleEl.value && String(d.tags || "") === tagsEl.value
      && String(d.desc || "") === descEl.value && String(d.body || "") === bodyEl.value) {
      try { k.delete(DRAFT_PREFIX + key); } catch (e) {}
      return "";
    }
    titleEl.value = String(d.title || "");
    tagsEl.value = String(d.tags || "");
    descEl.value = String(d.desc || "");
    bodyEl.value = String(d.body || "");
    return "AN UNSAVED DRAFT FROM " + draftAge(d.at) + " WAS PUT BACK IN THE FIELDS :: CTRL+S SAVES IT AS THE PAGE, CANCEL TWICE THROWS IT AWAY. IT WAS NEVER SAVED ANYWHERE BUT THIS BROWSER, SO THIS IS THE ONLY COPY OF IT.";
  }

  function draftAge(at) {
    var t = Date.parse(String(at || ""));
    if (!t) return "EARLIER";
    var mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return "LESS THAN A MINUTE AGO";
    if (mins < 90) return mins + " MINUTES AGO";
    var hrs = Math.round(mins / 60);
    if (hrs < 36) return hrs + (hrs === 1 ? " HOUR" : " HOURS") + " AGO";
    return Math.round(hrs / 24) + " DAYS AGO";
  }

  // Abandoned drafts are bounded: the oldest go when there are more than DRAFT_KEEP of them.
  async function draftSweep() {
    var k = store();
    if (!k) return;
    try {
      var ks = (await k.keys()).filter(function (x) { return String(x).indexOf(DRAFT_PREFIX) === 0; });
      if (ks.length <= DRAFT_KEEP) return;
      var recs = [];
      for (var i = 0; i < ks.length; i++) {
        var v = await k.get(ks[i]);
        recs.push({ key: ks[i], at: String((v && v.at) || "") });
      }
      recs.sort(function (a, b) { return a.at.localeCompare(b.at); });
      recs.slice(0, recs.length - DRAFT_KEEP).forEach(function (r) { try { k.delete(r.key); } catch (e) {} });
    } catch (e) {}
  }

  // The drafts, for `/rtfm mine`: what has been typed here and not saved, newest first. The editor is
  // the only thing that knows about them, so it is the thing that answers.
  async function draftList() {
    var k = store();
    if (!k) return [];
    try {
      var ks = (await k.keys()).filter(function (x) { return String(x).indexOf(DRAFT_PREFIX) === 0; });
      var out = [];
      for (var i = 0; i < ks.length; i++) {
        var v = await k.get(ks[i]);
        if (!v || typeof v !== "object") continue;
        out.push({
          id: String(ks[i]).slice(DRAFT_PREFIX.length), fresh: !!v.fresh,
          chars: String(v.body || "").length, at: String(v.at || ""), age: draftAge(v.at)
        });
      }
      out.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
      return out;
    } catch (e) { return []; }
  }

  // ---- opening --------------------------------------------------------------

  async function openEdit(id) {
    wire();
    if (!el) return "THE EDITOR IS NOT IN THE PAGE (src/js/rtfm-edit.js AND ITS MARKUP DID NOT LOAD).";
    if (!window.rtfm) return "THE READER IS OFFLINE (src/js/rtfm.js DID NOT LOAD).";
    var got = await window.rtfm.read(id);
    if (!got) return "THE RTFM HAS NOTHING CALLED \"" + upper(id) + "\" :: /rtfm LISTS THE PAGES, /rtfm new <NAME> STARTS ONE.";
    if (got.error) return "THAT PAGE COULD NOT BE READ :: " + got.error;
    var d = got.doc;
    if (d.generated) return "\"" + upper(d.title) + "\" IS GENERATED FROM " + d.from + " AND CANNOT BE REWRITTEN HERE :: /rtfm new <NAME> STARTS A PAGE OF YOUR OWN.";
    cur = { id: d.id, title: d.title, shadows: d.shadows || "", local: !!d.local, generated: false, fresh: false };
    idEl.value = d.id;
    titleEl.value = d.title || "";
    tagsEl.value = (d.tags || []).join(", ");
    descEl.value = d.desc || "";
    bodyEl.value = got.text || "";
    takeSnap();                       // the page as it is on disk, before any draft is put back
    draftSweep();
    var restored = await draftRestore(d.id);
    finishOpen(!!restored);
    return "OPENING \"" + upper(d.title || d.id) + "\" IN THE EDITOR :: "
      + (d.local
        ? (d.shadows ? "YOUR COPY - IT SHADOWS src/rtfm/" + d.shadows + " ON THIS DEVICE" : "WRITTEN HERE - THIS DEVICE ONLY")
        : "THE SHIPPED FILE " + rtfmDir() + d.file)
      + "\nCTRL+S SAVES, ESC CLOSES" + (d.generated ? "" : " :: /rtfm " + upper(d.id) + " READS IT, /rtfm mine LISTS WHAT YOU HAVE WRITTEN")
      + (restored ? "\n" + restored : "");
  }

  function rtfmDir() { return "src/rtfm/"; }

  async function openNew(id, title) {
    wire();
    if (!el) return "THE EDITOR IS NOT IN THE PAGE (src/js/rtfm-edit.js AND ITS MARKUP DID NOT LOAD).";
    cur = { id: "", title: "", shadows: "", local: false, generated: false, fresh: true };
    idEl.value = id || "untitled";
    titleEl.value = title || "";
    tagsEl.value = "";
    descEl.value = "";
    bodyEl.value = "# " + (title || id ? upper(title || id) : "A PAGE OF MY OWN") + "\n\n";
    takeSnap();                       // the page as it starts, before any draft is put back
    draftSweep();
    var restored = await draftRestore(window.rtfm ? window.rtfm.slug(idEl.value) : idEl.value);
    finishOpen(!!restored);
    return "THE EDITOR IS OPEN ON A NEW PAGE" + (id ? " :: " + upper(id) : " :: GIVE IT A NAME (LETTERS, NUMBERS, HYPHENS)")
      + "\nIT IS KEPT IN THIS BROWSER (kv), NEVER IN src/ :: CTRL+S SAVES, ESC CLOSES TAKES NOTHING WITH IT IF THERE IS UNSAVED WORK"
      + " :: THE TITLE LINE IS DROPPED WHEN THE PAGE IS PRINTED, BECAUSE THE HEADING IS DRAWN FROM THE TITLE FIELD"
      + (restored ? "\n" + restored : "");
  }

  // ---- saving ---------------------------------------------------------------

  async function save() {
    if (!shown || !window.rtfm) return;
    var key = window.rtfm.slug(idEl.value);
    if (!key) { note("A PAGE NEEDS A NAME :: LETTERS, NUMBERS AND HYPHENS (e.g. blood-rites).", true); idEl.focus(); return; }
    // A NEW page that takes a shipped page's name does not overwrite anything - it SHADOWS it here,
    // which is a fine thing to want and a bad thing to do by accident, so it is asked once.
    if (!cur || cur.fresh) {
      var sd = window.rtfm.findShipped(key);
      if (sd && sd.generated) { note("THE CHEATSHEET IS GENERATED FROM src/commands/commands.json AND CANNOT BE REWRITTEN HERE :: GIVE THIS PAGE ANOTHER NAME.", true); return; }
      if (sd && armed !== "shadow") {
        armed = "shadow";
        note("THERE IS A SHIPPED PAGE CALLED \"" + upper(sd.title) + "\" (" + key + ") :: PRESS SAVE AGAIN TO KEEP YOURS ALONGSIDE IT AND SHADOW IT HERE, OR GIVE THIS ONE ANOTHER NAME.", true);
        return;
      }
    }
    armed = "";
    note("SAVING...");
    if (tDraft) { window.clearTimeout(tDraft); tDraft = 0; }
    var res = await window.rtfm.save({
      id: key, title: titleEl.value, tags: splitTags(tagsEl.value), desc: descEl.value, body: bodyEl.value
    }, (cur && !cur.fresh) ? cur.id : "");
    if (!res || !res.ok) { note("NOT SAVED :: " + ((res && res.error) || "THE STORE SAID NOTHING"), true); return; }
    cur = { id: res.id, title: res.title, shadows: res.shadows, local: true, generated: false, fresh: false };
    idEl.value = res.id;
    if (!norm(titleEl.value)) titleEl.value = upper(res.title || res.id);
    draftClear();
    takeSnap();
    paintChrome();
    paintCount();
    note("SAVED :: " + res.id + " :: " + res.bytes + " CHARACTERS, " + res.lines + " LINES :: "
      + (res.shadows ? "YOUR COPY SHADOWS " + rtfmDir() + res.shadows + " ON THIS DEVICE" : "KEPT IN THIS BROWSER"), false);
    say("RTFM :: SAVED \"" + upper(res.title || res.id) + "\" (" + res.id + "), " + res.bytes + " CHARACTERS :: "
      + (res.shadows
        ? "YOUR COPY SHADOWS " + rtfmDir() + res.shadows + " ON THIS DEVICE - THE SHIPPED FILE IS UNTOUCHED, AND /rtfm rm " + upper(res.id) + " PUTS IT BACK IN FORCE"
        : "KEPT IN THIS BROWSER ONLY, NOT IN src/ - /rtfm export " + upper(res.id) + " DOWNLOADS IT AS MARKDOWN")
      + " :: /rtfm " + upper(res.id) + " READS IT.");
  }

  // ---- dropping -------------------------------------------------------------

  async function revert() {
    if (!shown || !cur || !cur.shadows) { note("THIS PAGE HAS NO SHIPPED FILE UNDER IT :: THERE IS NOTHING TO PUT BACK. A PAGE OF YOUR OWN IS DROPPED WITH DELETE.", true); return; }
    if (armed !== "revert") {
      armed = "revert";
      note("PRESS REVERT AGAIN TO DROP YOUR COPY AND PUT " + rtfmDir() + cur.shadows + " BACK IN FORCE HERE. YOUR VERSION (" + bodyEl.value.length + " CHARACTERS) IS KEPT NOWHERE ELSE.", true);
      return;
    }
    armed = "";
    var res = await window.rtfm.drop(cur.id);
    if (!res || !res.ok) { note("NOT REVERTED :: " + ((res && res.error) || "THE STORE SAID NOTHING"), true); return; }
    draftClear();
    var got = await window.rtfm.read(res.id);
    if (got && !got.error && got.doc) {
      var d = got.doc;
      cur = { id: d.id, title: d.title, shadows: d.shadows || "", local: !!d.local, generated: false, fresh: false };
      titleEl.value = d.title || "";
      tagsEl.value = (d.tags || []).join(", ");
      descEl.value = d.desc || "";
      bodyEl.value = got.text || "";
    }
    takeSnap();
    paintChrome();
    paintCount();
    paintPreview();
    note("REVERTED :: " + rtfmDir() + res.backTo + " IS IN FORCE AGAIN HERE. THE FILE WAS NEVER TOUCHED.", false);
    say("RTFM :: REVERTED \"" + upper(res.title) + "\" :: " + rtfmDir() + res.backTo + " IS IN FORCE AGAIN ON THIS DEVICE.");
  }

  async function del() {
    if (!shown || !cur || cur.fresh || !cur.local || cur.shadows) {
      note("NOTHING OF YOURS TO DROP HERE :: A PAGE OF YOUR OWN IS DROPPED WITH DELETE, A SHIPPED ONE YOU REWROTE WITH REVERT, AND A NEW ONE JUST CLOSES.", true);
      return;
    }
    if (armed !== "delete") {
      armed = "delete";
      note("PRESS DELETE AGAIN TO DROP \"" + upper(cur.title || cur.id) + "\" FROM THIS DEVICE. IT IS KEPT IN THIS BROWSER AND NOWHERE ELSE - /rtfm export " + upper(cur.id) + " FIRST IF YOU WANT IT AS A FILE.", true);
      return;
    }
    armed = "";
    var res = await window.rtfm.drop(cur.id);
    if (!res || !res.ok) { note("NOT DROPPED :: " + ((res && res.error) || "THE STORE SAID NOTHING"), true); return; }
    var title = res.title, id = res.id, bytes = res.bytes;
    draftClear();
    reallyClose();
    say("RTFM :: DROPPED \"" + upper(title) + "\" (" + id + "), " + bytes + " CHARACTERS :: IT WAS KEPT ONLY IN THIS BROWSER, SO NOTHING OF IT IS LEFT ON THIS DEVICE.");
  }

  // ---- closing --------------------------------------------------------------

  function requestClose() {
    if (!shown) return;
    if (dirty() && armed !== "cancel") {
      armed = "cancel";
      note("UNSAVED WORK :: PRESS CANCEL AGAIN TO THROW IT AWAY, OR SAVE. (A DRAFT OF IT IS KEPT FOR THIS PAGE IN THIS BROWSER, SO A RELOAD WOULD NOT LOSE IT - BUT THROWING IT AWAY HERE DOES.)", true);
      return;
    }
    if (dirty()) draftClear();
    reallyClose();
  }

  function reallyClose() {
    if (!el) return;
    if (tDraft) { window.clearTimeout(tDraft); tDraft = 0; }
    el.hidden = true;
    shown = false;
    cur = null;
    snap = "";
    armed = "";
    note("");
    try { document.getElementById("userInput").focus(); } catch (e) {}
  }

  wire();

  return {
    open: openEdit,
    openEdit: openEdit,
    openNew: openNew,
    isOpen: function () { return shown; },
    close: function () { if (shown) requestClose(); },
    save: save,
    revert: revert,
    drop: del,
    drafts: draftList,
    body: function () { return bodyEl ? bodyEl.value : ""; },
    note: note
  };
})();
